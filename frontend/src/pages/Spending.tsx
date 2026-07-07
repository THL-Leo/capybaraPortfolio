import { useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { MonthlyTotalsResponse } from '@/api/types';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { MonthNavigator } from '@/components/MonthNavigator';
import { PageHeader } from '@/components/layout/PageHeader';
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
    <div className="space-y-8">
      <PageHeader
        title="Spending"
        description="Credit card spending by category"
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <section className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          {summary?.month_label ?? 'This month'}
        </p>
        <p className="metric-value">{formatMoney(summary?.month_to_date ?? 0)}</p>
        <p className="text-xs text-muted-foreground">Total spending</p>
      </section>

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
          <CardContent className="p-0 pb-5">
            <DataGrid
              template="twoCol"
              rows={monthlyHistory}
              getRowKey={(row) => row.month}
              onRowClick={(row) => setMonth(row.month)}
              getRowClassName={(row) => cn(row.month === month && 'bg-muted/50')}
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
