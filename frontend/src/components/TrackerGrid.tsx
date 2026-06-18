import type { TrackedStock } from '@/api/types';
import { TrackerStockCard } from '@/components/TrackerStockCard';
import { cn } from '@/lib/utils';

interface TrackerGridProps {
  stocks: TrackedStock[];
  onRemove: (ticker: string) => void;
  emptyMessage?: string;
}

const CARD_HEIGHT = 232;
const GRID_GAP = 16;
const SCROLLABLE_ROWS = 3;

export function TrackerGrid({
  stocks,
  onRemove,
  emptyMessage = 'Search for a stock to start tracking',
}: TrackerGridProps) {
  if (stocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center text-sm text-capy-muted">
        {emptyMessage}
      </div>
    );
  }

  const scrollable = stocks.length >= 9;
  const maxHeight = scrollable
    ? SCROLLABLE_ROWS * CARD_HEIGHT + (SCROLLABLE_ROWS - 1) * GRID_GAP
    : undefined;

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-4',
        scrollable && 'overflow-y-auto pr-1',
      )}
      style={scrollable ? { maxHeight } : undefined}
    >
      {stocks.map((stock) => (
        <TrackerStockCard key={stock.ticker} stock={stock} onRemove={onRemove} />
      ))}
    </div>
  );
}
