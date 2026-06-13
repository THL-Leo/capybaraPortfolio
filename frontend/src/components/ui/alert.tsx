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
        'relative w-full rounded-lg border p-4 text-sm',
        variant === 'destructive' && 'border-destructive/50 text-destructive bg-destructive/10',
        variant === 'success' && 'border-capy-primary/30 text-capy-primary bg-capy-primary/10',
        variant === 'default' && 'bg-background',
        className,
      )}
      {...props}
    />
  );
}
