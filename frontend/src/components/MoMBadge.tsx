import { formatMoney } from '@/lib/utils';

interface MoMBadgeProps {
  current: number;
  previous: number;
  previousLabel: string;
}

export function MoMBadge({ current, previous, previousLabel }: MoMBadgeProps) {
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(0) : null;
  const up = diff > 0;

  return (
    <p className="text-sm text-capy-muted">
      {diff === 0 ? (
        <>Same as {previousLabel}</>
      ) : (
        <>
          <span className={up ? 'text-destructive' : 'text-capy-primary'}>
            {up ? '↑' : '↓'} {formatMoney(Math.abs(diff))}
            {pct != null && ` (${Math.abs(Number(pct))}%)`}
          </span>
          {' vs '}
          {previousLabel}
        </>
      )}
    </p>
  );
}
