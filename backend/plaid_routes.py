from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from plaid.exceptions import ApiException

from crypto_util import encrypt_token
from db import get_db
from plaid_client import create_link_token, exchange_public_token
from plaid_sync import sync_all_items_for_user, sync_item_for_user
from portfolio import (
    compute_net_worth_from_plaid,
    get_plaid_accounts,
    get_plaid_holdings,
    get_plaid_items,
    user_has_plaid_items,
)

plaid_bp = Blueprint('plaid', __name__)


@plaid_bp.route('/plaid/link-token', methods=['POST'])
@jwt_required()
def plaid_link_token():
    user_id = int(get_jwt_identity())
    try:
        token = create_link_token(str(user_id))
        return jsonify({'link_token': token}), 200
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
    return jsonify({
        'items': get_plaid_items(get_db(), user_id),
        'accounts': get_plaid_accounts(get_db(), user_id),
        'holdings': get_plaid_holdings(get_db(), user_id),
    }), 200


@plaid_bp.route('/net-worth', methods=['GET'])
@jwt_required()
def net_worth():
    user_id = int(get_jwt_identity())
    db = get_db()
    if not user_has_plaid_items(db, user_id):
        return jsonify({
            'source': 'none',
            'message': 'Connect an institution via Plaid to see net worth',
            'cash_total': 0,
            'investments_total': 0,
            'total': 0,
        }), 200
    data = compute_net_worth_from_plaid(db, user_id)
    return jsonify(data), 200
