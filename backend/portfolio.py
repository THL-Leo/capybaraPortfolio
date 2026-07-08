"""Net worth and holdings from Plaid tables."""

import json
from datetime import datetime, timezone

from categories import (
    NON_SPENDING_CATEGORIES,
    apply_category_to_transaction,
    effective_category_sql,
    is_hidden_payment_transaction,
)

ASSET_BUCKETS = (
    'checking',
    'savings',
    'hysa',
    'brokerage',
    'retirement_401k',
    'retirement_roth',
)


def classify_account(acc: dict) -> str:
    """Map a Plaid account to a net worth bucket."""
    acc_type = (acc.get('type') or '').lower()
    subtype = (acc.get('subtype') or '').lower()
    name = f"{acc.get('name') or ''} {acc.get('official_name') or ''}".lower()

    if acc_type == 'credit':
        return 'liability'

    if acc_type == 'depository':
        if subtype == 'checking':
            return 'checking'
        if subtype == 'savings':
            if 'hysa' in name or 'high yield' in name:
                return 'hysa'
            return 'savings'
        return 'savings'

    if acc_type == 'investment':
        combined = f'{subtype} {name}'
        if '401k' in combined or '401a' in combined:
            return 'retirement_401k'
        if 'roth' in combined or 'ira' in combined:
            return 'retirement_roth'
        return 'brokerage'

    return 'brokerage'


def _empty_breakdown() -> dict[str, float]:
    return {b: 0.0 for b in ASSET_BUCKETS}


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


BUCKET_SORT_ORDER = {
    'checking': 0,
    'savings': 1,
    'hysa': 2,
    'brokerage': 3,
    'retirement_401k': 4,
    'retirement_roth': 5,
    'liability': 6,
}


def enrich_accounts(accounts: list, items: list) -> list:
    """Attach bucket and institution_name; sort by bucket, institution, name."""
    inst_by_item = {i['item_id']: i.get('institution_name') or 'Unknown' for i in items}
    enriched = []
    for acc in accounts:
        row = dict(acc)
        row['bucket'] = classify_account(row)
        row['institution_name'] = inst_by_item.get(row.get('item_id'), 'Unknown')
        enriched.append(row)

    def sort_key(a):
        return (
            BUCKET_SORT_ORDER.get(a.get('bucket'), 99),
            (a.get('institution_name') or '').lower(),
            (a.get('name') or '').lower(),
        )

    enriched.sort(key=sort_key)
    return enriched


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


def get_account_with_institution(db, user_id: int, account_id: str) -> dict | None:
    row = db.execute(
        '''
        SELECT a.account_id, a.item_id, a.name, a.official_name, a.type, a.subtype,
               a.mask, a.current_balance, a.available_balance, a.currency,
               a.last_synced_at, i.institution_name, i.institution_id
        FROM plaid_accounts a
        LEFT JOIN plaid_items i ON i.item_id = a.item_id AND i.user_id = a.user_id
        WHERE a.user_id = ? AND a.account_id = ?
        ''',
        (user_id, account_id),
    ).fetchone()
    if row:
        result = dict(row)
        result['bucket'] = classify_account(result)
        return result
    return None


def get_card_transactions(
    db,
    user_id: int,
    account_id: str | None = None,
    month: str | None = None,
    limit: int = 100,
) -> list:
    where = ['user_id = ?']
    params: list = [user_id]
    if account_id:
        where.append('account_id = ?')
        params.append(account_id)
    if month:
        where.append('transaction_date LIKE ?')
        params.append(f'{month}%')
    sql = f'''
        SELECT account_id, transaction_id, transaction_date, name, merchant_name,
               amount, iso_currency_code, pending, category_primary,
               account_type, last_synced_at
        FROM plaid_card_transactions
        WHERE {' AND '.join(where)}
        ORDER BY transaction_date DESC, transaction_id DESC
        LIMIT ?
    '''
    params.append(limit)
    rows = db.execute(sql, tuple(params)).fetchall()
    results = []
    for row in rows:
        item = apply_category_to_transaction(dict(row))
        if is_hidden_payment_transaction(
            item.get('category_primary'),
            item.get('account_type'),
            item.get('amount'),
        ):
            continue
        results.append(item)
    return results


