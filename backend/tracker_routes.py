import sqlite3

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from db import get_db
from tracker import (
    add_stock,
    create_list,
    delete_list,
    get_holdings_stocks_with_quotes,
    get_lists,
    get_stocks_with_quotes,
    normalize_range,
    remove_stock,
    search_tickers,
)

tracker_bp = Blueprint('tracker', __name__)


@tracker_bp.route('/tracker/lists', methods=['GET'])
@jwt_required()
def tracker_get_lists():
    user_id = int(get_jwt_identity())
    db = get_db()
    lists = get_lists(db, user_id)
    return jsonify({'lists': lists}), 200


@tracker_bp.route('/tracker/lists', methods=['POST'])
@jwt_required()
def tracker_create_list():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    name = data.get('name', '')

    try:
        db = get_db()
        new_list = create_list(db, user_id, name)
        return jsonify({'list': new_list}), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@tracker_bp.route('/tracker/lists/<int:list_id>', methods=['DELETE'])
@jwt_required()
def tracker_delete_list(list_id):
    user_id = int(get_jwt_identity())
    db = get_db()

    try:
        deleted = delete_list(db, user_id, list_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    if not deleted:
        return jsonify({'error': 'List not found'}), 404

    return '', 204


@tracker_bp.route('/tracker/holdings/stocks', methods=['GET'])
@jwt_required()
def tracker_get_holdings_stocks():
    user_id = int(get_jwt_identity())
    range_key = normalize_range(request.args.get('range'))
    db = get_db()
    stocks = get_holdings_stocks_with_quotes(db, user_id, range_key)
    return jsonify({'stocks': stocks}), 200


@tracker_bp.route('/tracker/lists/<int:list_id>/stocks', methods=['GET'])
@jwt_required()
def tracker_get_stocks(list_id):
    user_id = int(get_jwt_identity())
    range_key = normalize_range(request.args.get('range'))
    db = get_db()
    stocks = get_stocks_with_quotes(db, user_id, list_id, range_key)

    if stocks is None:
        return jsonify({'error': 'List not found'}), 404

    return jsonify({'stocks': stocks}), 200


@tracker_bp.route('/tracker/lists/<int:list_id>/stocks', methods=['POST'])
@jwt_required()
def tracker_add_stock(list_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    ticker = data.get('ticker', '')

    if not ticker.strip():
        return jsonify({'error': 'Ticker is required'}), 400

    db = get_db()

    try:
        stock = add_stock(db, user_id, list_id, ticker)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Ticker already in list'}), 409

    if stock is None:
        return jsonify({'error': 'List not found'}), 404

    return jsonify({'stock': stock}), 201


@tracker_bp.route('/tracker/lists/<int:list_id>/stocks/<ticker>', methods=['DELETE'])
@jwt_required()
def tracker_remove_stock(list_id, ticker):
    user_id = int(get_jwt_identity())
    db = get_db()
    removed = remove_stock(db, user_id, list_id, ticker)

    if not removed:
        return jsonify({'error': 'Stock or list not found'}), 404

    return '', 204


@tracker_bp.route('/tracker/search', methods=['GET'])
@jwt_required()
def tracker_search():
    query = request.args.get('q', '')
    if not query.strip():
        return jsonify({'results': []}), 200

    results = search_tickers(query)
    return jsonify({'results': results}), 200
