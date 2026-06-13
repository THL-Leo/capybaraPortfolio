import type { AccountBucket, PlaidAccount } from '@/api/types';
import { BUCKET_LABELS, formatMoney } from '@/lib/utils';

export type AccountSectionKey = 'cash' | 'investments' | 'credit';

export interface AccountSection {
  key: AccountSectionKey;
  title: string;
  accounts: PlaidAccount[];
  subtotal: number;
}

const CASH_BUCKETS: AccountBucket[] = ['checking', 'savings', 'hysa'];
const INVESTMENT_BUCKETS: AccountBucket[] = ['brokerage', 'retirement_401k', 'retirement_roth'];

const SECTION_META: Record<AccountSectionKey, { title: string; buckets: AccountBucket[] }> = {
  cash: { title: 'Cash', buckets: CASH_BUCKETS },
  investments: { title: 'Investments', buckets: INVESTMENT_BUCKETS },
  credit: { title: 'Credit Cards', buckets: ['liability'] },
};

export function groupAccountsBySection(accounts: PlaidAccount[]): AccountSection[] {
  const sections: AccountSection[] = [];

  for (const key of ['cash', 'investments', 'credit'] as AccountSectionKey[]) {
    const { title, buckets } = SECTION_META[key];
    const filtered = accounts.filter((a) => a.bucket && buckets.includes(a.bucket));
    if (!filtered.length) continue;

    const subtotal = filtered.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
    sections.push({ key, title, accounts: filtered, subtotal });
  }

  return sections;
}

export function bucketLabel(bucket?: AccountBucket): string {
  if (!bucket) return 'Account';
  return BUCKET_LABELS[bucket] ?? bucket;
}

export function formatSectionSubtotal(key: AccountSectionKey, subtotal: number): string {
  if (key === 'credit') {
    return `${formatMoney(subtotal)} owed`;
  }
  return formatMoney(subtotal);
}

export function isInvestmentBucket(bucket?: AccountBucket): boolean {
  return !!bucket && INVESTMENT_BUCKETS.includes(bucket);
}

export function isCashBucket(bucket?: AccountBucket): boolean {
  return !!bucket && CASH_BUCKETS.includes(bucket);
}

export function isCreditBucket(bucket?: AccountBucket): boolean {
  return bucket === 'liability';
}
