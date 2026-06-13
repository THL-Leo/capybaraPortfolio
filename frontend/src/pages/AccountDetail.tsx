import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '@/api/client';
import type { PlaidAccount, Transaction } from '@/api/types';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCategory, formatMoney } from '@/lib/utils';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<PlaidAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spending, setSpending] = useState<{
    summary: { month_to_date: number; month_label: string };
    by_category: { category: string; amount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [accRes, txRes, spendRes] = await Promise.all([
          apiGet<{ account: PlaidAccount }>(`/accounts/${id}`),
          apiGet<{ transactions: Transaction[] }>(`/accounts/${id}/transactions`),
          apiGet<{
            summary: { month_to_date: number; month_label: string };
            by_category: { category: string; amount: number }[];
          }>(`/accounts/${id}/spending`),
        ]);
        if (!cancelled) {
          setAccount(accRes.account);
          setTransactions(txRes.transactions ?? []);
          setSpending(spendRes);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!account) return <Alert variant="destructive">Account not found</Alert>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounts" className="text-sm text-capy-primary hover:underline">
          ← Back to accounts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{account.name}</h1>
        <p className="text-sm text-capy-muted">
          {account.institution_name} · {account.subtype || account.type}
          {account.mask && ` ···${account.mask}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatMoney(account.current_balance)}</p>
        </CardContent>
      </Card>

      {spending && account.type === 'credit' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{spending.summary.month_label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(spending.summary.month_to_date)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart data={spending.by_category} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-capy-muted">No transactions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.transaction_id}>
                    <TableCell>{tx.transaction_date}</TableCell>
                    <TableCell>{tx.merchant_name || tx.name || '—'}</TableCell>
                    <TableCell className="text-capy-muted">
                      {tx.category_primary ? formatCategory(tx.category_primary) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(tx.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
