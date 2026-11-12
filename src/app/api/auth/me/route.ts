import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserById, getUserPortfolios, getUserTransactions, getStocks, getUserTeam } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const portfolios = await getUserPortfolios(user.id);
  const transactions = await getUserTransactions(user.id);
  const stocks = await getStocks();
  const stocksMap = new Map(stocks.map((s) => [s.id, s]));

  // Calculate metrics
  let totalHoldingsValue = 0;
  let totalCostBasis = 0;
  let todayPnl = 0;

  for (const p of portfolios) {
    const stock = stocksMap.get(p.stock_id);
    const price = stock ? stock.current_price : p.avg_buy_price;
    const prevClose = stock ? stock.previous_close : price;
    const val = p.shares_count * price;
    const cost = p.shares_count * p.avg_buy_price;
    totalHoldingsValue += val;
    totalCostBasis += cost;
    todayPnl += p.shares_count * (price - prevClose);
  }

  const netWorth = user.balance + totalHoldingsValue;
  const initialCapital = 1000000;
  const totalReturn = netWorth - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;
  const todayPnlPercent = netWorth > 0 ? (todayPnl / netWorth) * 100 : 0;

  const team = await getUserTeam(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      ecoin_balance: user.ecoin_balance,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      created_at: user.created_at,
      assigned_admin_id: user.assigned_admin_id,
      assigned_admin_name: user.assigned_admin_name,
      group_name: user.group_name,
      team_id: team?.id || user.team_id,
      team_name: team?.name || user.team_name,
      is_team_leader: team?.leader_id === user.id || user.is_team_leader,
    },
    team: team || null,
    metrics: {
      totalNetWorth: netWorth,
      availableCash: user.balance,
      totalHoldingsValue,
      todayPnl,
      todayPnlPercent,
      totalReturn,
      totalReturnPercent,
    },
    portfolios,
    transactions: transactions.slice(0, 15),
  });
}
