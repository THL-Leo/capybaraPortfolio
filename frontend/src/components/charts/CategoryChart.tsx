import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getCategoryColor } from '@/lib/chartTheme';
import { formatCategory, formatMoney } from '@/lib/utils';

interface CategoryPoint {
  category: string;
  amount: number;
}

export { getCategoryColor };

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
    <div className="rounded-lg bg-card px-3 py-2 text-sm shadow-md ring-1 ring-black/5">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="tabular-nums text-muted-foreground">
        {formatMoney(item.value)} ({item.payload.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No spending data</p>
    );
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
          innerRadius={60}
          outerRadius={95}
          paddingAngle={1}
          stroke="hsl(0 0% 100%)"
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
          wrapperStyle={{ fontSize: 12, paddingTop: 16, color: 'hsl(240 4% 46%)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
