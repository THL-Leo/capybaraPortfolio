import sqlite3
from flask import Flask, g, request, jsonify
from datetime import datetime, timedelta
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
# Completely disable CSRF protection
app.config['JWT_ACCESS_CSRF_HEADER_NAME'] = None
app.config['JWT_REFRESH_CSRF_HEADER_NAME'] = None

# Initialize extensions
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# JWT Error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization token is required'}), 401

origins = [
    os.getenv('DEV_API_URL')
]

CORS(app, origins=origins, supports_credentials=True)

DATABASE = './test.db'

def get_db():
    db = getattr(g, '__database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

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
        
        # Validate invite code
        if invite_code != os.getenv('INVITE_CODE'):
            return jsonify({'error': 'Invalid invite code'}), 403
        
        # Validate input
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Check if username already exists
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        if cursor.fetchone():
            return jsonify({'error': 'Username already exists'}), 409
        
        # Hash password and create user
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', 
                      (username, password_hash))
        db.commit()
        
        return jsonify({'message': 'User created successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': 'Registration failed'}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        # Validate input
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Check user credentials
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id, username, password_hash FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if user and bcrypt.check_password_hash(user[2], password):
            # Create JWT token (identity must be a string)
            access_token = create_access_token(identity=str(user[0]))
            return jsonify({
                'message': 'Login successful',
                'access_token': access_token,
                'user': {'id': user[0], 'username': user[1]}
            }), 200
        else:
            return jsonify({'error': 'Invalid username or password'}), 401
            
    except Exception as e:
        return jsonify({'error': 'Login failed'}), 500

@app.route('/home', methods=['GET'])
@jwt_required()
def home():
    try:
        current_user_id = int(get_jwt_identity())  # Convert string back to int
        
        # Get user info
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id, username FROM users WHERE id = ?', (current_user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user's transaction count (for the portfolio info)
        cursor.execute('SELECT COUNT(*) FROM transactions WHERE user_id = ?', (current_user_id,))
        transaction_count = cursor.fetchone()[0]
        
        return jsonify({
            'message': f'Welcome to your portfolio, {user[1]}!',
            'user': {'id': user[0], 'username': user[1]},
            'stats': {
                'total_transactions': transaction_count
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to load home page'}), 500

@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Successfully logged out'}), 200
