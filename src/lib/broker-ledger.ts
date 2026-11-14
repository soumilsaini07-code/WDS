import { getLocalDB, syncTeamPortfolioAndBalance } from './db';
import { Stock, Team } from './types';
import {
  INITIAL_PURSE_PER_TEAM,
  ROUND_0_MIN_DEPLOYMENT_RATIO,
  POST_ROUND_MIN_CASH_RATIO,
  TeamPurseRecord,
  TradeLedgerRow,
  BrokerLedgerSnapshot,
} from './broker-types';

export {
  INITIAL_PURSE_PER_TEAM,
  ROUND_0_MIN_DEPLOYMENT_RATIO,
  POST_ROUND_MIN_CASH_RATIO,
};
export type { TeamPurseRecord, TradeLedgerRow, BrokerLedgerSnapshot };

export function computeBrokerLedgerSnapshot(): BrokerLedgerSnapshot {
  const db = getLocalDB();
  const currentRoundId = db.current_round_id || 'round-0';
  const currentRound = (db.rounds || []).find((r) => r.id === currentRoundId);
  const currentRoundName = currentRound ? currentRound.name : currentRoundId.toUpperCase();

  const stocksMap = new Map<string, Stock>(db.stocks.map((s) => [s.id, s]));
  const stocksByTicker = new Map<string, Stock>(db.stocks.map((s) => [s.ticker.toUpperCase(), s]));

  // Ensure all teams are synced
  (db.teams || []).forEach((t) => syncTeamPortfolioAndBalance(t.id));

  // Build user-to-team map
  const userToTeamMap = new Map<string, Team>();
  (db.teams || []).forEach((team) => {
    userToTeamMap.set(team.leader_id, team);
    (team.members || []).forEach((m) => userToTeamMap.set(m.id, team));
  });
  db.users.forEach((u) => {
    if (u.team_id) {
      const team = db.teams?.find((t) => t.id === u.team_id || t.name.toLowerCase() === (u.team_name || '').toLowerCase());
      if (team) userToTeamMap.set(u.id, team);
    }
  });

  // Reconstruct Trades Master Ledger from BUY transactions
  const buyTransactions = db.transactions.filter((t) => t.type === 'BUY');
  const sellTransactions = db.transactions.filter((t) => t.type === 'SELL');

  let totalVolumeShares = 0;
  let totalGrossConsideration = 0;
  let totalDeskCommission = 0;

  const tradesLedger: TradeLedgerRow[] = buyTransactions.map((buyTx, idx) => {
    const stock = stocksMap.get(buyTx.stock_id) || stocksByTicker.get(buyTx.stock_id.toUpperCase());
    const buyerTeam = userToTeamMap.get(buyTx.user_id)?.name || 'Direct Buyer';

    // Match corresponding sell transaction around the same timestamp and stock
    const matchingSell = sellTransactions.find(
      (s) =>
        s.stock_id === buyTx.stock_id &&
        Math.abs(new Date(s.timestamp).getTime() - new Date(buyTx.timestamp).getTime()) < 3000 &&
        s.quantity === buyTx.quantity
    );
    const sellerTeam = matchingSell
      ? userToTeamMap.get(matchingSell.user_id)?.name || 'Secondary Seller'
      : (buyTx.round_id === 'round-0' ? 'Central Primary Pool' : 'Seller Desk');

    const qty = buyTx.quantity;
    const price = buyTx.price_at_trade || buyTx.price || (stock ? stock.current_price : 0);
    const gross = buyTx.gross_amount ?? Number((qty * price).toFixed(2));

    const isRound0Exempt =
      buyTx.round_id === 'round-0' ||
      sellerTeam === 'Central Primary Pool' ||
      sellerTeam.toLowerCase().includes('primary pool');

    const buyerBrokerage = isRound0Exempt ? 0 : (buyTx.brokerage ?? Number((gross * 0.05).toFixed(2)));
    const sellerBrokerage = isRound0Exempt ? 0 : (matchingSell?.brokerage ?? Number((gross * 0.05).toFixed(2)));
    const buyerTotalDebit = Number((gross + buyerBrokerage).toFixed(2));
    const sellerNetCredit = Number((gross - sellerBrokerage).toFixed(2));
    const deskCommission = Number((buyerBrokerage + sellerBrokerage).toFixed(2));

    totalVolumeShares += qty;
    totalGrossConsideration += gross;
    totalDeskCommission += deskCommission;

    return {
      slipId: `SLIP-${String(idx + 1).padStart(4, '0')}`,
      txId: buyTx.id,
      timestamp: buyTx.timestamp,
      roundId: buyTx.round_id || currentRoundId,
      buyerTeam,
      sellerTeam,
      ticker: stock ? stock.ticker : 'STOCK',
      stockName: stock ? stock.name : 'Unknown Security',
      quantity: qty,
      price,
      grossAmount: gross,
      buyerBrokerage,
      sellerBrokerage,
      buyerTotalDebit,
      sellerNetCredit,
      deskCommission,
      isRound0Exempt,
      status: 'EXECUTED' as const,
    };
  }).reverse(); // Latest trades first

  // Compile Team Purses & Elimination Analytics
  const teamsPurse: TeamPurseRecord[] = (db.teams || []).map((team) => {
    const teamUserIds = new Set<string>();
    teamUserIds.add(team.leader_id);
    (team.members || []).forEach((m) => teamUserIds.add(m.id));
    db.users.forEach((u) => {
      if (u.team_id === team.id || (u.team_name && u.team_name.toLowerCase() === team.name.toLowerCase())) {
        teamUserIds.add(u.id);
      }
    });

    // Round 0 cash spent
    const round0Buys = db.transactions.filter(
      (t) =>
        teamUserIds.has(t.user_id) &&
        t.type === 'BUY' &&
        t.round_id === 'round-0'
    );
    const round0Spent = round0Buys.reduce((acc, t) => {
      const amt = t.gross_amount ?? (t.quantity * (t.price_at_trade || 0));
      return acc + amt;
    }, 0);

    const round0DeployedPercent = Number(((round0Spent / INITIAL_PURSE_PER_TEAM) * 100).toFixed(2));
    const round0Target = INITIAL_PURSE_PER_TEAM * ROUND_0_MIN_DEPLOYMENT_RATIO; // 60 Lakhs
    const round0Met60Percent = round0Spent >= round0Target;
    const round0Shortfall = Math.max(0, Number((round0Target - round0Spent).toFixed(2)));

    // Team cash balance
    const currentCash = team.balance ?? INITIAL_PURSE_PER_TEAM;
    const cashReservePercent = Number(((currentCash / INITIAL_PURSE_PER_TEAM) * 100).toFixed(2));
    const cashFloorTarget = INITIAL_PURSE_PER_TEAM * POST_ROUND_MIN_CASH_RATIO; // 10 Lakhs
    const cashMet10PercentFloor = currentCash >= cashFloorTarget;

    // Team holdings
    const holdingsByStock: Record<string, number> = {};
    let totalHoldingsValue = 0;

    const teamPortfolios = db.portfolios.filter((p) => teamUserIds.has(p.user_id) && p.shares_count > 0);
    teamPortfolios.forEach((p) => {
      const stock = stocksMap.get(p.stock_id);
      if (stock) {
        holdingsByStock[stock.ticker] = (holdingsByStock[stock.ticker] || 0) + p.shares_count;
        totalHoldingsValue += p.shares_count * stock.current_price;
      }
    });

    const totalNetWorth = Number((currentCash + totalHoldingsValue).toFixed(2));
    const tradesCount = db.transactions.filter((t) => teamUserIds.has(t.user_id)).length;

    // Determine Strict Elimination Status
    // Rule 1: Must deploy at least 60% of 10L (₹6 Lakhs) in Round 0
    // Rule 2: Must maintain at least 10% of 10L (₹1 Lakh) in hand cash after each round
    const eliminationReasons: string[] = [];
    if (!round0Met60Percent) {
      eliminationReasons.push(`Failed 60% R0 Rule: Deployed ₹${(round0Spent / 100000).toFixed(2)}L / ₹6.00L (Shortfall: ₹${(round0Shortfall / 100000).toFixed(2)}L)`);
    }
    if (!cashMet10PercentFloor) {
      eliminationReasons.push(`Failed 10% Cash Rule: In-hand cash ₹${(currentCash / 100000).toFixed(2)}L is below ₹1.00L (10%) floor reserve`);
    }

    const status: 'QUALIFIED' | 'ELIMINATED' = eliminationReasons.length > 0 ? 'ELIMINATED' : 'QUALIFIED';

    return {
      teamId: team.id,
      teamName: team.name,
      teamCode: team.code,
      leaderName: team.leader_name,
      leaderEmail: team.leader_email,
      initialPurse: INITIAL_PURSE_PER_TEAM,
      currentCash,
      round0Spent: Number(round0Spent.toFixed(2)),
      round0DeployedPercent,
      round0Met60Percent,
      round0Shortfall,
      cashReservePercent,
      cashMet10PercentFloor,
      totalHoldingsValue: Number(totalHoldingsValue.toFixed(2)),
      totalNetWorth,
      tradesCount,
      status,
      eliminationReasons,
      holdingsByStock,
    };
  });

  // Holdings Matrix Data
  const matrixStocks = db.stocks.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    name: s.name,
    current_price: s.current_price,
  }));

  const matrixTeams = teamsPurse.map((tp) => ({
    teamId: tp.teamId,
    teamName: tp.teamName,
    teamCode: tp.teamCode,
    holdings: tp.holdingsByStock,
    totalValue: tp.totalHoldingsValue,
  }));

  return {
    currentRoundId,
    currentRoundName,
    roundClock: db.round_clock || { remaining_seconds: 900, is_paused: false, is_orders_locked: false },
    totalDealsSettled: tradesLedger.length,
    totalVolumeShares,
    totalGrossConsideration: Number(totalGrossConsideration.toFixed(2)),
    totalDeskCommission: Number(totalDeskCommission.toFixed(2)),
    teamsPurse,
    tradesLedger,
    stocks: db.stocks,
    holdingsMatrix: {
      stocks: matrixStocks,
      teams: matrixTeams,
    },
  };
}
