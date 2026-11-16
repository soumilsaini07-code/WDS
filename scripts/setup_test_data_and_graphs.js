const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const CSV_FILE = path.join(DATA_DIR, 'dalal_street_trades.csv');
const EXCEL_STOCKS_FILE = path.join(DATA_DIR, 'Stocks_2026_final_updated.xlsx');

console.log('======================================================================');
console.log('CONFIGURING CLEAN DATA: GRAPH TRAJECTORIES, TEAM CLEANUP & SAMPLE TRADES');
console.log('======================================================================\n');

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// 1. Clean Teams: Retain ONLY authentic cohort teams (Remove team8, team14, trial, team17, team20, team21, Team S)
console.log('[1/4] Cleaning team list (removing temporary/ad-hoc team names)...');
const officialTeamNames = [
  'Apex Alpha Syndicate',
  'Dalal Street Titans',
  'Alpha Traders',
  'Beta Capital',
  'Gamma Bulls',
  'Delta Hedge',
  'Epsilon Syndicate',
  'Zeta Holdings',
  'Omega Quant',
  'Sigma Assets',
  'Theta Fund',
  'Vortex Capital',
  'Zenith Securities',
  'Central Primary Pool',
];

const cleanTeams = (db.teams || [])
  .filter((t) => officialTeamNames.includes(t.name))
  .map((t) => {
    const isPool = t.name.toLowerCase().includes('primary pool');
    return {
      ...t,
      balance: isPool ? 10000000 : 1000000, // ₹10L starting budget, ₹1 Cr for Primary pool
    };
  });

console.log(`  ✓ Retained ${cleanTeams.length} official cohort teams:`);
cleanTeams.forEach((t, i) => console.log(`     ${i + 1}. ${t.name} (${t.code}) - Budget: ₹${(t.balance / 100000).toFixed(1)}L`));

// 2. Load 78 Stocks from Excel & Generate Realistic 6-Point Intraday Curves
console.log('\n[2/4] Generating realistic historical price graphs for all 78 stocks...');
const wb = XLSX.readFile(EXCEL_STOCKS_FILE);
const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const enrichedStocks = [];
for (let i = 0; i < Math.min(78, db.stocks.length); i++) {
  const stock = db.stocks[i];
  const row = excelRows[i] || {};
  const currentP = typeof row['Current Price'] === 'number' ? Number(row['Current Price'].toFixed(2)) : stock.current_price;
  const sector = (row['Sector'] || stock.sector || 'Equities').trim();

  // Pseudo-random deterministic hash based on ticker characters for natural variance
  const hash = stock.ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const trendSign = hash % 2 === 0 ? 1 : -1;
  const variancePct = 0.008 + ((hash % 10) * 0.001); // 0.8% - 1.7% variance

  // Generate 6 smooth historical points leading up to current price
  const p0 = Number((currentP * (1 - trendSign * variancePct)).toFixed(2));
  const p1 = Number((currentP * (1 - trendSign * variancePct * 0.6 + (hash % 3) * 0.002)).toFixed(2));
  const p2 = Number((currentP * (1 + trendSign * variancePct * 0.4 - (hash % 4) * 0.002)).toFixed(2));
  const p3 = Number((currentP * (1 - trendSign * variancePct * 0.2 + (hash % 5) * 0.001)).toFixed(2));
  const p4 = Number((currentP * (1 + trendSign * variancePct * 0.1)).toFixed(2));
  const p5 = currentP;

  const history = [p0, p1, p2, p3, p4, p5];
  const minPrice = Math.min(...history);
  const maxPrice = Math.max(...history);
  const change = Number((currentP - p0).toFixed(2));
  const changePercent = Number(((change / p0) * 100).toFixed(2));

  enrichedStocks.push({
    ...stock,
    current_price: currentP,
    previous_close: p0,
    day_high: Math.max(maxPrice, typeof row['52 Week high'] === 'number' ? row['52 Week high'] : currentP),
    day_low: Math.min(minPrice, typeof row['52 Week low'] === 'number' ? row['52 Week low'] : currentP),
    lower_circuit: Number((currentP * 0.90).toFixed(2)),
    upper_circuit: Number((currentP * 1.10).toFixed(2)),
    historical_prices: history,
    change,
    change_percent: changePercent,
    is_frozen: false,
    sector,
  });
}
console.log(`  ✓ Generated 6-point interactive trajectories for all ${enrichedStocks.length} equities`);

