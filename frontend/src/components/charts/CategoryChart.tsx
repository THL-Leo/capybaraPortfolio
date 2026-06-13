import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCategory, formatMoney } from '@/lib/utils';

interface CategoryPoint {
  category: string;
  amount: number;
}

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-capy-muted">No spending data</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatCategory(d.category),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          stroke="#6b6560"
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#6b6560"
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip formatter={(v: number) => formatMoney(v)} />
        <Bar dataKey="amount" fill="#5c7a4a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
