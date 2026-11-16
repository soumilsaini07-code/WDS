const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const CSV_FILE = path.join(DATA_DIR, 'dalal_street_trades.csv');
const EXCEL_STOCKS_FILE = path.join(DATA_DIR, 'Stocks_2026_final_updated.xlsx');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log');

console.log('======================================================================');
console.log('RESETTING WOLF OF DALAL STREET PLATFORM FOR FRESH DRY RUN');
console.log('======================================================================\n');

// 1. Read existing db.json to preserve user credentials & real cohort teams
if (!fs.existsSync(DB_FILE)) {
  console.error('db.json not found!');
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// 2. Read official 78 stocks from Stocks_2026_final_updated.xlsx
console.log('[1/7] Loading official 78 stocks from Stocks_2026_final_updated.xlsx...');
const wb = XLSX.readFile(EXCEL_STOCKS_FILE);
const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

if (excelRows.length !== 78) {
  console.warn(`Warning: Expected 78 rows, found ${excelRows.length}`);
}

// Map existing 78 stocks in db to clean initial values from Excel
const cleanStocks = [];
for (let i = 0; i < Math.min(78, db.stocks.length); i++) {
  const stock = db.stocks[i];
  const row = excelRows[i] || {};
  const basePrice = typeof row['Current Price'] === 'number' ? Number(row['Current Price'].toFixed(2)) : stock.current_price;
  const high = typeof row['52 Week high'] === 'number' ? Number(row['52 Week high'].toFixed(2)) : Number((basePrice * 1.1).toFixed(2));
  const low = typeof row['52 Week low'] === 'number' ? Number(row['52 Week low'].toFixed(2)) : Number((basePrice * 0.9).toFixed(2));
  const sector = (row['Sector'] || stock.sector || 'Equities').trim();

  cleanStocks.push({
    ...stock,
    current_price: basePrice,
    previous_close: basePrice,
    day_high: basePrice,
    day_low: basePrice,
    lower_circuit: Number((basePrice * 0.90).toFixed(2)),
    upper_circuit: Number((basePrice * 1.10).toFixed(2)),
    historical_prices: [basePrice],
    change: 0,
    change_percent: 0,
    is_frozen: false,
    sector,
  });
}
console.log(`  ✓ Loaded and normalized ${cleanStocks.length} official stocks with clean baseline LTP & ±10% collars`);

// 3. Reset Rounds to Round 0 Active
console.log('[2/7] Resetting Competition Rounds to Round 0 (Initial Purchase Session)...');
const cleanRounds = [
  {
    id: 'round-0',
    index: 0,
    name: 'Round 0: Initial Purchase Session',
    type: 'PRIMARY_DESK',
    status: 'ACTIVE',
    duration_minutes: 30,
    description: 'Initial stock purchase from predetermined universe of ~50 stocks. Unlimited supply from Econ desk.',
    rules_note: 'Mandatory 60% Deployment: Each team must invest at least ₹6,00,000 in this session. Unspent cash carries forward.',
  },
  {
    id: 'round-1',
    index: 1,
    name: 'Round 1: Inter-Team Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20,
    description: 'First floor trading session. Teams negotiate and execute trades mutually using physical signed trade slips.',
    rules_note: 'Live price uses quantity-weighted average of latest 3 trades. End-of-round cash check: minimum ₹1,00,000 required.',
  },
  {
    id: 'round-2',
    index: 2,
    name: 'Round 2: Inter-Team Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20,
    description: 'Trading continues under Round 2 opening prices after News 2 and R% adjustments.',
    rules_note: 'Trading via signed trade slips. Binding agreement once signed. End-of-round cash floor: ₹1,00,000.',
  },
  {
    id: 'ipo-1',
    index: 3,
    name: 'IPO Round 1: Tech Unicorn Primary Offering',
    type: 'IPO',
    status: 'UPCOMING',
    duration_minutes: 10,
    description: 'Primary market offering. Teams submit lot demand; smooth listing formula determines post-IPO price.',
    rules_note: 'Smooth Listing Formula: P_listing = P0 × (0.7 + 0.6S/(1+S)). Undersubscribed IPO gives every requesting team 1 lot.',
  },
  {
    id: 'round-3',
    index: 4,
    name: 'Round 3: Multi-Sector Expansion & IPO Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20,
    description: 'Secondary floor trading resumes, now including newly listed IPO 1 stock.',
    rules_note: '5% dual brokerage on P2P trades. Quantity-weighted 3-trade rolling price rule active.',
  },
  {
    id: 'ipo-2',
    index: 5,
    name: 'IPO Round 2: Green Energy Conglomerate Offering',
    type: 'IPO',
    status: 'UPCOMING',
    duration_minutes: 10,
    description: 'Second primary market IPO window. Teams submit lot applications.',
    rules_note: 'Listing price determined by aggregate subscription ratio S = D / L.',
  },
  {
    id: 'round-4',
    index: 6,
    name: 'Round 4: High Beta Floor Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20,
    description: 'High volatility secondary trading session with breaking news adjustments.',
    rules_note: 'Valid slips received by round cutoff processed after close to establish next price base.',
  },
  {
    id: 'round-5',
    index: 7,
    name: 'Round 5: Final Trading & Closing Bell',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20,
    description: 'Final Dalal Street trading window. Unexecuted slips discarded at close. Closing prices determine final winner.',
    rules_note: 'Final Portfolio Value = Cash + Σ(Holdings × Round 5 Close). Teams below ₹1,00,000 cash face round disqualification.',
  },
];

const cleanClock = {
  remaining_seconds: 1800, // 30 minutes
  is_paused: false,
  is_orders_locked: false,
  last_tick: Date.now(),
};

// 4. Reset IPO Listings to Default Upcoming
console.log('[3/7] Resetting IPO desk listings and purging subscription bids...');
const cleanIpoListings = [
  {
    id: 'ipo-item-1',
    round_id: 'ipo-1',
    company_name: 'NovaTech AI Systems Ltd.',
    ticker: 'NOVATECH',
    sector: 'Artificial Intelligence & Cloud',
    reference_price: 300.00,
    issue_price: 300.00,
    lot_size: 12,
    min_lots: 1,
    max_lots: 30,
    total_issue_lots: 100,
    total_demanded_lots: 0,
    subscription_ratio: 0,
    allotted_lots: 0,
    status: 'UPCOMING',
    description: 'Enterprise AI & Cloud Infrastructure provider. Smooth pricing: P_listing = P0 × (0.7 + 0.6S/(1+S)).',
  },
  {
    id: 'ipo-item-2',
    round_id: 'ipo-2',
    company_name: 'EcoPower Green Hydrogen Ltd.',
    ticker: 'ECOPOWER',
    sector: 'Renewable Energy & ESG',
    reference_price: 200.00,
    issue_price: 200.00,
    lot_size: 15,
    min_lots: 1,
    max_lots: 25,
    total_issue_lots: 120,
    total_demanded_lots: 0,
    subscription_ratio: 0,
    allotted_lots: 0,
    status: 'UPCOMING',
    description: 'Commercial green hydrogen & battery storage pioneer. High ESG compliance with national subsidies.',
  },
];

// 5. Clean News & Market Events
console.log('[4/7] Cleaning news feed and removing test market events...');
const cleanNews = [
  {
    id: 'news-1',
    headline: 'RBI Keeps Repo Rate Constant at 6.50% to Anchor Core Inflation',
    body: 'The Monetary Policy Committee of the RBI reiterated its focus on withdrawal of accommodation, supporting sustained market stability on Dalal Street.',
    sentiment: 'NEUTRAL',
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'news-2',
    headline: 'Global Crude Oil Eases Near $78/bbl: Relief for Indian Refiners',
    body: 'Crude indices soften amid steady North American output, lowering raw material import pressures for Indian petrochemical and automotive players.',
    sentiment: 'BULLISH',
    published_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'news-3',
    headline: 'Foreign Institutional Inflows Cross ₹4,200 Cr in Weekly Trading',
    body: 'Institutional appetite for Indian banking and auto blue-chips surges following robust quarterly margin disclosures.',
    sentiment: 'BULLISH',
    published_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

// 6. Clean Teams & Reset Balances to ₹10,00,000 Starting Purse
console.log('[5/7] Pruning test teams and resetting participant purses to ₹10,00,000 starting cash...');
const isTestTeam = (name) => {
  const n = (name || '').toLowerCase();
  return (
    n.startsWith('concurrent') ||
    n.startsWith('team p2p') ||
    n.startsWith('ipo bidder') ||
    n.includes('highroller') ||
    n.includes('underinvestor') ||
    n === 'bulls capital' ||
    n === 'team a' ||
    n === 'team b' ||
    n === 'team alpha' ||
    n === 'team beta'
  );
};

const cleanTeams = (db.teams || [])
  .filter((t) => !isTestTeam(t.name))
  .map((t) => {
    const isPool = t.name.toLowerCase().includes('primary pool');
    return {
      ...t,
      balance: isPool ? 10000000 : 1000000, // ₹1 Cr for Primary pool, ₹10L starting purse for teams
    };
  });
console.log(`  ✓ Retained ${cleanTeams.length} authentic student cohort teams with reset ₹10,00,000 budget`);

// Reset student users cash balance to ₹10,00,000
const cleanUsers = (db.users || []).map((u) => {
  if (u.role === 'participant') {
    return {
      ...u,
      balance: 1000000,
      ecoin_balance: 0,
    };
  }
  return u;
});

// 7. Clear all portfolios, transactions, order slips, settlements, and trade banners
console.log('[6/7] Purging all portfolios, transactions, order slips, and trade banners...');
db.stocks = cleanStocks;
db.teams = cleanTeams;
db.users = cleanUsers;
db.portfolios = [];
db.transactions = [];
db.order_slips = [];
db.market_events = [];
db.news_articles = cleanNews;
db.rounds = cleanRounds;
db.current_round_id = 'round-0';
db.round_clock = cleanClock;
db.ipo_listings = cleanIpoListings;
db.ipo_subscriptions = [];
db.round_settlements = {};
delete db.latest_trade;

// Write clean db.json and backup
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
fs.writeFileSync(DB_BACKUP_FILE, JSON.stringify(db, null, 2), 'utf8');
console.log('  ✓ Saved fresh db.json and db.backup.json');

// 8. Truncate dalal_street_trades.csv to header only
console.log('[7/7] Resetting dalal_street_trades.csv and audit log...');
const csvHeader = 'Slip ID,Timestamp,Team Name,Participant Name,Email,Stock Ticker,Stock Name,Order Type,Quantity,Price (INR),Total Consideration (INR),Executed By Admin,Status\n';
fs.writeFileSync(CSV_FILE, csvHeader, 'utf8');
console.log('  ✓ Truncated dalal_street_trades.csv to header only');

if (fs.existsSync(AUDIT_LOG_FILE)) {
  fs.writeFileSync(AUDIT_LOG_FILE, `[${new Date().toISOString()}] AUDIT_LOG_RESET: Platform prepared for fresh dry run\n`, 'utf8');
}

console.log('\n======================================================================');
console.log('🎉 DALAL STREET RESET COMPLETE: CLEAN ENVIRONMENT READY FOR DRY RUN!');
console.log('======================================================================\n');
