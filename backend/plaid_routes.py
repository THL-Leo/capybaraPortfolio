from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from plaid.exceptions import ApiException

from crypto_util import decrypt_token, encrypt_token
from db import get_db
from plaid_client import create_link_token, exchange_public_token
from plaid_sync import sync_all_items_for_user, sync_item_for_user
from portfolio import (
    compute_net_worth_from_plaid,
    compute_spending_summary,
    enrich_accounts,
    get_account_with_institution,
    get_allocation,
    get_card_transactions,
    get_credit_accounts,
    get_holdings_with_pnl,
    get_net_worth_snapshots,
    get_plaid_accounts,
    get_plaid_holdings,
    get_plaid_items,
    record_net_worth_snapshot,
    user_has_plaid_items,
)
from spending import (
    delete_budget,
    get_budget_vs_actual,
    get_budgets,
    get_monthly_spending_totals,
    get_spending_by_category,
    get_spending_by_week,
    upsert_budget,
)

plaid_bp = Blueprint('plaid', __name__)


@plaid_bp.route('/plaid/link-token', methods=['POST'])
@jwt_required()
def plaid_link_token():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    item_id = data.get('item_id')

    try:
        access_token = None
        if item_id:
            db = get_db()
            row = db.execute(
                '''
                SELECT access_token_encrypted FROM plaid_items
                WHERE user_id = ? AND item_id = ?
                ''',
                (user_id, item_id),
            ).fetchone()
            if not row:
                return jsonify({'error': 'Institution not found'}), 404
            access_token = decrypt_token(row['access_token_encrypted'])

        token = create_link_token(str(user_id), access_token=access_token)
        return jsonify({
            'link_token': token,
            'update_mode': access_token is not None,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except ApiException as e:
        return jsonify({'error': str(e.body)}), 502


@plaid_bp.route('/plaid/exchange-token', methods=['POST'])
@jwt_required()
def plaid_exchange_token():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    public_token = data.get('public_token')
    if not public_token:
        return jsonify({'error': 'public_token is required'}), 400

    try:
        access_token, item_id = exchange_public_token(public_token)
    except ApiException as e:
        return jsonify({'error': str(e.body)}), 502

    db = get_db()
    cursor = db.cursor()
    existing = cursor.execute(
        'SELECT id FROM plaid_items WHERE item_id = ?',
        (item_id,),
    ).fetchone()
    if existing:
        return jsonify({'error': 'This institution is already linked'}), 409

    encrypted = encrypt_token(access_token)
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        '''
        INSERT INTO plaid_items (user_id, item_id, access_token_encrypted, status, created_at)
        VALUES (?, ?, ?, 'active', ?)
        ''',
        (user_id, item_id, encrypted, now),
    )
    db.commit()

    item_row = cursor.execute(
        'SELECT * FROM plaid_items WHERE item_id = ? AND user_id = ?',
        (item_id, user_id),
    ).fetchone()
    sync_result = sync_item_for_user(db, user_id, dict(item_row))

    return jsonify({
        'message': 'Institution linked successfully',
        'item_id': item_id,
        'sync': sync_result,
    }), 200


@plaid_bp.route('/plaid/sync', methods=['POST'])
@jwt_required()
def plaid_sync():
    user_id = int(get_jwt_identity())
    if not user_has_plaid_items(get_db(), user_id):
        return jsonify({'error': 'No linked institutions'}), 404
    results = sync_all_items_for_user(user_id)
    return jsonify({'results': results}), 200


@plaid_bp.route('/plaid/items', methods=['GET'])
@jwt_required()
def plaid_items_list():
    user_id = int(get_jwt_identity())
    items = get_plaid_items(get_db(), user_id)
    return jsonify({'items': items}), 200


@plaid_bp.route('/plaid/items/<item_id>', methods=['DELETE'])
@jwt_required()
def plaid_item_delete(item_id):
    user_id = int(get_jwt_identity())
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'DELETE FROM plaid_holdings WHERE user_id = ? AND account_id IN ('
        'SELECT account_id FROM plaid_accounts WHERE item_id = ? AND user_id = ?)',
        (user_id, item_id, user_id),
    )
    cursor.execute(
        'DELETE FROM plaid_card_transactions WHERE user_id = ? AND account_id IN ('
        'SELECT account_id FROM plaid_accounts WHERE item_id = ? AND user_id = ?)',
        (user_id, item_id, user_id),
    )
    cursor.execute(
        'DELETE FROM plaid_accounts WHERE user_id = ? AND item_id = ?',
        (user_id, item_id),
    )
    cursor.execute(
        'SELECT id FROM plaid_items WHERE user_id = ? AND item_id = ?',
        (user_id, item_id),
    )
    if not cursor.fetchone():
        return jsonify({'error': 'Item not found'}), 404
    cursor.execute(
        'DELETE FROM plaid_items WHERE user_id = ? AND item_id = ?',
        (user_id, item_id),
    )
    db.commit()
    return jsonify({'message': 'Institution unlinked'}), 200


