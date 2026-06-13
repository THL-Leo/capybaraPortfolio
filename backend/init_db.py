"""Initialize SQLite schema. Run: python init_db.py"""

from db import get_connection

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plaid_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT,
    status TEXT DEFAULT 'active',
    error_message TEXT,
    last_sync_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plaid_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    account_id TEXT UNIQUE NOT NULL,
    name TEXT,
    official_name TEXT,
    type TEXT,
    subtype TEXT,
    mask TEXT,
    current_balance REAL,
    available_balance REAL,
    currency TEXT DEFAULT 'USD',
    last_synced_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plaid_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id TEXT NOT NULL,
    security_id TEXT,
    ticker_symbol TEXT,
    security_name TEXT,
    quantity REAL,
    cost_basis REAL,
    institution_value REAL,
    institution_price REAL,
    as_of_date TEXT,
    last_synced_at TEXT,
    UNIQUE(user_id, account_id, security_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    total REAL NOT NULL,
    cash_total REAL NOT NULL,
    investments_total REAL NOT NULL,
    source TEXT DEFAULT 'plaid',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_holdings_user ON plaid_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_user_date ON net_worth_snapshots(user_id, recorded_at);

CREATE TABLE IF NOT EXISTS plaid_card_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id TEXT NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    transaction_date TEXT NOT NULL,
    name TEXT,
    merchant_name TEXT,
    amount REAL NOT NULL,
    iso_currency_code TEXT DEFAULT 'USD',
    pending INTEGER DEFAULT 0,
    category_primary TEXT,
    last_synced_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_card_tx_user_date ON plaid_card_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_plaid_card_tx_account ON plaid_card_transactions(account_id);

CREATE TABLE IF NOT EXISTS spending_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    month TEXT NOT NULL,
    limit_amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category, month),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_spending_budgets_user_month ON spending_budgets(user_id, month);
"""


def run_migrations(conn):
    cols = {r[1] for r in conn.execute('PRAGMA table_info(plaid_items)').fetchall()}
    if 'transactions_cursor' not in cols:
        conn.execute('ALTER TABLE plaid_items ADD COLUMN transactions_cursor TEXT')

    tx_cols = {r[1] for r in conn.execute('PRAGMA table_info(plaid_card_transactions)').fetchall()}
    if 'account_type' not in tx_cols:
        conn.execute(
            "ALTER TABLE plaid_card_transactions ADD COLUMN account_type TEXT DEFAULT 'credit'"
        )

    nw_cols = {r[1] for r in conn.execute('PRAGMA table_info(net_worth_snapshots)').fetchall()}
    if 'breakdown' not in nw_cols:
        conn.execute('ALTER TABLE net_worth_snapshots ADD COLUMN breakdown TEXT')
    if 'assets_total' not in nw_cols:
        conn.execute('ALTER TABLE net_worth_snapshots ADD COLUMN assets_total REAL')
    if 'liabilities_total' not in nw_cols:
        conn.execute('ALTER TABLE net_worth_snapshots ADD COLUMN liabilities_total REAL')


def init_db(verbose=False):
    conn = get_connection()
    conn.executescript(SCHEMA)
    run_migrations(conn)
    conn.commit()
    conn.close()
    if verbose:
        print('Database initialized at', __import__('db').DATABASE)


if __name__ == '__main__':
    init_db(verbose=True)
