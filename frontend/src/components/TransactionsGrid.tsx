import type { Transaction } from '@/api/types';
import { DataGrid } from '@/components/ui/data-grid';
import { formatCategory, formatMoney } from '@/lib/utils';

interface TransactionsGridProps {
  transactions: Transaction[];
  emptyMessage?: string;
}

export function TransactionsGrid({ transactions, emptyMessage }: TransactionsGridProps) {
  return (
    <DataGrid
      template="transactions"
      rows={transactions}
      getRowKey={(tx) => tx.transaction_id}
      emptyMessage={transactions.length === 0 ? emptyMessage : undefined}
      columns={[
        {
          key: 'date',
          header: 'Date',
          render: (tx) => tx.transaction_date,
        },
        {
          key: 'description',
          header: 'Description',
          className: 'truncate',
          render: (tx) => tx.merchant_name || tx.name || '—',
        },
        {
          key: 'category',
          header: 'Category',
          className: 'truncate text-capy-muted',
          render: (tx) =>
            tx.category_primary ? formatCategory(tx.category_primary) : '—',
        },
        {
          key: 'amount',
          header: 'Amount',
          align: 'right',
          render: (tx) => formatMoney(tx.amount),
        },
      ]}
    />
  );
}
