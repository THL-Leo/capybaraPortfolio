import type { Holding } from '@/api/types';
import { DataGrid } from '@/components/data-grid/data-grid';
import { formatMoney } from '@/lib/utils';

interface HoldingsGridProps {
  holdings: Holding[];
  emptyMessage?: string;
}

export function HoldingsGrid({
  holdings,
  emptyMessage = 'No holdings linked yet',
}: HoldingsGridProps) {
  return (
    <DataGrid
      template="holdings"
      rows={holdings}
      getRowKey={(h) => `${h.account_id}-${h.security_id}`}
      emptyMessage={holdings.length === 0 ? emptyMessage : undefined}
      columns={[
        {
          key: 'symbol',
          header: 'Symbol',
          render: (h) => h.ticker_symbol || h.security_name || '—',
        },
        {
          key: 'qty',
          header: 'Qty',
          align: 'right',
          render: (h) => (h.quantity != null ? Number(h.quantity).toFixed(2) : '—'),
        },
        {
          key: 'value',
          header: 'Value',
          align: 'right',
          render: (h) => formatMoney(h.market_value),
        },
        {
          key: 'gain',
          header: 'Gain',
          align: 'right',
          render: (h) =>
            h.unrealized_gain != null ? (
              <span
                className={h.unrealized_gain >= 0 ? 'text-positive' : 'text-destructive'}
              >
                {formatMoney(h.unrealized_gain)}
              </span>
            ) : (
              '—'
            ),
        },
      ]}
    />
  );
}
