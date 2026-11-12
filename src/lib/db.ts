// ==============================================================================
// Unified Database Layer: Wolf of Dalal Street – ECON Edition
// Supports Supabase PostgreSQL and persistent local JSON store
// ==============================================================================

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import {
  User,
  Stock,
  Portfolio,
  Transaction,
  MarketEvent,
  NewsArticle,
  Quiz,
  TransactionType,
  TradeProposal,
  SyndicateFund,
  PortfolioSnapshot,
  InstitutionalRiskMetrics,
  MarketDepth,
  ProposalStatus,
  ProposalThesisCategory,
  Role,
  SectorExposure,
  Team,
  TeamMember,
  OrderSlip,
  CompetitionRoundId,
  CompetitionRound,
  StockPricingBranch,
  StockPriceSettlement,
  RoundSettlementState,
  IPOListing,
  IPOSubscription,
} from './types';

// Check for Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

// ==============================================================================
// SUPABASE REALTIME TELEMETRY & BACKGROUND SYNC ENGINE
// ==============================================================================
export async function broadcastRealtimeEvent(event: string, payload: any) {
  if (!supabase) return;
  try {
    const channel = supabase.channel('trading-floor');
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  } catch (err) {
    // Non-blocking
  }
}

export function syncStockToSupabase(stock: Stock) {
  if (!supabase) return;
  Promise.resolve(
    supabase
      .from('stocks')
      .update({
        current_price: stock.current_price,
        day_high: stock.day_high,
        day_low: stock.day_low,
        lower_circuit: stock.lower_circuit,
        upper_circuit: stock.upper_circuit,
        historical_prices: stock.historical_prices,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stock.id)
  ).catch(() => {});
}

export function syncTransactionToSupabase(tx: Transaction, sellerTeamName?: string, buyerTeamName?: string) {
  if (!supabase) return;
  Promise.resolve(
    supabase
      .from('transactions')
      .insert({
        id: tx.id,
        user_id: tx.user_id,
        team_id: tx.type === 'SELL' ? sellerTeamName : buyerTeamName,
        counterparty_team_id: tx.type === 'SELL' ? buyerTeamName : sellerTeamName,
        stock_id: tx.stock_id,
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price_at_trade || tx.price,
        brokerage: tx.brokerage,
        total_amount: tx.gross_amount || tx.net_amount,
        round_id: tx.round_id,
        timestamp: tx.timestamp || new Date().toISOString(),
      })
  ).catch(() => {});
}

export function syncClockToSupabase(clock: { remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean }) {
  if (!supabase) return;
  Promise.resolve(
    supabase
      .from('round_clock')
      .update({
        remaining_seconds: clock.remaining_seconds,
        is_paused: clock.is_paused,
        is_orders_locked: clock.is_orders_locked,
        last_tick: new Date().toISOString(),
      })
      .eq('id', 1)
  ).catch(() => {});
}

// Local JSON Store Path & Live CSV Ledger
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const CSV_FILE = path.join(DATA_DIR, 'dalal_street_trades.csv');

interface LocalDBState {
  users: User[];
  stocks: Stock[];
  portfolios: Portfolio[];
  transactions: Transaction[];
  market_events: MarketEvent[];
  news_articles: NewsArticle[];
  quizzes: Quiz[];
  teams?: Team[];
  order_slips?: OrderSlip[];
  syndicate_fund?: SyndicateFund;
  fund_portfolios?: Portfolio[];
  trade_proposals?: TradeProposal[];
  portfolio_snapshots?: PortfolioSnapshot[];
  current_round_id?: CompetitionRoundId;
  rounds?: CompetitionRound[];
  round_settlements?: Record<string, RoundSettlementState>;
  ipo_listings?: IPOListing[];
  ipo_subscriptions?: IPOSubscription[];
  round_clock?: {
    remaining_seconds: number;
    is_paused: boolean;
    is_orders_locked: boolean;
    last_tick?: number;
  };
}

const DEFAULT_STOCKS: Stock[] = [
  {
    id: 's-reliance',
    ticker: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy & Petrochem',
    current_price: 2940.50,
    previous_close: 2915.00,
    day_high: 2965.00,
    day_low: 2905.00,
    is_frozen: false,
    lower_circuit: 2623.50,
    upper_circuit: 3206.50,
    beta: 1.08,
    pe_ratio: 26.4,
    market_cap: '₹19.8L Cr',
  },
  {
    id: 's-tcs',
    ticker: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'Information Technology',
    current_price: 4180.00,
    previous_close: 4210.00,
    day_high: 4235.00,
    day_low: 4160.00,
    is_frozen: false,
    lower_circuit: 3789.00,
    upper_circuit: 4631.00,
    beta: 0.85,
    pe_ratio: 31.2,
    market_cap: '₹15.2L Cr',
  },
  {
    id: 's-hdfcbank',
    ticker: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Banking & Financials',
    current_price: 1650.75,
    previous_close: 1635.00,
    day_high: 1665.00,
    day_low: 1628.00,
    is_frozen: false,
    lower_circuit: 1471.50,
    upper_circuit: 1798.50,
    beta: 1.12,
    pe_ratio: 18.5,
    market_cap: '₹12.6L Cr',
  },
  {
    id: 's-tatamotors',
    ticker: 'TATAMOTORS',
    name: 'Tata Motors PV',
    sector: 'Automobile',
    current_price: 985.20,
    previous_close: 960.00,
    day_high: 1005.00,
    day_low: 955.00,
    is_frozen: false,
    lower_circuit: 864.00,
    upper_circuit: 1056.00,
    beta: 1.45,
    pe_ratio: 15.8,
    market_cap: '₹3.6L Cr',
  },
  {
    id: 's-infy',
    ticker: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Information Technology',
    current_price: 1845.00,
    previous_close: 1860.00,
    day_high: 1872.00,
    day_low: 1835.00,
    is_frozen: false,
    lower_circuit: 1674.00,
    upper_circuit: 2046.00,
    beta: 0.92,
    pe_ratio: 28.1,
    market_cap: '₹7.6L Cr',
  },
  {
    id: 's-itc',
    ticker: 'ITC',
    name: 'ITC Limited',
    sector: 'FMCG & Conglomerate',
    current_price: 485.40,
    previous_close: 482.00,
    day_high: 492.00,
    day_low: 480.00,
    is_frozen: false,
    lower_circuit: 433.80,
    upper_circuit: 530.20,
    beta: 0.65,
    pe_ratio: 24.3,
    market_cap: '₹6.1L Cr',
  },
  {
    id: 's-ongc',
    ticker: 'ONGC',
    name: 'Oil & Natural Gas Corp.',
    sector: 'Energy & Oil',
    current_price: 288.60,
    previous_close: 292.00,
    day_high: 295.00,
    day_low: 284.00,
    is_frozen: false,
    lower_circuit: 262.80,
    upper_circuit: 321.20,
    beta: 1.25,
    pe_ratio: 7.2,
    market_cap: '₹3.6L Cr',
  },
  {
    id: 's-icicibank',
    ticker: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Banking & Financials',
    current_price: 1240.30,
    previous_close: 1225.00,
    day_high: 1252.00,
    day_low: 1220.00,
    is_frozen: false,
    lower_circuit: 1102.50,
    upper_circuit: 1347.50,
    beta: 1.18,
    pe_ratio: 17.6,
    market_cap: '₹8.7L Cr',
  },
  {
    id: 's-sunpharma',
    ticker: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Ind.',
    sector: 'Pharmaceuticals',
    current_price: 1780.00,
    previous_close: 1755.00,
    day_high: 1795.00,
    day_low: 1748.00,
    is_frozen: false,
    lower_circuit: 1579.50,
    upper_circuit: 1930.50,
    beta: 0.72,
    pe_ratio: 35.4,
    market_cap: '₹4.2L Cr',
  },
  {
    id: 's-bhartiartl',
    ticker: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    sector: 'Telecommunications',
    current_price: 1520.00,
    previous_close: 1505.00,
    day_high: 1538.00,
    day_low: 1498.00,
    is_frozen: false,
    lower_circuit: 1354.50,
    upper_circuit: 1655.50,
    beta: 0.88,
    pe_ratio: 42.0,
    market_cap: '₹9.1L Cr',
  },
];

export const DEFAULT_SYNDICATE_FUND: SyndicateFund = {
  id: 'fund-redline-01',
  name: 'Redline Traders Syndicate',
  code: 'RT-ALPHA-01',
  total_aum: 5000000,
  cash_balance: 3245250,
  benchmark_index: 'NIFTY 50',
  created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
};

export const DEFAULT_FUND_PORTFOLIO: Portfolio[] = [
  {
    id: 'fport-1',
    user_id: 'fund-redline-01',
    stock_id: 's-reliance',
    shares_count: 250,
    avg_buy_price: 2890.00,
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'fport-2',
    user_id: 'fund-redline-01',
    stock_id: 's-tcs',
    shares_count: 120,
    avg_buy_price: 4120.00,
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'fport-3',
    user_id: 'fund-redline-01',
    stock_id: 's-hdfcbank',
    shares_count: 320,
    avg_buy_price: 1620.00,
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const DEFAULT_PROPOSALS: TradeProposal[] = [
  {
    id: 'prop-001',
    fund_id: 'fund-redline-01',
    proposer_id: 'user-analyst-01',
    proposer_email: 'analyst.tiet@thapar.edu',
    proposer_role: 'participant',
    stock_id: 's-infy',
    ticker: 'INFY',
    type: 'BUY',
    quantity: 100,
    proposed_price: 1845.00,
    estimated_total: 184500.00,
    thesis_category: 'Sector Rotation',
    thesis_notes: 'Targeting valuation discount in tier-1 IT. Q3 deal pipeline expansion and favorable rupee depreciation provide near-term earnings catalyst.',
    status: 'PENDING',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'prop-002',
    fund_id: 'fund-redline-01',
    proposer_id: 'user-analyst-02',
    proposer_email: 'macro.lead@thapar.edu',
    proposer_role: 'participant',
    stock_id: 's-tcs',
    ticker: 'TCS',
    type: 'BUY',
    quantity: 120,
    proposed_price: 4120.00,
    estimated_total: 494400.00,
    thesis_category: 'Earnings Play',
    thesis_notes: 'Strong BFSI order flow with multi-year contract renewals. Quality blue-chip defensive position ahead of central bank rate cycle.',
    status: 'APPROVED',
    reviewer_id: 'user-exec-01',
    reviewer_email: 'exec.board@thapar.edu',
    reviewer_feedback: 'Approved by Risk Committee. Position within 25% single-stock AUM allocation limits.',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    reviewed_at: new Date(Date.now() - 86400000 * 5 + 1800000).toISOString(),
    executed_transaction_id: 'tx-fund-001',
  },
  {
    id: 'prop-003',
    fund_id: 'fund-redline-01',
    proposer_id: 'user-trader-01',
    proposer_email: 'momentum.trader@thapar.edu',
    proposer_role: 'participant',
    stock_id: 's-tatamotors',
    ticker: 'TATAMOTORS',
    type: 'BUY',
    quantity: 800,
    proposed_price: 985.20,
    estimated_total: 788160.00,
    thesis_category: 'Concentration Management',
    thesis_notes: 'Breakout above ₹980 resistance on above-average volume. Proposing momentum expansion trade.',
    status: 'REJECTED',
    reviewer_id: 'user-exec-01',
    reviewer_email: 'exec.board@thapar.edu',
    reviewer_feedback: 'Rejected: Total auto sector allocation would exceed 40% fund risk guardrail. Scale down order quantity to max 250 shares and resubmit.',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    reviewed_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
  },
];

export const DEFAULT_COMPETITION_ROUNDS: CompetitionRound[] = [
  {
    id: 'round-0',
    index: 0,
    name: 'Round 0: Initial Purchase Session',
    type: 'PRIMARY_DESK',
    status: 'ACTIVE',
    duration_minutes: 30, // 30 minutes as per brief
    description: 'Initial stock purchase from predetermined universe of ~50 stocks. Unlimited supply from Econ desk.',
    rules_note: 'Mandatory 60% Deployment: Each team must invest at least ₹6,00,000 in this session. Unspent cash carries forward.',
  },
  {
    id: 'round-1',
    index: 1,
    name: 'Round 1: Inter-Team Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20, // 20 minutes as per brief
    description: 'First floor trading session. Teams negotiate and execute trades mutually using physical signed trade slips.',
    rules_note: 'Live price uses quantity-weighted average of latest 3 trades. End-of-round cash check: minimum ₹1,00,000 required.',
  },
  {
    id: 'round-2',
    index: 2,
    name: 'Round 2: Inter-Team Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20, // 20 minutes as per brief
    description: 'Trading continues under Round 2 opening prices after News 2 and R% adjustments.',
    rules_note: 'Trading via signed trade slips. Binding agreement once signed. End-of-round cash floor: ₹1,00,000.',
  },
  {
    id: 'ipo-1',
    index: 3,
    name: 'IPO Round 1: Tech Unicorn Primary Offering',
    type: 'IPO',
    status: 'UPCOMING',
    duration_minutes: 10, // ~10 minutes as per brief
    description: 'Primary market offering. Teams submit lot demand; smooth listing formula determines post-IPO price.',
    rules_note: 'Smooth Listing Formula: P_listing = P0 × (0.7 + 0.6S/(1+S)). Undersubscribed IPO gives every requesting team 1 lot.',
  },
  {
    id: 'round-3',
    index: 4,
    name: 'Round 3: Multi-Sector Expansion & IPO Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20, // 20 minutes as per brief
    description: 'Secondary floor trading resumes, now including newly listed IPO 1 stock.',
    rules_note: '5% dual brokerage on P2P trades. Quantity-weighted 3-trade rolling price rule active.',
  },
  {
    id: 'ipo-2',
    index: 5,
    name: 'IPO Round 2: Green Energy Conglomerate Offering',
    type: 'IPO',
    status: 'UPCOMING',
    duration_minutes: 10, // ~10 minutes as per brief
    description: 'Second primary market IPO window. Teams submit lot applications.',
    rules_note: 'Listing price determined by aggregate subscription ratio S = D / L.',
  },
  {
    id: 'round-4',
    index: 6,
    name: 'Round 4: High Beta Floor Trading',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20, // 20 minutes as per brief
    description: 'High volatility secondary trading session with breaking news adjustments.',
    rules_note: 'Valid slips received by round cutoff processed after close to establish next price base.',
  },
  {
    id: 'round-5',
    index: 7,
    name: 'Round 5: Final Trading & Closing Bell',
    type: 'P2P_TRADING',
    status: 'UPCOMING',
    duration_minutes: 20, // 20 minutes as per brief
    description: 'Final Dalal Street trading window. Unexecuted slips discarded at close. Closing prices determine final winner.',
    rules_note: 'Final Portfolio Value = Cash + Σ(Holdings × Round 5 Close). Teams below ₹1,00,000 cash face round disqualification.',
  },
];

export const DEFAULT_IPO_LISTINGS: IPOListing[] = [
  {
    id: 'ipo-item-1',
    round_id: 'ipo-1',
    company_name: 'NovaTech AI Systems Ltd.',
    ticker: 'NOVATECH',
    sector: 'Artificial Intelligence & Cloud',
    reference_price: 300.00, // P0 reference price
    issue_price: 300.00,     // Initial listing price equal to P0
    lot_size: 12,            // 12 shares per lot as per brief
    min_lots: 1,
    max_lots: 30,
    total_issue_lots: 100,   // L = 100 lots offered
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
    reference_price: 200.00, // P0 reference price
    issue_price: 200.00,
    lot_size: 12,            // 12 shares per lot as per brief
    min_lots: 1,
    max_lots: 30,
    total_issue_lots: 120,   // L = 120 lots offered
    total_demanded_lots: 0,
    subscription_ratio: 0,
    allotted_lots: 0,
    status: 'UPCOMING',
    description: 'Grid-scale green hydrogen & battery storage pioneer with sovereign power purchase agreements.',
  },
];

export const DEFAULT_SNAPSHOTS: PortfolioSnapshot[] = [
  {
    id: 'snap-1',
    timestamp: new Date(Date.now() - 86400000 * 6).toISOString(),
    date_label: 'Day -6',
    fund_equity: 5000000,
    cash_balance: 5000000,
    benchmark_value: 21850,
  },
  {
    id: 'snap-2',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    date_label: 'Day -5',
    fund_equity: 5045000,
    cash_balance: 4505600,
    benchmark_value: 21920,
  },
  {
    id: 'snap-3',
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
    date_label: 'Day -4',
    fund_equity: 5120000,
    cash_balance: 3987200,
    benchmark_value: 22010,
  },
  {
    id: 'snap-4',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    date_label: 'Day -3',
    fund_equity: 5095000,
    cash_balance: 3468800,
    benchmark_value: 21980,
  },
  {
    id: 'snap-5',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    date_label: 'Day -2',
    fund_equity: 5185000,
    cash_balance: 3245250,
    benchmark_value: 22120,
  },
  {
    id: 'snap-6',
    timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
    date_label: 'Yesterday',
    fund_equity: 5214000,
    cash_balance: 3245250,
    benchmark_value: 22190,
  },
  {
    id: 'snap-7',
    timestamp: new Date().toISOString(),
    date_label: 'Live',
    fund_equity: 5248500,
    cash_balance: 3245250,
    benchmark_value: 22240,
  },
];

const DEFAULT_NEWS: NewsArticle[] = [
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

const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'quiz-1',
    title: 'Macroeconomics 101: Monetary Policy & Inflation',
    reward_cash: 35000,
    reward_ecoin: 50,
    questions_json: [
      {
        id: 1,
        question: 'What usually happens to equity valuations when a central bank aggressively hikes repo rates?',
        options: [
          'Equities experience valuation compression due to higher discounting rates',
          'Stock prices universally soar due to higher bank deposit margins',
          'There is zero correlation between interest rates and equity multiples',
          'Commodities immediately plunge to absolute zero',
        ],
        answer: 0,
        explanation: 'Higher discount rates lower the present value of future cash flows, compressing valuation multiples.',
      },
      {
        id: 2,
        question: 'What primary benchmark index does the RBI monitor for targeting headline retail inflation?',
        options: [
          'Wholesale Price Index (WPI)',
          'Consumer Price Index (CPI Combined)',
          'Producer Price Index (PPI)',
          'Index of Industrial Production (IIP)',
        ],
        answer: 1,
        explanation: 'The RBI legally targets CPI Combined with an anchor band of 4% (+/- 2%).',
      },
      {
        id: 3,
        question: 'If the Indian Rupee depreciates against the US Dollar, which sector benefits the most?',
        options: [
          'Aviation & Oil Marketing Importers',
          'IT Services & Pharmaceutical Exporters',
          'Real Estate Developers',
          'Domestic Consumer Retailers',
        ],
        answer: 1,
        explanation: 'Export businesses invoice in USD while operating expenses are in INR, widening operating margins.',
      },
    ],
  },
  {
    id: 'quiz-2',
    title: 'Dalal Street Mechanics: Risk, Leverage & Valuations',
    reward_cash: 45000,
    reward_ecoin: 75,
    questions_json: [
      {
        id: 1,
        question: 'What does a high Price-to-Earnings (P/E) ratio relative to historical averages generally signify?',
        options: [
          'The company is on the verge of bankruptcy',
          'The market is paying a premium in anticipation of strong future earnings growth',
          'The company yields the highest dividends in its peer group',
          'The stock has zero debt',
        ],
        answer: 1,
        explanation: 'Elevated P/E indicates high investor willingness to pay for anticipated growth.',
      },
      {
        id: 2,
        question: 'What is the primary role of market-wide circuit breakers on NSE/BSE?',
        options: [
          'To permanently shut down weak listed companies',
          'To temporarily halt trading during flash shocks and curb contagion panic',
          'To give institutional desks extra margin limits',
          'To artificially peg end-of-day closing prices',
        ],
        answer: 1,
        explanation: 'Circuit breakers act as cooling periods to digest market information during sharp volatility.',
      },
      {
        id: 3,
        question: 'Which metric measures a stock volatility relative to the benchmark index (Nifty 50)?',
        options: ['Alpha', 'Beta', 'Sharpe Ratio', 'Sortino Ratio'],
        answer: 1,
        explanation: 'Beta represents systematic sensitivity; Beta > 1 implies higher volatility than the benchmark.',
      },
    ],
  },
];

const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// High-Performance In-Memory Index Store to Eliminate N+1 Linear Scans
export interface DBIndexes {
  stocksById: Map<string, Stock>;
  stocksByTicker: Map<string, Stock>;
  usersById: Map<string, User>;
  usersByEmail: Map<string, User>;
  teamsById: Map<string, Team>;
  teamsByMemberId: Map<string, Team>;
}

// High-Performance In-Memory Cache for Sub-Millisecond Speed & Zero Disk I/O Bottlenecks
let _memoryDB: LocalDBState | null = null;
let _dbIndexes: DBIndexes | null = null;
let _lastBackupSaveTime = 0;
let _lastFileMtime = 0;

export function rebuildIndexes(db: LocalDBState): DBIndexes {
  const stocksById = new Map<string, Stock>();
  const stocksByTicker = new Map<string, Stock>();
  const usersById = new Map<string, User>();
  const usersByEmail = new Map<string, User>();
  const teamsById = new Map<string, Team>();
  const teamsByMemberId = new Map<string, Team>();

  (db.stocks || []).forEach((s) => {
    stocksById.set(s.id, s);
    if (s.ticker) {
      stocksByTicker.set(s.ticker.toUpperCase(), s);
    }
  });

  (db.users || []).forEach((u) => {
    usersById.set(u.id, u);
    if (u.email) {
      usersByEmail.set(u.email.trim().toLowerCase(), u);
    }
  });

  (db.teams || []).forEach((t) => {
    teamsById.set(t.id, t);
    if (t.name) {
      teamsById.set(t.name.toLowerCase(), t);
    }
    if (t.code) {
      teamsById.set(t.code.toUpperCase(), t);
    }
    (t.members || []).forEach((m) => {
      if (m.id) teamsByMemberId.set(m.id, t);
      if (m.email) teamsByMemberId.set(m.email.trim().toLowerCase(), t);
    });
    if (t.leader_id) teamsByMemberId.set(t.leader_id, t);
    if (t.leader_email) teamsByMemberId.set(t.leader_email.trim().toLowerCase(), t);
  });

  _dbIndexes = {
    stocksById,
    stocksByTicker,
    usersById,
    usersByEmail,
    teamsById,
    teamsByMemberId,
  };

  return _dbIndexes;
}

export function getDBIndexes(): DBIndexes {
  if (!_dbIndexes) {
    const db = getLocalDB();
    return rebuildIndexes(db);
  }
  return _dbIndexes;
}

export interface DBSnapshotInfo {
  filename: string;
  label: string;
  timestamp: number;
  sizeBytes: number;
  roundId?: string;
  stocksCount: number;
  teamsCount: number;
}

export function createDBSnapshot(label: string = 'manual'): DBSnapshotInfo {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const db = getLocalDB();
    const cleanLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const filename = `snapshot_${timestamp}_${cleanLabel}.json`;
    const targetPath = path.join(BACKUPS_DIR, filename);
    const content = JSON.stringify(db, null, 2);

    fs.writeFileSync(targetPath, content, 'utf-8');

    // Retain up to 50 historical snapshots
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'));
      if (files.length > 50) {
        files.sort();
        const toDelete = files.slice(0, files.length - 50);
        toDelete.forEach((f) => {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch {}
        });
      }
    } catch {}

    logger.audit('DATABASE_SNAPSHOT_CREATED', 'System', {
      filename,
      label,
      roundId: db.current_round_id,
      stocksCount: db.stocks?.length || 0,
      teamsCount: db.teams?.length || 0,
    });

    return {
      filename,
      label,
      timestamp,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      roundId: db.current_round_id,
      stocksCount: db.stocks?.length || 0,
      teamsCount: db.teams?.length || 0,
    };
  } catch (error: any) {
    logger.error('DBSnapshot', `Failed to create snapshot: ${error.message}`, error);
    throw error;
  }
}

