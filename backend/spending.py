"""Spending analytics and budgets."""

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


def get_budgets(db, user_id: int, month: str | None = None) -> list:
    prefix = _month_prefix(month)
    rows = db.execute(
        '''
        SELECT id, category, month, limit_amount
        FROM spending_budgets
        WHERE user_id = ? AND month = ?
        ORDER BY category
        ''',
        (user_id, prefix),
    ).fetchall()
    return [dict(r) for r in rows]


def upsert_budget(db, user_id: int, category: str, month: str, limit_amount: float) -> dict:
    category_key = category.strip().upper().replace(' ', '_')
    db.execute(
        '''
        INSERT INTO spending_budgets (user_id, category, month, limit_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, category, month) DO UPDATE SET
            limit_amount = excluded.limit_amount
        ''',
        (user_id, category_key, month, limit_amount),
    )
    db.commit()
    row = db.execute(
        '''
        SELECT id, category, month, limit_amount FROM spending_budgets
        WHERE user_id = ? AND category = ? AND month = ?
        ''',
        (user_id, category_key, month),
    ).fetchone()
    return dict(row)


def delete_budget(db, user_id: int, budget_id: int) -> bool:
    cur = db.execute(
        'DELETE FROM spending_budgets WHERE id = ? AND user_id = ?',
        (budget_id, user_id),
    )
    db.commit()
    return cur.rowcount > 0


def get_budget_vs_actual(
    db,
    user_id: int,
    month: str | None = None,
    account_id: str | None = None,
) -> list:
    prefix = _month_prefix(month)
    budgets = get_budgets(db, user_id, prefix)
    by_cat = {b['category']: b for b in budgets}

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

    actual_rows = db.execute(
        f'''
        SELECT COALESCE(category_primary, 'OTHER') AS cat,
               COALESCE(SUM(amount), 0) AS total
        FROM plaid_card_transactions
        WHERE {' AND '.join(where)}
        GROUP BY cat
        ''',
        tuple(params),
    ).fetchall()

    results = []
    seen = set()
    for cat, total in actual_rows:
        actual = round(float(total), 2)
        budget_row = by_cat.get(cat)
        limit_amt = budget_row['limit_amount'] if budget_row else None
        results.append({
            'category': _format_category(cat),
            'category_key': cat,
            'actual': actual,
            'limit': limit_amt,
            'budget_id': budget_row['id'] if budget_row else None,
            'remaining': round(limit_amt - actual, 2) if limit_amt is not None else None,
        })
        seen.add(cat)

    for cat, budget_row in by_cat.items():
        if cat not in seen:
            results.append({
                'category': _format_category(cat),
                'category_key': cat,
                'actual': 0.0,
                'limit': budget_row['limit_amount'],
                'budget_id': budget_row['id'],
                'remaining': round(budget_row['limit_amount'], 2),
            })

    return sorted(results, key=lambda x: x['actual'], reverse=True)
