import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    RENT_AND_UTILITIES: 'Rent & Utilities',
    CREDIT_CARD_PAYMENT: 'Credit Card Payment',
  };
  if (labels[category]) {
    return labels[category];
  }
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const BUCKET_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  hysa: 'HYSA',
  brokerage: 'Brokerage',
  retirement_401k: '401(k)',
  retirement_roth: 'Roth IRA',
  liability: 'Credit Card',
};

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function isCurrentMonth(ym: string): boolean {
  return ym === currentMonth();
}
