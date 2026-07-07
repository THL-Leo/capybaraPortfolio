import type { TrackedStock } from '@/api/types';
import { TrackerIntradayChart } from '@/components/charts/TrackerIntradayChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatMoney } from '@/lib/utils';

interface TrackerStockCardProps {
  stock: TrackedStock;
  onRemove: (ticker: string) => void;
}

function formatChangePct(changePct: number): string {
  const normalized = Math.abs(changePct) <= 1 ? changePct * 100 : changePct;
  const sign = normalized >= 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}%`;
}

export function TrackerStockCard({ stock, onRemove }: TrackerStockCardProps) {
  const positive = stock.change != null && stock.change >= 0;
  const negative = stock.change != null && stock.change < 0;
  const changeColor = positive
    ? 'text-positive'
    : negative
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <Card className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 z-10 h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(stock.ticker)}
        aria-label={`Remove ${stock.ticker}`}
      >
        ×
      </Button>
      <CardContent className="flex flex-col gap-2 p-4 pb-4 pt-7">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 pr-6">
          <p className="truncate text-base font-semibold leading-tight tracking-tight">
            {stock.ticker}
          </p>
          <p className="text-right text-base font-semibold tabular-nums leading-tight">
            {stock.price != null ? formatMoney(stock.price) : '—'}
          </p>
          <p className="truncate text-sm text-muted-foreground">{stock.name}</p>
          <p className={cn('text-right text-sm font-medium tabular-nums', changeColor)}>
            {stock.change != null ? (
              <>
                {stock.change >= 0 ? '+' : ''}
                {formatMoney(stock.change)}
              </>
            ) : (
              '—'
            )}
            {stock.change_pct != null && (
              <span className="ml-1">({formatChangePct(stock.change_pct)})</span>
            )}
          </p>
        </div>
        <TrackerIntradayChart
          data={stock.intraday ?? []}
          positive={positive}
          negative={negative}
        />
      </CardContent>
    </Card>
  );
}