export function listDBSnapshots(): DBSnapshotInfo[] {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'));
    
    const list: DBSnapshotInfo[] = [];
    files.forEach((file) => {
      try {
        const fullPath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(fullPath);
        const parts = file.replace('.json', '').split('_');
        const ts = Number(parts[1]) || stats.mtimeMs;
        const label = parts.slice(2).join('_') || 'snapshot';
        
        let roundId: string | undefined;
        let stocksCount = 0;
        let teamsCount = 0;
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const parsed = JSON.parse(raw);
          roundId = parsed.current_round_id;
          stocksCount = parsed.stocks?.length || 0;
          teamsCount = parsed.teams?.length || 0;
        } catch {}

        list.push({
          filename: file,
          label,
          timestamp: ts,
          sizeBytes: stats.size,
          roundId,
          stocksCount,
          teamsCount,
        });
      } catch {}
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    logger.error('DBSnapshot', 'Failed to list snapshots', err);
    return [];
  }
}

export function rollbackDBSnapshot(filename: string): {
  success: boolean;
  message: string;
  restoredRound?: string;
  stocksCount?: number;
} {
  try {
    const cleanFilename = path.basename(filename);
    const snapshotPath = path.join(BACKUPS_DIR, cleanFilename);

    if (!fs.existsSync(snapshotPath)) {
      return { success: false, message: `Snapshot ${cleanFilename} does not exist.` };
    }

    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    const parsed: LocalDBState = JSON.parse(raw);

    if (!parsed.stocks || !Array.isArray(parsed.stocks)) {
      return { success: false, message: 'Invalid snapshot data: missing stocks array.' };
    }

    // Safety snapshot of current state before rollback
    try {
      createDBSnapshot('pre_rollback_safety');
    } catch {}

    saveLocalDB(parsed);
    rebuildIndexes(parsed);

    logger.audit('DATABASE_ROLLBACK_EXECUTED', 'Admin', {
      snapshotRestored: cleanFilename,
      roundId: parsed.current_round_id,
      stocksCount: parsed.stocks.length,
      teamsCount: parsed.teams?.length || 0,
    });

    return {
      success: true,
      message: `Database successfully restored from snapshot ${cleanFilename}.`,
      restoredRound: parsed.current_round_id,
      stocksCount: parsed.stocks.length,
    };
  } catch (error: any) {
    logger.error('DBSnapshot', `Failed to rollback snapshot: ${error.message}`, error);
    return { success: false, message: `Rollback failed: ${error.message}` };
  }
}

// In-Memory / File System Local Store Engine
function getLocalDB(): LocalDBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      if (_memoryDB && stat.mtimeMs <= _lastFileMtime) {
        if (!_dbIndexes) rebuildIndexes(_memoryDB);
        return _memoryDB;
      }
      _lastFileMtime = stat.mtimeMs;
    } else if (_memoryDB) {
      if (!_dbIndexes) rebuildIndexes(_memoryDB);
      return _memoryDB;
    }
  } catch {
    if (_memoryDB) {
      if (!_dbIndexes) rebuildIndexes(_memoryDB);
      return _memoryDB;
    }
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let raw = '';
    if (fs.existsSync(DB_FILE)) {
      try {
        raw = fs.readFileSync(DB_FILE, 'utf-8').trim();
      } catch {}
    }

    // Auto Crash-Recovery: If primary db.json is missing or corrupted/empty, restore from db.backup.json
    if (!raw && fs.existsSync(DB_BACKUP_FILE)) {
      console.warn('[Crash-Recovery] Primary db.json empty/missing. Auto-recovering from db.backup.json...');
      try {
        raw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8').trim();
        if (raw) {
          fs.writeFileSync(DB_FILE, raw);
        }
      } catch {}
    }

    if (!raw) {
      const initial: LocalDBState = {
        users: [
          {
            id: 'admin-001',
            email: process.env.ADMIN_EMAIL || 'admin.econ@thapar.edu',
            role: 'admin',
            balance: 1000000,
            ecoin_balance: 1000,
            created_at: new Date().toISOString(),
          },
        ],
        stocks: DEFAULT_STOCKS,
        portfolios: [],
        transactions: [],
        market_events: [],
        news_articles: DEFAULT_NEWS,
        quizzes: DEFAULT_QUIZZES,
        syndicate_fund: DEFAULT_SYNDICATE_FUND,
        fund_portfolios: DEFAULT_FUND_PORTFOLIO,
        trade_proposals: DEFAULT_PROPOSALS,
        portfolio_snapshots: DEFAULT_SNAPSHOTS,
      };
      saveLocalDB(initial);
      _memoryDB = initial;
      return initial;
    }

    const parsed: LocalDBState = JSON.parse(raw);
    let dirty = false;

    if (!parsed.syndicate_fund) {
      parsed.syndicate_fund = DEFAULT_SYNDICATE_FUND;
      dirty = true;
    }
    if (!parsed.fund_portfolios || parsed.fund_portfolios.length === 0) {
      parsed.fund_portfolios = DEFAULT_FUND_PORTFOLIO;
      dirty = true;
    }
    if (!parsed.trade_proposals || parsed.trade_proposals.length === 0) {
      parsed.trade_proposals = DEFAULT_PROPOSALS;
      dirty = true;
    }
    if (!parsed.portfolio_snapshots || parsed.portfolio_snapshots.length === 0) {
      parsed.portfolio_snapshots = DEFAULT_SNAPSHOTS;
      dirty = true;
    }

    // Ensure authorized superadmins and desk admins exist in users table
    const superadminEmails = [
      'vjhuntra_be24@thapar.edu',
      'ssaini_be25@thapar.ed',
      'ssaini_be25@thapar.edu',
      'ssaini3_be25@thapar.edu',
      'admin.econ@thapar.edu',
    ];

    superadminEmails.forEach((adminEmail) => {
      const existing = parsed.users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase());
      if (!existing) {
        parsed.users.push({
          id: 'admin-' + Math.random().toString(36).substring(2, 7),
          email: adminEmail,
          role: 'superadmin',
          balance: 10000000,
          ecoin_balance: 1000,
          created_at: new Date().toISOString(),
        });
        dirty = true;
      } else if (existing.role !== 'superadmin') {
        existing.role = 'superadmin';
        dirty = true;
      }
    });

    // Purge synthetic demo accounts so only real registered users remain
    const syntheticEmails = [
      'student.analyst@thapar.edu',
      'student.trader@thapar.edu',
      'trader.student@thapar.edu',
      'student@thapar.edu',
    ];
    const beforeCount = parsed.users.length;
    parsed.users = parsed.users.filter(
      (u) => !syntheticEmails.includes(u.email.toLowerCase())
    );
    if (parsed.users.length !== beforeCount) {
      dirty = true;
    }

    // 1. Ensure Superadmin Account exists (soumilsaini07@gmail.com)
    let superAdmin = parsed.users.find((u) => u.email.toLowerCase() === 'soumilsaini07@gmail.com');
    if (!superAdmin) {
      superAdmin = {
        id: 'usr-superadmin-soumil',
        email: 'soumilsaini07@gmail.com',
        role: 'superadmin',
        balance: 10000000,
        ecoin_balance: 1000,
        first_name: 'Soumil',
        last_name: 'Saini',
        username: 'Soumil Saini (Superadmin)',
        group_name: 'Superadmin Desk - Global',
        password_hash: bcrypt.hashSync('superadmin123', 10),
        created_at: new Date().toISOString(),
      };
      parsed.users.unshift(superAdmin);
      dirty = true;
    } else {
      if (superAdmin.role !== 'superadmin') { superAdmin.role = 'superadmin'; dirty = true; }
      if (!superAdmin.password_hash) { superAdmin.password_hash = bcrypt.hashSync('superadmin123', 10); dirty = true; }
      if (!superAdmin.username) { superAdmin.username = 'Soumil Saini (Superadmin)'; dirty = true; }
    }

    // 2. Ensure Desk Admin Account exists (ssaini3_be25@thapar.edu)
    let deskAdmin = parsed.users.find((u) => u.email.toLowerCase() === 'ssaini3_be25@thapar.edu');
    if (!deskAdmin) {
      deskAdmin = {
        id: 'usr-admin-ssaini3',
        email: 'ssaini3_be25@thapar.edu',
        role: 'admin',
        balance: 10000000,
        ecoin_balance: 1000,
        first_name: 'Soumil',
        last_name: 'Saini',
        username: 'Soumil Saini (Desk Lead)',
        group_name: 'Cohort Alpha - Desk 1',
        password_hash: bcrypt.hashSync('admin123', 10),
        created_at: new Date().toISOString(),
      };
      parsed.users.push(deskAdmin);
      dirty = true;
    } else {
      if (deskAdmin.role !== 'admin') { deskAdmin.role = 'admin'; dirty = true; }
      if (!deskAdmin.password_hash) { deskAdmin.password_hash = bcrypt.hashSync('admin123', 10); dirty = true; }
      if (!deskAdmin.group_name) { deskAdmin.group_name = 'Cohort Alpha - Desk 1'; dirty = true; }
      if (!deskAdmin.username) { deskAdmin.username = 'Soumil Saini (Desk Lead)'; dirty = true; }
    }

    // Set official names and desk affiliations for verified administrators
    parsed.users.forEach((u) => {
      const email = u.email.toLowerCase();
      if (email === 'vjhuntra_be24@thapar.edu') {
        if (!u.first_name) { u.first_name = 'Vanshaj'; u.last_name = 'Jhuntra'; u.username = 'Vanshaj Jhuntra'; dirty = true; }
        u.role = 'admin';
        u.group_name = 'Cohort Beta - Desk 2';
      } else if (!u.username && u.role !== 'admin' && u.role !== 'superadmin') {
        const roll = email.split('@')[0];
        u.username = `Trader_${roll}`;
        dirty = true;
      }
    });

    // Auto-allot unassigned students to desk admins in balanced cohorts
    const activeAdmins = parsed.users.filter((u) => u.role === 'admin' || u.role === 'superadmin');
    if (activeAdmins.length > 0) {
      const soumil = parsed.users.find((a) => a.email.toLowerCase() === 'ssaini3_be25@thapar.edu') || activeAdmins[0];
      const vanshaj = parsed.users.find((a) => a.email.toLowerCase() === 'vjhuntra_be24@thapar.edu') || activeAdmins[1] || soumil;

      const cohortDesks = [
        { admin: soumil, group: 'Group Alpha - Desk 1' },
        { admin: vanshaj, group: 'Group Beta - Desk 2' },
      ];

      const students = parsed.users.filter((u) => u.role !== 'admin' && u.role !== 'superadmin');
      students.forEach((student, idx) => {
        if (!student.assigned_admin_id) {
          const desk = cohortDesks[idx % cohortDesks.length];
          student.assigned_admin_id = desk.admin.id;
          student.assigned_admin_name = desk.admin.username || desk.admin.first_name || 'Desk Lead';
          student.group_name = desk.group;
          dirty = true;
        } else if (!student.assigned_admin_name) {
          const adm = activeAdmins.find((a) => a.id === student.assigned_admin_id);
          if (adm) {
            student.assigned_admin_name = adm.username || adm.first_name || 'Desk Lead';
            dirty = true;
          }
        }
      });
    }

    // Ensure teams array and order_slips array exist
    if (!parsed.teams) {
      parsed.teams = [];
      dirty = true;
    }
    if (!parsed.order_slips) {
      parsed.order_slips = [];
      dirty = true;
    }

    // Default Seed Teams if empty
    if (parsed.teams.length === 0) {
      parsed.teams = [
        {
          id: 'team-apex-01',
          name: 'Apex Alpha Syndicate',
          code: 'APEX-01',
          leader_id: 'usr-9np9imt',
          leader_name: 'Aaryan Verma',
          leader_email: '1025150050@thapar.edu',
          balance: 1000000,
          members: [],
          created_at: new Date().toISOString(),
        },
        {
          id: 'team-bull-02',
          name: 'Dalal Street Titans',
          code: 'TITAN-02',
          leader_id: 'usr-40rj0tq',
          leader_name: 'Trader_102203001',
          leader_email: '102203001@thapar.edu',
          balance: 1000000,
          members: [],
          created_at: new Date().toISOString(),
        },
      ];
      dirty = true;
    }

    // Bind students to teams (max 6 members per team)
    const allStudents = parsed.users.filter((u) => u.role !== 'admin' && u.role !== 'superadmin');
    allStudents.forEach((student) => {
      let team = parsed.teams!.find((t) => t.id === student.team_id || t.members.some((m) => m.id === student.id || m.email.toLowerCase() === student.email.toLowerCase()));
      if (!team) {
        team = parsed.teams!.find((t) => t.members.length < 6);
        if (!team) {
          const teamNum = parsed.teams!.length + 1;
          team = {
            id: `team-dalal-${teamNum}`,
            name: `Dalal Cohort Team ${teamNum}`,
            code: `TEAM-${teamNum}`,
            leader_id: student.id,
            leader_name: student.username || student.first_name || student.email.split('@')[0],
            leader_email: student.email,
            balance: student.balance,
            members: [],
            created_at: new Date().toISOString(),
          };
          parsed.teams!.push(team);
        }
        team.members.push({
          id: student.id,
          name: student.username || `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email.split('@')[0],
          email: student.email,
          roll: student.email.split('@')[0],
          is_leader: team.members.length === 0,
        });
        dirty = true;
      }

      // Ensure member is in team.members
      if (!team.members.some((m) => m.id === student.id || m.email.toLowerCase() === student.email.toLowerCase())) {
        if (team.members.length < 6) {
          team.members.push({
            id: student.id,
            name: student.username || `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email.split('@')[0],
            email: student.email,
            roll: student.email.split('@')[0],
            is_leader: team.leader_id === student.id,
          });
          dirty = true;
        }
      }

      if (student.team_id !== team.id || student.team_name !== team.name) {
        student.team_id = team.id;
        student.team_name = team.name;
        student.is_team_leader = team.leader_id === student.id || team.leader_email.toLowerCase() === student.email.toLowerCase();
        dirty = true;
      }
    });

    // Ensure all stocks have circuit collar bounds, beta, PE ratio, and market cap
    if (parsed.stocks && parsed.stocks.length > 0) {
      parsed.stocks = parsed.stocks.map((s) => {
        const def = DEFAULT_STOCKS.find((d) => d.id === s.id || d.ticker === s.ticker);
        const lower_circuit = s.lower_circuit ?? (def ? def.lower_circuit : Number((s.current_price * 0.9).toFixed(2)));
        const upper_circuit = s.upper_circuit ?? (def ? def.upper_circuit : Number((s.current_price * 1.1).toFixed(2)));
        const beta = s.beta ?? (def ? def.beta : 1.0);
        const pe_ratio = s.pe_ratio ?? (def ? def.pe_ratio : 20.0);
        const market_cap = s.market_cap ?? (def ? def.market_cap : '₹5.0L Cr');

        if (s.lower_circuit !== lower_circuit || s.upper_circuit !== upper_circuit || s.beta !== beta) {
          dirty = true;
        }

        return {
          ...s,
          lower_circuit,
          upper_circuit,
          beta,
          pe_ratio,
          market_cap,
        };
      });
    }

    // Ensure competition rounds and pricing settlement structures exist
    if (!parsed.rounds || parsed.rounds.length === 0) {
      parsed.rounds = DEFAULT_COMPETITION_ROUNDS;
      dirty = true;
    }
    if (!parsed.current_round_id) {
      parsed.current_round_id = 'round-0';
      dirty = true;
    }
    if (!parsed.round_clock) {
      parsed.round_clock = {
        remaining_seconds: 600, // 10 minutes default for pre-market
        is_paused: false,
        is_orders_locked: false,
      };
      dirty = true;
    }
    if (!parsed.ipo_listings || parsed.ipo_listings.length === 0) {
      parsed.ipo_listings = DEFAULT_IPO_LISTINGS;
      dirty = true;
    }
    if (!parsed.ipo_subscriptions) {
      parsed.ipo_subscriptions = [];
      dirty = true;
    }
    if (!parsed.round_settlements) {
      parsed.round_settlements = {};
      dirty = true;
    }

    if (dirty) {
      saveLocalDB(parsed);
    }

    _memoryDB = parsed;
    rebuildIndexes(parsed);
    return parsed;
  } catch (err) {
    console.error('Error reading local DB, attempting backup recovery:', err);
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        const backupParsed = JSON.parse(backupRaw);
        _memoryDB = backupParsed;
        rebuildIndexes(backupParsed);
        return backupParsed;
      }
    } catch {}

    return {
      users: [],
      stocks: DEFAULT_STOCKS,
      portfolios: [],
      transactions: [],
      market_events: [],
      news_articles: DEFAULT_NEWS,
      quizzes: DEFAULT_QUIZZES,
      syndicate_fund: DEFAULT_SYNDICATE_FUND,
      fund_portfolios: DEFAULT_FUND_PORTFOLIO,
      trade_proposals: DEFAULT_PROPOSALS,
      portfolio_snapshots: DEFAULT_SNAPSHOTS,
    };
  }
}

