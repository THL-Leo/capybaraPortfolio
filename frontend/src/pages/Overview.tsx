import { useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { HomeResponse } from '@/api/types';
import { useNetWorth } from '@/hooks/useNetWorth';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BUCKET_LABELS, formatMoney } from '@/lib/utils';

export default function Overview() {
  const { current, snapshots, loading, error } = useNetWorth();
  const [home, setHome] = useState<HomeResponse | null>(null);

  useEffect(() => {
    apiGet<HomeResponse>('/home').then(setHome).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const breakdown = current?.breakdown ?? home?.plaid?.breakdown;
  const chartData = snapshots.map((s) => ({ date: s.date, value: s.total }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={home?.message}
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <section className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Net worth</p>
          <p className="metric-value mt-1">{formatMoney(current?.total ?? 0)}</p>
        </div>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Assets</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatMoney(current?.assets_total ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Liabilities</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-destructive">
              {formatMoney(current?.liabilities_total ?? 0)}
            </p>
          </div>
        </div>
      </section>

      {breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Bucket breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60">
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">
                    {BUCKET_LABELS[key] ?? key}
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatMoney(val)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Net worth over time</CardTitle>
          <Badge>{snapshots.length ? 'Plaid' : 'No data'}</Badge>
        </CardHeader>
        <CardContent>
          <NetWorthChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
