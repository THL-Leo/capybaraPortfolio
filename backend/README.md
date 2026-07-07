# Capybara Portfolio — Backend

Flask API for Plaid-linked net worth tracking and credit card spending.

## Stack

- **Flask 3** — HTTP API
- **SQLite** — local database (`portfolio.db`)
- **plaid-python** — institution linking and sync
- **Fernet** (`crypto_util.py`) — encrypted Plaid access tokens
- **Flask-JWT-Extended** — JWT in httpOnly cookies with CSRF

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Username + bcrypt password hash |
| `plaid_items` | Linked institutions (encrypted access token) |
| `plaid_accounts` | Account balances and metadata |
| `plaid_holdings` | Investment positions |
| `plaid_card_transactions` | Credit/checking transactions |
| `net_worth_snapshots` | Daily net worth history with bucket breakdown |

Legacy tables (`transactions`, `price_cache`) are no longer created for new databases. Existing databases keep them but they are unused.

## Account classification

`classify_account(acc)` maps Plaid accounts to net worth buckets:

| Condition | Bucket |
|-----------|--------|
| `depository` + `checking` | `checking` |
| `depository` + `savings` + "HYSA" or "High Yield" in name | `hysa` |
| `depository` + `savings` | `savings` |
| `investment` + 401k/401a in subtype/name | `retirement_401k` |
| `investment` + roth/ira in subtype/name | `retirement_roth` |
| `investment` (else) | `brokerage` |
| `credit` | `liability` |

For investment accounts, use the sum of holdings when positions are synced; otherwise use the account balance. Depository accounts use balance only. Holdings are never added on top of an investment account balance (avoids double-counting).

## Net worth formula

```
assets_total   = checking + savings + hysa + brokerage + retirement_401k + retirement_roth
liabilities_total = sum of credit card balances
net_worth      = assets_total - liabilities_total
```

Snapshots store a JSON `breakdown` column with per-bucket values.

## API endpoints

### Auth

| Method | Path | Response |
|--------|------|----------|
| POST | `/register` | `{ message }` |
| POST | `/login` | `{ message, user }` + JWT cookie |
| POST | `/logout` | `{ message }` |
| GET | `/home` | `{ user, stats, plaid: { net_worth, breakdown, assets_total, liabilities_total, ... } }` |

### Plaid

| Method | Path | Response |
|--------|------|----------|
| POST | `/plaid/link-token` | `{ link_token, update_mode }` |
| POST | `/plaid/exchange-token` | `{ message, item_id, sync }` |
| POST | `/plaid/sync` | `{ results }` |
| GET | `/plaid/items` | `{ items }` |
| DELETE | `/plaid/items/:id` | `{ message }` |

### Portfolio

| Method | Path | Response |
|--------|------|----------|
| GET | `/net-worth` | `{ breakdown, assets_total, liabilities_total, total, ... }` |
| GET | `/net-worth-over-time` | `{ snapshots: [{ date, total, breakdown, ... }] }` |
| GET | `/accounts` | `{ accounts[] with bucket + institution_name, holdings, allocation, ... }` |
| GET | `/accounts/:id` | `{ account }` — includes `bucket` |
| GET | `/portfolio/holdings-analytics` | `{ holdings }` |
| GET | `/portfolio/allocation` | `{ total, slices }` |

### Spending

| Method | Path | Response |
|--------|------|----------|
| GET | `/spending/analytics` | `{ spending_summary, by_category, by_week }` — `?month=YYYY-MM` |
| GET | `/spending/monthly-totals` | `{ months: [{ month, month_label, total }] }` — `?months=12` |
| GET | `/accounts/:id/spending` | `{ summary, by_category, by_week }` |
| GET | `/accounts/:id/transactions` | `{ transactions }` |

## Sync pipeline

1. `refresh_data.py` (cron) or `POST /plaid/sync` (manual)
2. `plaid_sync.py` fetches accounts, holdings, transactions per item
3. `record_net_worth_snapshot()` upserts today's snapshot with bucket breakdown

## Environment variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing + Fernet key derivation |
| `INVITE_CODE` | Registration gate |
| `DEV_API_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `PLAID_CLIENT_ID` | Plaid Dashboard |
| `PLAID_SECRET` | Sandbox or production secret |
| `PLAID_ENV` | `sandbox` or `production` |
| `PLAID_REDIRECT_URI` | OAuth redirect (production) |
| `ENCRYPTION_KEY` | Optional Fernet key |

## SQLite → Postgres (future)

Schema uses simple INTEGER PRIMARY KEY and TEXT dates. Migration to Postgres would require:
- `SERIAL`/`BIGSERIAL` for IDs
- `TIMESTAMPTZ` for dates
- `JSONB` for `breakdown` column
- Connection pooling (e.g. psycopg2 or asyncpg)

No ORM is used, so SQL queries port directly.
