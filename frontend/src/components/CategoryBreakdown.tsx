import { CategoryChart, getCategoryColor } from '@/components/charts/CategoryChart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCategory, formatMoney, formatMonthLabel } from '@/lib/utils';

interface CategoryPoint {
  category: string;
  amount: number;
}

interface CategoryBreakdownProps {
  data: CategoryPoint[];
  month?: string;
}

export function CategoryBreakdown({ data, month }: CategoryBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-capy-muted">
        {month
          ? `No spending in ${formatMonthLabel(month)}. Try a previous month.`
          : 'No spending data for this period.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <CategoryChart data={data} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">% of month</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={row.category}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getCategoryColor(i) }}
                  />
                  {formatCategory(row.category)}
                </span>
              </TableCell>
              <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
              <TableCell className="text-right text-capy-muted">
                {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
