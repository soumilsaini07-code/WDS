// Core TypeScript Data Definitions for Wolf of Dalal Street – Institutional Edition

export type Role = 'superadmin' | 'admin' | 'participant';

export type PlatformMode = 'competition' | 'syndicate';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: Role;
  balance: number; // in INR (default 10,00,000)
  ecoin_balance: number; // in ECoin
  created_at: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  group_name?: string;
  team_id?: string;
  team_name?: string;
  is_team_leader?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roll?: string;
  is_leader?: boolean;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  leader_id: string;
  leader_name: string;
  leader_email: string;
  members: TeamMember[]; // max 6 members
  balance: number;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  created_at: string;
}

export interface OrderSlip {
  id: string;
  slip_id: string; // e.g. "SLIP-8491"
  team_id: string;
  team_name: string;
  student_id: string;
  student_name: string;
  student_email: string;
  user_name?: string;
  user_email?: string;
  stock_id: string;
  ticker: string;
  stock_name: string;
  type: TransactionType;
  order_type?: TransactionType;
  quantity: number;
  price: number;
  gross_amount?: number;
  brokerage?: number; // 5% brokerage fee
  total_amount: number;
  status: 'PENDING' | 'EXECUTED' | 'REJECTED';
  created_at: string;
  executed_at?: string;
  executed_by_admin?: string;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  current_price: number;
  previous_close: number;
  day_high: number;
  day_low: number;
  is_frozen: boolean;
  lower_circuit?: number; // ±10% lower limit
  upper_circuit?: number; // ±10% upper limit
  beta?: number; // Systematic market sensitivity
  pe_ratio?: number;
  market_cap?: string;
  change?: number;
  change_percent?: number;
  historical_prices?: number[];
  drifts?: Record<string, number>;
}

export interface Portfolio {
  id: string;
  user_id: string;
  stock_id: string;
  shares_count: number;
  avg_buy_price: number;
  updated_at: string;
  // Hydrated stock info for UI
  stock?: Stock;
}

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  user_id: string;
  stock_id: string;
  type: TransactionType;
  quantity: number;
  price_at_trade: number;
  gross_amount?: number;
  brokerage?: number;
  net_amount?: number;
  timestamp: string;
  // Optional convenience aliases
  price?: number;
  total?: number;
  // Hydrated stock info
  stock?: Stock;
  // Governance attribution
  proposal_id?: string;
  approved_by?: string;
  fund_id?: string;
  round_id?: string;
}

export type ProposalThesisCategory =
  | 'Sector Rotation'
  | 'Earnings Play'
  | 'Macro Hedge'
  | 'Hedge / Downside Risk'
  | 'Macro Catalyst'
  | 'Valuation Gap'
  | 'Concentration Management';

export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TradeProposal {
  id: string;
  fund_id: string;
  proposer_id: string;
  proposer_email: string;
  proposer_role: Role;
  stock_id: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  proposed_price: number;
  estimated_total: number;
  thesis_category: ProposalThesisCategory;
  thesis_notes: string;
  status: ProposalStatus;
  reviewer_id?: string;
  reviewer_email?: string;
  reviewer_feedback?: string;
  created_at: string;
  reviewed_at?: string;
  executed_transaction_id?: string;
  stock?: Stock;
}

export interface SyndicateFund {
  id: string;
  name: string;
  code: string;
  total_aum: number;
  cash_balance: number;
  benchmark_index: string; // e.g. "NIFTY 50"
  created_at: string;
}

export interface SectorExposure {
  sector: string;
  value: number;
  percentage: number;
  isConcentrated: boolean; // >40% allocation alert
}

export interface InstitutionalRiskMetrics {
  var95Percent1Day: number; // Value-at-Risk 95% 1-day (in INR)
  portfolioBeta: number; // Beta relative to NIFTY 50
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sectorAllocations: SectorExposure[];
  circuitLimitBreachesCount: number;
}

export interface PortfolioSnapshot {
  id: string;
  timestamp: string;
  date_label: string;
  fund_equity: number;
  cash_balance: number;
  benchmark_value: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  ordersCount: number;
  totalVolume: number;
}

export interface MarketDepth {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadBps: number;
}

