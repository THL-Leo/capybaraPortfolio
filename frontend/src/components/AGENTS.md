# Components — Agent Guide

Shared React components live here. This folder is split by responsibility:

| Folder / file | Purpose |
|---------------|---------|
| `ui/` | Dumb primitives — **read `ui/AGENTS.md` before editing** |
| `layout/` | App shell, page header, route wrappers |
| `charts/` | Recharts wrappers; colors from `src/lib/chartTheme.ts` |
| `data-grid/` | CSS-grid table used across accounts, spending, holdings |
| `*.tsx` (root) | Feature composites: `AccountsGroupedTable`, `TrackerGrid`, etc. |

## Feature component rules

- **Compose primitives** from `ui/` — don't reimplement button/card styles inline
- **Props interfaces** at top of file; export only when reused elsewhere
- **No inline fetch** in presentational components — data comes from pages/hooks via props
- Use `cn()` for conditional classes
- Empty states: centered `text-sm text-muted-foreground`, no dashed borders
- Money: `formatMoney()` from `@/lib/utils`; align right with `tabular-nums`

## Layout components

- `AppShell` — sticky nav + `<Outlet />`; don't duplicate nav in pages
- `PageHeader` — page title, description, optional action slot

## Data display

- Tabular data → `DataGrid` from `@/components/data-grid/data-grid`
- Section headers in grouped tables → `DataGridSectionRow`
- Charts → dedicated component in `charts/`; share theme from `chartTheme.ts`

## Naming

- PascalCase files for components: `TrackerStockCard.tsx`
- One main export per file matching the filename
- Hooks used by pages stay in `src/hooks/`, not here
