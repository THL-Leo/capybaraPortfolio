import { useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { HomeResponse } from '@/api/types';
import { useNetWorth } from '@/hooks/useNetWorth';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
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
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const breakdown = current?.breakdown ?? home?.plaid?.breakdown;
  const chartData = snapshots.map((s) => ({ date: s.date, value: s.total }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        {home && <p className="text-sm text-capy-muted">{home.message}</p>}
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-capy-muted">Net worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatMoney(current?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-capy-muted">Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-capy-primary">
              {formatMoney(current?.assets_total ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-capy-muted">Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-capy-credit">
              {formatMoney(current?.liabilities_total ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Bucket breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} className="flex justify-between rounded-lg border p-3">
                  <span className="text-sm text-capy-muted">{BUCKET_LABELS[key] ?? key}</span>
                  <span className="font-medium">{formatMoney(val)}</span>
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
