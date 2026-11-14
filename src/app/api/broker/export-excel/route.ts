import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = computeBrokerLedgerSnapshot();

    // 1. Sheet 1: Team Purses & Elimination Audit
    const teamRows = snapshot.teamsPurse.map((tp) => ({
      'Team ID': tp.teamId,
      'Team Code': tp.teamCode,
      'Team Name': tp.teamName,
      'Leader Name': tp.leaderName,
      'Leader Email': tp.leaderEmail,
      'Initial Purse (INR)': tp.initialPurse,
      'Round 0 Spent (INR)': tp.round0Spent,
      'R0 Deployed %': `${tp.round0DeployedPercent}%`,
      'R0 60% Rule (Target >= 60L)': tp.round0Met60Percent ? 'QUALIFIED' : 'ELIMINATION_RISK',
      'R0 Shortfall to 60% (INR)': tp.round0Shortfall,
      'Current Cash Balance (INR)': tp.currentCash,
      'Cash Reserve %': `${tp.cashReservePercent}%`,
      '10% Cash Rule (Floor >= 10L)': tp.cashMet10PercentFloor ? 'HEALTHY' : 'LOW_CASH_WARNING',
      'Stock Holdings Value (INR)': tp.totalHoldingsValue,
      'Total Net Worth (INR)': tp.totalNetWorth,
      'Total Trades': tp.tradesCount,
      'Overall Status': tp.status,
    }));

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
      'Buyer 5% Brokerage (INR)': row.buyerBrokerage,
      'Seller 5% Brokerage (INR)': row.sellerBrokerage,
      'Total Buyer Outflow (INR)': row.buyerTotalDebit,
      'Total Seller Proceeds (INR)': row.sellerNetCredit,
      'Econ Desk 10% Fee (INR)': row.deskCommission,
      'Round 0 Exemption': row.isRound0Exempt ? 'YES (Waived)' : 'NO (5% Applied)',
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
