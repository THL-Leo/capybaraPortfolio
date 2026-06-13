import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared CSS grid column templates for consistent table alignment */
export const GRID_TEMPLATES = {
  accounts:
    'grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(6.5rem,auto)_minmax(7.5rem,auto)]',
  holdings:
    'grid-cols-[minmax(0,2fr)_minmax(5rem,auto)_minmax(7.5rem,auto)_minmax(7.5rem,auto)]',
  transactions:
    'grid-cols-[minmax(6.5rem,auto)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(7rem,auto)]',
  category:
    'grid-cols-[minmax(0,2fr)_minmax(7.5rem,auto)_minmax(5.5rem,auto)]',
  twoCol: 'grid-cols-[minmax(0,1fr)_minmax(7.5rem,auto)]',
} as const;

export type GridTemplate = keyof typeof GRID_TEMPLATES;

export function gridCols(template: GridTemplate): string {
  return cn('grid', GRID_TEMPLATES[template]);
}

const HEADER_ROW =
  'border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-capy-muted';
const BODY_ROW =
  'grid items-center border-t border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30';

export interface DataGridColumn<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface DataGridProps<T> {
  template: GridTemplate;
  columns: DataGridColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  emptyMessage?: string;
}

export function DataGrid<T>({
  template,
  columns,
  rows,
  getRowKey,
  onRowClick,
  getRowClassName,
  emptyMessage,
}: DataGridProps<T>) {
  if (!rows.length && emptyMessage) {
    return <p className="px-4 py-8 text-center text-sm text-capy-muted">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className={cn(gridCols(template), HEADER_ROW)}>
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(col.align === 'right' && 'text-right', col.headerClassName)}
          >
            {col.header}
          </div>
        ))}
      </div>
      {rows.map((row, index) => (
        <div
          key={getRowKey(row)}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={
            onRowClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }
              : undefined
          }
          className={cn(
            gridCols(template),
            BODY_ROW,
            onRowClick && 'cursor-pointer',
            getRowClassName?.(row),
          )}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                'min-w-0',
                col.align === 'right' && 'text-right tabular-nums',
                col.className,
              )}
            >
              {col.render(row, index)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Section divider row (e.g. Cash / Investments headers) */
export function DataGridSectionRow({
  template,
  label,
  value,
  valueClassName,
}: {
  template: GridTemplate;
  label: ReactNode;
  value?: ReactNode;
  valueClassName?: string;
}) {
  const labelSpan = value !== undefined ? 'col-span-3' : 'col-span-full';

  return (
    <div
      className={cn(
        gridCols(template),
        'items-center border-b border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold',
      )}
    >
      <div className={labelSpan}>{label}</div>
      {value !== undefined && (
        <div className={cn('text-right tabular-nums', valueClassName)}>{value}</div>
      )}
    </div>
  );
}
