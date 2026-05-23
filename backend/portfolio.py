"""Net worth and holdings from Plaid tables, with legacy CSV fallback."""


def user_has_plaid_items(db, user_id: int) -> bool:
    row = db.execute(
        'SELECT 1 FROM plaid_items WHERE user_id = ? LIMIT 1',
        (user_id,),
    ).fetchone()
    return row is not None


def get_plaid_accounts(db, user_id: int) -> list:
    rows = db.execute(
        '''
        SELECT account_id, item_id, name, official_name, type, subtype, mask,
               current_balance, available_balance, currency, last_synced_at
        FROM plaid_accounts WHERE user_id = ?
        ORDER BY type, name
        ''',
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_plaid_holdings(db, user_id: int) -> list:
    rows = db.execute(
        '''
        SELECT account_id, security_id, ticker_symbol, security_name, quantity,
               cost_basis, institution_value, institution_price, last_synced_at
        FROM plaid_holdings WHERE user_id = ?
        ORDER BY ticker_symbol
        ''',
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_plaid_items(db, user_id: int) -> list:
    rows = db.execute(
        '''
        SELECT id, item_id, institution_id, institution_name, status,
               error_message, last_sync_at, created_at
        FROM plaid_items WHERE user_id = ?
        ORDER BY created_at DESC
        ''',
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def compute_net_worth_from_plaid(db, user_id: int) -> dict:
    accounts = get_plaid_accounts(db, user_id)
    holdings = get_plaid_holdings(db, user_id)

    cash_total = 0.0
    cash_accounts = []
    for acc in accounts:
        if acc['type'] == 'depository':
            bal = acc['current_balance'] or 0.0
            cash_total += bal
            cash_accounts.append({**acc, 'balance': bal})

    investments_total = 0.0
    for h in holdings:
        val = h['institution_value']
        if val is not None:
            investments_total += val
        elif h['quantity'] and h['institution_price']:
            investments_total += h['quantity'] * h['institution_price']

    return {
        'source': 'plaid',
        'cash_total': round(cash_total, 2),
        'investments_total': round(investments_total, 2),
        'total': round(cash_total + investments_total, 2),
        'cash_accounts': cash_accounts,
        'holdings': holdings,
        'accounts': accounts,
    }
