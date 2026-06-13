import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, g, jsonify, make_response, request
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)

from db import get_db
from init_db import init_db
from plaid_routes import plaid_bp
from portfolio import compute_net_worth_from_plaid, get_plaid_items, user_has_plaid_items

load_dotenv()

init_db()

app = Flask(__name__)
app.register_blueprint(plaid_bp)

app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token_cookie'
app.config['JWT_ACCESS_CSRF_HEADER_NAME'] = 'X-CSRF-TOKEN'
app.config['JWT_COOKIE_SAMESITE'] = 'Lax'

jwt = JWTManager(app)
bcrypt = Bcrypt(app)


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401


@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token'}), 401


@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization token is required'}), 401


origins = [os.getenv('DEV_API_URL')]
CORS(app, origins=origins, supports_credentials=True)


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route('/time')
def get_time():
    return {'time': datetime.now().isoformat()}


@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        invite_code = data.get('invite_code')

        if invite_code != os.getenv('INVITE_CODE'):
            return jsonify({'error': 'Invalid invite code'}), 403

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        if cursor.fetchone():
            return jsonify({'error': 'Username already exists'}), 409

        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cursor.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            (username, password_hash),
        )
        db.commit()

        return jsonify({'message': 'User created successfully'}), 201

    except Exception:
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            (username,),
        )
        user = cursor.fetchone()

        if user and bcrypt.check_password_hash(user[2], password):
            access_token = create_access_token(identity=str(user[0]))
            response = make_response(jsonify({
                'message': 'Login successful',
                'user': {'id': user[0], 'username': user[1]},
            }))
            set_access_cookies(response, access_token)
            return response, 200

        return jsonify({'error': 'Invalid username or password'}), 401

    except Exception:
        return jsonify({'error': 'Login failed'}), 500


@app.route('/home', methods=['GET'])
@jwt_required()
def home():
    try:
        current_user_id = int(get_jwt_identity())

        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id, username FROM users WHERE id = ?', (current_user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        stats = {}
        plaid = {'has_items': False}
        if user_has_plaid_items(db, current_user_id):
            items = get_plaid_items(db, current_user_id)
            nw = compute_net_worth_from_plaid(db, current_user_id)
            plaid = {
                'has_items': True,
                'linked_institutions': len(items),
                'net_worth': nw['total'],
                'assets_total': nw['assets_total'],
                'liabilities_total': nw['liabilities_total'],
                'breakdown': nw['breakdown'],
                'cash_total': nw['cash_total'],
                'investments_total': nw['investments_total'],
                'sync_items': [
                    {
                        'item_id': i['item_id'],
                        'institution_name': i.get('institution_name'),
                        'status': i.get('status'),
                        'error_message': i.get('error_message'),
                        'last_sync_at': i.get('last_sync_at'),
                    }
                    for i in items
                ],
            }
            stats['net_worth'] = nw['total']

        return jsonify({
            'message': f'Welcome to your portfolio, {user[1]}!',
            'user': {'id': user[0], 'username': user[1]},
            'stats': stats,
            'plaid': plaid,
        }), 200

    except Exception:
        return jsonify({'error': 'Failed to load home page'}), 500


@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    response = make_response(jsonify({'message': 'Successfully logged out'}))
    unset_jwt_cookies(response)
    return response, 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
