# Capybara Portfolio

Plaid-first daily net worth tracker with credit card spending insights.

## Goals

| Priority | Feature |
|----------|---------|
| **P1** | Net worth by bucket: checking, savings, HYSA, brokerage, 401k, Roth IRA |
| **P2** | Credit card spending analytics and budgets |

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Flask 3, SQLite, plaid-python, Flask-JWT-Extended, Bcrypt, Fernet encryption |
| Frontend | Vite, React 19, TypeScript, Tailwind, shadcn/ui, Recharts, react-plaid-link |
| Data | Raw SQL, `refresh_data.py` cron — no ORM, no webhooks, no Postgres |

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for details.

## Quick start

### Backend

```bash
cd backend
uv venv
uv pip install -r requirements.txt
cp .env.example .env   # fill in SECRET_KEY, INVITE_CODE, PLAID_*, DEV_API_URL
uv run python init_db.py
uv run flask run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173 (Vite) and proxies API calls to Flask on :5000.

## Plaid Sandbox

1. Log in at [dashboard.plaid.com](https://dashboard.plaid.com).
2. Use **Sandbox** credentials in `.env`.
3. In the app: **Accounts → Connect institution** and pick a test bank/brokerage.
4. Sandbox login: `user_good` / `pass_good`; phone OTP `415-555-0010` / `123456`.

## Scheduled sync (cron)

Sync all linked Plaid items and record net worth snapshots:

```bash
cd backend
uv run python refresh_data.py
```

**Cron example** (daily at 6:00 AM):

```cron
0 6 * * * cd /path/to/capybaraPortfolio/backend && uv run python refresh_data.py >> /tmp/capy-refresh.log 2>&1
```

Without scheduled sync, net worth history and spending charts only update when you click **Sync** on the Accounts page.

## tmux example

```bash
tmux new-session -d -s capybara
tmux send-keys -t capybara 'cd backend && uv run flask run' C-m
tmux split-window -h -t capybara
tmux send-keys -t capybara 'cd frontend && npm run dev' C-m
tmux attach -t capybara
```
