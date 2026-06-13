"""Refresh Plaid data and net worth snapshots. Run via cron or tmux."""

from dotenv import load_dotenv

load_dotenv()

from db import get_connection
from init_db import init_db
from plaid_sync import sync_all_users
from portfolio import record_net_worth_snapshot


if __name__ == '__main__':
    init_db()
    print('Syncing all Plaid items...')
    sync_all_users()
    print('Recording net worth snapshots...')
    conn = get_connection()
    user_ids = [
        r[0] for r in conn.execute('SELECT DISTINCT user_id FROM plaid_items').fetchall()
    ]
    conn.close()
    for uid in user_ids:
        conn = get_connection()
        record_net_worth_snapshot(conn, uid)
        conn.close()
    print('Done.')