def compute_spending_summary(
    db,
    user_id: int,
    account_id: str | None = None,
    month: str | None = None,
) -> dict:
    """Sum credit-card purchases (positive amounts) for the requested month."""
    if month:
        try:
            label = datetime.strptime(month, '%Y-%m').strftime('%B %Y')
        except ValueError:
            label = month
        month_prefix = month
    else:
        now = datetime.now(timezone.utc)
        month_prefix = now.strftime('%Y-%m')
        label = now.strftime('%B %Y')

    where = ['user_id = ?', 'pending = 0', 'amount > 0', 'transaction_date LIKE ?']
    excluded = ', '.join(f"'{cat}'" for cat in NON_SPENDING_CATEGORIES)
    where.append(f"({effective_category_sql()}) NOT IN ({excluded})")
    params: list = [user_id, f'{month_prefix}%']
    if account_id:
        where.append('account_id = ?')
        params.append(account_id)
    else:
        where.append("account_type = 'credit'")

    row = db.execute(
        f'SELECT COALESCE(SUM(amount), 0) FROM plaid_card_transactions WHERE {" AND ".join(where)}',
        tuple(params),
    ).fetchone()
    month_to_date = round(float(row[0] if row else 0), 2)
    return {
        'month_to_date': month_to_date,
        'month_label': label,
        'month': month_prefix,
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


def _holding_value(h: dict) -> float:
    val = h.get('institution_value')
    if val is not None:
        return float(val)
    if h.get('quantity') and h.get('institution_price'):
        return float(h['quantity']) * float(h['institution_price'])
    return 0.0


def _holdings_total_by_account(holdings: list) -> dict[str, float]:
    """Sum institution value per investment account."""
    totals: dict[str, float] = {}
    for h in holdings:
        account_id = h.get('account_id')
        if not account_id:
            continue
        totals[account_id] = totals.get(account_id, 0.0) + _holding_value(h)
    return totals


def compute_net_worth_from_plaid(db, user_id: int) -> dict:
    accounts = get_plaid_accounts(db, user_id)
    holdings = get_plaid_holdings(db, user_id)
    holdings_by_account = _holdings_total_by_account(holdings)

    breakdown = _empty_breakdown()
    liabilities_total = 0.0
    cash_accounts = []

    account_bucket = {a['account_id']: classify_account(a) for a in accounts}

    for acc in accounts:
        bal = float(acc['current_balance'] or 0.0)
        bucket = account_bucket[acc['account_id']]

        if bucket == 'liability':
            liabilities_total += bal
            continue

        if acc['type'] == 'depository':
            breakdown[bucket] = breakdown.get(bucket, 0.0) + bal
            cash_accounts.append({**acc, 'balance': bal, 'bucket': bucket})
        elif acc['type'] == 'investment':
            # Plaid account balance already reflects total market value when
            # holdings exist — use holdings sum only, else fall back to balance.
            if acc['account_id'] not in holdings_by_account and bal > 0:
                breakdown[bucket] = breakdown.get(bucket, 0.0) + bal

    for account_id, holding_total in holdings_by_account.items():
        bucket = account_bucket.get(account_id, 'brokerage')
        if bucket == 'liability':
            continue
        breakdown[bucket] = breakdown.get(bucket, 0.0) + holding_total

    for key in breakdown:
        breakdown[key] = round(breakdown[key], 2)
    liabilities_total = round(liabilities_total, 2)

    assets_total = round(sum(breakdown.values()), 2)
    net_worth = round(assets_total - liabilities_total, 2)

    cash_total = round(
        breakdown['checking'] + breakdown['savings'] + breakdown['hysa'], 2
    )
    investments_total = round(
        breakdown['brokerage']
        + breakdown['retirement_401k']
        + breakdown['retirement_roth'],
        2,
    )

    return {
        'source': 'plaid',
        'breakdown': breakdown,
        'assets_total': assets_total,
        'liabilities_total': liabilities_total,
        'total': net_worth,
        'cash_total': cash_total,
        'investments_total': investments_total,
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
    breakdown_json = json.dumps(nw['breakdown'])

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
            SET recorded_at = ?, total = ?, cash_total = ?, investments_total = ?,
                assets_total = ?, liabilities_total = ?, breakdown = ?, source = 'plaid'
            WHERE id = ?
            ''',
            (
                recorded_at,
                nw['total'],
                nw['cash_total'],
                nw['investments_total'],
                nw['assets_total'],
                nw['liabilities_total'],
                breakdown_json,
                existing[0],
            ),
        )
    else:
        db.execute(
            '''
            INSERT INTO net_worth_snapshots
            (user_id, recorded_at, total, cash_total, investments_total,
             assets_total, liabilities_total, breakdown, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'plaid')
            ''',
            (
                user_id,
                recorded_at,
                nw['total'],
                nw['cash_total'],
                nw['investments_total'],
                nw['assets_total'],
                nw['liabilities_total'],
                breakdown_json,
            ),
        )
    db.commit()
    return nw


def get_net_worth_snapshots(db, user_id: int) -> list:
    rows = db.execute(
        '''
        SELECT recorded_at, total, cash_total, investments_total,
               assets_total, liabilities_total, breakdown, source
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
        breakdown = _empty_breakdown()
        if r.get('breakdown'):
            try:
                parsed = json.loads(r['breakdown'])
                breakdown.update({k: float(v) for k, v in parsed.items()})
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        snapshots.append({
            'date': date_str,
            'total': r['total'],
            'cash_total': r['cash_total'],
            'investments_total': r['investments_total'],
            'assets_total': r.get('assets_total'),
            'liabilities_total': r.get('liabilities_total'),
            'breakdown': breakdown,
            'source': r['source'],
        })
    return snapshots


def get_net_worth_snapshots_for_chart(db, user_id: int) -> list:
    """Return stored snapshots with today's point replaced by live Plaid totals."""
    snapshots = get_net_worth_snapshots(db, user_id)
    if not user_has_plaid_items(db, user_id):
        return snapshots

    nw = compute_net_worth_from_plaid(db, user_id)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    live_point = {
        'date': today,
        'total': nw['total'],
        'cash_total': nw['cash_total'],
        'investments_total': nw['investments_total'],
        'assets_total': nw['assets_total'],
        'liabilities_total': nw['liabilities_total'],
        'breakdown': nw['breakdown'],
        'source': nw['source'],
    }

    if snapshots and snapshots[-1]['date'] == today:
        snapshots[-1] = live_point
    else:
        snapshots.append(live_point)

    return snapshots


CASH_TICKERS = frozenset({'CASH', 'CUR:USD', 'USD'})


def get_holdings_by_ticker(db, user_id: int) -> dict[str, dict]:
    """Aggregate Plaid holdings by ticker symbol (dedupes across accounts)."""
    by_ticker: dict[str, dict] = {}
    for h in get_holdings_with_pnl(db, user_id):
        ticker = (h.get('ticker_symbol') or '').strip().upper()
        if not ticker or ticker in CASH_TICKERS:
            continue
        qty = h.get('quantity')
        if qty is None or float(qty) <= 0:
            continue

        if ticker not in by_ticker:
            by_ticker[ticker] = {
                'ticker': ticker,
                'name': h.get('security_name') or ticker,
                'quantity': 0.0,
                'market_value': 0.0,
                'cost_basis': 0.0,
            }

        entry = by_ticker[ticker]
        entry['quantity'] += float(qty)
        entry['market_value'] = round(entry['market_value'] + float(h.get('market_value') or 0), 2)
        cost = h.get('cost_basis')
        if cost is not None:
            entry['cost_basis'] = round(entry['cost_basis'] + float(cost), 2)

    for entry in by_ticker.values():
        cost = entry.get('cost_basis') or 0
        if cost > 0:
            gain = round(entry['market_value'] - cost, 2)
            entry['unrealized_gain'] = gain
            entry['unrealized_gain_pct'] = round((gain / cost) * 100, 2)
        else:
            entry['unrealized_gain'] = None
            entry['unrealized_gain_pct'] = None
        entry['quantity'] = round(entry['quantity'], 4)

    return by_ticker


def get_holdings_with_pnl(db, user_id: int) -> list:
    holdings = get_plaid_holdings(db, user_id)
    enriched = []
    for h in holdings:
        value = _holding_value(h)
        cost = h.get('cost_basis')
        gain = None
        gain_pct = None
        if cost is not None and cost > 0:
            gain = round(value - cost, 2)
            gain_pct = round((gain / cost) * 100, 2)
        enriched.append({
            **h,
            'market_value': round(value, 2),
            'unrealized_gain': gain,
            'unrealized_gain_pct': gain_pct,
        })
    return enriched


def get_allocation(db, user_id: int) -> dict:
    holdings = get_plaid_holdings(db, user_id)
    buckets: dict[str, float] = {}
    total = 0.0
    for h in holdings:
        value = _holding_value(h)
        ticker = (h.get('ticker_symbol') or '').upper()
        if ticker in ('', 'CASH', 'CUR:USD', 'USD'):
            label = 'Cash & equivalents'
        elif ticker:
            label = 'Equities & funds'
        else:
            label = 'Other'
        buckets[label] = buckets.get(label, 0.0) + value
        total += value

    slices = [
        {
            'label': label,
            'value': round(val, 2),
            'percent': round((val / total) * 100, 1) if total > 0 else 0,
        }
        for label, val in sorted(buckets.items(), key=lambda x: -x[1])
    ]
    return {'total': round(total, 2), 'slices': slices}
