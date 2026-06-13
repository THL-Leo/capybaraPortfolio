import { useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { MonthlyTotalsResponse } from '@/api/types';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { MonthNavigator } from '@/components/MonthNavigator';
import { useSpending } from '@/hooks/useSpending';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, currentMonth, formatMoney } from '@/lib/utils';

export default function Spending() {
  const [month, setMonth] = useState(currentMonth);
  const { data, loading, error } = useSpending(month);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyTotalsResponse['months']>([]);

  useEffect(() => {
    apiGet<MonthlyTotalsResponse>('/spending/monthly-totals?months=12')
      .then((res) => setMonthlyHistory(res.months ?? []))
      .catch(() => setMonthlyHistory([]));
  }, [data]);

  if (loading && !data) return <Skeleton className="h-64 w-full" />;

  const summary = data?.spending_summary;
  const byCategory = data?.by_category ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Spending</h1>
          <p className="text-sm text-capy-muted">Credit card spending by category</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

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
            <DataGrid
              template="twoCol"
              rows={monthlyHistory}
              getRowKey={(row) => row.month}
              onRowClick={(row) => setMonth(row.month)}
              getRowClassName={(row) => cn(row.month === month && 'bg-muted/30')}
              columns={[
                { key: 'month', header: 'Month', render: (row) => row.month_label },
                {
                  key: 'total',
                  header: 'Total spent',
                  align: 'right',
                  render: (row) => formatMoney(row.total),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
