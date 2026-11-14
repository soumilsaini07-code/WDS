import { Stock } from './types';

export const INITIAL_PURSE_PER_TEAM = 10000000; // ₹1,00,00,000 (100 Lakhs / 1 Crore)
export const ROUND_0_MIN_DEPLOYMENT_RATIO = 0.60; // 60% must be deployed in Round 0 (₹60 Lakhs)
export const POST_ROUND_MIN_CASH_RATIO = 0.10; // 10% cash reserve floor (₹10 Lakhs)

export interface TeamPurseRecord {
  teamId: string;
  teamName: string;
  teamCode: string;
  leaderName: string;
  leaderEmail: string;
  initialPurse: number;
  currentCash: number;
  round0Spent: number;
  round0DeployedPercent: number;
  round0Met60Percent: boolean;
  round0Shortfall: number;
  cashReservePercent: number;
  cashMet10PercentFloor: boolean;
  totalHoldingsValue: number;
  totalNetWorth: number;
  tradesCount: number;
  status: 'QUALIFIED' | 'LOW_CASH_WARNING' | 'ELIMINATION_RISK';
  holdingsByStock: Record<string, number>; // ticker -> quantity
}

export interface TradeLedgerRow {
  slipId: string;
  txId: string;
  timestamp: string;
  roundId: string;
  buyerTeam: string;
  sellerTeam: string;
  ticker: string;
  stockName: string;
  quantity: number;
  price: number;
  grossAmount: number;
  buyerBrokerage: number;
  sellerBrokerage: number;
  buyerTotalDebit: number;
  sellerNetCredit: number;
  deskCommission: number;
  isRound0Exempt: boolean;
  status: 'EXECUTED' | string;
}

export interface BrokerLedgerSnapshot {
  currentRoundId: string;
  currentRoundName: string;
  roundClock: {
    remaining_seconds: number;
    is_paused: boolean;
    is_orders_locked: boolean;
  };
  totalDealsSettled: number;
  totalVolumeShares: number;
  totalGrossConsideration: number;
  totalDeskCommission: number;
  teamsPurse: TeamPurseRecord[];
  tradesLedger: TradeLedgerRow[];
  stocks: Stock[];
  holdingsMatrix: {
    stocks: { id: string; ticker: string; name: string; current_price: number }[];
    teams: {
      teamId: string;
      teamName: string;
      teamCode: string;
      holdings: Record<string, number>;
      totalValue: number;
    }[];
  };
}