// 3. Create a Small Set of Realistic Initial Trades
console.log('\n[3/4] Creating realistic initial trade entries (3 sample executed trades)...');
const txTime = new Date().toISOString();
const teamApex = cleanTeams.find((t) => t.name === 'Apex Alpha Syndicate');
const teamTitans = cleanTeams.find((t) => t.name === 'Dalal Street Titans');
const teamAlpha = cleanTeams.find((t) => t.name === 'Alpha Traders');
const teamVortex = cleanTeams.find((t) => t.name === 'Vortex Capital');
const pool = cleanTeams.find((t) => t.name === 'Central Primary Pool');

const relianceStock = enrichedStocks.find((s) => s.ticker === 'RELIANCE') || enrichedStocks[0];
const infyStock = enrichedStocks.find((s) => s.ticker === 'INFY') || enrichedStocks[1];
const zomatoStock = enrichedStocks.find((s) => s.ticker === 'ZOMATO') || enrichedStocks[2];

// Trade 1: Apex buys 150 RELIANCE @ 1164.90 from Primary Pool (0% primary brokerage)
const t1Qty = 150;
const t1Price = relianceStock.current_price;
const t1Gross = Number((t1Qty * t1Price).toFixed(2));
teamApex.balance = Number((teamApex.balance - t1Gross).toFixed(2));
pool.balance = Number((pool.balance + t1Gross).toFixed(2));

// Trade 2: Titans buys 120 INFY @ 1185.00 from Primary Pool (0% primary brokerage)
const t2Qty = 120;
const t2Price = infyStock.current_price;
const t2Gross = Number((t2Qty * t2Price).toFixed(2));
teamTitans.balance = Number((teamTitans.balance - t2Gross).toFixed(2));
pool.balance = Number((pool.balance + t2Gross).toFixed(2));

// Trade 3: Alpha Traders buys 100 ZOMATO @ 350.00 from Vortex Capital (Dual 5% brokerage = 5% buyer + 5% seller)
const t3Qty = 100;
const t3Price = 350.00;
const t3Gross = Number((t3Qty * t3Price).toFixed(2));
const t3BuyerFee = Number((t3Gross * 0.05).toFixed(2));
const t3SellerFee = Number((t3Gross * 0.05).toFixed(2));
teamAlpha.balance = Number((teamAlpha.balance - (t3Gross + t3BuyerFee)).toFixed(2));
teamVortex.balance = Number((teamVortex.balance + (t3Gross - t3SellerFee)).toFixed(2));

// Update ZOMATO live price to 350.00 and add to history
zomatoStock.current_price = t3Price;
zomatoStock.change = Number((t3Price - zomatoStock.previous_close).toFixed(2));
zomatoStock.change_percent = Number(((zomatoStock.change / zomatoStock.previous_close) * 100).toFixed(2));
zomatoStock.historical_prices.push(t3Price);

const sampleTransactions = [
  {
    id: 'tx-init-01-s',
    user_id: pool.leader_id || 'usr-pool',
    stock_id: relianceStock.id,
    type: 'SELL',
    quantity: t1Qty,
    price_at_trade: t1Price,
    gross_amount: t1Gross,
    brokerage: 0,
    net_amount: t1Gross,
    round_id: 'round-0',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'tx-init-01-b',
    user_id: teamApex.leader_id || 'usr-apex',
    stock_id: relianceStock.id,
    type: 'BUY',
    quantity: t1Qty,
    price_at_trade: t1Price,
    gross_amount: t1Gross,
    brokerage: 0,
    net_amount: t1Gross,
    round_id: 'round-0',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'tx-init-02-s',
    user_id: pool.leader_id || 'usr-pool',
    stock_id: infyStock.id,
    type: 'SELL',
    quantity: t2Qty,
    price_at_trade: t2Price,
    gross_amount: t2Gross,
    brokerage: 0,
    net_amount: t2Gross,
    round_id: 'round-0',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'tx-init-02-b',
    user_id: teamTitans.leader_id || 'usr-titans',
    stock_id: infyStock.id,
    type: 'BUY',
    quantity: t2Qty,
    price_at_trade: t2Price,
    gross_amount: t2Gross,
    brokerage: 0,
    net_amount: t2Gross,
    round_id: 'round-0',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'tx-init-03-s',
    user_id: teamVortex.leader_id || 'usr-vortex',
    stock_id: zomatoStock.id,
    type: 'SELL',
    quantity: t3Qty,
    price_at_trade: t3Price,
    gross_amount: t3Gross,
    brokerage: t3SellerFee,
    net_amount: t3Gross - t3SellerFee,
    round_id: 'round-0',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'tx-init-03-b',
    user_id: teamAlpha.leader_id || 'usr-alpha',
    stock_id: zomatoStock.id,
    type: 'BUY',
    quantity: t3Qty,
    price_at_trade: t3Price,
    gross_amount: t3Gross,
    brokerage: t3BuyerFee,
    net_amount: t3Gross + t3BuyerFee,
    round_id: 'round-0',
    timestamp: new Date().toISOString(),
  },
];

