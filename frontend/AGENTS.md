# Frontend — Agent Guide

React + Vite + TypeScript app. Read this before editing anything under `frontend/`.

## Stack

- **React 19** with **React Router**
- **Tailwind CSS** for styling; tokens in `src/index.css` and `tailwind.config.js`
- **shadcn/ui pattern** — copy-paste primitives in `src/components/ui/` (not an npm UI kit)
- **class-variance-authority** for variant styles; **`cn()`** from `src/lib/utils.ts` for class merging
- **lucide-react** for icons; **Recharts** for charts

## Project layout

```
src/
  api/           API client and types
  components/    Shared UI — see components/AGENTS.md
  context/       React context providers
  hooks/         Data-fetching and state hooks
  lib/           Utilities (cn, formatters, chartTheme)
  pages/         Route-level page components
```

## Styling rules

- Use **semantic tokens**: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border` — not hardcoded hex or legacy `capy-*` classes in new code
- Money values: `tabular-nums` on numeric displays
- Page titles: `page-title` utility class or `PageHeader` component
- Hero metrics: `metric-value` utility class
- Cards/surfaces: `ring-1 ring-black/5`, avoid heavy borders and `shadow-sm` stacks
- Spacing rhythm on pages: `space-y-8`; main content already has `py-8` from `AppShell`

## Pages

- One default export per file in `src/pages/`
- Use `PageHeader` for title + description + optional actions
- Loading: `Skeleton` from `@/components/ui/skeleton`
- Errors: `Alert` from `@/components/ui/alert`
- Keep data fetching in hooks (`src/hooks/`), not inline in pages when reusable

## Imports

- Use `@/` path alias (maps to `src/`)
- UI primitives: `@/components/ui/<name>`
- Feature components: `@/components/<Name>`
- Data grid: `@/components/data-grid/data-grid` (not `ui/`)

## Adding new UI

1. Check if a primitive already exists in `src/components/ui/`
2. If adding a primitive, follow `src/components/ui/AGENTS.md` exactly
3. Prefer `npx shadcn@latest add <component>` for complex primitives (installs Radix deps), then adapt tokens to match our theme
4. Domain-specific composites (tables, grids, charts) belong in `src/components/`, not `ui/`

## Build

```bash
npm run dev      # local dev server
npm run build    # tsc + vite production build
```
