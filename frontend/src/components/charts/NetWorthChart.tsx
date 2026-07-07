import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  axisStroke,
  axisTickStyle,
  CHART_COLORS,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '@/lib/chartTheme';
import { formatMoney } from '@/lib/utils';

interface Point {
  date: string;
  value: number;
}

export function NetWorthChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No history yet</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTickStyle}
          stroke={axisStroke}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={axisTickStyle}
          stroke={axisStroke}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v: number) => [formatMoney(v), 'Net worth']}
          labelFormatter={(l) => l}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS.line}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.line }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