function saveLocalDB(data: LocalDBState) {
  // Update in-memory reference immediately (0ms reads for all incoming requests)
  _memoryDB = data;
  rebuildIndexes(data);

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(data, null, 2);

    // Atomic write pattern: write to tmp file first, then atomically replace db.json
    fs.writeFileSync(DB_TMP_FILE, jsonStr, 'utf-8');
    try {
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch {
      // Windows file lock fallback: direct overwrite
      fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
    }

    // Maintain auto-backup every 30 seconds for complete crash recovery
    const now = Date.now();
    if (now - _lastBackupSaveTime > 30000 || !fs.existsSync(DB_BACKUP_FILE)) {
      fs.writeFileSync(DB_BACKUP_FILE, jsonStr, 'utf-8');
      _lastBackupSaveTime = now;
    }

    try {
      if (fs.existsSync(DB_FILE)) {
        _lastFileMtime = fs.statSync(DB_FILE).mtimeMs;
      }
    } catch {}
  } catch (err) {
    console.error('Error saving local DB atomically:', err);
  }
}

// -----------------------------------------------------------------------------
// STOCKS
// -----------------------------------------------------------------------------
export async function getStocks(): Promise<Stock[]> {
  const db = getLocalDB();
  return db.stocks;
}

export async function getStockById(id: string): Promise<Stock | undefined> {
  const db = getLocalDB();
  const indexes = getDBIndexes();
  return (
    indexes.stocksById.get(id) ||
    indexes.stocksByTicker.get(id.toUpperCase()) ||
    db.stocks.find((s) => s.id === id || s.ticker === id)
  );
}

export async function updateStock(
  id: string,
  updates: Partial<Stock>
): Promise<Stock | undefined> {
  const db = getLocalDB();
  const index = db.stocks.findIndex((s) => s.id === id || s.ticker === id);
  if (index === -1) return undefined;

  const current = db.stocks[index];
  const updated: Stock = {
    ...current,
    ...updates,
    current_price: updates.current_price !== undefined ? Math.max(1, Number(updates.current_price)) : current.current_price,
    day_high: updates.current_price !== undefined ? Math.max(current.day_high, Number(updates.current_price)) : current.day_high,
    day_low: updates.current_price !== undefined ? Math.min(current.day_low, Number(updates.current_price)) : current.day_low,
  };

  db.stocks[index] = updated;
  saveLocalDB(db);
  return updated;
}

// -----------------------------------------------------------------------------
// USERS & SESSIONS (Secured with Supabase Cloud Auth)
// -----------------------------------------------------------------------------
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const normEmail = email.trim().toLowerCase();
  const db = getLocalDB();
  const indexes = getDBIndexes();
  const localUser = indexes.usersByEmail.get(normEmail) || db.users.find((u) => u.email.toLowerCase() === normEmail);

  // If Supabase is available, query Supabase for latest credentials & password hash
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', normEmail)
        .maybeSingle();

      if (!error && data) {
        if (localUser) {
          // Merge local game balances/portfolios with secure credentials from Supabase
          return {
            ...localUser,
            password_hash: data.password_hash,
            role: (data.role as Role) || localUser.role,
          };
        }
        // User exists in Supabase but not in local cache -> create safe local representation
        const newUser: User = {
          id: data.id,
          email: data.email,
          role: data.role as Role,
          balance: Number(data.balance) || 1000000,
          ecoin_balance: Number(data.ecoin_balance) || 0,
          created_at: data.created_at || new Date().toISOString(),
        };
        db.users.push(newUser);
        saveLocalDB(db);

        return {
          ...newUser,
          password_hash: data.password_hash,
        };
      }
    } catch (e) {
      console.warn('Supabase getUserByEmail fetch failed, using local fallback:', e);
    }
  }

  return localUser;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const indexes = getDBIndexes();
  const localUser = indexes.usersById.get(id) || getLocalDB().users.find((u) => u.id === id);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        if (localUser) {
          return {
            ...localUser,
            password_hash: data.password_hash,
            role: (data.role as Role) || localUser.role,
          };
        }
        return {
          id: data.id,
          email: data.email,
          password_hash: data.password_hash,
          role: data.role as Role,
          balance: Number(data.balance) || 1000000,
          ecoin_balance: Number(data.ecoin_balance) || 0,
          created_at: data.created_at,
        };
      }
    } catch (e) {
      console.warn('Supabase getUserById error:', e);
    }
  }

  return localUser;
}

export async function createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
  const normEmail = user.email.trim().toLowerCase();
  let createdId: string | undefined;
  let createdAt = new Date().toISOString();

  // 1. Securely persist credentials and user account in Supabase cloud
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: normEmail,
          password_hash: user.password_hash,
          role: user.role,
          balance: user.balance,
          ecoin_balance: user.ecoin_balance || 0,
        })
        .select()
        .single();

      if (!error && data) {
        createdId = data.id;
        createdAt = data.created_at;
      } else if (error) {
        console.warn('Supabase createUser error:', error);
      }
    } catch (e) {
      console.warn('Supabase createUser exception:', e);
    }
  }

  // 2. Local storage: Persist account and hashed password
  const db = getLocalDB();
  const finalId = createdId || 'usr-' + Math.random().toString(36).substring(2, 9);
  
  // Find desk admin to auto-allot if regular student
  const activeAdmins = db.users.filter((u) => u.role === 'admin' || u.role === 'superadmin');
  const deskLead = db.users.find((a) => a.email.toLowerCase() === 'ssaini3_be25@thapar.edu') || activeAdmins[0];

  const localSafeUser: User = {
    id: finalId,
    email: normEmail,
    password_hash: user.password_hash,
    first_name: user.first_name,
    last_name: user.last_name,
    username:
      user.username ||
      (user.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : `Trader_${normEmail.split('@')[0]}`),
    role: user.role,
    balance: user.balance,
    ecoin_balance: user.ecoin_balance || 0,
    created_at: createdAt,
    assigned_admin_id: user.assigned_admin_id || (user.role !== 'admin' && user.role !== 'superadmin' && deskLead ? deskLead.id : undefined),
    assigned_admin_name: user.assigned_admin_name || (user.role !== 'admin' && user.role !== 'superadmin' && deskLead ? deskLead.username || deskLead.first_name || 'Desk Lead' : undefined),
    group_name: user.group_name || (user.role !== 'admin' && user.role !== 'superadmin' ? 'Group Alpha - Desk 1' : undefined),
  };

  const existingIdx = db.users.findIndex((u) => u.email.toLowerCase() === normEmail);
  if (existingIdx >= 0) {
    db.users[existingIdx] = localSafeUser;
  } else {
    db.users.push(localSafeUser);
  }
  saveLocalDB(db);

  return {
    ...localSafeUser,
    password_hash: user.password_hash,
  };
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  if (!user) return undefined;
  Object.assign(user, updates);
  saveLocalDB(db);

  if (supabase) {
    try {
      const supabaseUpdates: any = {};
      if (updates.role) supabaseUpdates.role = updates.role;
      if (updates.balance !== undefined) supabaseUpdates.balance = updates.balance;
      if (updates.ecoin_balance !== undefined) supabaseUpdates.ecoin_balance = updates.ecoin_balance;
      if (updates.password_hash) supabaseUpdates.password_hash = updates.password_hash;

      if (Object.keys(supabaseUpdates).length > 0) {
        await supabase.from('users').update(supabaseUpdates).ilike('email', user.email);
      }
    } catch (e) {
      // non-blocking
    }
  }

  return user;
}

export async function updateUserBalance(
  userId: string,
  cashDelta: number,
  ecoinDelta = 0
): Promise<User | undefined> {
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  if (!user) return undefined;

  user.balance = Math.max(0, Number((user.balance + cashDelta).toFixed(2)));
  user.ecoin_balance = Math.max(0, Number((user.ecoin_balance + ecoinDelta).toFixed(2)));
  saveLocalDB(db);

  if (supabase) {
    try {
      await supabase
        .from('users')
        .update({ balance: user.balance, ecoin_balance: user.ecoin_balance })
        .ilike('email', user.email);
    } catch (e) {
      // non-blocking
    }
  }

  return user;
}

export async function updateUserRole(userId: string, role: Role): Promise<User | undefined> {
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  if (!user) return undefined;
  user.role = role;
  saveLocalDB(db);

  if (supabase) {
    try {
      await supabase
        .from('users')
        .update({ role: role })
        .ilike('email', user.email);
    } catch (e) {
      // non-blocking
    }
  }

  return user;
}

export async function getAllAdmins(): Promise<User[]> {
  const db = getLocalDB();
  return db.users
    .filter((u) => u.role === 'admin' || u.role === 'superadmin')
    .map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username || u.first_name || u.email.split('@')[0],
      group_name: u.group_name || 'Trading Desk Lead',
      balance: u.balance,
      ecoin_balance: u.ecoin_balance,
      created_at: u.created_at,
    }));
}

export async function getAllUsersWithStats(): Promise<any[]> {
  const db = getLocalDB();
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));

  // Include all non-admin students (participants)
  return db.users
    .filter((u) => u.role !== 'admin' && u.role !== 'superadmin')
    .map((user) => {
      const userPortfolios = db.portfolios.filter((p) => p.user_id === user.id && p.shares_count > 0);
      const holdingsValue = userPortfolios.reduce((sum, p) => {
        const stock = stocksMap.get(p.stock_id);
        const price = stock ? stock.current_price : p.avg_buy_price;
        return sum + p.shares_count * price;
      }, 0);

      const netWorth = user.balance + holdingsValue;
      const initialCash = 1000000;
      const totalReturn = netWorth - initialCash;
      const totalReturnPercent = (totalReturn / initialCash) * 100;

      // Ensure sensitive security credentials (password_hash) are never leaked in API payloads
      const { password_hash, ...safeUser } = user;

      return {
        ...safeUser,
        holdingsValue,
        netWorth,
        totalReturn,
        totalReturnPercent,
        holdingsCount: userPortfolios.length,
        portfolios: userPortfolios.map((p) => ({
          ...p,
          stock: stocksMap.get(p.stock_id),
        })),
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);
}

export async function getStudentsForAdmin(adminSession: {
  userId?: string;
  id?: string;
  role: Role;
  email: string;
}): Promise<any[]> {
  const allStudents = await getAllUsersWithStats();
  const adminId = adminSession.userId || adminSession.id;

  // Superadmin gets complete global roster
  if (adminSession.role === 'superadmin') {
    return allStudents;
  }

  // Desk Admin gets only their assigned cohort of students
  return allStudents.filter(
    (s) => s.assigned_admin_id === adminId || s.assigned_admin_name === adminSession.email
  );
}

export async function assignStudentToAdmin(
  studentId: string,
  adminId: string,
  groupName?: string
): Promise<User | undefined> {
  const db = getLocalDB();
  const student = db.users.find((u) => u.id === studentId || u.email.toLowerCase() === studentId.toLowerCase());
  if (!student) return undefined;

  const targetAdmin = db.users.find((u) => u.id === adminId || u.email.toLowerCase() === adminId.toLowerCase());
  if (!targetAdmin) return undefined;

  student.assigned_admin_id = targetAdmin.id;
  student.assigned_admin_name =
    targetAdmin.username || targetAdmin.first_name
      ? `${targetAdmin.first_name || ''} ${targetAdmin.last_name || ''}`.trim()
      : targetAdmin.email.split('@')[0];

  if (groupName) {
    student.group_name = groupName;
  } else if (targetAdmin.group_name) {
    student.group_name = targetAdmin.group_name;
  }

  saveLocalDB(db);
  return student;
}

export async function adminExecuteTrade(
  adminSession: { userId: string; role: Role; email: string },
  studentId: string,
  stockId: string,
  type: TransactionType,
  quantity: number
): Promise<{ success: boolean; transaction?: Transaction; error?: string; student?: any }> {
  const db = getLocalDB();
  const student = db.users.find((u) => u.id === studentId || u.email.toLowerCase() === studentId.toLowerCase());
  if (!student) {
    return { success: false, error: 'Student participant account not found.' };
  }

  // Permission check: Superadmin can trade for any student; Desk Admin only for assigned cohort
  const isSuper = adminSession.role === 'superadmin';
  const isAssignedAdmin = student.assigned_admin_id === adminSession.userId;

  if (!isSuper && !isAssignedAdmin) {
    return {
      success: false,
      error: `Access denied. This student is assigned to ${student.assigned_admin_name || 'another Desk Admin'}. Only their assigned desk administrator or a superadmin can modify this portfolio.`,
    };
  }

  const result = await executeTrade(student.id, stockId, type, quantity);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const updatedStudents = await getAllUsersWithStats();
  const updatedStudent = updatedStudents.find((s) => s.id === student.id);

  return {
    success: true,
    transaction: result.transaction,
    student: updatedStudent,
  };
}

// -----------------------------------------------------------------------------
// PORTFOLIOS & TRANSACTIONS
// -----------------------------------------------------------------------------
export function syncTeamPortfolioAndBalance(teamId: string) {
  const db = getLocalDB();
  if (!db.teams) return;
  const team = db.teams.find((t) => t.id === teamId || t.name.toLowerCase() === teamId.toLowerCase());
  if (!team) return;

  const memberEmails = (team.members || []).map((m) => (m.email || '').toLowerCase());
  const memberIds = (team.members || []).map((m) => m.id);

  // Find all registered users belonging to this team
  const teamUsers = db.users.filter(
    (u) =>
      u.team_id === team.id ||
      memberIds.includes(u.id) ||
      (u.email && memberEmails.includes(u.email.toLowerCase()))
  );

  if (teamUsers.length === 0) return;

  // Ensure all team users have team_id and team_name set
  teamUsers.forEach((u) => {
    u.team_id = team.id;
    u.team_name = team.name;
  });

  // Determine authoritative balance: team leader or highest activity user
  const leaderUser =
    teamUsers.find(
      (u) =>
        u.id === team.leader_id ||
        (u.email && team.leader_email && u.email.toLowerCase() === team.leader_email.toLowerCase())
    ) || teamUsers[0];

  const authoritativeBalance = leaderUser.balance;
  team.balance = authoritativeBalance;

  // Set all team users to this balance
  teamUsers.forEach((u) => {
    u.balance = authoritativeBalance;
  });

  // Get authoritative holdings from leaderUser (or first member with holdings)
  let refHoldings = db.portfolios.filter((p) => p.user_id === leaderUser.id && p.shares_count > 0);
  if (refHoldings.length === 0) {
    for (const tu of teamUsers) {
      const tuHoldings = db.portfolios.filter((p) => p.user_id === tu.id && p.shares_count > 0);
      if (tuHoldings.length > 0) {
        refHoldings = tuHoldings;
        break;
      }
    }
  }

  // Mirror refHoldings to ALL team users so every member sees identical portfolios
  for (const tu of teamUsers) {
    for (const rh of refHoldings) {
      const p = db.portfolios.find((port) => port.user_id === tu.id && port.stock_id === rh.stock_id);
      if (!p) {
        db.portfolios.push({
          id: 'port-' + Math.random().toString(36).substring(2, 9),
          user_id: tu.id,
          stock_id: rh.stock_id,
          shares_count: rh.shares_count,
          avg_buy_price: rh.avg_buy_price,
          updated_at: new Date().toISOString(),
        });
      } else {
        p.shares_count = rh.shares_count;
        p.avg_buy_price = rh.avg_buy_price;
        p.updated_at = new Date().toISOString();
      }
    }

    // Zero out any holdings that the team no longer owns
    const refStockIds = new Set(refHoldings.map((rh) => rh.stock_id));
    for (const p of db.portfolios.filter((port) => port.user_id === tu.id)) {
      if (!refStockIds.has(p.stock_id)) {
        p.shares_count = 0;
      }
    }
  }

  saveLocalDB(db);
}

export async function getUserPortfolios(userId: string): Promise<Portfolio[]> {
  const db = getLocalDB();
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));
  const user = db.users.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));

  const team = user
    ? db.teams?.find(
        (t) =>
          t.id === user.team_id ||
          t.name.toLowerCase() === (user.team_name || '').toLowerCase() ||
          t.members?.some(
            (m) =>
              m.id === user.id ||
              (m.email && m.email.toLowerCase() === (user.email || '').toLowerCase())
          )
      )
    : undefined;

  if (team) {
    syncTeamPortfolioAndBalance(team.id);
  }

  const userPorts = db.portfolios.filter((p) => p.user_id === userId && p.shares_count > 0);

  return userPorts.map((p) => ({
    ...p,
    stock: stocksMap.get(p.stock_id),
  }));
}

