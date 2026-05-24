"""Refresh Plaid data and optional yfinance price cache. Run via cron or tmux."""

import os

from dotenv import load_dotenv

load_dotenv()

from init_db import init_db
from plaid_sync import sync_all_users
from portfolio import record_net_worth_snapshot
from db import get_connection


def refresh_prices():
    """Update price_cache for symbols in plaid_holdings (optional enhancement)."""
    try:
        import yfinance as yf
    except ImportError:
        return

    from db import get_connection

    conn = get_connection()
    rows = conn.execute(
        '''
        SELECT DISTINCT ticker_symbol FROM plaid_holdings
        WHERE ticker_symbol IS NOT NULL AND ticker_symbol != ''
        '''
    ).fetchall()
    symbols = [r[0] for r in rows]
    if not symbols:
        conn.close()
        return

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = info.get('regularMarketPrice')
            if not price:
                hist = ticker.history(period='1d')
                if not hist.empty:
                    price = float(hist['Close'].iloc[-1])
            if price:
                conn.execute(
                    '''
                    INSERT INTO price_cache (symbol, price, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(symbol) DO UPDATE SET
                        price = excluded.price, updated_at = excluded.updated_at
                    ''',
                    (symbol, price, now),
                )
        except Exception as e:
            print(f'Price fetch failed for {symbol}: {e}')
    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
    print('Syncing all Plaid items...')
    sync_all_users()
    print('Recording net worth snapshots...')
    conn = get_connection()
    user_ids = [r[0] for r in conn.execute('SELECT DISTINCT user_id FROM plaid_items').fetchall()]
    conn.close()
    for uid in user_ids:
        conn = get_connection()
        record_net_worth_snapshot(conn, uid)
        conn.close()
    print('Refreshing prices...')
    refresh_prices()
    print('Done.')
