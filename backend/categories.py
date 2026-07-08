"""Transaction category normalization and merchant overrides."""

RENT_MERCHANT_PATTERNS = (
    'rentcafe',
    'rent cafe',
    'yardi',
    'property payment rent',
    'payment rent',
)

CREDIT_CARD_PAYMENT_PATTERNS = (
    'payment to',
    'credit crd',
    'citi autopay',
    'citicardap',
    'card ending in',
    'automatic payment',
    'payment thank you',
)

REAL_LOAN_PATTERNS = (
    'mortgage',
    'student loan',
    'auto loan',
    'car loan',
    'nelnet',
    'great lakes',
    'sofi',
)

# Excluded from credit-card spending analytics (not purchases).
NON_SPENDING_CATEGORIES = (
    'LOAN_PAYMENTS',
    'LOAN_DISBURSEMENTS',
    'CREDIT_CARD_PAYMENT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
)


def _merchant_blob(name: str | None, merchant_name: str | None) -> str:
    return f'{merchant_name or ""} {name or ""}'.lower()


def is_rent_payment(name: str | None, merchant_name: str | None) -> bool:
    blob = _merchant_blob(name, merchant_name)
    if any(pattern in blob for pattern in RENT_MERCHANT_PATTERNS):
        return True
    if 'ysi' in blob and ('rent' in blob or 'property' in blob):
        return True
    return False


def is_credit_card_payment(
    name: str | None,
    merchant_name: str | None,
    primary: str | None = None,
) -> bool:
    """Plaid labels card bill pay as LOAN_PAYMENTS — detect and reclassify."""
    if primary not in ('LOAN_PAYMENTS', 'LOAN_DISBURSEMENTS'):
        return False
    blob = _merchant_blob(name, merchant_name)
    if any(pattern in blob for pattern in REAL_LOAN_PATTERNS):
        return False
    if any(pattern in blob for pattern in CREDIT_CARD_PAYMENT_PATTERNS):
        return True
    if primary == 'LOAN_DISBURSEMENTS':
        return True
    if 'autopay' in blob and any(k in blob for k in ('card', 'crd', 'citi', 'chase')):
        return True
    return False


def resolve_category_primary(
    primary: str | None,
    name: str | None = None,
    merchant_name: str | None = None,
) -> str:
    if is_rent_payment(name, merchant_name):
        return 'RENT_AND_UTILITIES'
    if is_credit_card_payment(name, merchant_name, primary):
        return 'CREDIT_CARD_PAYMENT'
    return primary or 'OTHER'


def effective_category_sql(alias: str = '') -> str:
    prefix = f'{alias}.' if alias else ''
    blob = (
        f"LOWER(COALESCE({prefix}merchant_name, '') || ' ' || COALESCE({prefix}name, ''))"
    )
    primary = f"COALESCE({prefix}category_primary, 'OTHER')"
    return f'''
    CASE
      WHEN {blob} LIKE '%rentcafe%'
        OR {blob} LIKE '%rent cafe%'
        OR {blob} LIKE '%yardi%'
        OR {blob} LIKE '%property payment rent%'
        OR {blob} LIKE '%payment rent%'
        OR ({blob} LIKE '%ysi%' AND ({blob} LIKE '%rent%' OR {blob} LIKE '%property%'))
      THEN 'RENT_AND_UTILITIES'
      WHEN {primary} IN ('LOAN_PAYMENTS', 'LOAN_DISBURSEMENTS')
        AND {blob} NOT LIKE '%mortgage%'
        AND {blob} NOT LIKE '%student loan%'
        AND {blob} NOT LIKE '%auto loan%'
        AND (
          {blob} LIKE '%payment to%'
          OR {blob} LIKE '%credit crd%'
          OR {blob} LIKE '%citi autopay%'
          OR {blob} LIKE '%citicardap%'
          OR {blob} LIKE '%card ending in%'
          OR {blob} LIKE '%automatic payment%'
          OR {blob} LIKE '%payment thank you%'
          OR {primary} = 'LOAN_DISBURSEMENTS'
          OR ({blob} LIKE '%autopay%' AND (
            {blob} LIKE '%card%' OR {blob} LIKE '%crd%'
            OR {blob} LIKE '%citi%' OR {blob} LIKE '%chase%'
          ))
        )
      THEN 'CREDIT_CARD_PAYMENT'
      ELSE {primary}
    END
    '''.strip()


def is_hidden_payment_transaction(
    category_primary: str | None,
    account_type: str | None,
    amount: float | None,
) -> bool:
    """Hide credit-side payment mirrors (e.g. AUTOMATIC PAYMENT - THANK)."""
    if category_primary != 'CREDIT_CARD_PAYMENT':
        return False
    if account_type == 'credit' and amount is not None and float(amount) < 0:
        return True
    return False


def apply_category_to_transaction(row: dict) -> dict:
    result = dict(row)
    result['category_primary'] = resolve_category_primary(
        result.get('category_primary'),
        result.get('name'),
        result.get('merchant_name'),
    )
    return result


def backfill_transaction_categories(db, user_id: int) -> int:
    """Update stored categories after rule changes; remove hidden payment mirrors."""
    rows = db.execute(
        '''
        SELECT transaction_id, name, merchant_name, category_primary,
               account_type, amount
        FROM plaid_card_transactions
        WHERE user_id = ?
        ''',
        (user_id,),
    ).fetchall()
    updated = 0
    removed = 0
    for row in rows:
        resolved = resolve_category_primary(
            row['category_primary'],
            row['name'],
            row['merchant_name'],
        )
        if is_hidden_payment_transaction(
            resolved,
            row['account_type'],
            row['amount'],
        ):
            db.execute(
                'DELETE FROM plaid_card_transactions WHERE transaction_id = ?',
                (row['transaction_id'],),
            )
            removed += 1
            continue
        if resolved != row['category_primary']:
            db.execute(
                'UPDATE plaid_card_transactions SET category_primary = ? WHERE transaction_id = ?',
                (resolved, row['transaction_id']),
            )
            updated += 1
    if updated or removed:
        db.commit()
    return updated + removed


# Backwards compatibility
backfill_rent_categories = backfill_transaction_categories