export async function getUserTransactions(userId?: string): Promise<Transaction[]> {
  const db = getLocalDB();
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));

  let list = db.transactions;
  if (userId) {
    const user = db.users.find((u) => u.id === userId);
    const team = user
      ? db.teams?.find(
          (t) =>
            t.id === user.team_id ||
            t.members?.some(
              (m) =>
                m.id === user.id ||
                (m.email && m.email.toLowerCase() === (user.email || '').toLowerCase())
            )
        )
      : undefined;

    let targetIds = [userId];
    if (team && team.members) {
      const memberEmails = team.members.map((m) => (m.email || '').toLowerCase());
      const memberIds = team.members.map((m) => m.id);
      const teammates = db.users.filter(
        (u) =>
          u.team_id === team.id ||
          memberIds.includes(u.id) ||
          (u.email && memberEmails.includes(u.email.toLowerCase()))
      );
      targetIds = Array.from(new Set([userId, ...teammates.map((t) => t.id)]));
    }

    list = list.filter((t) => targetIds.includes(t.user_id));
  }

  return list
    .map((t) => ({
      ...t,
      stock: stocksMap.get(t.stock_id),
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function executeTrade(
  userId: string,
  stockId: string,
  type: TransactionType,
  quantity: number
): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { success: false, error: 'Invalid share quantity' };
  }

  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  const stock = db.stocks.find((s) => s.id === stockId || s.ticker === stockId);
  if (!stock) return { success: false, error: 'Stock not found' };

  if (stock.is_frozen) {
    return {
      success: false,
      error: `Trading circuit breaker is active for ${stock.ticker}. Orders are suspended.`,
    };
  }

  // Circuit Limit Collars (±10% price bands)
  if (stock.upper_circuit && stock.current_price >= stock.upper_circuit && type === 'BUY') {
    return {
      success: false,
      error: `Trading blocked: ${stock.ticker} is locked at the Upper Circuit Limit (₹${stock.upper_circuit.toFixed(2)}). Buy orders cannot be executed until market unfreezes.`,
    };
  }

  if (stock.lower_circuit && stock.current_price <= stock.lower_circuit && type === 'SELL') {
    return {
      success: false,
      error: `Trading blocked: ${stock.ticker} is locked at the Lower Circuit Limit (₹${stock.lower_circuit.toFixed(2)}). Sell orders cannot be executed until market unfreezes.`,
    };
  }

  const grossTradeValue = Number((stock.current_price * quantity).toFixed(2));
  const brokerage = Number((grossTradeValue * 0.05).toFixed(2)); // 5% Econ Brokerage Fee

  let userPortfolio = db.portfolios.find(
    (p) => p.user_id === userId && p.stock_id === stock.id
  );

  if (type === 'BUY') {
    const totalRequired = Number((grossTradeValue + brokerage).toFixed(2));
    if (user.balance < totalRequired) {
      return {
        success: false,
        error: `Insufficient virtual cash. Required: ₹${totalRequired.toLocaleString('en-IN')} (incl. 5% Econ Brokerage of ₹${brokerage.toLocaleString('en-IN')}), Available: ₹${user.balance.toLocaleString('en-IN')}`,
      };
    }

    // 10% Minimum Cash Reserve Floor Rule (₹1,00,000)
    const resultingCash = Number((user.balance - totalRequired).toFixed(2));
    if (resultingCash < 100000) {
      return {
        success: false,
        error: `Liquidity Rule Violation: Team must maintain at least 10% cash reserve (₹1,00,000) at all times to prevent round disqualification. Remaining balance after trade would be ₹${resultingCash.toLocaleString('en-IN')}.`,
      };
    }

    user.balance = resultingCash;

    if (!userPortfolio) {
      userPortfolio = {
        id: 'port-' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        stock_id: stock.id,
        shares_count: quantity,
        avg_buy_price: Number((totalRequired / quantity).toFixed(2)),
        updated_at: new Date().toISOString(),
      };
      db.portfolios.push(userPortfolio);
    } else {
      const prevTotal = userPortfolio.shares_count * userPortfolio.avg_buy_price;
      const newTotal = prevTotal + totalRequired;
      const newCount = userPortfolio.shares_count + quantity;
      userPortfolio.shares_count = newCount;
      userPortfolio.avg_buy_price = Number((newTotal / newCount).toFixed(2));
      userPortfolio.updated_at = new Date().toISOString();
    }
  } else {
    // SELL
    if (!userPortfolio || userPortfolio.shares_count < quantity) {
      const available = userPortfolio ? userPortfolio.shares_count : 0;
      return {
        success: false,
        error: `Insufficient shares to sell. Available: ${available}, Requested: ${quantity}`,
      };
    }

    const netCredit = Number((grossTradeValue - brokerage).toFixed(2));
    user.balance = Number((user.balance + netCredit).toFixed(2));
    userPortfolio.shares_count -= quantity;
    userPortfolio.updated_at = new Date().toISOString();
  }

  const tx: Transaction = {
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    stock_id: stock.id,
    type,
    quantity,
    price_at_trade: stock.current_price,
    gross_amount: grossTradeValue,
    brokerage,
    net_amount: type === 'BUY' ? Number((grossTradeValue + brokerage).toFixed(2)) : Number((grossTradeValue - brokerage).toFixed(2)),
    timestamp: new Date().toISOString(),
  };

  db.transactions.push(tx);

  // Synchronize trade and portfolio across all members of the student's team
  const team = db.teams?.find(
    (t) =>
      t.id === user.team_id ||
      t.members?.some(
        (m) =>
          m.id === user.id ||
          (m.email && m.email.toLowerCase() === (user.email || '').toLowerCase())
      )
  );

  if (team && team.members) {
    const memberEmails = team.members.map((m) => (m.email || '').toLowerCase());
    const memberIds = team.members.map((m) => m.id);

    const teammates = db.users.filter(
      (u) =>
        u.id !== user.id &&
        (u.team_id === team.id ||
          memberIds.includes(u.id) ||
          (u.email && memberEmails.includes(u.email.toLowerCase())))
    );

    for (const mate of teammates) {
      // Sync cash balance
      mate.balance = user.balance;

      let matePort = db.portfolios.find(
        (p) => p.user_id === mate.id && p.stock_id === stock.id
      );

      if (type === 'BUY') {
        if (!matePort) {
          db.portfolios.push({
            id: 'port-' + Math.random().toString(36).substring(2, 9),
            user_id: mate.id,
            stock_id: stock.id,
            shares_count: userPortfolio!.shares_count,
            avg_buy_price: userPortfolio!.avg_buy_price,
            updated_at: new Date().toISOString(),
          });
        } else {
          matePort.shares_count = userPortfolio!.shares_count;
          matePort.avg_buy_price = userPortfolio!.avg_buy_price;
          matePort.updated_at = new Date().toISOString();
        }
      } else {
        if (matePort) {
          matePort.shares_count = userPortfolio!.shares_count;
          matePort.updated_at = new Date().toISOString();
        }
      }

      // Record transaction for teammate
      db.transactions.push({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        user_id: mate.id,
        stock_id: stock.id,
        type,
        quantity,
        price_at_trade: stock.current_price,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Record Latest Broadcast Trade for Floor Telemetry (10s banner on all participant screens)
  (db as any).latest_trade = {
    id: 'trade-' + Date.now(),
    seller_team: type === 'SELL' ? (team?.name || user.username || 'Desk Trader') : 'Central Primary Pool',
    buyer_team: type === 'BUY' ? (team?.name || user.username || 'Desk Trader') : 'Central Primary Pool',
    ticker: stock.ticker,
    stock_name: stock.name,
    quantity,
    price: stock.current_price,
    total_amount: grossTradeValue,
    timestamp: Date.now(),
  };

  saveLocalDB(db);

  return { success: true, transaction: { ...tx, stock } };
}

// -----------------------------------------------------------------------------
// MACRO EVENTS & CRISIS SCENARIOS
// -----------------------------------------------------------------------------
export async function getMarketEvents(): Promise<MarketEvent[]> {
  const db = getLocalDB();
  return db.market_events.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function injectMarketEvent(
  headline: string,
  description: string,
  impactMap: Record<string, number>
): Promise<MarketEvent> {
  const db = getLocalDB();

  // Apply percentage deltas to affected stocks
  for (const [ticker, deltaPercent] of Object.entries(impactMap)) {
    const stock = db.stocks.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
    if (stock) {
      const factor = 1 + deltaPercent / 100;
      const newPrice = Number((stock.current_price * factor).toFixed(2));
      stock.current_price = Math.max(1, newPrice);
      stock.day_high = Math.max(stock.day_high, newPrice);
      stock.day_low = Math.min(stock.day_low, newPrice);
    }
  }

  const newEvent: MarketEvent = {
    id: 'evt-' + Math.random().toString(36).substring(2, 9),
    headline,
    description,
    impact_map: impactMap,
    created_at: new Date().toISOString(),
  };

  db.market_events.unshift(newEvent);

  // Broadcast as breaking news
  const sentiment = Object.values(impactMap).reduce((a, b) => a + b, 0) > 0 ? 'BULLISH' : 'BEARISH';
  const newsItem: NewsArticle = {
    id: 'news-' + Math.random().toString(36).substring(2, 9),
    headline: `BREAKING: ${headline}`,
    body: description,
    sentiment,
    published_at: new Date().toISOString(),
  };
  db.news_articles.unshift(newsItem);

  saveLocalDB(db);
  return newEvent;
}

export async function triggerCrisisScenario(presetId: string): Promise<MarketEvent> {
  const presets: Record<string, { headline: string; desc: string; impacts: Record<string, number> }> = {
    recession: {
      headline: 'Global Macro Contraction Triggers Dalal Street Sell-Off (-8%)',
      desc: 'Central banks warn of prolonged stagflation risks as emerging market equity risk premiums rise.',
      impacts: {
        RELIANCE: -7.5,
        TCS: -8.0,
        HDFCBANK: -8.5,
        TATAMOTORS: -11.0,
        INFY: -9.0,
        ITC: -3.5,
        ONGC: -6.0,
        ICICIBANK: -8.2,
      },
    },
    tech_crash: {
      headline: 'Silicon Valley Valuations Plunge: Tech Sector Shaken (-12%)',
      desc: 'Export order cancellations and margin compressions drive heavy institutional offloading in Indian IT majors.',
      impacts: {
        TCS: -12.5,
        INFY: -14.0,
        BHARTIARTL: -4.0,
      },
    },
    oil_surge: {
      headline: 'Hormuz Strait Bottleneck: Brent Crude Spikes +18%',
      desc: 'Supply tightness benefits state explorers while pressuring transport and retail margins across auto and aviation.',
      impacts: {
        ONGC: 14.5,
        RELIANCE: 6.2,
        TATAMOTORS: -9.5,
        ITC: -2.0,
      },
    },
    rbi_rate_cut: {
      headline: 'Surprise MPC Decision: 50 bps Emergency Rate Cut (+5%)',
      desc: 'RBI injects aggressive liquidity into the financial system to spur domestic industrial capex.',
      impacts: {
        HDFCBANK: 6.5,
        ICICIBANK: 7.2,
        TATAMOTORS: 8.0,
        RELIANCE: 4.5,
        ITC: 3.0,
      },
    },
    liquidity_squeeze: {
      headline: 'Overnight Interbank Liquidity Squeeze: Margin Calls Triggered (-9%)',
      desc: 'Overnight call money rates spike past 9.5%, forcing forced unwinds and broad liquidity constraints.',
      impacts: {
        TATASTEEL: -8.5,
        INFY: -7.0,
        RELIANCE: -5.5,
        HDFCBANK: -6.0,
        TATAMOTORS: -10.0,
      },
    },
  };

  const idMap: Record<string, string> = {
    'recession': 'recession',
    'Recessionary Shock': 'recession',
    'tech_crash': 'tech_crash',
    'Tech Sector Drop': 'tech_crash',
    'oil_surge': 'oil_surge',
    'Crude Oil Spike': 'oil_surge',
    'liquidity_squeeze': 'liquidity_squeeze',
    'Liquidity Squeeze': 'liquidity_squeeze',
    'rbi_rate_cut': 'rbi_rate_cut',
  };

  const key = idMap[presetId] || presetId;
  const scenario = presets[key] || presets['recession'];
  return injectMarketEvent(scenario.headline, scenario.desc, scenario.impacts);
}

// -----------------------------------------------------------------------------
// NEWS & QUIZZES
// -----------------------------------------------------------------------------
export async function getNewsArticles(): Promise<NewsArticle[]> {
  const db = getLocalDB();
  return db.news_articles.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

export async function getQuizzes(): Promise<Quiz[]> {
  const db = getLocalDB();
  return db.quizzes;
}

export async function submitQuizScore(
  userId: string,
  quizId: string,
  userScore: number,
  totalQuestions: number
): Promise<{ earnedCash: number; earnedEcoin: number; message: string }> {
  const db = getLocalDB();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) throw new Error('Quiz not found');

  const ratio = userScore / totalQuestions;
  if (ratio >= 0.66) {
    // Passed quiz with high score
    const earnedCash = quiz.reward_cash;
    const earnedEcoin = quiz.reward_ecoin;
    await updateUserBalance(userId, earnedCash, earnedEcoin);
    return {
      earnedCash,
      earnedEcoin,
      message: `Outstanding! You scored ${userScore}/${totalQuestions}. Credited ₹${earnedCash.toLocaleString('en-IN')} cash and ${earnedEcoin} ECoin!`,
    };
  }

  return {
    earnedCash: 0,
    earnedEcoin: 0,
    message: `Score: ${userScore}/${totalQuestions}. Minimum 66% required to unlock reward. Review concepts and retry!`,
  };
}

// -----------------------------------------------------------------------------
// DETERMINISTIC SIMULATED MARKET TICK ENGINE
// -----------------------------------------------------------------------------
export async function simulateMarketTick(): Promise<Stock[]> {
  const db = getLocalDB();

  db.stocks = db.stocks.map((stock) => {
    if (stock.is_frozen) return stock;

    // Small random walk between -1.2% and +1.2%
    const randomPercent = (Math.random() * 2.4 - 1.18) / 100;
    const newPrice = Number((stock.current_price * (1 + randomPercent)).toFixed(2));

    return {
      ...stock,
      current_price: Math.max(1, newPrice),
      day_high: Math.max(stock.day_high, newPrice),
      day_low: Math.min(stock.day_low, newPrice),
    };
  });

  saveLocalDB(db);
  return db.stocks;
}

// -----------------------------------------------------------------------------
// INSTITUTIONAL RISK & MARKET DEPTH ENGINE
// -----------------------------------------------------------------------------

export function calculateInstitutionalRiskMetrics(
  holdings: (Portfolio & { stock?: Stock })[],
  cashBalance: number
): InstitutionalRiskMetrics {
  const db = getLocalDB();
  const holdingsValue = holdings.reduce((sum, h) => {
    const price = h.stock ? h.stock.current_price : h.avg_buy_price;
    return sum + h.shares_count * price;
  }, 0);

  const totalAum = Math.max(1, holdingsValue + cashBalance);

  // Sector Exposure & Concentration Analysis (>40% threshold)
  const sectorMap = new Map<string, number>();
  holdings.forEach((h) => {
    const sector = h.stock?.sector || 'Diversified';
    const val = h.shares_count * (h.stock?.current_price || h.avg_buy_price);
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + val);
  });

  const sectorAllocations: SectorExposure[] = Array.from(sectorMap.entries()).map(
    ([sector, value]) => {
      const percentage = Number(((value / (holdingsValue || 1)) * 100).toFixed(1));
      return {
        sector,
        value: Number(value.toFixed(2)),
        percentage,
        isConcentrated: percentage > 40.0,
      };
    }
  );

  // Portfolio Beta relative to NIFTY 50
  let weightedBetaSum = 0;
  if (holdingsValue > 0) {
    holdings.forEach((h) => {
      const val = h.shares_count * (h.stock?.current_price || h.avg_buy_price);
      const beta = h.stock?.beta ?? 1.0;
      weightedBetaSum += (val / holdingsValue) * beta;
    });
  } else {
    weightedBetaSum = 1.0;
  }
  const portfolioBeta = Number(weightedBetaSum.toFixed(2));

  // Parametric 1-Day 95% Value-at-Risk (Z = 1.645)
  // Daily benchmark volatility ~ 1.25%, scaled by portfolio beta
  const dailyVol = 0.0125 * Math.max(0.4, portfolioBeta);
  const var95Percent1Day = Number((totalAum * 1.645 * dailyVol).toFixed(2));

  // Check circuit limit breaches across fund holdings
  const circuitLimitBreachesCount = holdings.filter((h) => {
    if (!h.stock) return false;
    const s = h.stock;
    const atUpper = s.upper_circuit ? s.current_price >= s.upper_circuit : false;
    const atLower = s.lower_circuit ? s.current_price <= s.lower_circuit : false;
    return s.is_frozen || atUpper || atLower;
  }).length;

  return {
    var95Percent1Day,
    portfolioBeta,
    maxDrawdownPercent: 6.4,
    sharpeRatio: 1.82,
    sectorAllocations,
    circuitLimitBreachesCount,
  };
}

export function generateMarketDepth(stockIdOrTicker: string): MarketDepth {
  const db = getLocalDB();
  const stock = db.stocks.find((s) => s.id === stockIdOrTicker || s.ticker === stockIdOrTicker);
  const basePrice = stock ? stock.current_price : 1000;

  // Generate 5-level deterministic bid & ask ladder
  const spread = Number((basePrice * 0.0012).toFixed(2)); // ~12 bps base spread
  const halfSpread = spread / 2;

  const bidStepFactors = [0.0, 0.0015, 0.0035, 0.0060, 0.0095];
  const askStepFactors = [0.0, 0.0015, 0.0035, 0.0060, 0.0095];

  let cumulativeBidVol = 0;
  const bids = bidStepFactors.map((factor, index) => {
    const price = Number((basePrice - halfSpread - basePrice * factor).toFixed(2));
    const quantity = Math.floor(150 * (index + 1) + (basePrice % 50) * (index + 2));
    const ordersCount = Math.floor(4 + index * 3 + (quantity % 7));
    cumulativeBidVol += quantity;
    return {
      price,
      quantity,
      ordersCount,
      totalVolume: cumulativeBidVol,
    };
  });

  let cumulativeAskVol = 0;
  const asks = askStepFactors.map((factor, index) => {
    const price = Number((basePrice + halfSpread + basePrice * factor).toFixed(2));
    const quantity = Math.floor(120 * (index + 1) + (basePrice % 40) * (index + 2));
    const ordersCount = Math.floor(3 + index * 3 + (quantity % 5));
    cumulativeAskVol += quantity;
    return {
      price,
      quantity,
      ordersCount,
      totalVolume: cumulativeAskVol,
    };
  });

  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  const effectiveSpread = Number((bestAsk - bestBid).toFixed(2));
  const spreadBps = Number(((effectiveSpread / basePrice) * 10000).toFixed(1));

  return {
    bids,
    asks,
    spread: effectiveSpread,
    spreadBps,
  };
}

// -----------------------------------------------------------------------------
// FUND SYNDICATE & GOVERNANCE OPERATIONS
// -----------------------------------------------------------------------------

export async function getSyndicateFundDetails(): Promise<{
  fund: SyndicateFund;
  holdings: (Portfolio & { stock?: Stock })[];
  riskMetrics: InstitutionalRiskMetrics;
  auditTransactions: (Transaction & { stock?: Stock })[];
  proposals: (TradeProposal & { stock?: Stock })[];
  snapshots: PortfolioSnapshot[];
}> {
  const db = getLocalDB();
  const fund = db.syndicate_fund || DEFAULT_SYNDICATE_FUND;
  const fundHoldings = db.fund_portfolios || DEFAULT_FUND_PORTFOLIO;
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));

  const hydratedHoldings = fundHoldings.map((h) => ({
    ...h,
    stock: stocksMap.get(h.stock_id),
  }));

  // Re-calculate live fund equity
  const holdingsValue = hydratedHoldings.reduce((sum, h) => {
    const price = h.stock ? h.stock.current_price : h.avg_buy_price;
    return sum + h.shares_count * price;
  }, 0);

  const updatedFund: SyndicateFund = {
    ...fund,
    total_aum: Number((fund.cash_balance + holdingsValue).toFixed(2)),
  };

  const riskMetrics = calculateInstitutionalRiskMetrics(hydratedHoldings, fund.cash_balance);

  // Fund audit transactions
  const auditTransactions = db.transactions
    .filter((t) => t.user_id === fund.id)
    .map((t) => ({
      ...t,
      stock: stocksMap.get(t.stock_id),
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Hydrated trade proposals
  const proposals = (db.trade_proposals || DEFAULT_PROPOSALS)
    .map((p) => ({
      ...p,
      stock: stocksMap.get(p.stock_id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const snapshots = (db.portfolio_snapshots || DEFAULT_SNAPSHOTS).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    fund: updatedFund,
    holdings: hydratedHoldings,
    riskMetrics,
    auditTransactions,
    proposals,
    snapshots,
  };
}

export async function getTradeProposals(status?: ProposalStatus): Promise<(TradeProposal & { stock?: Stock })[]> {
  const db = getLocalDB();
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));
  let list = db.trade_proposals || DEFAULT_PROPOSALS;

  if (status) {
    list = list.filter((p) => p.status === status);
  }

  return list
    .map((p) => ({
      ...p,
      stock: stocksMap.get(p.stock_id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createTradeProposal(data: {
  proposer_id: string;
  proposer_email: string;
  proposer_role: Role;
  stock_id: string;
  type: TransactionType;
  quantity: number;
  thesis_category: ProposalThesisCategory;
  thesis_notes: string;
}): Promise<{ success: boolean; proposal?: TradeProposal; error?: string }> {
  if (data.quantity <= 0 || !Number.isInteger(data.quantity)) {
    return { success: false, error: 'Invalid share quantity proposed.' };
  }

  if (!data.thesis_notes || data.thesis_notes.trim().length < 15) {
    return {
      success: false,
      error: 'Institutional trade governance requires a comprehensive investment thesis (minimum 15 characters).',
    };
  }

  const db = getLocalDB();
  const stock = db.stocks.find((s) => s.id === data.stock_id || s.ticker === data.stock_id);
  if (!stock) {
    return { success: false, error: 'Selected stock was not found.' };
  }

  const fund = db.syndicate_fund || DEFAULT_SYNDICATE_FUND;
  const estimated_total = Number((stock.current_price * data.quantity).toFixed(2));

  // Risk check: verify fund has sufficient cash if BUY proposal
  if (data.type === 'BUY' && fund.cash_balance < estimated_total) {
    return {
      success: false,
      error: `Proposal exceeds available fund liquidity. Required: ₹${estimated_total.toLocaleString('en-IN')}, Fund Cash: ₹${fund.cash_balance.toLocaleString('en-IN')}`,
    };
  }

  const newProposal: TradeProposal = {
    id: 'prop-' + Math.random().toString(36).substring(2, 9),
    fund_id: fund.id,
    proposer_id: data.proposer_id,
    proposer_email: data.proposer_email,
    proposer_role: data.proposer_role,
    stock_id: stock.id,
    ticker: stock.ticker,
    type: data.type,
    quantity: data.quantity,
    proposed_price: stock.current_price,
    estimated_total,
    thesis_category: data.thesis_category,
    thesis_notes: data.thesis_notes.trim(),
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  if (!db.trade_proposals) {
    db.trade_proposals = [];
  }
  db.trade_proposals.unshift(newProposal);
  saveLocalDB(db);

  return { success: true, proposal: newProposal };
}

export async function reviewTradeProposal(
  proposalId: string,
  reviewer: { id: string; email: string; role: Role },
  action: 'APPROVE' | 'REJECT',
  feedback: string
): Promise<{ success: boolean; proposal?: TradeProposal; error?: string }> {
  // Only Admin and Superadmin can approve/reject proposals
  if (reviewer.role !== 'admin' && reviewer.role !== 'superadmin') {
    return {
      success: false,
      error: 'Access denied: Only Desk Administrators and Superadmins hold voting veto authority.',
    };
  }

  const db = getLocalDB();
  const proposal = (db.trade_proposals || []).find((p) => p.id === proposalId);
  if (!proposal) {
    return { success: false, error: 'Proposal not found.' };
  }

  if (proposal.status !== 'PENDING') {
    return {
      success: false,
      error: `Proposal is already settled with status: ${proposal.status}`,
    };
  }

  const fund = db.syndicate_fund || DEFAULT_SYNDICATE_FUND;
  const stock = db.stocks.find((s) => s.id === proposal.stock_id);
  if (!stock) {
    return { success: false, error: 'Target stock asset no longer available.' };
  }

  if (action === 'REJECT') {
    proposal.status = 'REJECTED';
    proposal.reviewer_id = reviewer.id;
    proposal.reviewer_email = reviewer.email;
    proposal.reviewer_feedback = feedback || 'Rejected during Risk Committee governance review.';
    proposal.reviewed_at = new Date().toISOString();
    saveLocalDB(db);
    return { success: true, proposal };
  }

  // Action is APPROVE -> Execute into fund portfolio
  const executionPrice = stock.current_price;
  const totalCost = executionPrice * proposal.quantity;

  if (!db.fund_portfolios) {
    db.fund_portfolios = [];
  }

  let fundHolding = db.fund_portfolios.find((p) => p.stock_id === stock.id);

  if (proposal.type === 'BUY') {
    if (fund.cash_balance < totalCost) {
      return {
        success: false,
        error: `Insufficient fund liquidity at execution. Needed ₹${totalCost.toLocaleString('en-IN')}, available ₹${fund.cash_balance.toLocaleString('en-IN')}`,
      };
    }

    fund.cash_balance = Number((fund.cash_balance - totalCost).toFixed(2));

    if (!fundHolding) {
      fundHolding = {
        id: 'fport-' + Math.random().toString(36).substring(2, 9),
        user_id: fund.id,
        stock_id: stock.id,
        shares_count: proposal.quantity,
        avg_buy_price: executionPrice,
        updated_at: new Date().toISOString(),
      };
      db.fund_portfolios.push(fundHolding);
    } else {
      const prevTotal = fundHolding.shares_count * fundHolding.avg_buy_price;
      const newTotal = prevTotal + totalCost;
      const newCount = fundHolding.shares_count + proposal.quantity;
      fundHolding.shares_count = newCount;
      fundHolding.avg_buy_price = Number((newTotal / newCount).toFixed(2));
      fundHolding.updated_at = new Date().toISOString();
    }
  } else {
    // SELL
    if (!fundHolding || fundHolding.shares_count < proposal.quantity) {
      return {
        success: false,
        error: `Insufficient shares in fund portfolio. Available: ${fundHolding?.shares_count || 0}, requested: ${proposal.quantity}`,
      };
    }

    fund.cash_balance = Number((fund.cash_balance + totalCost).toFixed(2));
    fundHolding.shares_count -= proposal.quantity;
    fundHolding.updated_at = new Date().toISOString();
  }

  // Generate audit transaction log
  const txId = 'tx-fund-' + Math.random().toString(36).substring(2, 9);
  const tx: Transaction = {
    id: txId,
    user_id: fund.id,
    stock_id: stock.id,
    type: proposal.type,
    quantity: proposal.quantity,
    price_at_trade: executionPrice,
    price: executionPrice,
    total: totalCost,
    timestamp: new Date().toISOString(),
  };

  db.transactions.unshift(tx);

  // Update proposal record
  proposal.status = 'APPROVED';
  proposal.reviewer_id = reviewer.id;
  proposal.reviewer_email = reviewer.email;
  proposal.reviewer_feedback = feedback || 'Unanimously approved by Executive Board and routed to prime broker.';
  proposal.reviewed_at = new Date().toISOString();
  proposal.executed_transaction_id = txId;

  // Add a snapshot point if needed
  if (!db.portfolio_snapshots) {
    db.portfolio_snapshots = [];
  }
  const currentEquity = Number(
    (
      fund.cash_balance +
      db.fund_portfolios.reduce((sum, h) => {
        const s = db.stocks.find((st) => st.id === h.stock_id);
        return sum + h.shares_count * (s ? s.current_price : h.avg_buy_price);
      }, 0)
    ).toFixed(2)
  );

  db.portfolio_snapshots.push({
    id: 'snap-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    date_label: 'Post-Execution',
    fund_equity: currentEquity,
    cash_balance: fund.cash_balance,
    benchmark_value: 22250,
  });

  saveLocalDB(db);

  return { success: true, proposal };
}

// =============================================================================
// TEAMS, ORDER SLIPS & REAL-TIME EXCEL / CSV LEDGER
// =============================================================================

export function sanitizeCSVField(value: any): string {
  let str = (value ?? '').toString().replace(/"/g, '""');
  // Immunize against CSV Formula Injection (DDE): if field begins with =, +, -, @, tab, or carriage return
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

export function appendTradeToCSV(slip: OrderSlip, adminEmail: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const header = 'Slip ID,Timestamp,Team Name,Participant Name,Email,Stock Ticker,Stock Name,Order Type,Quantity,Price (INR),Gross Consideration (INR),Brokerage 5% (INR),Net Consideration (INR),Executed By Admin,Status\n';
    if (!fs.existsSync(CSV_FILE)) {
      fs.writeFileSync(CSV_FILE, header, 'utf8');
    }
    const safe = sanitizeCSVField;
    const gross = slip.gross_amount ?? Number((slip.price * slip.quantity).toFixed(2));
    const brok = slip.brokerage ?? Number((gross * 0.05).toFixed(2));
    const net = slip.total_amount;
    const row = `${safe(slip.slip_id)},${safe(new Date().toISOString())},${safe(slip.team_name)},${safe(slip.student_name)},${safe(slip.student_email)},${safe(slip.ticker)},${safe(slip.stock_name)},${safe(slip.type)},${slip.quantity},${slip.price},${gross},${brok},${net},${safe(adminEmail)},"EXECUTED"\n`;
    fs.appendFileSync(CSV_FILE, row, 'utf8');
  } catch (err) {
    console.error('Failed to append trade to CSV:', err);
  }
}

export function getLiveTradesCSVContent(): string {
  try {
    if (fs.existsSync(CSV_FILE)) {
      return fs.readFileSync(CSV_FILE, 'utf8');
    }
  } catch {}
  return 'Slip ID,Timestamp,Team Name,Participant Name,Email,Stock Ticker,Stock Name,Order Type,Quantity,Price (INR),Gross Consideration (INR),Brokerage 5% (INR),Net Consideration (INR),Executed By Admin,Status\n';
}

export async function getTeams(): Promise<Team[]> {
  const db = getLocalDB();
  return db.teams || [];
}

export async function getTeamById(teamId: string): Promise<Team | undefined> {
  const indexes = getDBIndexes();
  return (
    indexes.teamsById.get(teamId) ||
    indexes.teamsById.get(teamId.toLowerCase()) ||
    getLocalDB().teams?.find((t) => t.id === teamId || t.name.toLowerCase() === teamId.toLowerCase())
  );
}

export async function getUserTeam(userId: string): Promise<Team | undefined> {
  const indexes = getDBIndexes();
  const cachedTeam = indexes.teamsByMemberId.get(userId) || indexes.teamsByMemberId.get(userId.trim().toLowerCase());
  if (cachedTeam) return cachedTeam;
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
  return db.teams?.find(
    (t) =>
      (user && t.id === user.team_id) ||
      t.id === userId ||
      t.members?.some(
        (m) =>
          m.id === userId ||
          (user && m.id === user.id) ||
          m.email.toLowerCase() === userId.toLowerCase() ||
          (user && user.email && m.email.toLowerCase() === user.email.toLowerCase())
      )
  );
}

export async function joinTeamByCode(
  userId: string,
  code: string
): Promise<{ success: boolean; team?: Team; error?: string }> {
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
  if (!user) return { success: false, error: 'User account not found.' };

  const normCode = code.trim().toUpperCase();
  if (!normCode) return { success: false, error: 'Please enter a valid Team Code.' };

  if (!db.teams) db.teams = [];
  const team = db.teams.find(
    (t) => t.code.toUpperCase() === normCode || t.id.toUpperCase() === normCode || t.name.toUpperCase() === normCode
  );

  if (!team) {
    return {
      success: false,
      error: `No team found with code "${normCode}". Please ask your Team Leader for the official Squad Code.`,
    };
  }

  // Check if team already has 6 members
  const isAlreadyMember = team.members?.some(
    (m) => m.id === user.id || (user.email && (m.email || '').toLowerCase() === user.email.toLowerCase())
  );

  if (!isAlreadyMember && team.members && team.members.length >= 6) {
    return {
      success: false,
      error: `Team "${team.name}" is already at full capacity (maximum 6 members allowed).`,
    };
  }

  // Remove user from any other team
  db.teams.forEach((t) => {
    if (t.id !== team.id && t.members) {
      t.members = t.members.filter(
        (m) => m.id !== user.id && (!user.email || (m.email || '').toLowerCase() !== user.email.toLowerCase())
      );
    }
  });

  // Add user to this team
  if (!team.members) team.members = [];
  const memberIdx = team.members.findIndex(
    (m) => m.id === user.id || (user.email && (m.email || '').toLowerCase() === user.email.toLowerCase())
  );

  const displayName =
    user.username ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.email.split('@')[0];

  if (memberIdx === -1) {
    team.members.push({
      id: user.id,
      name: displayName,
      email: user.email,
      roll: user.email.split('@')[0],
      is_leader: false,
    });
  } else {
    team.members[memberIdx].name = displayName;
    team.members[memberIdx].id = user.id;
  }

  user.team_id = team.id;
  user.team_name = team.name;

  // Synchronize team's cash and holdings to this member
  syncTeamPortfolioAndBalance(team.id);

  saveLocalDB(db);

  return { success: true, team };
}

export async function createTeam(
  userId: string,
  teamName: string,
  customCode?: string
): Promise<{ success: boolean; team?: Team; error?: string }> {
  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
  if (!user) return { success: false, error: 'User account not found.' };

  const trimmed = teamName.trim();
  if (!trimmed) return { success: false, error: 'Team name cannot be empty.' };

  if (!db.teams) db.teams = [];

  let code = customCode ? customCode.trim().toUpperCase() : '';
  if (!code) {
    const slug = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'SQUAD';
    const rand = Math.floor(10 + Math.random() * 90);
    code = `${slug}-${rand}`;
  }

  if (db.teams.some((t) => t.code.toUpperCase() === code)) {
    code = `${code}-${Math.floor(10 + Math.random() * 90)}`;
  }

  const displayName =
    user.username ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.email.split('@')[0];

  const newTeam: Team = {
    id: 'team-' + Math.random().toString(36).substring(2, 8),
    name: trimmed,
    code,
    leader_id: user.id,
    leader_name: displayName,
    leader_email: user.email,
    balance: user.balance || 1000000,
    members: [
      {
        id: user.id,
        name: displayName,
        email: user.email,
        roll: user.email.split('@')[0],
        is_leader: true,
      },
    ],
    created_at: new Date().toISOString(),
  };

  db.teams.push(newTeam);
  user.team_id = newTeam.id;
  user.team_name = newTeam.name;
  user.is_team_leader = true;

  syncTeamPortfolioAndBalance(newTeam.id);
  saveLocalDB(db);

  return { success: true, team: newTeam };
}

export async function verifySuperAdminPassword(email: string, pass: string): Promise<boolean> {
  const normEmail = email.trim().toLowerCase();
  const db = getLocalDB();
  const superAdmin = db.users.find(
    (u) => u.email.toLowerCase() === normEmail && u.role === 'superadmin'
  );
  if (!superAdmin) return false;
  if (superAdmin.password_hash) {
    return bcrypt.compare(pass, superAdmin.password_hash);
  }
  // If uninitialized, seed with configured superadmin password and hash it
  const defaultPass = process.env.SUPERADMIN_PASSWORD || 'superadmin123';
  if (pass === defaultPass) {
    superAdmin.password_hash = await bcrypt.hash(pass, 10);
    saveLocalDB(db);
    return true;
  }
  return false;
}

export async function superadminManageTeam(
  adminEmail: string,
  adminPass: string,
  action: 'REMOVE_MEMBER' | 'EDIT_MEMBER' | 'ADD_MEMBER' | 'SET_LEADER',
  teamId: string,
  payload: any
): Promise<{ success: boolean; team?: Team; error?: string }> {
  const isAuth = await verifySuperAdminPassword(adminEmail, adminPass);
  if (!isAuth) {
    return { success: false, error: 'Two-step verification failed: Incorrect Superadmin email or password.' };
  }

  const db = getLocalDB();
  if (!db.teams) db.teams = [];
  const team = db.teams.find((t) => t.id === teamId);
  if (!team) {
    return { success: false, error: 'Team not found.' };
  }

  if (action === 'REMOVE_MEMBER') {
    const memberId = payload.memberId || payload.userId || '';
    team.members = team.members.filter((m) => m.id !== memberId && (m.email ? m.email.toLowerCase() !== String(memberId).toLowerCase() : true));
    const user = db.users.find((u) => u.id === memberId || (u.email && u.email.toLowerCase() === String(memberId).toLowerCase()));
    if (user) {
      delete user.team_id;
      delete user.team_name;
      delete user.is_team_leader;
    }
    // If leader was removed, assign first remaining member
    if (team.leader_id === memberId && team.members.length > 0) {
      team.leader_id = team.members[0].id;
      team.leader_name = team.members[0].name;
      team.leader_email = team.members[0].email;
      team.members[0].is_leader = true;
    }
  } else if (action === 'EDIT_MEMBER') {
    const memberId = payload.memberId || payload.userId || '';
    const name = payload.name || payload.newName;
    const email = payload.email || payload.newEmail;
    const roll = payload.roll;
    const isLeader = payload.isLeader;
    const member = team.members.find((m) =>
      (memberId && m.id === memberId) ||
      (memberId && m.email && m.email.toLowerCase() === String(memberId).toLowerCase())
    );
    if (member) {
      if (name) member.name = name;
      if (email) member.email = email;
      if (roll) member.roll = roll;
      if (isLeader) {
        team.members.forEach((m) => (m.is_leader = false));
        member.is_leader = true;
        team.leader_id = member.id;
        team.leader_name = member.name;
        team.leader_email = member.email;
      }
    }
    const user = db.users.find((u) =>
      (memberId && u.id === memberId) ||
      (memberId && u.email && u.email.toLowerCase() === String(memberId).toLowerCase())
    );
    if (user) {
      if (name) {
        const parts = name.split(' ');
        user.first_name = parts[0];
        user.last_name = parts.slice(1).join(' ');
        user.username = name;
      }
      if (email) user.email = email;
    }
  } else if (action === 'ADD_MEMBER') {
    if (team.members.length >= 6) {
      return { success: false, error: 'Team capacity reached. Maximum 6 members allowed per team.' };
    }
    const name = payload.name || payload.newName || 'New Participant';
    const email = payload.email || payload.newEmail || '';
    const roll = payload.roll || (email ? email.split('@')[0] : 'ROSTER');
    const newMemberId = 'usr-' + Math.random().toString(36).substring(2, 9);
    team.members.push({
      id: newMemberId,
      name,
      email: email.toLowerCase(),
      roll,
      is_leader: false,
    });
  } else if (action === 'SET_LEADER') {
    const memberId = payload.memberId || payload.userId || '';
    const member = team.members.find((m) => m.id === memberId);
    if (member) {
      team.members.forEach((m) => (m.is_leader = false));
      member.is_leader = true;
      team.leader_id = member.id;
      team.leader_name = member.name;
      team.leader_email = member.email;
    }
  }

  saveLocalDB(db);
  return { success: true, team };
}

export async function createOrderSlip(
  userId: string,
  stockId: string,
  type: TransactionType,
  quantity: number
): Promise<{ success: boolean; slip?: OrderSlip; error?: string }> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { success: false, error: 'Invalid share quantity. Must be a positive integer.' };
  }

  const db = getLocalDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User account not found.' };

  const stock = db.stocks.find((s) => s.id === stockId || s.ticker === stockId);
  if (!stock) return { success: false, error: 'Target stock not found.' };

  if (stock.is_frozen) {
    return {
      success: false,
      error: `Trading circuit breaker is active for ${stock.ticker}. Orders are suspended.`,
    };
  }

  const grossCost = Number((stock.current_price * quantity).toFixed(2));
  const brokerage = Number((grossCost * 0.05).toFixed(2));
  const totalCost = type === 'BUY' ? Number((grossCost + brokerage).toFixed(2)) : Number((grossCost - brokerage).toFixed(2));

  const team = db.teams?.find((t) => t.id === user.team_id || t.members.some((m) => m.id === user.id));
  const teamName = team ? team.name : user.team_name || 'Independent Syndicate';
  const teamId = team ? team.id : user.team_id || 'team-default';

  if (type === 'BUY') {
    if (user.balance < totalCost) {
      return {
        success: false,
        error: `Insufficient virtual cash balance. Required: ₹${totalCost.toLocaleString('en-IN')} (incl. 5% Econ Brokerage of ₹${brokerage.toLocaleString('en-IN')}), Available: ₹${user.balance.toLocaleString('en-IN')}`,
      };
    }
    // 10% Cash Floor Enforcement (₹1,00,000 minimum cash)
    const resultingCash = Number((user.balance - totalCost).toFixed(2));
    if (resultingCash < 100000) {
      return {
        success: false,
        error: `Liquidity Rule Violation: Team must maintain at least 10% cash reserve (₹1,00,000) at all times to avoid round disqualification. Remaining balance after order would be ₹${resultingCash.toLocaleString('en-IN')}.`,
      };
    }
  } else {
    const held = db.portfolios.find((p) => p.user_id === user.id && p.stock_id === stock.id);
    if (!held || held.shares_count < quantity) {
      return {
        success: false,
        error: `Insufficient shares in portfolio. Requested: ${quantity}, Owned: ${held ? held.shares_count : 0}`,
      };
    }
  }

  // Generate unique Slip ID (e.g. SLIP-7391)
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const slipId = `SLIP-${randNum}`;

  const slip: OrderSlip = {
    id: 'ord-' + Math.random().toString(36).substring(2, 9),
    slip_id: slipId,
    team_id: teamId,
    team_name: teamName,
    student_id: user.id,
    student_name: user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0],
    student_email: user.email,
    stock_id: stock.id,
    ticker: stock.ticker,
    stock_name: stock.name,
    type,
    order_type: type,
    quantity,
    price: stock.current_price,
    gross_amount: grossCost,
    brokerage,
    total_amount: totalCost,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  if (!db.order_slips) db.order_slips = [];
  db.order_slips.unshift(slip);
  saveLocalDB(db);

  // Realtime Broadcast to Desk Admin
  broadcastRealtimeEvent('SLIP_SUBMITTED', slip);

  return { success: true, slip };
}

export async function getOrderSlips(teamId?: string): Promise<OrderSlip[]> {
  const db = getLocalDB();
  let list = db.order_slips || [];
  if (teamId) {
    list = list.filter((s) => s.team_id === teamId || s.student_id === teamId);
  }
  return list;
}

export async function getOrderSlipBySlipId(slipIdOrId: string): Promise<OrderSlip | undefined> {
  const db = getLocalDB();
  const norm = slipIdOrId.trim().toUpperCase();
  return db.order_slips?.find(
    (s) => s.slip_id.toUpperCase() === norm || s.id === slipIdOrId
  );
}

export async function adminExecuteOrderSlip(
  adminSession: { email: string; role: Role; userId?: string },
  slipIdOrId: string,
  action: 'APPROVE' | 'REJECT'
): Promise<{ success: boolean; slip?: OrderSlip; transaction?: Transaction; error?: string }> {
  const db = getLocalDB();
  const normSlip = slipIdOrId.trim().toUpperCase();
  const slip = db.order_slips?.find(
    (s) => s.slip_id.toUpperCase() === normSlip || s.id === slipIdOrId
  );

  if (!slip) {
    return { success: false, error: `Order slip "${slipIdOrId}" was not found.` };
  }

  if (slip.status !== 'PENDING') {
    return {
      success: false,
      error: `Order slip ${slip.slip_id} has already been ${slip.status.toLowerCase()} on ${slip.executed_at ? new Date(slip.executed_at).toLocaleTimeString() : 'record'}.`,
    };
  }

  if (action === 'REJECT') {
    slip.status = 'REJECTED';
    slip.executed_at = new Date().toISOString();
    slip.executed_by_admin = adminSession.email;
    saveLocalDB(db);
    return { success: true, slip };
  }

  // Execute trade
  const tradeResult = await executeTrade(slip.student_id, slip.stock_id, slip.type, slip.quantity);
  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error };
  }

  slip.status = 'EXECUTED';
  slip.executed_at = new Date().toISOString();
  slip.executed_by_admin = adminSession.email;

  // Real-time synchronization of whole team's portfolio and cash balance
  if (slip.team_id) {
    syncTeamPortfolioAndBalance(slip.team_id);
  }

  // Record Latest Broadcast Trade for Floor Telemetry (10s banner on all participant screens)
  (db as any).latest_trade = {
    id: 'trade-' + Date.now(),
    seller_team: slip.order_type === 'SELL' ? slip.team_name : 'Central Primary Pool',
    buyer_team: slip.order_type === 'BUY' ? slip.team_name : 'Central Primary Pool',
    ticker: slip.ticker,
    stock_name: slip.stock_name,
    quantity: slip.quantity,
    price: slip.price,
    total_amount: slip.total_amount,
    timestamp: Date.now(),
  };

  saveLocalDB(db);

  // Real-time Excel/CSV sheet update
  appendTradeToCSV(slip, adminSession.email);

  // Realtime Telemetry Broadcast
  broadcastRealtimeEvent('TRADE_EXECUTED', (db as any).latest_trade);
  broadcastRealtimeEvent('SLIP_STATUS_UPDATED', slip);

  return {
    success: true,
    slip,
    transaction: tradeResult.transaction,
  };
}

// =============================================================================
// REGULATORY PENALTIES & 1-CLICK SNITCH TRIBUNAL
// =============================================================================
export async function applyTeamPenalty(
  adminEmail: string,
  teamId: string,
  reason: 'INSIDER_TRADING_10' | 'FALSE_REPORT_15' | 'KHABRI_FEE_10K' | 'CUSTOM',
  customAmount?: number
): Promise<{ success: boolean; penaltyAmount?: number; team?: Team; reasonLabel?: string; error?: string }> {
  const db = getLocalDB();
  if (!db.teams) db.teams = [];
  const team = db.teams.find((t) => t.id === teamId || t.name.toLowerCase() === teamId.toLowerCase());
  if (!team) return { success: false, error: 'Target team not found in system records.' };

  // Calculate team's total equity holdings value
  const stocksMap = new Map(db.stocks.map((s) => [s.id, s]));
  const leaderUser =
    db.users.find(
      (u) =>
        u.id === team.leader_id ||
        (u.email && u.email.toLowerCase() === (team.leader_email || '').toLowerCase())
    ) || db.users.find((u) => u.team_id === team.id);

  const teamPortfolios = leaderUser
    ? db.portfolios.filter((p) => p.user_id === leaderUser.id && p.shares_count > 0)
    : [];

  const totalHoldingsValue = teamPortfolios.reduce((acc, p) => {
    const st = stocksMap.get(p.stock_id);
    return acc + p.shares_count * (st ? st.current_price : p.avg_buy_price);
  }, 0);

  let penaltyAmount = 0;
  let reasonLabel = '';

  if (reason === 'INSIDER_TRADING_10') {
    penaltyAmount = Math.max(10000, Math.round(totalHoldingsValue * 0.10));
    reasonLabel = `10% Insider Trading Penalty (Holdings basis: ₹${totalHoldingsValue.toLocaleString('en-IN')})`;
  } else if (reason === 'FALSE_REPORT_15') {
    penaltyAmount = Math.max(15000, Math.round(totalHoldingsValue * 0.15));
    reasonLabel = `15% False Accusation Penalty (Holdings basis: ₹${totalHoldingsValue.toLocaleString('en-IN')})`;
  } else if (reason === 'KHABRI_FEE_10K') {
    penaltyAmount = 10000;
    reasonLabel = 'Khabri Insider Intel Access Fee';
  } else if (reason === 'CUSTOM') {
    penaltyAmount = customAmount && customAmount > 0 ? customAmount : 10000;
    reasonLabel = 'Regulatory Fine / Disciplinary Penalty';
  }

  // Deduct penalty from team balance
  const oldBalance = team.balance || (leaderUser ? leaderUser.balance : 1000000);
  const newBalance = Number((oldBalance - penaltyAmount).toFixed(2));
  team.balance = newBalance;

  // Sync to all team members
  const memberEmails = (team.members || []).map((m) => (m.email || '').toLowerCase());
  const memberIds = (team.members || []).map((m) => m.id);
  const teamUsers = db.users.filter(
    (u) =>
      u.team_id === team.id ||
      memberIds.includes(u.id) ||
      (u.email && memberEmails.includes(u.email.toLowerCase()))
  );
  teamUsers.forEach((u) => {
    u.balance = newBalance;
  });

  // Record penalty transaction
  const penaltyTx: Transaction = {
    id: 'fine-' + Math.random().toString(36).substring(2, 9),
    user_id: leaderUser ? leaderUser.id : team.leader_id,
    stock_id: 's-regulatory-fine',
    type: 'SELL',
    quantity: 1,
    price_at_trade: penaltyAmount,
    gross_amount: penaltyAmount,
    brokerage: 0,
    net_amount: penaltyAmount,
    timestamp: new Date().toISOString(),
  };
  db.transactions.push(penaltyTx);

  // Append penalty event to CSV ledger
  try {
    const safe = sanitizeCSVField;
    const randId = `FINE-${Math.floor(1000 + Math.random() * 9000)}`;
    const row = `${safe(randId)},${safe(new Date().toISOString())},${safe(team.name)},${safe(team.leader_name)},${safe(team.leader_email)},"PENALTY","${safe(reasonLabel)}","PENALTY",1,${penaltyAmount},${penaltyAmount},0,-${penaltyAmount},${safe(adminEmail)},"EXECUTED"\n`;
    fs.appendFileSync(CSV_FILE, row, 'utf8');
  } catch {}

  saveLocalDB(db);

  return { success: true, penaltyAmount, team, reasonLabel };
}

// =============================================================================
// INTER-TEAM (P2P) DESK EXECUTION (ROUNDS 2–7)
// =============================================================================
export async function executeInterTeamTrade(
  adminEmail: string,
  sellerTeamId: string,
  buyerTeamId: string,
  stockId: string,
  quantity: number,
  agreedPrice: number,
  options?: { flexibleFloorMode?: boolean; allowCircuitBypass?: boolean }
): Promise<{ success: boolean; error?: string; summary?: any }> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { success: false, error: 'Invalid share quantity.' };
  }
  if (agreedPrice <= 0) {
    return { success: false, error: 'Invalid trade price.' };
  }

  const db = getLocalDB();

  // Helper to find or automatically create on-the-spot team (e.g. "Team 14", "Bulls")
  const findOrCreateTeam = (identifier: string): Team => {
    const trimmed = (identifier || '').trim();
    let team = db.teams?.find(
      (t) =>
        t.id === trimmed ||
        t.name.toLowerCase() === trimmed.toLowerCase() ||
        (t.code && t.code.toLowerCase() === trimmed.toLowerCase())
    );
    if (!team) {
      const code = trimmed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'TEAM';
      const leaderId = 'usr-' + Math.random().toString(36).substring(2, 8);
      const createdTeam: Team = {
        id: 'team-' + Math.random().toString(36).substring(2, 8),
        name: trimmed,
        code,
        balance: 1000000,
        leader_id: leaderId,
        leader_name: trimmed,
        leader_email: `${code.toLowerCase()}@thapar.edu`,
        members: [],
        created_at: new Date().toISOString(),
      };
      if (!db.teams) db.teams = [];
      db.teams.push(createdTeam);
      return createdTeam;
    }
    return team;
  };

  const sellerTeam = findOrCreateTeam(sellerTeamId);
  const buyerTeam = findOrCreateTeam(buyerTeamId);

  if (sellerTeam.name.toLowerCase() === buyerTeam.name.toLowerCase()) {
    return { success: false, error: 'Seller and Buyer team cannot be the same.' };
  }

  const stock = db.stocks.find(
    (s) =>
      s.id === stockId ||
      s.ticker.toUpperCase() === stockId.toUpperCase() ||
      s.name.toLowerCase() === stockId.toLowerCase()
  );
  if (!stock) return { success: false, error: `Target stock "${stockId}" not found.` };

  if (stock.is_frozen) {
    return { success: false, error: `Trading circuit breaker is active for ${stock.ticker}. Orders suspended.` };
  }

  // Dual 5% Brokerage & Base Price Calculations (Waived on Primary Pool Issuances in Round 0)
  const isPrimaryPool =
    sellerTeam.name === 'Central Primary Pool' ||
    sellerTeam.name.toLowerCase().includes('primary pool') ||
    sellerTeam.name.toLowerCase().includes('issuance pool');

  // Enforce official fixed base price (LTP) in Round 0 / Primary pool purchases (Rulebook §3)
  const effectivePrice = isPrimaryPool ? stock.current_price : agreedPrice;

  // Circuit limit check on agreed price (±10% bounds) - can be bypassed if explicitly requested by admin
  const isCircuitBreached =
    !isPrimaryPool &&
    ((stock.upper_circuit && effectivePrice > stock.upper_circuit) ||
     (stock.lower_circuit && effectivePrice < stock.lower_circuit));
  if (isCircuitBreached && !options?.allowCircuitBypass) {
    return {
      success: false,
      error: `Agreed price ₹${effectivePrice.toFixed(2)} breaches circuit limits (LC: ₹${(stock.lower_circuit ?? 0).toFixed(2)} / UC: ₹${(stock.upper_circuit ?? 0).toFixed(2)}) for ${stock.ticker}. Check 'Bypass Circuit Collar' if this was an official physical auction deal.`,
    };
  }

  // Find Seller representative
  const sellerLeader: User =
    db.users.find(
      (u) =>
        u.id === sellerTeam.leader_id ||
        (u.email && u.email.toLowerCase() === (sellerTeam.leader_email || '').toLowerCase())
    ) ||
    db.users.find((u) => u.team_id === sellerTeam.id) || {
      id: sellerTeam.leader_id || ('usr-' + Math.random().toString(36).substring(2, 8)),
      email: sellerTeam.leader_email || `${sellerTeam.code.toLowerCase()}@thapar.edu`,
      role: 'participant',
      username: sellerTeam.leader_name || sellerTeam.name,
      balance: sellerTeam.balance ?? 1000000,
      ecoin_balance: 0,
      team_id: sellerTeam.id,
      team_name: sellerTeam.name,
      created_at: new Date().toISOString(),
    };
  if (!db.users.some((u) => u.id === sellerLeader.id)) {
    db.users.push(sellerLeader);
  }

  // Find Buyer representative
  const buyerLeader: User =
    db.users.find(
      (u) =>
        u.id === buyerTeam.leader_id ||
        (u.email && u.email.toLowerCase() === (buyerTeam.leader_email || '').toLowerCase())
    ) ||
    db.users.find((u) => u.team_id === buyerTeam.id) || {
      id: buyerTeam.leader_id || ('usr-' + Math.random().toString(36).substring(2, 8)),
      email: buyerTeam.leader_email || `${buyerTeam.code.toLowerCase()}@thapar.edu`,
      role: 'participant',
      username: buyerTeam.leader_name || buyerTeam.name,
      balance: buyerTeam.balance ?? 1000000,
      ecoin_balance: 0,
      team_id: buyerTeam.id,
      team_name: buyerTeam.name,
      created_at: new Date().toISOString(),
    };
  if (!db.users.some((u) => u.id === buyerLeader.id)) {
    db.users.push(buyerLeader);
  }

  // Flexible Floor Mode: If seller doesn't have sufficient portfolio recorded in DB,
  // auto-initialize so the physical trade is never blocked on the live floor
  let sellerPort = db.portfolios.find((p) => p.user_id === sellerLeader.id && p.stock_id === stock.id);
  if (!sellerPort) {
    sellerPort = {
      id: 'port-' + Math.random().toString(36).substring(2, 9),
      user_id: sellerLeader.id,
      stock_id: stock.id,
      shares_count: quantity,
      avg_buy_price: agreedPrice,
      updated_at: new Date().toISOString(),
    };
    db.portfolios.push(sellerPort);
  } else if (sellerPort.shares_count < quantity) {
    sellerPort.shares_count = quantity;
  }

  // Dual 5% Brokerage Calculations (Waived on Primary Pool Issuances in Round 0)
  const grossDealValue = Number((effectivePrice * quantity).toFixed(2));
  const buyerBrokerage = isPrimaryPool ? 0 : Number((grossDealValue * 0.05).toFixed(2));
  const sellerBrokerage = isPrimaryPool ? 0 : Number((grossDealValue * 0.05).toFixed(2));
  const totalBuyerDebit = Number((grossDealValue + buyerBrokerage).toFixed(2));
  const totalSellerCredit = Number((grossDealValue - sellerBrokerage).toFixed(2));
  const totalEconCommission = Number((buyerBrokerage + sellerBrokerage).toFixed(2));

  // Ensure buyer has sufficient cash so live event isn't blocked by website wallet balance
  if (buyerLeader.balance < totalBuyerDebit + 100000) {
    buyerLeader.balance = totalBuyerDebit + 250000;
  }
  const buyerCash = buyerLeader.balance;
  const resultingBuyerCash = Number((buyerCash - totalBuyerDebit).toFixed(2));

  // Execute transfer:
  // 1. Seller side
  sellerPort.shares_count -= quantity;
  sellerPort.updated_at = new Date().toISOString();
  sellerLeader.balance = Number((sellerLeader.balance + totalSellerCredit).toFixed(2));

  // 2. Buyer side
  let buyerPort = db.portfolios.find((p) => p.user_id === buyerLeader.id && p.stock_id === stock.id);
  const buyerEffectivePrice = Number((totalBuyerDebit / quantity).toFixed(2));
  if (!buyerPort) {
    buyerPort = {
      id: 'port-' + Math.random().toString(36).substring(2, 9),
      user_id: buyerLeader.id,
      stock_id: stock.id,
      shares_count: quantity,
      avg_buy_price: buyerEffectivePrice,
      updated_at: new Date().toISOString(),
    };
    db.portfolios.push(buyerPort);
  } else {
    const prevTotal = buyerPort.shares_count * buyerPort.avg_buy_price;
    const newTotal = prevTotal + totalBuyerDebit;
    const newCount = buyerPort.shares_count + quantity;
    buyerPort.shares_count = newCount;
    buyerPort.avg_buy_price = Number((newTotal / newCount).toFixed(2));
    buyerPort.updated_at = new Date().toISOString();
  }
  buyerLeader.balance = resultingBuyerCash;

  // 3. Transactions logging
  const currentRoundId = db.current_round_id || 'round-1';
  const txTime = new Date().toISOString();
  const sellTx: Transaction = {
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    user_id: sellerLeader.id,
    stock_id: stock.id,
    type: 'SELL',
    quantity,
    price_at_trade: effectivePrice,
    gross_amount: grossDealValue,
    brokerage: sellerBrokerage,
    net_amount: totalSellerCredit,
    round_id: currentRoundId,
    timestamp: txTime,
  };
  const buyTx: Transaction = {
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    user_id: buyerLeader.id,
    stock_id: stock.id,
    type: 'BUY',
    quantity,
    price_at_trade: effectivePrice,
    gross_amount: grossDealValue,
    brokerage: buyerBrokerage,
    net_amount: totalBuyerDebit,
    round_id: currentRoundId,
    timestamp: txTime,
  };
  db.transactions.push(sellTx, buyTx);

  // 4. Update stock live price: Rolling Latest-3-Deals VWAP Rule
  // Price updates starting from the 3rd deal, and continuously on EVERY subsequent deal:
  // - Deal 1 & 2: Awaiting 3rd deal to form valid initial 3-deal sample
  // - Deal 3: VWAP of (Deal 1 + Deal 2 + Deal 3) / Total Quantity
  // - Deal 4: VWAP of (Deal 2 + Deal 3 + Deal 4) / Total Quantity (Deal 1 drops out)
  // - Deal N (N >= 3): Rolling VWAP of the latest 3 deals (slice(-3))
  // (Primary desk allocations in Round 0 from Central Primary Pool are fixed reference issuance and do not fluctuate secondary market prices)
  const roundStockTrades = db.transactions.filter(
    (t) =>
      t.stock_id === stock.id &&
      t.type === 'BUY' &&
      typeof t.price_at_trade === 'number' &&
      t.round_id === currentRoundId
  );
  const dealsCount = roundStockTrades.length;
  const isEligibleForUpdate = dealsCount >= 3;

  let priceUpdated = false;
  let rollingTradesCount = 0;
  if (isEligibleForUpdate && !isPrimaryPool) {
    const latest3Trades = roundStockTrades.slice(-3);
    rollingTradesCount = latest3Trades.length;
    const totalQ = latest3Trades.reduce((acc, t) => acc + t.quantity, 0);
    const weightedSum = latest3Trades.reduce((acc, t) => acc + t.quantity * t.price_at_trade, 0);
    if (totalQ > 0) {
      stock.current_price = Number((weightedSum / totalQ).toFixed(2));
      stock.change = Number((stock.current_price - stock.previous_close).toFixed(2));
      stock.change_percent = stock.previous_close > 0
        ? Number(((stock.change / stock.previous_close) * 100).toFixed(2))
        : 0;
      stock.day_high = Math.max(stock.day_high, stock.current_price);
      stock.day_low = Math.min(stock.day_low, stock.current_price);
      if (!stock.historical_prices) {
        stock.historical_prices = [stock.previous_close];
      }
      stock.historical_prices.push(stock.current_price);
      priceUpdated = true;
    }
  }

  // 5. Synchronize both teams
  syncTeamPortfolioAndBalance(sellerTeam.id);
  syncTeamPortfolioAndBalance(buyerTeam.id);

  // 6. Append dual rows to dalal_street_trades.csv
  try {
    const safe = sanitizeCSVField;
    const randSlip = `P2P-${Math.floor(1000 + Math.random() * 9000)}`;
    const sellerRow = `${safe(randSlip + '-S')},${safe(txTime)},${safe(sellerTeam.name)},${safe(sellerTeam.leader_name)},${safe(sellerTeam.leader_email)},${safe(stock.ticker)},${safe(stock.name)},"SELL",${quantity},${effectivePrice},${grossDealValue},${sellerBrokerage},${totalSellerCredit},${safe(adminEmail)},"EXECUTED (P2P Sold to ${buyerTeam.name})"\n`;
    const buyerRow = `${safe(randSlip + '-B')},${safe(txTime)},${safe(buyerTeam.name)},${safe(buyerTeam.leader_name)},${safe(buyerTeam.leader_email)},${safe(stock.ticker)},${safe(stock.name)},"BUY",${quantity},${effectivePrice},${grossDealValue},${buyerBrokerage},${totalBuyerDebit},${safe(adminEmail)},"EXECUTED (P2P Bought from ${sellerTeam.name})"\n`;
    fs.appendFileSync(CSV_FILE, sellerRow, 'utf8');
    fs.appendFileSync(CSV_FILE, buyerRow, 'utf8');
  } catch {}

  // 7. Record Latest Broadcast Trade for Floor Telemetry (10s banner on all participant screens)
  (db as any).latest_trade = {
    id: 'trade-' + Date.now(),
    seller_team: sellerTeam.name,
    buyer_team: buyerTeam.name,
    ticker: stock.ticker,
    stock_name: stock.name,
    quantity,
    price: effectivePrice,
    total_amount: grossDealValue,
    timestamp: Date.now(),
  };

  saveLocalDB(db);

  // Supabase Realtime Telemetry & Cloud Synchronization
  const latestTradePayload = (db as any).latest_trade;
  broadcastRealtimeEvent('TRADE_EXECUTED', latestTradePayload);
  if (priceUpdated) {
    broadcastRealtimeEvent('STOCK_PRICE_UPDATED', stock);
    syncStockToSupabase(stock);
  }
  syncTransactionToSupabase(sellTx, sellerTeam.name, buyerTeam.name);
  syncTransactionToSupabase(buyTx, sellerTeam.name, buyerTeam.name);

  logger.audit('P2P_TRADE_EXECUTED', adminEmail || 'AdminDesk', {
    sellerTeam: sellerTeam.name,
    buyerTeam: buyerTeam.name,
    ticker: stock.ticker,
    quantity,
    price: agreedPrice,
    grossValue: grossDealValue,
  });

  return {
    success: true,
    summary: {
      sellerTeam: sellerTeam.name,
      buyerTeam: buyerTeam.name,
      ticker: stock.ticker,
      quantity,
      agreedPrice,
      grossDealValue,
      buyerBrokerage,
      sellerBrokerage,
      totalEconCommission,
      totalBuyerDebit,
      totalSellerCredit,
      dealsCount,
      batchProgress: dealsCount < 3 ? `${dealsCount}/3` : `Rolling 3-Trade Window (Deal #${dealsCount})`,
      rollingTradesCount,
      priceUpdated,
      currentStockPrice: stock.current_price,
    },
  };
}

// ==============================================================================
// COMPETITION ROUNDS & DYNAMIC 4-BRANCH PRICING ENGINE
// Handwritten Rulebook Engine: Orders After Time, News, R Formula & IPO Allotment
// ==============================================================================

export function getCompetitionRounds(): {
  rounds: CompetitionRound[];
  currentRound: CompetitionRound;
  clock: { remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean; last_tick?: number };
} {
  const db = getLocalDB();
  const rounds = db.rounds && db.rounds.length > 0 ? db.rounds : DEFAULT_COMPETITION_ROUNDS;
  const currentId = db.current_round_id || 'round-0';
  const currentRound = rounds.find((r) => r.id === currentId) || rounds[0];
  const now = Date.now();

  if (!db.round_clock) {
    db.round_clock = {
      remaining_seconds: currentRound.duration_minutes * 60,
      is_paused: false,
      is_orders_locked: false,
      last_tick: now,
    };
    saveLocalDB(db);
  }

  // Calculate live elapsed seconds if the simulation clock is actively running
  if (!db.round_clock.is_paused && db.round_clock.remaining_seconds > 0) {
    const lastTick = db.round_clock.last_tick || now;
    const elapsedSeconds = Math.floor((now - lastTick) / 1000);
    if (elapsedSeconds > 0) {
      db.round_clock.remaining_seconds = Math.max(0, db.round_clock.remaining_seconds - elapsedSeconds);
      // Advance last_tick by the consumed whole seconds
      db.round_clock.last_tick = lastTick + (elapsedSeconds * 1000);
      saveLocalDB(db);
    }
  } else {
    // When paused, anchor last_tick to current time so no time is lost while idle
    db.round_clock.last_tick = now;
  }

  return { rounds, currentRound, clock: db.round_clock };
}

export function advanceCompetitionRound(targetRoundId?: CompetitionRoundId): {
  success: boolean;
  previousRoundId: CompetitionRoundId;
  currentRound: CompetitionRound;
} {
  const db = getLocalDB();
  const rounds = db.rounds && db.rounds.length > 0 ? db.rounds : DEFAULT_COMPETITION_ROUNDS;
  const prevId = db.current_round_id || 'round-0';

  let nextRound: CompetitionRound | undefined;
  if (targetRoundId) {
    nextRound = rounds.find((r) => r.id === targetRoundId);
  } else {
    const currentIndex = rounds.findIndex((r) => r.id === prevId);
    if (currentIndex >= 0 && currentIndex < rounds.length - 1) {
      nextRound = rounds[currentIndex + 1];
    }
  }

  if (!nextRound) {
    return {
      success: false,
      previousRoundId: prevId,
      currentRound: rounds.find((r) => r.id === prevId) || rounds[0],
    };
  }

  // Create an automatic versioned snapshot before advancing round
  try {
    createDBSnapshot(`pre_advance_${prevId}_to_${nextRound.id}`);
  } catch (snapErr) {
    logger.warn('RoundAdvancement', 'Auto-snapshot before round advancement failed', { error: String(snapErr) });
  }

  // Update statuses
  rounds.forEach((r) => {
    if (r.id === nextRound!.id) {
      r.status = 'ACTIVE';
    } else {
      const targetIdx = rounds.findIndex((x) => x.id === nextRound!.id);
      const thisIdx = rounds.findIndex((x) => x.id === r.id);
      r.status = thisIdx < targetIdx ? 'COMPLETED' : 'UPCOMING';
    }
  });

  db.rounds = rounds;
  db.current_round_id = nextRound.id;
  db.round_clock = {
    remaining_seconds: nextRound.duration_minutes * 60,
    is_paused: false,
    is_orders_locked: nextRound.type === 'PRE_MARKET',
    last_tick: Date.now(),
  };

  // If entering an IPO round, ensure that IPO is marked SUBSCRIPTION_OPEN
  if (nextRound.type === 'IPO' && db.ipo_listings) {
    const ipo = db.ipo_listings.find((item) => item.round_id === nextRound!.id);
    if (ipo && ipo.status === 'UPCOMING') {
      ipo.status = 'SUBSCRIPTION_OPEN';
    }
  }

  saveLocalDB(db);

  broadcastRealtimeEvent('ROUND_ADVANCED', nextRound);
  broadcastRealtimeEvent('CLOCK_UPDATED', db.round_clock);
  syncClockToSupabase(db.round_clock);

  logger.audit('ROUND_ADVANCED', 'Admin', {
    fromRound: prevId,
    toRound: nextRound.id,
    durationMinutes: nextRound.duration_minutes,
  });

  return {
    success: true,
    previousRoundId: prevId,
    currentRound: nextRound,
  };
}

export function updateRoundClock(data: {
  remaining_seconds?: number;
  is_paused?: boolean;
  is_orders_locked?: boolean;
}): { remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean; last_tick?: number } {
  const db = getLocalDB();
  const now = Date.now();
  if (!db.round_clock) {
    db.round_clock = { remaining_seconds: 600, is_paused: false, is_orders_locked: false, last_tick: now };
  }

  // If it was running, first compute elapsed time before applying overrides
  if (!db.round_clock.is_paused && db.round_clock.remaining_seconds > 0) {
    const lastTick = db.round_clock.last_tick || now;
    const elapsedSeconds = Math.floor((now - lastTick) / 1000);
    if (elapsedSeconds > 0) {
      db.round_clock.remaining_seconds = Math.max(0, db.round_clock.remaining_seconds - elapsedSeconds);
    }
  }

  if (typeof data.remaining_seconds === 'number') {
    db.round_clock.remaining_seconds = Math.max(0, data.remaining_seconds);
  }
  if (typeof data.is_paused === 'boolean') {
    db.round_clock.is_paused = data.is_paused;
  }
  if (typeof data.is_orders_locked === 'boolean') {
    db.round_clock.is_orders_locked = data.is_orders_locked;
  }

  db.round_clock.last_tick = now;
  saveLocalDB(db);
  broadcastRealtimeEvent('CLOCK_UPDATED', db.round_clock);
  syncClockToSupabase(db.round_clock);
  return db.round_clock;
}

/**
 * Formula for Market Drift R%:
 * As instructed: "and also make a formula for this R (e.g it is avg of the stocks that were sold )"
 * R% measures overall market momentum derived from:
 * 1. Average percentage price shift of all stocks that were traded/sold in the session
 * 2. Net buy/sell volume pressure skew
 * 3. Result bounded within realistic bounds [-5.0%, +5.0%] (with full Admin override)
 */
export function calculateMarketRFormula(roundId?: CompetitionRoundId): {
  calculated_r: number;
  average_traded_stock_shift: number;
  total_round_buy_volume: number;
  total_round_sell_volume: number;
  traded_stocks_count: number;
  formula_breakdown: string;
} {
  const db = getLocalDB();
  const txs = db.transactions || [];

  // Group transactions by stock
  const stockShiftMap: Record<string, { totalVol: number; weightedPriceSum: number; basePrice: number }> = {};
  let totalBuyVol = 0;
  let totalSellVol = 0;

  txs.forEach((tx) => {
    const stock = db.stocks.find((s) => s.id === tx.stock_id);
    if (!stock) return;

    if (tx.type === 'BUY') totalBuyVol += tx.quantity;
    if (tx.type === 'SELL') totalSellVol += tx.quantity;

    if (!stockShiftMap[stock.id]) {
      stockShiftMap[stock.id] = {
        totalVol: 0,
        weightedPriceSum: 0,
        basePrice: stock.previous_close || stock.current_price,
      };
    }

    const price = tx.price_at_trade || tx.price || stock.current_price;
    stockShiftMap[stock.id].totalVol += tx.quantity;
    stockShiftMap[stock.id].weightedPriceSum += price * tx.quantity;
  });

  const tradedStockIds = Object.keys(stockShiftMap);
  let totalPercentageShift = 0;

  tradedStockIds.forEach((sid) => {
    const item = stockShiftMap[sid];
    if (item.totalVol > 0 && item.basePrice > 0) {
      const vwap = item.weightedPriceSum / item.totalVol;
      const pctShift = ((vwap - item.basePrice) / item.basePrice) * 100;
      totalPercentageShift += pctShift;
    }
  });

  const avgShift = tradedStockIds.length > 0 ? totalPercentageShift / tradedStockIds.length : 0;
  const totalVolume = totalBuyVol + totalSellVol;
  const volumeSkew = totalVolume > 0 ? (totalBuyVol - totalSellVol) / totalVolume : 0;
  const volumePressure = volumeSkew * 2.0; // +/- 2% max contribution

  // Raw R formula: 70% weighted from average stock price shift + 30% from volume pressure
  const rawR = avgShift * 0.7 + volumePressure;
  // Bound R between -5.0% and +5.0%
  const clampedR = Math.max(-5.0, Math.min(5.0, Number(rawR.toFixed(2))));

  return {
    calculated_r: clampedR,
    average_traded_stock_shift: Number(avgShift.toFixed(2)),
    total_round_buy_volume: totalBuyVol,
    total_round_sell_volume: totalSellVol,
    traded_stocks_count: tradedStockIds.length,
    formula_breakdown: `R = (Avg Traded Stocks Shift: ${avgShift.toFixed(2)}% × 0.7) + (Net Volume Skew: ${volumePressure.toFixed(2)}%) = ${clampedR.toFixed(2)}%`,
  };
}

/**
 * Preview Round Pricing Settlement implementing the 4 handwritten branches:
 * Branch 1 (Orders After Time): P_next = P_orders * (1 + R%)
 * Branch 2 (Orders After Time + News): P_next = P_orders * (1 + N% + R%)
 * Branch 3 (News Only): P_next = P_current * (1 + N%)
 * Branch 4 (NULL - No Orders, No News): P_next = P_current * (1 + R%) with ±10% collars
 */
export function previewRoundSettlement(params: {
  roundId?: CompetitionRoundId;
  overrideR?: number;
  stockNewsOverrides?: Record<string, number>; // stock_id or ticker -> N%
  stockROverrides?: Record<string, number>;    // stock_id or ticker -> R%
  randomizeR?: boolean;
}): RoundSettlementState {
  const db = getLocalDB();
  const currentId = params.roundId || db.current_round_id || 'round-0';
  const rStats = calculateMarketRFormula(currentId);
  const activeR = typeof params.overrideR === 'number' ? params.overrideR : rStats.calculated_r;

  // Determine which stocks had orders
  const stockOrdersMap: Record<string, { count: number; totalVol: number; valueSum: number }> = {};
  (db.transactions || []).forEach((tx) => {
    if (!stockOrdersMap[tx.stock_id]) {
      stockOrdersMap[tx.stock_id] = { count: 0, totalVol: 0, valueSum: 0 };
    }
    const price = tx.price_at_trade || tx.price || 0;
    stockOrdersMap[tx.stock_id].count += 1;
    stockOrdersMap[tx.stock_id].totalVol += tx.quantity;
    stockOrdersMap[tx.stock_id].valueSum += price * tx.quantity;
  });

  const settlements: StockPriceSettlement[] = db.stocks.map((stock) => {
    const ordersData = stockOrdersMap[stock.id] || { count: 0, totalVol: 0, valueSum: 0 };
    const hasOrders = ordersData.count > 0 && ordersData.totalVol > 0;
    const vwapOrders = hasOrders ? Number((ordersData.valueSum / ordersData.totalVol).toFixed(2)) : undefined;

    // Check news impact N%
    let newsImpact = 0;
    if (params.stockNewsOverrides) {
      if (typeof params.stockNewsOverrides[stock.id] === 'number') {
        newsImpact = params.stockNewsOverrides[stock.id];
      } else if (typeof params.stockNewsOverrides[stock.ticker] === 'number') {
        newsImpact = params.stockNewsOverrides[stock.ticker];
      }
    }
    // Also look up any related market events or news articles
    if (newsImpact === 0) {
      if (db.market_events) {
        for (const evt of db.market_events) {
          if (evt.impact_map && typeof evt.impact_map[stock.ticker] === 'number') {
            newsImpact = evt.impact_map[stock.ticker];
            break;
          }
        }
      }
      if (newsImpact === 0 && db.news_articles) {
        const match = db.news_articles.find((n: any) =>
          n.related_stock_id === stock.id ||
          (n.headline && n.headline.toUpperCase().includes(stock.ticker)) ||
          ((n.summary || n.body) && (n.summary || n.body).toUpperCase().includes(stock.ticker))
        );
        if (match && typeof (match as any).impact_percent === 'number') {
          newsImpact = (match as any).impact_percent;
        }
      }
    }

    // Individual stock R% (Assigned automatically between 1% and 10% per stock, with admin overrides)
    let stockR: number;
    if (params.stockROverrides && typeof params.stockROverrides[stock.id] === 'number') {
      stockR = params.stockROverrides[stock.id];
    } else if (params.stockROverrides && typeof params.stockROverrides[stock.ticker] === 'number') {
      stockR = params.stockROverrides[stock.ticker];
    } else if (typeof params.overrideR === 'number' && params.overrideR !== 0 && !params.randomizeR) {
      stockR = params.overrideR;
    } else {
      // Automatically assign random R% between 1% and 10% (signed to give natural bull/bear market dispersion)
      const sign = Math.random() < 0.5 ? 1 : -1;
      const magnitude = 1.0 + Math.random() * 9.0; // 1.00% to 10.00%
      stockR = Number((sign * magnitude).toFixed(2));
    }

    const hasNews = newsImpact !== 0;

    let branch: StockPricingBranch;
    let branch_label: string;
    let rawPrice: number;

    // Use Brief §6.2 Sequential Multiplication Formula:
    // P_open = P_base × (1 + N/100) × (1 + R/100)
    const baseP = vwapOrders || stock.current_price;
    const nFactor = 1 + (newsImpact / 100);
    const rFactor = 1 + (stockR / 100);

    if (hasOrders && hasNews) {
      // Branch 2: Orders After Time + News -> P_base × (1 + N%) × (1 + R%)
      branch = 'BRANCH_2_ORDERS_AND_NEWS';
      branch_label = 'Branch 2: Orders + News [P_orders × (1 + N%) × (1 + R%)]';
      rawPrice = baseP * nFactor * rFactor;
    } else if (hasOrders && !hasNews) {
      // Branch 1: Orders After Time -> P_orders × (1 + R%)
      branch = 'BRANCH_1_ORDERS';
      branch_label = 'Branch 1: Orders Only [P_orders × (1 + R%)]';
      rawPrice = baseP * rFactor;
    } else if (!hasOrders && hasNews) {
      // Branch 3: News Only -> P_current × (1 + N%)
      branch = 'BRANCH_3_NEWS_ONLY';
      branch_label = 'Branch 3: News Only [P_current × (1 + N%)]';
      rawPrice = stock.current_price * nFactor;
    } else {
      // Branch 4: NULL (No Orders, No News) -> P_current × (1 + R%)
      branch = 'BRANCH_4_NULL';
      branch_label = 'Branch 4: NULL [P_current × (1 + R%)]';
      rawPrice = stock.current_price * rFactor;
    }

    // Circuit Collars: Lower Circuit = current_price * 0.90, Upper Circuit = current_price * 1.10
    const circuitLower = Number((stock.current_price * 0.90).toFixed(2));
    const circuitUpper = Number((stock.current_price * 1.10).toFixed(2));

    let finalPrice = Number(rawPrice.toFixed(2));
    let isBreached = false;

    if (finalPrice < circuitLower) {
      finalPrice = circuitLower;
      isBreached = true;
    } else if (finalPrice > circuitUpper) {
      finalPrice = circuitUpper;
      isBreached = true;
    }

    return {
      stock_id: stock.id,
      ticker: stock.ticker,
      name: stock.name,
      previous_round_price: stock.current_price,
      order_count: ordersData.count,
      total_volume_traded: ordersData.totalVol,
      orders_baseline_price: vwapOrders,
      news_impact_percent: Number(newsImpact.toFixed(2)),
      market_drift_percent: Number(stockR.toFixed(2)),
      branch,
      branch_label,
      calculated_price: Number(rawPrice.toFixed(2)),
      final_price: finalPrice,
      circuit_lower: circuitLower,
      circuit_upper: circuitUpper,
      is_circuit_breached: isBreached,
    };
  });

  const avgMarketR = settlements.length > 0
    ? Number((settlements.reduce((acc, s) => acc + s.market_drift_percent, 0) / settlements.length).toFixed(2))
    : activeR;

  return {
    round_id: currentId,
    market_r_percent: avgMarketR,
    r_formula_details: {
      total_round_buy_volume: rStats.total_round_buy_volume,
      total_round_sell_volume: rStats.total_round_sell_volume,
      average_traded_stock_shift: rStats.average_traded_stock_shift,
      calculated_r: avgMarketR,
    },
    settlements,
    is_applied: false,
  };
}

/**
 * Apply the calculated/admin-overridden round settlement prices to all active stocks
 */
export function applyRoundSettlement(
  roundId: CompetitionRoundId,
  settlements: StockPriceSettlement[],
  adminEmail: string
): { success: boolean; appliedCount: number; message: string } {
  // Create an automatic versioned snapshot before applying price settlement
  try {
    createDBSnapshot(`pre_settlement_${roundId}`);
  } catch (snapErr) {
    logger.warn('Settlement', 'Auto-snapshot before settlement failed', { error: String(snapErr) });
  }

  const db = getLocalDB();

  settlements.forEach((item) => {
    const stock = db.stocks.find((s) => s.id === item.stock_id);
    if (!stock) return;

    stock.previous_close = stock.current_price;
    stock.current_price = item.final_price;
    // Set fresh ±10% circuit limits for the upcoming trading session
    stock.lower_circuit = Number((item.final_price * 0.90).toFixed(2));
    stock.upper_circuit = Number((item.final_price * 1.10).toFixed(2));
    stock.day_high = Math.max(stock.day_high, item.final_price);
    stock.day_low = Math.min(stock.day_low, item.final_price);
  });

  // Store in settlements ledger
  if (!db.round_settlements) db.round_settlements = {};
  db.round_settlements[roundId] = {
    round_id: roundId,
    market_r_percent: settlements[0]?.market_drift_percent || 0,
    r_formula_details: {
      total_round_buy_volume: 0,
      total_round_sell_volume: 0,
      average_traded_stock_shift: 0,
      calculated_r: settlements[0]?.market_drift_percent || 0,
    },
    settlements,
    is_applied: true,
    applied_at: new Date().toISOString(),
  };

  // Re-sync all teams to reflect fresh mark-to-market portfolio values
  (db.teams || []).forEach((team) => {
    syncTeamPortfolioAndBalance(team.id);
  });

  saveLocalDB(db);

  logger.audit('ROUND_SETTLEMENT_APPLIED', adminEmail || 'Admin', {
    roundId,
    appliedCount: settlements.length,
    marketRPercent: settlements[0]?.market_drift_percent || 0,
  });

  return {
    success: true,
    appliedCount: settlements.length,
    message: `Successfully broadcast new settlement prices for ${settlements.length} stocks across Dalal Street.`,
  };
}

// ==============================================================================
// IPO SUBSCRIPTION & ALLOTMENT ENGINE
// ==============================================================================

// Helper to dynamically calculate news impact N% on an IPO listing
export function getIPONewsImpact(ipo: { ticker: string; sector?: string }): { impact_percent: number; headline?: string } {
  const db = getLocalDB();
  let impact = 0;
  let headline: string | undefined;

  // 1. Check market events impact map
  if (db.market_events) {
    for (const evt of db.market_events) {
      if (evt.impact_map && typeof evt.impact_map[ipo.ticker] === 'number') {
        impact = evt.impact_map[ipo.ticker];
        headline = evt.headline;
        break;
      }
    }
  }

  // 2. Check news articles matching ticker or sector
  if (impact === 0 && db.news_articles) {
    const match = db.news_articles.find((n: any) =>
      (n.headline && n.headline.toUpperCase().includes(ipo.ticker.toUpperCase())) ||
      (n.sector && ipo.sector && n.sector.toLowerCase() === ipo.sector.toLowerCase()) ||
      ((n.body || n.summary) && (n.body || n.summary).toUpperCase().includes(ipo.ticker.toUpperCase()))
    );
    if (match) {
      headline = match.headline;
      if (typeof (match as any).impact_percent === 'number') {
        impact = (match as any).impact_percent;
      } else if (match.sentiment === 'BULLISH') {
        impact = 5.0;
      } else if (match.sentiment === 'BEARISH') {
        impact = -5.0;
      }
    }
  }

  return { impact_percent: impact, headline };
}

export function getIPOListings(): IPOListing[] {
  const db = getLocalDB();
  const raw = db.ipo_listings && db.ipo_listings.length > 0 ? db.ipo_listings : DEFAULT_IPO_LISTINGS;
  return raw.map((item) => {
    const news = getIPONewsImpact(item);
    return {
      ...item,
      news_impact_percent: news.impact_percent,
      news_headline: news.headline,
    };
  });
}

export function getIPOSubscriptions(roundId?: string): IPOSubscription[] {
  const db = getLocalDB();
  const subs = db.ipo_subscriptions || [];
  if (roundId) return subs.filter((s) => s.round_id === roundId);
  return subs;
}

export function subscribeToIPO(params: {
  ipo_id: string;
  team_id: string;
  user_id: string;
  lots: number;
}): { success: boolean; error?: string; subscription?: IPOSubscription } {
  const db = getLocalDB();
  const ipo = (db.ipo_listings || []).find((i) => i.id === params.ipo_id);
  if (!ipo) return { success: false, error: 'IPO Listing not found.' };

  const currentRound = db.current_round_id || 'round-0';
  if (currentRound !== ipo.round_id) {
    return {
      success: false,
      error: `IPO subscription for ${ipo.company_name} is only valid during ${ipo.round_id.toUpperCase()}. Currently in ${currentRound.toUpperCase()}.`,
    };
  }

  let team = (db.teams || []).find(
    (t) =>
      t.id === params.team_id ||
      t.name.toLowerCase() === (params.team_id || '').toLowerCase() ||
      (t.code && t.code.toLowerCase() === (params.team_id || '').toLowerCase())
  );
  if (!team) {
    team = (db.teams || []).find((t) => t.leader_id === params.user_id || t.members?.some((m: any) => m.id === params.user_id || m.email === params.user_id));
  }
  // Fallback: If user is an individual trader or admin testing, auto-create/bind their syndicate team
  if (!team) {
    const usr = db.users.find((u) => u.id === params.user_id || (u.email && u.email === params.user_id));
    if (usr) {
      const teamName = usr.username || (usr.first_name ? `${usr.first_name}'s Team` : 'Syndicate Team');
      const createdTeam: any = {
        id: params.team_id || ('team-' + usr.id),
        name: teamName,
        code: 'TEAM-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        leader_id: usr.id,
        leader_name: usr.username || usr.first_name || usr.email,
        leader_email: usr.email,
        balance: usr.balance ?? 1000000,
        members: [{ id: usr.id, name: usr.username || usr.first_name || 'Trader', email: usr.email, role: 'leader' }],
        created_at: new Date().toISOString(),
      };
      if (!db.teams) db.teams = [];
      db.teams.push(createdTeam);
      usr.team_id = createdTeam.id;
      team = createdTeam;
    }
  }
  if (!team) return { success: false, error: 'Team record not found. Please join or create a team.' };

  const user =
    db.users.find((u) => u.id === params.user_id) ||
    db.users.find((u) => u.email && params.user_id && u.email.toLowerCase() === params.user_id.toLowerCase()) ||
    db.users.find((u) => u.id === team.leader_id) ||
    db.users.find((u) => u.email && u.email.toLowerCase() === (team.leader_email || '').toLowerCase()) ||
    db.users.find((u) => u.team_id === team.id) ||
    db.users[0]; // Fallback to first active participant/admin if needed

  const userName = user ? (user.username || user.first_name || team.leader_name) : team.leader_name;
  const userId = user ? user.id : (team.leader_id || 'usr-default');

  if (params.lots < ipo.min_lots || params.lots > ipo.max_lots) {
    return {
      success: false,
      error: `Invalid lot quantity. Minimum: ${ipo.min_lots} lot (${ipo.min_lots * ipo.lot_size} shares), Maximum: ${ipo.max_lots} lots (${ipo.max_lots * ipo.lot_size} shares).`,
    };
  }

  const shareQty = params.lots * ipo.lot_size;
  const totalAmount = Number((shareQty * ipo.issue_price).toFixed(2));

  // Check Cash Balance & 10% Cash Reserve Rule
  if (team.balance < totalAmount) {
    return {
      success: false,
      error: `Insufficient team funds. Required: ₹${totalAmount.toLocaleString('en-IN')}, Available: ₹${team.balance.toLocaleString('en-IN')}`,
    };
  }

  const remainingCash = Number((team.balance - totalAmount).toFixed(2));
  if (remainingCash < 100000) {
    return {
      success: false,
      error: `Cash Reserve Violation: Subscribing to ${params.lots} lots would leave ₹${remainingCash.toLocaleString('en-IN')}, dropping below mandatory 10% reserve (₹1,00,000).`,
    };
  }

  if (!db.ipo_subscriptions) db.ipo_subscriptions = [];

  // Check if team already applied
  const existingSub = db.ipo_subscriptions.find((s) => s.ipo_id === ipo.id && s.team_id === team.id);
  if (existingSub) {
    return {
      success: false,
      error: `Team "${team.name}" has already submitted an IPO bid for ${existingSub.lots_requested} lots. Duplicate bids not allowed.`,
    };
  }

  const subscription: IPOSubscription = {
    id: 'ipo-sub-' + Math.random().toString(36).substring(2, 9),
    ipo_id: ipo.id,
    round_id: ipo.round_id,
    team_id: team.id,
    team_name: team.name,
    user_id: userId,
    user_name: userName,
    lots_requested: params.lots,
    share_quantity: shareQty,
    issue_price: ipo.issue_price,
    total_amount: totalAmount,
    lots_allotted: 0,
    status: 'BID_PLACED',
    created_at: new Date().toISOString(),
  };

  db.ipo_subscriptions.push(subscription);
  saveLocalDB(db);

  return { success: true, subscription };
}

export function allotIPOLots(
  adminEmail: string,
  ipoId: string
): { success: boolean; allottedCount: number; message: string; listingPrice?: number } {
  const db = getLocalDB();
  const ipo = (db.ipo_listings || []).find((i) => i.id === ipoId);
  if (!ipo) return { success: false, allottedCount: 0, message: 'IPO listing not found.' };

  const subs = (db.ipo_subscriptions || []).filter((s) => s.ipo_id === ipoId && s.status === 'BID_PLACED');
  if (subs.length === 0) {
    return { success: false, allottedCount: 0, message: 'No pending IPO bids found for this listing.' };
  }

  // Calculate Subscription Demand & Smooth Listing Price with News Impact (Brief §7.2)
  // D = total lots requested by all teams
  // L = total lots offered in that IPO
  // S = subscription ratio = D / L
  // N = news impact percentage delta
  // P_listing = P0 × (1 + N/100) × (0.7 + (0.6S / (1 + S)))
  const totalLotsDemanded = subs.reduce((acc, s) => acc + s.lots_requested, 0);
  const totalLotsOffered = ipo.total_issue_lots || 100;
  const subscriptionRatio = Number((totalLotsDemanded / totalLotsOffered).toFixed(2));
  const baseP0 = ipo.reference_price || ipo.issue_price || 300.00;

  const newsInfo = getIPONewsImpact(ipo);
  const newsFactor = 1 + (newsInfo.impact_percent / 100);
  const smoothMultiplier = 0.7 + ((0.6 * subscriptionRatio) / (1 + subscriptionRatio));
  const calculatedListingPrice = Number((baseP0 * newsFactor * smoothMultiplier).toFixed(2));

  ipo.total_demanded_lots = totalLotsDemanded;
  ipo.subscription_ratio = subscriptionRatio;
  ipo.issue_price = calculatedListingPrice;
  ipo.news_impact_percent = newsInfo.impact_percent;
  ipo.news_headline = newsInfo.headline;

  // Ensure stock exists in db.stocks so it can be traded
  let listedStock = db.stocks.find((s) => s.ticker === ipo.ticker);
  if (!listedStock) {
    listedStock = {
      id: 's-' + ipo.ticker.toLowerCase(),
      ticker: ipo.ticker,
      name: ipo.company_name,
      sector: ipo.sector,
      current_price: calculatedListingPrice,
      previous_close: baseP0,
      day_high: calculatedListingPrice,
      day_low: calculatedListingPrice,
      is_frozen: false,
      lower_circuit: Number((calculatedListingPrice * 0.90).toFixed(2)),
      upper_circuit: Number((calculatedListingPrice * 1.10).toFixed(2)),
      beta: 1.25,
      pe_ratio: 24.5,
      market_cap: '₹4.2L Cr',
    };
    db.stocks.push(listedStock);
  } else {
    listedStock.current_price = calculatedListingPrice;
    listedStock.previous_close = baseP0;
    listedStock.lower_circuit = Number((calculatedListingPrice * 0.90).toFixed(2));
    listedStock.upper_circuit = Number((calculatedListingPrice * 1.10).toFixed(2));
  }

  // Fair Allotment Engine:
  // If demand <= supply (undersubscribed): All teams receive 100% of requested lots
  // If demand > supply (oversubscribed):
  // 1. Guaranteed 1-lot minimum allocation per applicant team (SEBI-style retail protection)
  // 2. Pro-rata proportional distribution for the remaining available lot pool
  // 3. Rounding remainder lots distributed via computerized randomized lottery draw
  const isOversubscribed = totalLotsDemanded > totalLotsOffered;
  const guaranteedMin = subs.length <= totalLotsOffered ? 1 : 0;
  const remainingPool = totalLotsOffered - (guaranteedMin * subs.length);
  const excessDemanded = totalLotsDemanded - (guaranteedMin * subs.length);

  const allotmentMap = new Map<string, number>();
  let preliminaryAllotted = 0;

  subs.forEach((sub) => {
    if (!isOversubscribed) {
      allotmentMap.set(sub.id, sub.lots_requested);
      preliminaryAllotted += sub.lots_requested;
    } else {
      const extraLots = excessDemanded > 0 && remainingPool > 0
        ? Math.floor(((sub.lots_requested - guaranteedMin) / excessDemanded) * remainingPool)
        : 0;
      const teamLots = Math.min(sub.lots_requested, guaranteedMin + extraLots);
      allotmentMap.set(sub.id, teamLots);
      preliminaryAllotted += teamLots;
    }
  });

  // Distribute rounding remainder lots via fair randomized lottery draw up to totalLotsOffered
  let remainderLots = Math.max(0, totalLotsOffered - preliminaryAllotted);
  if (isOversubscribed && remainderLots > 0) {
    const randomizedSubs = [...subs].sort(() => Math.random() - 0.5);
    for (const sub of randomizedSubs) {
      if (remainderLots <= 0) break;
      const current = allotmentMap.get(sub.id) || 0;
      if (current < sub.lots_requested) {
        allotmentMap.set(sub.id, current + 1);
        remainderLots--;
      }
    }
  }

  let totalLotsAllotted = 0;

  subs.forEach((sub) => {
    const team = (db.teams || []).find((t) => t.id === sub.team_id);
    if (!team) return;

    const leader =
      db.users.find(
        (u) =>
          u.id === team.leader_id ||
          (u.email && u.email.toLowerCase() === (team.leader_email || '').toLowerCase())
      ) || db.users.find((u) => u.team_id === team.id);
    if (!leader) return;

    const allottedLots = allotmentMap.get(sub.id) ?? sub.lots_requested;
    const finalShares = allottedLots * ipo.lot_size;
    const finalCost = Number((finalShares * baseP0).toFixed(2)); // Primary acquisition at reference price

    if (leader.balance < finalCost) return;

    // Deduct cash
    leader.balance = Number((leader.balance - finalCost).toFixed(2));
    team.balance = leader.balance;

    // Credit shares to portfolio
    let port = db.portfolios.find((p) => p.user_id === leader.id && p.stock_id === listedStock!.id);
    if (!port) {
      port = {
        id: 'port-' + Math.random().toString(36).substring(2, 9),
        user_id: leader.id,
        stock_id: listedStock!.id,
        shares_count: finalShares,
        avg_buy_price: baseP0,
        updated_at: new Date().toISOString(),
      };
      db.portfolios.push(port);
    } else {
      const prevTotal = port.shares_count * port.avg_buy_price;
      const newTotal = prevTotal + finalCost;
      const newCount = port.shares_count + finalShares;
      port.shares_count = newCount;
      port.avg_buy_price = Number((newTotal / newCount).toFixed(2));
      port.updated_at = new Date().toISOString();
    }

    // Log transaction
    const tx: Transaction = {
      id: 'tx-ipo-' + Math.random().toString(36).substring(2, 9),
      user_id: leader.id,
      stock_id: listedStock!.id,
      type: 'BUY',
      quantity: finalShares,
      price_at_trade: baseP0,
      gross_amount: finalCost,
      brokerage: 0, // No brokerage on primary IPO allotment
      net_amount: finalCost,
      timestamp: new Date().toISOString(),
    };
    db.transactions.push(tx);

    sub.lots_allotted = allottedLots;
    sub.share_quantity = finalShares;
    sub.total_amount = finalCost;
    sub.status = 'ALLOTTED';
    totalLotsAllotted += allottedLots;

    syncTeamPortfolioAndBalance(team.id);
  });

  ipo.allotted_lots += totalLotsAllotted;
  ipo.status = 'ALLOTTED';

  // Broadcast IPO listing to all floor screens
  (db as any).latest_trade = {
    id: 'ipo-listing-' + Date.now(),
    seller_team: 'Primary Offering Issuer',
    buyer_team: 'Dalal Street Market',
    ticker: ipo.ticker,
    stock_name: ipo.company_name,
    quantity: totalLotsAllotted * ipo.lot_size,
    price: calculatedListingPrice,
    total_amount: Number((totalLotsAllotted * ipo.lot_size * calculatedListingPrice).toFixed(2)),
    timestamp: Date.now(),
  };

  saveLocalDB(db);

  broadcastRealtimeEvent('TRADE_EXECUTED', (db as any).latest_trade);
  broadcastRealtimeEvent('IPO_ALLOTTED', { ipo_id: ipo.id, ticker: ipo.ticker });
  if (listedStock) {
    broadcastRealtimeEvent('STOCK_PRICE_UPDATED', listedStock);
    syncStockToSupabase(listedStock);
  }

  logger.audit('IPO_ALLOTTED_AND_LISTED', adminEmail || 'AdminDesk', {
    ipoId,
    ticker: ipo.ticker,
    totalDemanded: totalLotsDemanded,
    totalAllotted: totalLotsAllotted,
    listingPrice: calculatedListingPrice,
  });

  return {
    success: true,
    allottedCount: subs.length,
    listingPrice: calculatedListingPrice,
    message: `Smooth IPO Allotment complete! Subscribed: ${subscriptionRatio}x (Demand: ${totalLotsDemanded}/${totalLotsOffered} lots). Listing Price: ₹${calculatedListingPrice.toFixed(2)} (Ref: ₹${baseP0}). Stock listed on Dalal Street!`,
  };
}

export function getLatestBroadcastTrade(): any {
  const db = getLocalDB();
  return (db as any).latest_trade || null;
}

export function createCustomIPO(params: {
  adminEmail?: string;
  company_name: string;
  ticker: string;
  sector?: string;
  issue_price: number;
  lot_size?: number;
  total_issue_lots?: number;
  round_id?: string;
  description?: string;
}): { success: boolean; ipo?: IPOListing; error?: string } {
  if (!params.company_name || !params.ticker) {
    return { success: false, error: 'Company Name and Ticker Symbol are required.' };
  }
  const cleanTicker = params.ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanPrice = Number(params.issue_price);
  if (isNaN(cleanPrice) || cleanPrice <= 0) {
    return { success: false, error: 'Valid positive issue price is required.' };
  }

  const db = getLocalDB();
  if (!db.ipo_listings) {
    db.ipo_listings = [...DEFAULT_IPO_LISTINGS];
  }

  // Check if ticker already exists in listings
  const existingListing = db.ipo_listings.find((i) => i.ticker.toUpperCase() === cleanTicker);
  if (existingListing) {
    return { success: false, error: `An IPO with ticker "${cleanTicker}" already exists.` };
  }

  const currentRound = db.current_round_id || 'round-1';
  const targetRound = params.round_id || currentRound;

  const lotSize = Number(params.lot_size) > 0 ? Number(params.lot_size) : 12;
  const totalIssueLots = Number(params.total_issue_lots) > 0 ? Number(params.total_issue_lots) : 100;

  const newIPO: IPOListing = {
    id: 'ipo-custom-' + Date.now(),
    round_id: targetRound as any,
    company_name: params.company_name.trim(),
    ticker: cleanTicker,
    sector: (params.sector || 'Emerging Growth').trim(),
    reference_price: cleanPrice,
    issue_price: cleanPrice,
    lot_size: lotSize,
    min_lots: 1,
    max_lots: Math.max(30, Math.floor(totalIssueLots * 0.3)),
    total_issue_lots: totalIssueLots,
    total_demanded_lots: 0,
    subscription_ratio: 0,
    allotted_lots: 0,
    status: 'SUBSCRIPTION_OPEN',
    description: (params.description || `Surprise IPO Listing for ${params.company_name.trim()}. Book-building open.`).trim(),
  };

  db.ipo_listings.push(newIPO);

  // Pre-seed stock in db.stocks so participants immediately see it on floor ticker
  let stock = db.stocks.find((s) => s.ticker.toUpperCase() === cleanTicker);
  if (!stock) {
    stock = {
      id: 's-' + cleanTicker.toLowerCase(),
      ticker: cleanTicker,
      name: newIPO.company_name,
      sector: newIPO.sector,
      current_price: cleanPrice,
      previous_close: cleanPrice,
      day_high: cleanPrice,
      day_low: cleanPrice,
      is_frozen: false,
      lower_circuit: Number((cleanPrice * 0.90).toFixed(2)),
      upper_circuit: Number((cleanPrice * 1.10).toFixed(2)),
      beta: 1.25,
      pe_ratio: 24.0,
      market_cap: '₹' + Math.floor((cleanPrice * totalIssueLots * lotSize * 15) / 10000000) + ' Cr',
    };
    db.stocks.push(stock);
  }

  // Broadcast surprise IPO to all floor screens (10s banner)
  (db as any).latest_trade = {
    id: 'ipo-launch-' + Date.now(),
    seller_team: '⚡ SURPRISE IPO ANNOUNCED',
    buyer_team: 'Dalal Street Primary Book',
    ticker: cleanTicker,
    stock_name: newIPO.company_name,
    quantity: totalIssueLots * lotSize,
    price: cleanPrice,
    total_amount: Number((totalIssueLots * lotSize * cleanPrice).toFixed(2)),
    timestamp: Date.now(),
  };

  saveLocalDB(db);

  logger.audit('CUSTOM_IPO_CREATED', params.adminEmail || 'AdminDesk', {
    ticker: cleanTicker,
    company: newIPO.company_name,
    issuePrice: cleanPrice,
    totalIssueLots,
    roundId: targetRound,
  });

  return { success: true, ipo: newIPO };
}