export interface MarketEvent {
  id: string;
  headline: string;
  description: string;
  impact_map: Record<string, number>; // ticker -> percentage_delta (e.g. {"TATAMOTORS": 10.0, "ONGC": -5.0})
  created_at: string;
}

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  sentiment: Sentiment;
  published_at: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions_json: QuizQuestion[];
  reward_cash: number;
  reward_ecoin: number;
}

export interface UserSession {
  userId: string;
  email: string;
  role: Role;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  group_name?: string;
  team_id?: string;
  team_name?: string;
  is_team_leader?: boolean;
}

export interface PortfolioMetric {
  totalNetWorth: number;
  availableCash: number;
  totalHoldingsValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// =============================================================================
// COMPETITION ROUNDS, 4-BRANCH DYNAMIC PRICING & IPO ENGINE
// =============================================================================

export type CompetitionRoundId =
  | 'round-0'
  | 'round-1'
  | 'round-2'
  | 'ipo-1'
  | 'round-3'
  | 'ipo-2'
  | 'round-4'
  | 'round-5';

export type RoundStageType = 'PRE_MARKET' | 'PRIMARY_DESK' | 'P2P_TRADING' | 'IPO';

export interface CompetitionRound {
  id: CompetitionRoundId;
  index: number;
  name: string;
  type: RoundStageType;
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'COMPLETED';
  duration_minutes: number;
  started_at?: string;
  ends_at?: string;
  news_headline?: string;
  description: string;
  rules_note?: string;
}

export type StockPricingBranch =
  | 'BRANCH_1_ORDERS'           // Orders After Time: P_orders + R%
  | 'BRANCH_2_ORDERS_AND_NEWS'  // Orders After Time + News: P_orders + N% + R%
  | 'BRANCH_3_NEWS_ONLY'        // News Only: P_current + N%
  | 'BRANCH_4_NULL';            // NULL: P_current + R% (within ±10% collars)

export interface StockPriceSettlement {
  stock_id: string;
  ticker: string;
  name: string;
  previous_round_price: number;
  order_count: number;
  total_volume_traded: number;
  orders_baseline_price?: number; // P_orders (VWAP of orders in this round)
  news_impact_percent: number;    // N% (Admin controllable)
  market_drift_percent: number;   // R% (Admin controllable)
  branch: StockPricingBranch;
  branch_label: string;
  calculated_price: number;
  final_price: number;            // Admin confirmed price
  circuit_lower: number;          // ±10% lower collar
  circuit_upper: number;          // ±10% upper collar
  is_circuit_breached: boolean;
}

export interface RoundSettlementState {
  round_id: CompetitionRoundId;
  market_r_percent: number;       // Global R% derived from average traded stock shifts
  r_formula_details: {
    total_round_buy_volume: number;
    total_round_sell_volume: number;
    average_traded_stock_shift: number;
    calculated_r: number;
  };
  settlements: StockPriceSettlement[];
  is_applied: boolean;
  applied_at?: string;
}

export interface IPOListing {
  id: string;
  round_id: 'ipo-1' | 'ipo-2';
  company_name: string;
  ticker: string;
  sector: string;
  reference_price: number;      // P0: Base reference price per share
  issue_price: number;          // P_listing calculated via smooth formula
  lot_size: number;             // e.g. 12 shares as per brief
  min_lots: number;
  max_lots: number;
  total_issue_lots: number;     // L: Total lots offered in the IPO
  total_demanded_lots?: number; // D: Total lots requested by teams
  subscription_ratio?: number;  // S = D / L
  allotted_lots: number;
  status: 'UPCOMING' | 'SUBSCRIPTION_OPEN' | 'ALLOTTED' | 'LISTED';
  description: string;
  news_impact_percent?: number;
  news_headline?: string;
}

export interface IPOSubscription {
  id: string;
  ipo_id: string;
  round_id: 'ipo-1' | 'ipo-2';
  team_id: string;
  team_name: string;
  user_id: string;
  user_name: string;
  lots_requested: number;
  share_quantity: number;
  issue_price: number;
  total_amount: number;
  lots_allotted: number;
  status: 'BID_PLACED' | 'ALLOTTED' | 'REJECTED';
  created_at: string;
}
