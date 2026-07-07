import { cn } from '@/lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' | 'success' }) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg p-4 text-sm ring-1 ring-inset',
        variant === 'destructive' &&
          'bg-destructive/5 text-destructive ring-destructive/20',
        variant === 'success' && 'bg-positive/5 text-positive ring-positive/20',
        variant === 'default' && 'bg-muted/50 text-foreground ring-black/5',
        className,
      )}
      {...props}
    />
  );
}
