"""Net worth and holdings from Plaid tables, with legacy CSV fallback."""

from datetime import datetime, timezone


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


def get_credit_accounts(db, user_id: int) -> list:
    return [a for a in get_plaid_accounts(db, user_id) if a.get('type') == 'credit']


def get_card_transactions(db, user_id: int, limit: int = 100) -> list:
    rows = db.execute(
        '''
        SELECT account_id, transaction_id, transaction_date, name, merchant_name,
               amount, iso_currency_code, pending, category_primary, last_synced_at
        FROM plaid_card_transactions
        WHERE user_id = ?
        ORDER BY transaction_date DESC, transaction_id DESC
        LIMIT ?
        ''',
        (user_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def compute_spending_summary(db, user_id: int) -> dict:
    """Sum credit-card purchases (positive amounts) for the current UTC month."""
    now = datetime.now(timezone.utc)
    month_prefix = now.strftime('%Y-%m')
    row = db.execute(
        '''
        SELECT COALESCE(SUM(amount), 0)
        FROM plaid_card_transactions
        WHERE user_id = ?
          AND pending = 0
          AND amount > 0
          AND transaction_date LIKE ?
        ''',
        (user_id, f'{month_prefix}%'),
    ).fetchone()
    month_to_date = round(float(row[0] if row else 0), 2)
    return {
        'month_to_date': month_to_date,
        'month_label': now.strftime('%B %Y'),
    }


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


def record_net_worth_snapshot(db, user_id: int) -> dict | None:
    """Upsert one snapshot per user per UTC calendar day from current Plaid balances."""
    if not user_has_plaid_items(db, user_id):
        return None

    nw = compute_net_worth_from_plaid(db, user_id)
    now = datetime.now(timezone.utc)
    recorded_at = now.isoformat()
    day = now.strftime('%Y-%m-%d')

    existing = db.execute(
        '''
        SELECT id FROM net_worth_snapshots
        WHERE user_id = ? AND recorded_at LIKE ?
        ORDER BY recorded_at DESC LIMIT 1
        ''',
        (user_id, f'{day}%'),
    ).fetchone()

    if existing:
        db.execute(
            '''
            UPDATE net_worth_snapshots
            SET recorded_at = ?, total = ?, cash_total = ?, investments_total = ?, source = 'plaid'
            WHERE id = ?
            ''',
            (recorded_at, nw['total'], nw['cash_total'], nw['investments_total'], existing[0]),
        )
    else:
        db.execute(
            '''
            INSERT INTO net_worth_snapshots
            (user_id, recorded_at, total, cash_total, investments_total, source)
            VALUES (?, ?, ?, ?, ?, 'plaid')
            ''',
            (user_id, recorded_at, nw['total'], nw['cash_total'], nw['investments_total']),
        )
    db.commit()
    return nw


def get_net_worth_snapshots(db, user_id: int) -> list:
    rows = db.execute(
        '''
        SELECT recorded_at, total, cash_total, investments_total, source
        FROM net_worth_snapshots
        WHERE user_id = ?
        ORDER BY recorded_at ASC
        ''',
        (user_id,),
    ).fetchall()
    snapshots = []
    for row in rows:
        r = dict(row)
        date_str = r['recorded_at'][:10] if r['recorded_at'] else ''
        snapshots.append({
            'date': date_str,
            'total': r['total'],
            'cash_total': r['cash_total'],
            'investments_total': r['investments_total'],
            'source': r['source'],
        })
    return snapshots
