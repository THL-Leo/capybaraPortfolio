import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IntradayPoint } from '@/api/types';
import { formatMoney } from '@/lib/utils';

interface TrackerIntradayChartProps {
  data: IntradayPoint[];
  positive?: boolean;
  negative?: boolean;
}

interface ChartPoint {
  at: string;
  price: number;
  ts: number;
}

function parsePointMs(point: IntradayPoint): number {
  const raw = point.at ?? (point as IntradayPoint & { time?: string }).time ?? '';
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatAxisTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTooltipTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildTicks(points: ChartPoint[], count = 4): number[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    return [points[0].ts];
  }

  const first = points[0].ts;
  const last = points[points.length - 1].ts;
  if (first === last) {
    return [first];
  }

  const slots = Math.min(count, points.length);
  const step = (last - first) / (slots - 1);
  return Array.from({ length: slots }, (_, index) => Math.round(first + step * index));
}

export function TrackerIntradayChart({ data, positive, negative }: TrackerIntradayChartProps) {
  const chartData = useMemo<ChartPoint[]>(
    () =>
      data
        .map((point) => ({
          at: point.at ?? (point as IntradayPoint & { time?: string }).time ?? '',
          price: point.price,
          ts: parsePointMs(point),
        }))
        .filter((point) => point.ts > 0),
    [data],
  );

  const xTicks = useMemo(() => buildTicks(chartData), [chartData]);

  if (!chartData.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-md bg-capy-bg/60 text-xs text-capy-muted">
        No intraday data
      </div>
    );
  }

  const stroke = positive ? '#5c7a4a' : negative ? '#dc2626' : '#6b6560';

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 16 }}
        >
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={formatAxisTime}
            tick={{ fontSize: 11, fill: '#6b6560' }}
            stroke="#6b6560"
            tickMargin={8}
            axisLine={{ stroke: '#6b6560' }}
            tickLine={{ stroke: '#6b6560' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: '#6b6560' }}
            stroke="#6b6560"
            width={48}
            tickMargin={4}
            axisLine={{ stroke: '#6b6560' }}
            tickLine={{ stroke: '#6b6560' }}
            tickFormatter={(value: number) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            formatter={(value: number) => [formatMoney(value), 'Price']}
            labelFormatter={(_, payload) => {
              const ts = payload?.[0]?.payload?.ts as number | undefined;
              return ts ? formatTooltipTime(ts) : '';
            }}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