const samplePortfolios = [
  {
    id: 'port-apex-rel',
    user_id: teamApex.leader_id || 'usr-apex',
    stock_id: relianceStock.id,
    shares_count: t1Qty,
    avg_buy_price: t1Price,
    updated_at: txTime,
  },
  {
    id: 'port-titans-infy',
    user_id: teamTitans.leader_id || 'usr-titans',
    stock_id: infyStock.id,
    shares_count: t2Qty,
    avg_buy_price: t2Price,
    updated_at: txTime,
  },
  {
    id: 'port-alpha-zomato',
    user_id: teamAlpha.leader_id || 'usr-alpha',
    stock_id: zomatoStock.id,
    shares_count: t3Qty,
    avg_buy_price: t3Price,
    updated_at: txTime,
  },
];

// Set Latest Broadcast Trade for Dashboard Banner (showing recent inter-team trade)
const latestTrade = {
  id: 'trade-' + Date.now(),
  seller_team: teamVortex.name,
  buyer_team: teamAlpha.name,
  ticker: zomatoStock.ticker,
  stock_name: zomatoStock.name,
  quantity: t3Qty,
  price: t3Price,
  total_amount: t3Gross,
  timestamp: Date.now(),
};

// 4. Save Database & CSV Ledger
console.log('\n[4/4] Writing database state and CSV ledger...');
db.stocks = enrichedStocks;
db.teams = cleanTeams;
db.portfolios = samplePortfolios;
db.transactions = sampleTransactions;
db.order_slips = [];
db.round_settlements = {};
db.ipo_subscriptions = [];
db.latest_trade = latestTrade;

// Reset CSV with the 3 sample trades
const csvHeader = 'Slip ID,Timestamp,Team Name,Participant Name,Email,Stock Ticker,Stock Name,Order Type,Quantity,Price (INR),Total Consideration (INR),Executed By Admin,Status\n';
const r1 = `"P2P-1001-B","${txTime}","${teamApex.name}","Aaryan Verma","1025150050@thapar.edu","${relianceStock.ticker}","${relianceStock.name}","BUY",${t1Qty},${t1Price},${t1Gross},"admin.econ@thapar.edu","EXECUTED (Primary Pool Issuance)"\n`;
const r2 = `"P2P-1002-B","${txTime}","${teamTitans.name}","Trader_102203001","102203001@thapar.edu","${infyStock.ticker}","${infyStock.name}","BUY",${t2Qty},${t2Price},${t2Gross},"admin.econ@thapar.edu","EXECUTED (Primary Pool Issuance)"\n`;
const r3s = `"P2P-1003-S","${txTime}","${teamVortex.name}","Vortex Desk","vortex@thapar.edu","${zomatoStock.ticker}","${zomatoStock.name}","SELL",${t3Qty},${t3Price},${t3Gross},"admin.econ@thapar.edu","EXECUTED (P2P Sold to ${teamAlpha.name})"\n`;
const r3b = `"P2P-1003-B","${txTime}","${teamAlpha.name}","Alpha Desk","alpha@thapar.edu","${zomatoStock.ticker}","${zomatoStock.name}","BUY",${t3Qty},${t3Price},${t3Gross},"admin.econ@thapar.edu","EXECUTED (P2P Bought from ${teamVortex.name})"\n`;

fs.writeFileSync(CSV_FILE, csvHeader + r1 + r2 + r3s + r3b, 'utf8');
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
fs.writeFileSync(DB_BACKUP_FILE, JSON.stringify(db, null, 2), 'utf8');

console.log('  ✓ Saved db.json, db.backup.json, and dalal_street_trades.csv');

console.log('\n======================================================================');
console.log('🎉 INITIALIZATION COMPLETE: CLEAN TEAMS, GRAPHS & SAMPLE TRADES READY!');
console.log('======================================================================\n');
