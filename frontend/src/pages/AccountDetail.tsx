import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '@/api/client';
import type { Holding, PlaidAccount, Transaction } from '@/api/types';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { HoldingsGrid } from '@/components/HoldingsGrid';
import { MoMBadge } from '@/components/MoMBadge';
import { MonthNavigator } from '@/components/MonthNavigator';
import { TransactionsGrid } from '@/components/TransactionsGrid';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  bucketLabel,
  isCashBucket,
  isCreditBucket,
  isInvestmentBucket,
} from '@/lib/accountGroups';
import {
  addMonths,
  currentMonth,
  formatMoney,
  formatMonthLabel,
} from '@/lib/utils';

interface AccountSpendingResponse {
  summary: { month_to_date: number; month_label: string; month: string };
  by_category: { category: string; amount: number }[];
}

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [month, setMonth] = useState(currentMonth);
  const [account, setAccount] = useState<PlaidAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spending, setSpending] = useState<AccountSpendingResponse | null>(null);
  const [prevMonthSpend, setPrevMonthSpend] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      const prevMonth = addMonths(month, -1);

      try {
        const [accRes, txRes, spendRes, prevRes, accountsRes] = await Promise.all([
          apiGet<{ account: PlaidAccount }>(`/accounts/${id}`),
          apiGet<{ transactions: Transaction[] }>(
            `/accounts/${id}/transactions?month=${month}`,
          ),
          apiGet<AccountSpendingResponse>(`/accounts/${id}/spending?month=${month}`),
          apiGet<AccountSpendingResponse>(`/accounts/${id}/spending?month=${prevMonth}`),
          apiGet<{ holdings_analytics: Holding[] }>('/accounts'),
        ]);

        if (!cancelled) {
          setAccount(accRes.account);
          setTransactions(txRes.transactions ?? []);
          setSpending(spendRes);
          setPrevMonthSpend(prevRes.summary?.month_to_date ?? 0);
          const acctHoldings = (accountsRes.holdings_analytics ?? []).filter(
            (h) => h.account_id === id,
          );
          setHoldings(acctHoldings);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, month]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!account) return <Alert variant="destructive">Account not found</Alert>;

  const bucket = account.bucket;
  const isCredit = isCreditBucket(bucket) || account.type === 'credit';
  const isInvestment = isInvestmentBucket(bucket) || account.type === 'investment';
  const isCash = isCashBucket(bucket) || account.type === 'depository';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounts" className="text-sm text-capy-primary hover:underline">
          ← Back to accounts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <Badge>{bucketLabel(bucket)}</Badge>
        </div>
        <p className="text-sm text-capy-muted">
          {account.institution_name} · {account.subtype || account.type}
          {account.mask && ` ···${account.mask}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isCredit ? 'Balance owed' : 'Balance'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-semibold ${isCredit ? 'text-destructive' : ''}`}>
            {formatMoney(account.current_balance)}
          </p>
          {isCash && account.available_balance != null && (
            <p className="mt-1 text-sm text-capy-muted">
              Available: {formatMoney(account.available_balance)}
            </p>
          )}
          {account.last_synced_at && (
            <p className="mt-1 text-xs text-capy-muted">
              Last synced {new Date(account.last_synced_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {isCredit && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Spending</h2>
            <MonthNavigator month={month} onChange={setMonth} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{spending?.summary.month_label ?? formatMonthLabel(month)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(spending?.summary.month_to_date ?? 0)}
              </p>
              {prevMonthSpend != null && spending && (
                <div className="mt-2">
                  <MoMBadge
                    current={spending.summary.month_to_date}
                    previous={prevMonthSpend}
                    previousLabel={formatMonthLabel(addMonths(month, -1))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBreakdown data={spending?.by_category ?? []} month={month} />
            </CardContent>
          </Card>
        </>
      )}

      {isInvestment && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <Badge>{holdings.length} positions</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {holdings.length === 0 ? (
              <p className="p-6 text-sm text-capy-muted">No holdings in this account</p>
            ) : (
              <HoldingsGrid holdings={holdings} emptyMessage="No holdings in this account" />
            )}
          </CardContent>
        </Card>
      )}

      {(isCredit || isCash) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCredit ? `Transactions — ${formatMonthLabel(month)}` : 'Recent transactions'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TransactionsGrid
              transactions={transactions}
              emptyMessage={
                isCredit
                  ? `No transactions in ${formatMonthLabel(month)}.`
                  : 'No transactions for this account.'
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
