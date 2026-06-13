"""Spending analytics."""

from datetime import datetime, timedelta, timezone


def _month_prefix(month: str | None = None) -> str:
    if month:
        return month
    return datetime.now(timezone.utc).strftime('%Y-%m')


def _format_category(cat: str | None) -> str:
    if not cat:
        return 'Other'
    return cat.replace('_', ' ').title()


def get_spending_by_category(
    db,
    user_id: int,
    month: str | None = None,
    account_id: str | None = None,
) -> list:
    prefix = _month_prefix(month)
    where = [
        'user_id = ?',
        'pending = 0',
        'amount > 0',
        'transaction_date LIKE ?',
    ]
    params: list = [user_id, f'{prefix}%']
    if account_id:
        where.append('account_id = ?')
        params.append(account_id)
    rows = db.execute(
        f'''
        SELECT COALESCE(category_primary, 'OTHER') AS cat,
               COALESCE(SUM(amount), 0) AS total
        FROM plaid_card_transactions
        WHERE {' AND '.join(where)}
        GROUP BY cat
        ORDER BY total DESC
        ''',
        tuple(params),
    ).fetchall()
    return [
        {
            'category': _format_category(r[0]),
            'category_key': r[0],
            'amount': round(float(r[1]), 2),
        }
        for r in rows
    ]


def get_spending_by_week(
    db,
    user_id: int,
    weeks: int = 8,
    account_id: str | None = None,
) -> list:
    now = datetime.now(timezone.utc).date()
    start = now - timedelta(weeks=weeks)
    start_str = start.isoformat()
    where = [
        'user_id = ?',
        'pending = 0',
        'amount > 0',
        'transaction_date >= ?',
    ]
    params: list = [user_id, start_str]
    if account_id:
        where.append('account_id = ?')
        params.append(account_id)
    rows = db.execute(
        f'''
        SELECT transaction_date, amount
        FROM plaid_card_transactions
        WHERE {' AND '.join(where)}
        ''',
        tuple(params),
    ).fetchall()

    buckets: dict[str, float] = {}
    for date_str, amount in rows:
        try:
            d = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
        except ValueError:
            continue
        week_start = d - timedelta(days=d.weekday())
        key = week_start.isoformat()
        buckets[key] = buckets.get(key, 0.0) + float(amount)

    return [
        {'week_start': k, 'amount': round(v, 2)}
        for k, v in sorted(buckets.items())
    ]


def get_monthly_spending_totals(db, user_id: int, months: int = 12) -> list:
    """Total credit-card spend per calendar month, most recent first."""
    rows = db.execute(
        '''
        SELECT substr(transaction_date, 1, 7) AS month,
               COALESCE(SUM(amount), 0) AS total
        FROM plaid_card_transactions
        WHERE user_id = ? AND pending = 0 AND amount > 0
        GROUP BY month
        ORDER BY month DESC
        LIMIT ?
        ''',
        (user_id, months),
    ).fetchall()

    results = []
    for month_str, total in rows:
        try:
            label = datetime.strptime(month_str, '%Y-%m').strftime('%B %Y')
        except ValueError:
            label = month_str
        results.append({
            'month': month_str,
            'month_label': label,
            'total': round(float(total), 2),
        })
    return results
