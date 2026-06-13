export interface User {
  id: number;
  username: string;
}

export interface NetWorthBreakdown {
  checking: number;
  savings: number;
  hysa: number;
  brokerage: number;
  retirement_401k: number;
  retirement_roth: number;
}

export interface NetWorthData {
  source: string;
  total: number;
  assets_total: number;
  liabilities_total: number;
  cash_total: number;
  investments_total: number;
  breakdown: NetWorthBreakdown;
  message?: string;
}

export interface NetWorthSnapshot {
  date: string;
  total: number;
  cash_total: number;
  investments_total: number;
  assets_total?: number;
  liabilities_total?: number;
  breakdown: NetWorthBreakdown;
  source: string;
}

export interface PlaidItem {
  item_id: string;
  institution_id?: string;
  institution_name?: string;
  status: string;
  error_message?: string;
  last_sync_at?: string;
  created_at?: string;
}

export type AccountBucket =
  | 'checking'
  | 'savings'
  | 'hysa'
  | 'brokerage'
  | 'retirement_401k'
  | 'retirement_roth'
  | 'liability';

export interface PlaidAccount {
  account_id: string;
  item_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  mask?: string;
  current_balance?: number;
  available_balance?: number;
  currency?: string;
  last_synced_at?: string;
  institution_name?: string;
  institution_id?: string;
  bucket?: AccountBucket;
}

export interface Holding {
  account_id: string;
  security_id?: string;
  ticker_symbol?: string;
  security_name?: string;
  quantity?: number;
  cost_basis?: number;
  institution_value?: number;
  institution_price?: number;
  market_value?: number;
  unrealized_gain?: number | null;
  unrealized_gain_pct?: number | null;
}

export interface AllocationSlice {
  label: string;
  value: number;
  percent: number;
}

export interface SpendingCategory {
  category: string;
  amount: number;
}

export interface SpendingWeek {
  week_start: string;
  amount: number;
  label?: string;
}

export interface SpendingAnalyticsResponse {
  spending_summary: {
    month_to_date: number;
    month_label: string;
    month: string;
  };
  by_category: SpendingCategory[];
  by_week: SpendingWeek[];
}

export interface Transaction {
  account_id: string;
  transaction_id: string;
  transaction_date: string;
  name?: string;
  merchant_name?: string;
  amount: number;
  pending?: number;
  category_primary?: string;
}

export interface HomeResponse {
  message: string;
  user: User;
  stats: { net_worth?: number };
  plaid: {
    has_items: boolean;
    linked_institutions?: number;
    net_worth?: number;
    assets_total?: number;
    liabilities_total?: number;
    breakdown?: NetWorthBreakdown;
    cash_total?: number;
    investments_total?: number;
    sync_items?: PlaidItem[];
  };
}

export interface AccountsResponse {
  items: PlaidItem[];
  accounts: PlaidAccount[];
  holdings: Holding[];
  holdings_analytics: Holding[];
  allocation: { total: number; slices: AllocationSlice[] };
  credit_cards: PlaidAccount[];
}

export interface MonthlySpendingTotal {
  month: string;
  month_label: string;
  total: number;
}

export interface MonthlyTotalsResponse {
  months: MonthlySpendingTotal[];
}
