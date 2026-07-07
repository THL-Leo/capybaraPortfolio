import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true (default), shows an indeterminate sliding bar for loading states. */
  indeterminate?: boolean;
  value?: number;
}

export function Progress({
  className,
  indeterminate = true,
  value = 0,
  ...props
}: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn('relative h-0.5 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      {indeterminate ? (
        <div className="absolute h-full w-1/3 animate-progress rounded-full bg-foreground" />
      ) : (
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      )}
    </div>
  );
}
