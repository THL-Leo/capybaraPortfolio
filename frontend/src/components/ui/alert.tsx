import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg p-4 text-sm ring-1 ring-inset', {
  variants: {
    variant: {
      default: 'bg-muted/50 text-foreground ring-black/5',
      destructive: 'bg-destructive/5 text-destructive ring-destructive/20',
      success: 'bg-positive/5 text-positive ring-positive/20',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
