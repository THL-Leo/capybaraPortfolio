# UI Primitives — Agent Guide

Files in `src/components/ui/` are **dumb, reusable primitives** — no app logic, no API calls, no domain types.

For feature-level components (grids, charts wrappers, layout), see `../AGENTS.md` in the parent `components/` folder.

## Required structure

Every primitive must follow this pattern:

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority'; // when variants exist
import { cn } from '@/lib/utils';

export interface FooProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fooVariants> {} // omit if no variants

const Foo = React.forwardRef<HTMLDivElement, FooProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(fooVariants({ variant }), className)} {...props} />
  ),
);
Foo.displayName = 'Foo';

export { Foo, fooVariants }; // export variants only when using CVA
```

## Rules

| Rule | Detail |
|------|--------|
| `forwardRef` | Always — enables composition and form libraries |
| `displayName` | Always — matches export name (`Button`, `Card`, …) |
| `FooProps` interface | Always — extend the correct `React.*HTMLAttributes` |
| `import * as React` | Use namespace import, not default |
| `cn()` | Merge `className`; never string-concatenate classes |
| CVA | Use for `variant` / `size` props (`Button`, `Alert`); skip for single-style components |
| Semantic HTML | `Badge` → `<span>`, buttons → `<button>`, headings in `CardTitle` → `<h3>` |
| Tokens | `bg-background`, `text-muted-foreground`, `ring-black/5` — no raw hex |
| No domain logic | No imports from `api/`, `hooks/`, or `pages/` |

## File naming

- kebab-case file: `button.tsx`, `progress.tsx`
- PascalCase exports: `Button`, `Progress`
- One primary component per file; compound components (e.g. `Card` + `CardHeader`) stay together

## Variants (CVA example)

```tsx
const buttonVariants = cva('base-classes…', {
  variants: {
    variant: { default: '…', outline: '…' },
    size: { default: '…', sm: '…', icon: '…' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
```

## What does NOT belong here

- `DataGrid` → `src/components/data-grid/` (domain table layout)
- Chart wrappers → `src/components/charts/`
- `PageHeader`, `AppShell` → `src/components/layout/`

## Adding a new primitive

1. Copy an existing file (`skeleton.tsx` for simple, `button.tsx` for variants) as a template
2. Match tokens to `src/index.css` `:root` variables
3. Export props interface + component (+ variants if CVA)
4. Import from `@/components/ui/<name>` in consumers

## Current primitives

`alert`, `badge`, `button`, `card`, `input`, `label`, `progress`, `skeleton`, `table`
