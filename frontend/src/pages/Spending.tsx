import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/api/client';
import type { MonthlyTotalsResponse } from '@/api/types';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { MonthNavigator } from '@/components/MonthNavigator';
import { useSpending } from '@/hooks/useSpending';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, currentMonth, formatMoney } from '@/lib/utils';

export default function Spending() {
  const [month, setMonth] = useState(currentMonth);
  const { data, loading, error, refresh } = useSpending(month);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyTotalsResponse['months']>([]);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    apiGet<MonthlyTotalsResponse>('/spending/monthly-totals?months=12')
      .then((res) => setMonthlyHistory(res.months ?? []))
      .catch(() => setMonthlyHistory([]));
  }, [data]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !limit) return;
    setSaving(true);
    setLocalError('');
    try {
      await apiPost('/spending/budgets', {
        category,
        limit_amount: parseFloat(limit),
        month,
      });
      setMessage('Budget saved');
      setCategory('');
      setLimit('');
      refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: number) => {
    try {
      await apiDelete(`/spending/budgets/${id}`);
      setMessage('Budget removed');
      refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading && !data) return <Skeleton className="h-64 w-full" />;

  const summary = data?.spending_summary;
  const byCategory = data?.by_category ?? [];
  const budgets = data?.budgets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Spending</h1>
          <p className="text-sm text-capy-muted">Credit card spending and budgets</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      {(error || localError) && <Alert variant="destructive">{error || localError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{summary?.month_label ?? 'This month'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-capy-muted">Total spending</p>
          <p className="text-3xl font-semibold">{formatMoney(summary?.month_to_date ?? 0)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBreakdown data={byCategory} month={month} />
        </CardContent>
      </Card>

      {monthlyHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyHistory.map((row) => (
                  <TableRow
                    key={row.month}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      row.month === month && 'bg-muted/30',
                    )}
                    onClick={() => setMonth(row.month)}
                  >
                    <TableCell>{row.month_label}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monthly budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSaveBudget} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="FOOD_AND_DRINK"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                min="0"
                step="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="500"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add budget'}
            </Button>
          </form>

          {budgets.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => (
                  <TableRow key={b.budget_id ?? b.category}>
                    <TableCell>{b.category}</TableCell>
                    <TableCell className="text-right">{formatMoney(b.actual)}</TableCell>
                    <TableCell className="text-right">{formatMoney(b.limit)}</TableCell>
                    <TableCell className="text-right">
                      {b.budget_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBudget(b.budget_id!)}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
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
