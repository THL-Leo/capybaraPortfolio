import { CategoryChart, getCategoryColor } from '@/components/charts/CategoryChart';
import { DataGrid } from '@/components/data-grid/data-grid';
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
      <p className="py-10 text-center text-sm text-muted-foreground">
        {month
          ? `No spending in ${formatMonthLabel(month)}. Try a previous month.`
          : 'No spending data for this period.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <CategoryChart data={data} />
      <DataGrid
        template="category"
        rows={data}
        getRowKey={(row) => row.category}
        columns={[
          {
            key: 'category',
            header: 'Category',
            render: (row, i) => (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: getCategoryColor(i) }}
                />
                {formatCategory(row.category)}
              </span>
            ),
          },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (row) => formatMoney(row.amount),
          },
          {
            key: 'percent',
            header: '% of month',
            align: 'right',
            className: 'text-muted-foreground',
            render: (row) =>
              total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '—',
          },
        ]}
      />
    </div>
  );
}