@plaid_bp.route('/accounts', methods=['GET'])
@jwt_required()
def accounts():
    user_id = int(get_jwt_identity())
    db = get_db()
    month = request.args.get('month')
    items = get_plaid_items(db, user_id)
    card_transactions = get_card_transactions(db, user_id)
    return jsonify({
        'items': items,
        'accounts': enrich_accounts(get_plaid_accounts(db, user_id), items),
        'holdings': get_plaid_holdings(db, user_id),
        'holdings_analytics': get_holdings_with_pnl(db, user_id),
        'allocation': get_allocation(db, user_id),
        'credit_cards': get_credit_accounts(db, user_id),
        'card_transactions': card_transactions,
        'spending_summary': compute_spending_summary(db, user_id),
        'spending_by_category': get_spending_by_category(db, user_id, month),
        'spending_by_week': get_spending_by_week(db, user_id),
        'budgets': get_budget_vs_actual(db, user_id, month),
    }), 200


@plaid_bp.route('/accounts/<account_id>', methods=['GET'])
@jwt_required()
def account_detail(account_id):
    user_id = int(get_jwt_identity())
    account = get_account_with_institution(get_db(), user_id, account_id)
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    return jsonify({'account': account}), 200


@plaid_bp.route('/accounts/<account_id>/transactions', methods=['GET'])
@jwt_required()
def account_transactions(account_id):
    user_id = int(get_jwt_identity())
    db = get_db()
    if not get_account_with_institution(db, user_id, account_id):
        return jsonify({'error': 'Account not found'}), 404

    month = request.args.get('month')
    try:
        limit = min(int(request.args.get('limit', 200)), 500)
    except (TypeError, ValueError):
        limit = 200

    return jsonify({
        'account_id': account_id,
        'month': month,
        'transactions': get_card_transactions(
            db, user_id, account_id=account_id, month=month, limit=limit,
        ),
    }), 200


@plaid_bp.route('/accounts/<account_id>/spending', methods=['GET'])
@jwt_required()
def account_spending(account_id):
    user_id = int(get_jwt_identity())
    db = get_db()
    if not get_account_with_institution(db, user_id, account_id):
        return jsonify({'error': 'Account not found'}), 404

    month = request.args.get('month')
    return jsonify({
        'account_id': account_id,
        'month': month,
        'summary': compute_spending_summary(db, user_id, account_id=account_id, month=month),
        'by_category': get_spending_by_category(db, user_id, month, account_id=account_id),
        'by_week': get_spending_by_week(db, user_id, account_id=account_id),
        'budgets': get_budget_vs_actual(db, user_id, month, account_id=account_id),
    }), 200


@plaid_bp.route('/spending/analytics', methods=['GET'])
@jwt_required()
def spending_analytics():
    user_id = int(get_jwt_identity())
    db = get_db()
    month = request.args.get('month')
    return jsonify({
        'spending_summary': compute_spending_summary(db, user_id, month=month),
        'by_category': get_spending_by_category(db, user_id, month),
        'by_week': get_spending_by_week(db, user_id),
        'budgets': get_budget_vs_actual(db, user_id, month),
    }), 200


@plaid_bp.route('/spending/monthly-totals', methods=['GET'])
@jwt_required()
def spending_monthly_totals():
    user_id = int(get_jwt_identity())
    try:
        months = min(int(request.args.get('months', 12)), 24)
    except (TypeError, ValueError):
        months = 12
    return jsonify({
        'months': get_monthly_spending_totals(get_db(), user_id, months),
    }), 200


