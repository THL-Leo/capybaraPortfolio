import type { ChartRange, TrackedStock } from '@/api/types';
import { TrackerPriceChart } from '@/components/charts/TrackerIntradayChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatMoney } from '@/lib/utils';

interface TrackerStockCardProps {
  stock: TrackedStock;
  chartRange?: ChartRange;
  readOnly?: boolean;
  onRemove?: (ticker: string) => void;
}

function formatChangePct(changePct: number): string {
  const normalized = Math.abs(changePct) <= 1 ? changePct * 100 : changePct;
  const sign = normalized >= 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}%`;
}

function formatShares(quantity: number): string {
  const rounded = Number(quantity.toFixed(4));
  return `${rounded} share${rounded === 1 ? '' : 's'}`;
}

export function TrackerStockCard({
  stock,
  chartRange = '1D',
  readOnly = false,
  onRemove,
}: TrackerStockCardProps) {
  const positive = stock.change != null && stock.change >= 0;
  const negative = stock.change != null && stock.change < 0;
  const changeColor = positive
    ? 'text-positive'
    : negative
      ? 'text-destructive'
      : 'text-muted-foreground';

  const chartData = stock.history ?? stock.intraday ?? [];
  const hasHoldingMeta = stock.quantity != null;

  return (
    <Card className="relative">
      {!readOnly && onRemove && (
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
      )}
      <CardContent className={cn('flex flex-col gap-2 p-4 pb-4', readOnly ? 'pt-4' : 'pt-7')}>
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
        {hasHoldingMeta && (
          <p className="text-xs text-muted-foreground">
            {formatShares(stock.quantity!)}
            {stock.unrealized_gain != null && (
              <>
                {' · '}
                <span
                  className={
                    stock.unrealized_gain >= 0 ? 'text-positive' : 'text-destructive'
                  }
                >
                  {stock.unrealized_gain >= 0 ? '+' : ''}
                  {formatMoney(stock.unrealized_gain)}
                </span>
                {stock.unrealized_gain_pct != null && (
                  <span>
                    {' '}
                    ({formatChangePct(stock.unrealized_gain_pct)})
                  </span>
                )}
              </>
            )}
          </p>
        )}
        <TrackerPriceChart
          data={chartData}
          range={chartRange}
          positive={positive}
          negative={negative}
        />
      </CardContent>
    </Card>
  );
}
