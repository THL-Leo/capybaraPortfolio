import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { formatCategory, formatMoney } from '@/lib/utils';

interface CategoryPoint {
  category: string;
  amount: number;
}

/** Capybara-themed palette for spending categories */
export const CATEGORY_COLORS = [
  '#5c7a4a',
  '#3b6978',
  '#8b6914',
  '#b45309',
  '#7c6b9d',
  '#c45c5c',
  '#4a8f6e',
  '#6b8cae',
  '#a67c52',
  '#9b59b6',
  '#e07b39',
  '#2d6a6a',
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: { percent: number };
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.name}</p>
      <p className="text-capy-muted">
        {formatMoney(item.value)} ({item.payload.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-capy-muted">No spending data</p>;
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const chartData = data.map((d) => ({
    ...d,
    label: formatCategory(d.category),
    percent: total > 0 ? (d.amount / total) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="amount"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={getCategoryColor(i)} />
          ))}
        </Pie>
        <Tooltip content={<CategoryTooltip />} />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
