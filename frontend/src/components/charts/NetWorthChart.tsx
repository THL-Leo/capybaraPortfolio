import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/utils';

interface Point {
  date: string;
  value: number;
}

export function NetWorthChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-capy-muted">No history yet</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b6560" />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#6b6560"
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip formatter={(v: number) => formatMoney(v)} labelFormatter={(l) => l} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#5c7a4a"
          strokeWidth={2}
          dot={{ r: 3, fill: '#5c7a4a' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
