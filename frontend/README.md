# Capybara Portfolio — Frontend

Vite + React 19 + TypeScript dashboard for net worth and spending.

## Stack

- **Vite** — dev server and build
- **React 19** + **TypeScript**
- **Tailwind CSS** — styling
- **shadcn/ui** — UI components
- **Recharts** — net worth and spending charts
- **react-plaid-link** — Plaid Link integration
- **react-router-dom** — client routing

## Pages

| Route | Page | API calls |
|-------|------|-----------|
| `/` | Overview | `GET /home`, `/net-worth`, `/net-worth-over-time` |
| `/accounts` | Accounts | `GET /accounts`, `/portfolio/holdings-analytics`, `/portfolio/allocation`; Plaid link/sync/delete |
| `/spending` | Spending | `GET /spending/analytics`; budgets CRUD |
| `/accounts/:id` | Account detail | `GET /accounts/:id`, `/accounts/:id/spending`, `/accounts/:id/transactions` |
| `/login` | Login | `POST /login` |
| `/register` | Register | `POST /register` |

## Auth

JWT stored in httpOnly cookie (`access_token_cookie`). CSRF token read from `csrf_access_token` cookie and sent as `X-CSRF-TOKEN` header on all authenticated requests. See `src/context/AuthContext.tsx` and `src/api/client.ts`.

## Folder structure

```
src/
├── api/client.ts, types.ts
├── context/AuthContext.tsx
├── hooks/useNetWorth.ts, useAccounts.ts, useSpending.ts
├── components/layout/     AppShell, Nav, ProtectedRoute
├── components/charts/     NetWorthChart, CategoryChart
├── components/ui/         shadcn components
├── pages/                 Overview, Accounts, Spending, AccountDetail, Login, Register
├── lib/utils.ts           formatMoney, formatCategory
└── App.tsx
```

## Theme tokens

Capybara palette (from legacy dashboard):

| Token | Value |
|-------|-------|
| Background | `#f7f4ef` |
| Primary | `#5c7a4a` |
| Text | `#2d2a26` |

Configured in `tailwind.config.js` as `capy-*` colors.

## Dev proxy

Vite proxies `/api` requests to Flask at `http://127.0.0.1:5000`. Set `VITE_API_URL` for production builds.

```bash
npm run dev    # http://localhost:5173
npm run build  # production bundle
```

## What was removed

- Create React App (CRA) and `react-scripts`
- Bootstrap CSS
- Visx charts
- CSV upload page and `/upload` route
- TanStack Query, Redux
- Monolithic `Accounts.js` tab layout (split into Overview / Accounts / Spending pages)
