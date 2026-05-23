from datetime import datetime, timezone

from plaid.exceptions import ApiException

from crypto_util import decrypt_token
from db import get_db, get_connection
from plaid_client import get_balances, get_holdings, get_item


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _security_map(securities):
    by_id = {}
    for sec in securities or []:
        sid = sec.get('security_id') or sec.get('securityId')
        if sid:
            by_id[sid] = sec
    return by_id


def sync_item_for_user(db, user_id: int, item_row) -> dict:
    """Sync accounts, balances, and investment holdings for one plaid_items row."""
    item_id = item_row['item_id']
    access_token = decrypt_token(item_row['access_token_encrypted'])
    synced_at = _now_iso()
    accounts_synced = 0
    holdings_synced = 0

    try:
        item_info = get_item(access_token)
        institution = item_info.get('item', {})
        institution_id = institution.get('institution_id')
        institution_name = institution.get('institution_name')
        cursor = db.cursor()
        cursor.execute(
            '''
            UPDATE plaid_items
            SET institution_id = ?, institution_name = ?, status = 'active',
                error_message = NULL, last_sync_at = ?
            WHERE item_id = ? AND user_id = ?
            ''',
            (institution_id, institution_name, synced_at, item_id, user_id),
        )
    except ApiException as e:
        _mark_item_error(db, item_id, user_id, str(e.body))
        return {'ok': False, 'error': str(e.body)}

    # Balances (all account types)
    try:
        balance_data = get_balances(access_token)
        for account in balance_data.get('accounts', []):
            balances = account.get('balances', {})
            cursor = db.cursor()
            cursor.execute(
                '''
                INSERT INTO plaid_accounts (
                    user_id, item_id, account_id, name, official_name,
                    type, subtype, mask, current_balance, available_balance,
                    currency, last_synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(account_id) DO UPDATE SET
                    name = excluded.name,
                    official_name = excluded.official_name,
                    type = excluded.type,
                    subtype = excluded.subtype,
                    mask = excluded.mask,
                    current_balance = excluded.current_balance,
                    available_balance = excluded.available_balance,
                    currency = excluded.currency,
                    last_synced_at = excluded.last_synced_at
                ''',
                (
                    user_id,
                    item_id,
                    account['account_id'],
                    account.get('name'),
                    account.get('official_name'),
                    account.get('type'),
                    account.get('subtype'),
                    account.get('mask'),
                    balances.get('current'),
                    balances.get('available'),
                    balances.get('iso_currency_code') or 'USD',
                    synced_at,
                ),
            )
            accounts_synced += 1
    except ApiException as e:
        body = e.body if hasattr(e, 'body') else str(e)
        if 'PRODUCT_NOT_READY' in str(body):
            _mark_item_pending(db, item_id, user_id, 'Balance data not ready yet')
        else:
            _mark_item_error(db, item_id, user_id, str(body))
            return {'ok': False, 'error': str(body)}

    # Investment holdings
    try:
        holdings_data = get_holdings(access_token)
        sec_by_id = _security_map(holdings_data.get('securities', []))
        cursor = db.cursor()
        cursor.execute(
            'DELETE FROM plaid_holdings WHERE user_id = ? AND account_id IN ('
            'SELECT account_id FROM plaid_accounts WHERE item_id = ? AND user_id = ?)',
            (user_id, item_id, user_id),
        )
        for holding in holdings_data.get('holdings', []):
            account_id = holding.get('account_id')
            security_id = holding.get('security_id')
            sec = sec_by_id.get(security_id, {})
            ticker = sec.get('ticker_symbol')
            cursor.execute(
                '''
                INSERT INTO plaid_holdings (
                    user_id, account_id, security_id, ticker_symbol, security_name,
                    quantity, cost_basis, institution_value, institution_price,
                    as_of_date, last_synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, account_id, security_id) DO UPDATE SET
                    ticker_symbol = excluded.ticker_symbol,
                    security_name = excluded.security_name,
                    quantity = excluded.quantity,
                    cost_basis = excluded.cost_basis,
                    institution_value = excluded.institution_value,
                    institution_price = excluded.institution_price,
                    as_of_date = excluded.as_of_date,
                    last_synced_at = excluded.last_synced_at
                ''',
                (
                    user_id,
                    account_id,
                    security_id,
                    ticker,
                    sec.get('name'),
                    holding.get('quantity'),
                    holding.get('cost_basis'),
                    holding.get('institution_value'),
                    holding.get('institution_price'),
                    synced_at[:10],
                    synced_at,
                ),
            )
            holdings_synced += 1
    except ApiException as e:
        body = e.body if hasattr(e, 'body') else str(e)
        if 'PRODUCT_NOT_READY' in str(body):
            _mark_item_pending(db, item_id, user_id, 'Investment data not ready yet')
        else:
            _mark_item_error(db, item_id, user_id, str(body))
            return {'ok': False, 'error': str(body)}

    db.commit()
    return {
        'ok': True,
        'accounts_synced': accounts_synced,
        'holdings_synced': holdings_synced,
    }


def _mark_item_error(db, item_id, user_id, message):
    db.cursor().execute(
        '''
        UPDATE plaid_items SET status = 'error', error_message = ?, last_sync_at = ?
        WHERE item_id = ? AND user_id = ?
        ''',
        (message[:500], _now_iso(), item_id, user_id),
    )
    db.commit()


def _mark_item_pending(db, item_id, user_id, message):
    db.cursor().execute(
        '''
        UPDATE plaid_items SET status = 'pending', error_message = ?, last_sync_at = ?
        WHERE item_id = ? AND user_id = ?
        ''',
        (message[:500], _now_iso(), item_id, user_id),
    )
    db.commit()


def sync_all_items_for_user(user_id: int, db=None) -> list:
    own_db = db is None
    if own_db:
        db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'SELECT * FROM plaid_items WHERE user_id = ?',
        (user_id,),
    )
    items = cursor.fetchall()
    results = []
    for row in items:
        item = dict(row) if hasattr(row, 'keys') else row
        results.append(sync_item_for_user(db, user_id, item))
    return results


def sync_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT user_id FROM plaid_items')
    user_ids = [r[0] for r in cursor.fetchall()]
    for uid in user_ids:
        cursor.execute('SELECT * FROM plaid_items WHERE user_id = ?', (uid,))
        for row in cursor.fetchall():
            sync_item_for_user(conn, uid, dict(row))
    conn.close()
