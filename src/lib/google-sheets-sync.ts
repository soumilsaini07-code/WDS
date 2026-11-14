/**
 * Live Google Sheets Automation Sync Engine
 * Real-time event streaming for Wolf of Dalal Street
 */

export const GOOGLE_SHEETS_WEBHOOK_URL =
  process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
  'https://script.google.com/macros/s/AKfycbxVs6ufIy72aD66SIJH8_AcGICtULJ2TGRbIaQz8ysVkXMb6xh_ElAT2wR2FxR4fdDp/exec';

export interface TradeSyncRecord {
  tradeId?: string;
  sellerTeam: string;
  buyerTeam: string;
  ticker: string;
  quantity: number;
  agreedPrice: number;
  grossDealValue: number;
  buyerBrokerage?: number;
  sellerBrokerage?: number;
  totalEconCommission?: number;
  totalBuyerDebit?: number;
  totalSellerCredit?: number;
  dealsCount?: number;
}

export interface IpoSyncRecord {
  subscriptionId: string;
  teamName: string;
  ticker: string;
  lots: number;
  shares: number;
  issuePrice: number;
  totalAmount: number;
  status: string;
  timestamp?: string;
}

/**
 * Push an approved secondary trade slip to Google Sheets immediately.
 * Executed in background (fire-and-forget) to ensure 0ms latency for brokers.
 */
export function pushTradeToGoogleSheets(trade: TradeSyncRecord) {
  const timestamp = new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const row = [
    trade.tradeId || `SLIP-${Date.now().toString().slice(-6)}`,
    timestamp,
    trade.buyerTeam,
    trade.sellerTeam,
    trade.ticker,
    trade.quantity,
    trade.agreedPrice,
    trade.grossDealValue,
    trade.buyerBrokerage ?? 0,
    trade.sellerBrokerage ?? 0,
    trade.totalBuyerDebit ?? trade.grossDealValue,
    trade.totalSellerCredit ?? trade.grossDealValue,
    trade.totalEconCommission ?? 0,
    trade.dealsCount ? `Deal #${trade.dealsCount}` : 'Approved',
  ];

  fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sheetName: 'Live_Trades',
      action: 'APPEND_TRADE',
      row,
      trade,
    }),
    redirect: 'follow',
  })
    .then(async (res) => {
      if (!res.ok) {
        console.warn(`[GoogleSheetsSync] Trade sync responded with status: ${res.status}`);
      }
    })
    .catch((err) => {
      console.warn('[GoogleSheetsSync] Background sync error (Trade):', err.message);
    });
}

/**
 * Push an approved IPO application slip to Google Sheets immediately.
 */
export function pushIpoBidToGoogleSheets(ipo: IpoSyncRecord) {
  const timestamp =
    ipo.timestamp ||
    new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const row = [
    ipo.subscriptionId,
    timestamp,
    ipo.teamName,
    ipo.ticker,
    ipo.lots,
    ipo.shares,
    ipo.issuePrice,
    ipo.totalAmount,
    ipo.status || 'BID_PLACED',
  ];

  fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sheetName: 'IPO_Applications',
      action: 'APPEND_IPO',
      row,
      ipo,
    }),
    redirect: 'follow',
  })
    .then(async (res) => {
      if (!res.ok) {
        console.warn(`[GoogleSheetsSync] IPO sync responded with status: ${res.status}`);
      }
    })
    .catch((err) => {
      console.warn('[GoogleSheetsSync] Background sync error (IPO):', err.message);
    });
}