@plaid_bp.route('/spending/budgets', methods=['GET', 'POST'])
@jwt_required()
def spending_budgets():
    user_id = int(get_jwt_identity())
    db = get_db()
    month = request.args.get('month') or datetime.now(timezone.utc).strftime('%Y-%m')

    if request.method == 'GET':
        return jsonify({
            'month': month,
            'budgets': get_budget_vs_actual(db, user_id, month),
        }), 200

    data = request.get_json() or {}
    category = data.get('category')
    limit_amount = data.get('limit_amount')
    if not category or limit_amount is None:
        return jsonify({'error': 'category and limit_amount are required'}), 400

    try:
        limit_val = float(limit_amount)
    except (TypeError, ValueError):
        return jsonify({'error': 'limit_amount must be a number'}), 400

    if limit_val < 0:
        return jsonify({'error': 'limit_amount must be non-negative'}), 400

    row = upsert_budget(db, user_id, category, data.get('month') or month, limit_val)
    return jsonify({
        'budget': row,
        'budgets': get_budget_vs_actual(db, user_id, data.get('month') or month),
    }), 200


@plaid_bp.route('/spending/budgets/<int:budget_id>', methods=['DELETE'])
@jwt_required()
def spending_budget_delete(budget_id):
    user_id = int(get_jwt_identity())
    if not delete_budget(get_db(), user_id, budget_id):
        return jsonify({'error': 'Budget not found'}), 404
    return jsonify({'message': 'Budget deleted'}), 200


@plaid_bp.route('/portfolio/allocation', methods=['GET'])
@jwt_required()
def portfolio_allocation():
    user_id = int(get_jwt_identity())
    return jsonify(get_allocation(get_db(), user_id)), 200


@plaid_bp.route('/portfolio/holdings-analytics', methods=['GET'])
@jwt_required()
def portfolio_holdings_analytics():
    user_id = int(get_jwt_identity())
    return jsonify({'holdings': get_holdings_with_pnl(get_db(), user_id)}), 200


@plaid_bp.route('/net-worth', methods=['GET'])
@jwt_required()
def net_worth():
    user_id = int(get_jwt_identity())
    db = get_db()
    if not user_has_plaid_items(db, user_id):
        return jsonify({
            'source': 'none',
            'message': 'Connect an institution via Plaid to see net worth',
            'breakdown': {},
            'assets_total': 0,
            'liabilities_total': 0,
            'cash_total': 0,
            'investments_total': 0,
            'total': 0,
        }), 200
    data = compute_net_worth_from_plaid(db, user_id)
    return jsonify(data), 200


@plaid_bp.route('/net-worth-over-time', methods=['GET'])
@jwt_required()
def net_worth_over_time():
    user_id = int(get_jwt_identity())
    db = get_db()
    if not user_has_plaid_items(db, user_id):
        return jsonify({
            'source': 'none',
            'message': 'Connect an institution via Plaid to see net worth history',
            'snapshots': [],
        }), 200
    try:
        snapshots = get_net_worth_snapshots(db, user_id)
        if not snapshots:
            record_net_worth_snapshot(db, user_id)
            snapshots = get_net_worth_snapshots(db, user_id)
    except Exception as e:
        return jsonify({
            'source': 'plaid',
            'snapshots': [],
            'message': f'Unable to load history: {e}',
        }), 200
    return jsonify({
        'source': 'plaid',
        'snapshots': snapshots,
        'message': 'Net worth history loaded' if snapshots else 'History builds after each sync',
    }), 200


@plaid_bp.route('/investments-over-time', methods=['GET'])
@jwt_required()
def investments_over_time():
    user_id = int(get_jwt_identity())
    db = get_db()
    if not user_has_plaid_items(db, user_id):
        return jsonify({'snapshots': [], 'series': []}), 200
    snapshots = get_net_worth_snapshots(db, user_id)
    series = [
        {'date': s['date'], 'value': s['investments_total']}
        for s in snapshots
    ]
    return jsonify({
        'source': 'plaid',
        'snapshots': snapshots,
        'series': series,
        'note': 'Values recorded at each sync (not intraday market history).',
    }), 200
