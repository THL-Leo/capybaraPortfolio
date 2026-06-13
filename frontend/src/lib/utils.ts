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
};
