# Capybara Portfolio

Local portfolio tracker: Flask + SQLite backend, React frontend, Plaid (Sandbox) for institutions.

## Prerequisites

- Python 3.11+ with [uv](https://github.com/astral-sh/uv)
- Node.js 18+

## Backend setup

```bash
cd backend
uv venv          # if you have not already
uv pip install -r requirements.txt
cp .env.example .env   # fill in SECRET_KEY, INVITE_CODE, PLAID_*, DEV_API_URL
uv run python init_db.py
uv run flask run
```

### `.env` keys

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing |
| `INVITE_CODE` | Registration gate |
| `DEV_API_URL` | `http://localhost:3000` (CORS) |
| `PLAID_CLIENT_ID` | From Plaid Dashboard |
| `PLAID_SECRET` | Sandbox secret while developing |
| `PLAID_ENV` | `sandbox` |
| `ENCRYPTION_KEY` | Optional Fernet key; if unset, derived from `SECRET_KEY` |

## Frontend setup

```bash
cd frontend
npm install
npm start
```

App runs at http://localhost:3000 and proxies API calls to Flask on :5000.

## Plaid Sandbox

1. Log in at [dashboard.plaid.com](https://dashboard.plaid.com).
2. Use **Sandbox** credentials in `.env`.
3. In the app: **Accounts → Connect institution** and pick a test bank/brokerage.
4. Production OAuth (real Schwab, etc.) can be configured later.

## Optional: refresh job (tmux pane or cron)

```bash
cd backend
uv run python refresh_data.py
```

Syncs all linked Plaid items and updates yfinance price cache.

## tmux example

```bash
tmux new-session -d -s capybara
tmux send-keys -t capybara 'cd backend && uv run flask run' C-m
tmux split-window -h -t capybara
tmux send-keys -t capybara 'cd frontend && npm start' C-m
tmux attach -t capybara
```

## CSV fallback

Schwab CSV import remains at `/upload` for institutions that are not linked or not ready on Plaid yet.
