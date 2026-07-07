/** Shared chart styling tokens for Recharts components */

export const CHART_COLORS = {
  axis: 'hsl(240 4% 46%)',
  grid: 'hsl(240 6% 90%)',
  line: 'hsl(240 6% 10%)',
  positive: 'hsl(142 71% 35%)',
  negative: 'hsl(0 72% 51%)',
  neutral: 'hsl(240 4% 46%)',
} as const;

export const CATEGORY_COLORS = [
  'hsl(240 6% 10%)',
  'hsl(240 4% 46%)',
  'hsl(240 5% 65%)',
  'hsl(142 71% 35%)',
  'hsl(0 72% 51%)',
  'hsl(240 5% 84%)',
  'hsl(240 6% 25%)',
  'hsl(240 4% 55%)',
  'hsl(142 40% 45%)',
  'hsl(0 50% 55%)',
  'hsl(240 5% 72%)',
  'hsl(240 6% 18%)',
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export const axisTickStyle = { fontSize: 12, fill: CHART_COLORS.axis };
export const axisStroke = CHART_COLORS.axis;

export const tooltipContentStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: 'none',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  background: 'hsl(0 0% 100%)',
  padding: '8px 12px',
};

export const tooltipLabelStyle = {
  color: CHART_COLORS.axis,
  marginBottom: 4,
};

export const tooltipItemStyle = {
  color: 'hsl(240 6% 10%)',
  fontWeight: 500,
};
