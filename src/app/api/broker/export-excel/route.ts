import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';
import {
  reconcileTeamsFromSupabase,
  reconcilePortfoliosFromSupabase,
  reconcileTransactionsFromSupabase,
  reconcileClockFromSupabase,
  reconcileIPOFromSupabase,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await Promise.allSettled([
        reconcileTeamsFromSupabase(),
        reconcilePortfoliosFromSupabase(),
        reconcileTransactionsFromSupabase(),
        reconcileClockFromSupabase(),
        reconcileIPOFromSupabase(),
      ]);
    } catch {}

    const snapshot = computeBrokerLedgerSnapshot();

    // 1. Sheet 1: Team Purses & Elimination Audit
    const teamRows = snapshot.teamsPurse.map((tp) => {
      const teamIpoWins = (snapshot.ipoSubscriptions || []).filter(
        (s) =>
          (s.team_id === tp.teamId || s.team_name === tp.teamName) &&
          (s.status === 'ALLOTTED' || (s.lots_allotted && s.lots_allotted > 0))
      );
      const ipoSummary =
        teamIpoWins
          .map((w) => {
            const l = (snapshot.ipoListings || []).find((x) => x.id === w.ipo_id);
            return `${l?.ticker || 'IPO'}: ${w.lots_allotted || w.lots_requested} Lots (${w.share_quantity} shares)`;
          })
          .join(' | ') || 'None';

      return {
        'Team ID': tp.teamId,
        'Team Code': tp.teamCode,
        'Team Name': tp.teamName,
        'Leader Name': tp.leaderName,
        'Leader Email': tp.leaderEmail,
        'Total Budget (INR)': tp.initialPurse,
        'Round 0 Spent (INR)': tp.round0Spent,
        'R0 Deployed %': `${tp.round0DeployedPercent}%`,
        'R0 60% Rule (Target >= 6L)': tp.round0Met60Percent ? 'QUALIFIED' : 'ELIMINATED',
        'R0 Shortfall to 60% (INR)': tp.round0Shortfall,
        'In-Hand Cash Balance (INR)': tp.currentCash,
        'In-Hand Cash Reserve %': `${tp.cashReservePercent}%`,
        '10% In-Hand Cash Rule (Floor >= 1L)': tp.cashMet10PercentFloor ? 'QUALIFIED' : 'ELIMINATED',
        'Stock Holdings Value (INR)': tp.totalHoldingsValue,
        'Total Net Worth (INR)': tp.totalNetWorth,
        'IPO Allotments Won': ipoSummary,
        'Total Trades': tp.tradesCount,
        'Elimination Details': (tp.eliminationReasons || []).join(' | ') || 'None (Compliant)',
        'Overall Status': tp.status,
      };
    });

    // 2. Sheet 2: Trades Master Ledger
    const tradeRows = snapshot.tradesLedger.map((row) => ({
      'Slip ID': row.slipId,
      'Timestamp': row.timestamp,
      'Round ID': row.roundId,
      'Buyer Team': row.buyerTeam,
      'Seller Team': row.sellerTeam,
      'Security Ticker': row.ticker,
      'Company Name': row.stockName,
      'Quantity (Shares)': row.quantity,
      'Agreed Price (INR)': row.price,
      'Gross Consideration (INR)': row.grossAmount,
      'Buyer 1% Brokerage (INR)': row.buyerBrokerage,
      'Seller 1% Brokerage (INR)': row.sellerBrokerage,
      'Total Buyer Outflow (INR)': row.buyerTotalDebit,
      'Total Seller Proceeds (INR)': row.sellerNetCredit,
      'Econ Desk 2% Fee (INR)': row.deskCommission,
      'Round 0 Exemption': row.isRound0Exempt ? 'YES (Waived)' : 'NO (1% Applied)',
      'Status': row.status,
    }));

    // 3. Sheet 3: Holdings Matrix
    const stockTickers = snapshot.holdingsMatrix.stocks.map((s) => s.ticker);
    const matrixRows = snapshot.holdingsMatrix.teams.map((t) => {
      const row: Record<string, any> = {
        'Team Code': t.teamCode,
        'Team Name': t.teamName,
      };
      stockTickers.forEach((ticker) => {
        row[ticker] = t.holdings[ticker] || 0;
      });
      row['Total Portfolio Value (INR)'] = t.totalValue;
      return row;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    const wsTeams = XLSX.utils.json_to_sheet(teamRows);
    XLSX.utils.book_append_sheet(wb, wsTeams, 'Team_Purses_And_Elimination');

    const wsTrades = XLSX.utils.json_to_sheet(tradeRows);
    XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades_Master_Ledger');

    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Stock_Holdings_Matrix');

    // 4. Sheet 4: IPO Subscriptions & Applications Ledger
    const ipoRows = (snapshot.ipoSubscriptions || []).map((sub) => {
      const listing = (snapshot.ipoListings || []).find((l) => l.id === sub.ipo_id);
      const isAllotted = sub.status === 'ALLOTTED' || (sub.lots_allotted && sub.lots_allotted > 0);
      const lotsWon = sub.lots_allotted ?? (isAllotted ? sub.lots_requested : 0);
      const sharesWon = isAllotted ? (sub.share_quantity || lotsWon * (listing?.lot_size || 1)) : 0;
      const considerationDeducted = isAllotted ? sub.total_amount : 0;

      return {
        'Subscription ID': sub.id,
        'IPO Ticker': listing?.ticker || sub.ipo_id,
        'Company Name': listing?.company_name || 'Primary Issue',
        'Team Name': sub.team_name,
        'Lots Applied': sub.lots_requested,
        'Lots Allotted': lotsWon,
        'Shares Allotted': sharesWon,
        'Issue Price (INR)': sub.issue_price,
        'Bid Total (INR)': sub.total_amount,
        'Cash Deducted (INR)': considerationDeducted,
        'Allotment Outcome': isAllotted ? `ALLOTTED (${lotsWon} Lots)` : sub.status === 'NOT_ALLOTTED' ? 'NOT ALLOTTED (REFUNDED)' : 'PENDING ALLOTMENT',
        'Timestamp': sub.created_at,
        'Status': sub.status,
      };
    });
    const wsIPO = XLSX.utils.json_to_sheet(ipoRows.length > 0 ? ipoRows : [{ 'Message': 'No IPO subscriptions placed yet.' }]);
    XLSX.utils.book_append_sheet(wb, wsIPO, 'IPO_Applications_Ledger');

    // 5. Sheet 5: Dedicated IPO Allotted Teams & Portfolio Crediting
    const allottedSubs = (snapshot.ipoSubscriptions || []).filter(
      (sub) => sub.status === 'ALLOTTED' || (sub.lots_allotted && sub.lots_allotted > 0)
    );
    const allottedRows = allottedSubs.map((sub) => {
      const listing = (snapshot.ipoListings || []).find((l) => l.id === sub.ipo_id);
      const matchingStock = snapshot.stocks.find((s) => s.ticker === listing?.ticker);
      const lotsWon = sub.lots_allotted ?? sub.lots_requested;
      const sharesCredited = sub.share_quantity || (lotsWon * (listing?.lot_size || 1));
      const costDeducted = sub.total_amount;
      const currentMarketPrice = matchingStock?.current_price || listing?.issue_price || sub.issue_price;
      const currentVal = Number((sharesCredited * currentMarketPrice).toFixed(2));
      const pnl = Number((currentVal - costDeducted).toFixed(2));

      return {
        'IPO Ticker': listing?.ticker || sub.ipo_id,
        'Company Name': listing?.company_name || 'Primary Equity',
        'Allotted Team': sub.team_name,
        'Lots Won': lotsWon,
        'Shares Credited': sharesCredited,
        'Issue Price (INR)': sub.issue_price,
        'Total Outflow Deducted (INR)': costDeducted,
        'Market / Listing Price (INR)': matchingStock?.current_price
          ? matchingStock.current_price
          : listing?.status === 'LISTED'
          ? listing.issue_price
          : 'Awaiting Secondary Listing',
        'Current Market Value (INR)': currentVal,
        'Unrealized Gain / Loss (INR)': pnl,
        'Ledger Status': 'CONFIRMED ALLOTMENT (CREDITED TO PORTFOLIO)',
        'Allotment Timestamp': sub.created_at,
      };
    });

    const wsAllotted = XLSX.utils.json_to_sheet(
      allottedRows.length > 0 ? allottedRows : [{ 'Message': 'No IPO allotments confirmed yet. Allotments take place once the bidding window closes.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsAllotted, 'IPO_Allotted_Teams');

    // Generate binary buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Dalal_Street_Event_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to export Excel workbook.' }, { status: 500 });
  }
}
