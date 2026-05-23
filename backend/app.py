import sqlite3
from flask import Flask, g, request, jsonify, make_response
from datetime import datetime, timedelta
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import os

from db import get_db
from plaid_routes import plaid_bp
from portfolio import compute_net_worth_from_plaid, get_plaid_items, user_has_plaid_items

load_dotenv()

app = Flask(__name__)
app.register_blueprint(plaid_bp)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY') # The secret key used to encode and decode JWT
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)  # jwt expires after 24 hours (inactivity is handled by frontend)
# Enable JWT in cookies with CSRF protection
# https://www.cyberchief.ai/2023/05/secure-jwt-token-storage.html
# using cookies for XSS protection and persistent storage
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False  # Set to True in production with HTTPS, will only be sent through HTTPS connection if True
app.config['JWT_COOKIE_CSRF_PROTECT'] = True # CSRF protection is enabled when using cookies, should be True in production
app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token_cookie' # name of the cookie that will hold the access token
app.config['JWT_ACCESS_CSRF_HEADER_NAME'] = 'X-CSRF-TOKEN' # name of the header on an incoming request
app.config['JWT_COOKIE_SAMESITE'] = 'Lax' # controls how cookies should be sent in a cross site browsing context

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
            
            # Create response and set httpOnly cookies
            response = make_response(jsonify({
                'message': 'Login successful',
                'user': {'id': user[0], 'username': user[1]}
            }))
            
            # Set the JWT token in httpOnly cookies
            set_access_cookies(response, access_token)
            return response, 200
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

        stats = {'total_transactions': transaction_count}
        plaid = {'has_items': False}
        if user_has_plaid_items(db, current_user_id):
            items = get_plaid_items(db, current_user_id)
            nw = compute_net_worth_from_plaid(db, current_user_id)
            plaid = {
                'has_items': True,
                'linked_institutions': len(items),
                'net_worth': nw['total'],
                'cash_total': nw['cash_total'],
                'investments_total': nw['investments_total'],
            }
            stats['net_worth'] = nw['total']
        
        return jsonify({
            'message': f'Welcome to your portfolio, {user[1]}!',
            'user': {'id': user[0], 'username': user[1]},
            'stats': stats,
            'plaid': plaid,
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to load home page'}), 500

@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    response = make_response(jsonify({'message': 'Successfully logged out'}))
    # Clear the JWT cookies
    unset_jwt_cookies(response)
    return response, 200

@app.route('/upload', methods=['POST'])
@jwt_required()
def upload_csv():
    try:
        current_user_id = int(get_jwt_identity())
        print(f"=== UPLOAD STARTED ===")
        print(f"User ID: {current_user_id}")
        
        # Check if file was uploaded
        if 'csv_file' not in request.files:
            print("ERROR: No file uploaded")
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['csv_file']
        brokerage = request.form.get('brokerage')
        
        print(f"File received: {file.filename}")
        print(f"Brokerage selected: {brokerage}")
        
        if file.filename == '':
            print("ERROR: No file selected")
            return jsonify({'error': 'No file selected'}), 400
        
        if not brokerage:
            print("ERROR: No brokerage selected")
            return jsonify({'error': 'No brokerage selected'}), 400
        
        # Validate file type
        if not file.filename.lower().endswith('.csv'):
            print("ERROR: File must be a CSV")
            return jsonify({'error': 'File must be a CSV'}), 400
        
        # Read and parse CSV based on brokerage
        print("Reading CSV file...")
        csv_content = file.read().decode('utf-8')
        print(f"CSV content length: {len(csv_content)} characters")
        print(f"First 200 characters: {csv_content[:200]}")
        
        print("Parsing CSV...")
        transactions = parse_csv_by_brokerage(csv_content, brokerage, current_user_id)
        
        print(f"Parsed {len(transactions)} transactions")
        
        if not transactions:
            print("ERROR: No valid transactions found")
            return jsonify({'error': 'Failed to parse CSV or no valid transactions found'}), 400
        
        # Save transactions to database
        print("Saving to database...")
        db = get_db()
        cursor = db.cursor()
        
        try:
            # Insert transactions
            for i, transaction in enumerate(transactions):
                print(f"Inserting transaction {i+1}: {transaction}")
                cursor.execute('''
                    INSERT INTO transactions 
                    (user_id, symbol, transaction_type, quantity, price, transaction_date, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    transaction['user_id'],
                    transaction['symbol'],
                    transaction['transaction_type'],
                    transaction['quantity'],
                    transaction['price'],
                    transaction['date'],  # Maps to transaction_date in DB
                    f"Imported from Schwab CSV on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                ))
            
            db.commit()
            print("Database commit successful!")
            
        except Exception as db_error:
            print(f"Database error: {db_error}")
            db.rollback()
            return jsonify({'error': f'Database error: {str(db_error)}'}), 500
        
        print(f"=== UPLOAD COMPLETED ===")
        print(f"Total transactions imported: {len(transactions)}")
        
        return jsonify({
            'message': f'Successfully imported {len(transactions)} transactions from {brokerage}',
            'transaction_count': len(transactions)
        }), 200
        
    except Exception as e:
        print(f"UPLOAD ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to process CSV file'}), 500

def parse_csv_by_brokerage(csv_content, brokerage, user_id):
    """
    Parse CSV content based on brokerage format
    Returns list of transaction dictionaries
    """
    import csv
    from io import StringIO
    from datetime import datetime
    
    print(f"=== CSV PARSING STARTED ===")
    print(f"Brokerage: {brokerage}")
    print(f"User ID: {user_id}")
    
    transactions = []
    
    try:
        # Parse CSV content
        print("Creating CSV reader...")
        csv_file = StringIO(csv_content)
        reader = csv.DictReader(csv_file)
        
        print(f"CSV columns detected: {reader.fieldnames}")
        
        if brokerage == 'schwab':
            print("Using Schwab parser...")
            transactions = parse_schwab_csv(reader, user_id)
        else:
            # For now, only support Schwab
            print(f"Brokerage {brokerage} not supported yet. Only Schwab is currently supported.")
            return []
            
    except Exception as e:
        print(f"CSV parsing error: {str(e)}")
        import traceback
        traceback.print_exc()
        return []
    
    print(f"=== CSV PARSING COMPLETED ===")
    print(f"Total transactions parsed: {len(transactions)}")
    return transactions


# Add other brokerage parsers as needed
def parse_schwab_csv(reader, user_id):
    """Parse Charles Schwab CSV format"""
    print(f"=== SCHWAB PARSER STARTED ===")
    print(f"User ID: {user_id}")
    
    def clean_schwab_date(date_str):
        """Clean Schwab date strings to MM/DD/YYYY format"""
        if not date_str:
            return None
        
        # Handle "as of" dates - extract the effective date
        if " as of " in date_str:
            # Format: "06/13/2024 as of 06/10/2024" -> use "06/10/2024" (the effective date)
            effective_date = date_str.split(" as of ")[1].strip()
            print(f"    Date cleaning: '{date_str}' -> effective date: '{effective_date}'")
            return effective_date
        
        # Handle regular dates
        cleaned_date = date_str.strip()
        print(f"    Date cleaning: '{date_str}' -> cleaned: '{cleaned_date}'")
        return cleaned_date
    
    transactions = []
    row_count = 0
    skipped_count = 0
    
    for row in reader:
        row_count += 1
        print(f"\n--- Processing Row {row_count} ---")
        print(f"Raw row data: {row}")
        
        try:
            # Schwab CSV columns: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
            raw_date = row.get('Date', '')
            action = row.get('Action', '')
            symbol = row.get('Symbol', '')
            description = row.get('Description', '')
            quantity = row.get('Quantity', '')
            price = row.get('Price', '')
            fees = row.get('Fees & Comm', '')
            amount = row.get('Amount', '')
            
            # Clean the date
            date = clean_schwab_date(raw_date)
            
            print(f"Extracted values:")
            print(f"  Raw Date: '{raw_date}'")
            print(f"  Cleaned Date: '{date}'")
            print(f"  Action: '{action}'")
            print(f"  Symbol: '{symbol}'")
            print(f"  Description: '{description}'")
            print(f"  Quantity: '{quantity}'")
            print(f"  Price: '{price}'")
            print(f"  Fees: '{fees}'")
            print(f"  Amount: '{amount}'")
            
            # Skip rows without essential data (date and action only; symbol can be empty for cash rows)
            if not date or not action:
                print(f"  SKIPPED: Missing essential data (date or action)")
                skipped_count += 1
                continue
            
            # Handle different transaction types
            transaction_type = None
            dividend_amount = 0
            
            if 'Buy' in action:
                transaction_type = 'BUY'
            elif 'Sell' in action:
                transaction_type = 'SELL'
            elif 'Qualified Dividend' in action:
                transaction_type = 'DIVIDEND'
                # For qualified dividends, the amount is the dividend payment
                if amount and amount.strip():
                    try:
                        dividend_amount = float(amount.replace('$', '').replace(',', ''))
                    except ValueError:
                        dividend_amount = 0
            elif 'Qual Div Reinvest' in action:
                transaction_type = 'DIVIDEND'
                # For dividend reinvestments, the amount is the dividend payment
                if amount and amount.strip():
                    try:
                        dividend_amount = float(amount.replace('$', '').replace(',', ''))
                    except ValueError:
                        dividend_amount = 0
            elif 'Reinvest Dividend' in action:
                transaction_type = 'DIVIDEND'
                # For dividend reinvestments, the amount is the dividend payment
                if amount and amount.strip():
                    try:
                        dividend_amount = float(amount.replace('$', '').replace(',', ''))
                    except ValueError:
                        dividend_amount = 0
            elif 'Reinvest Shares' in action:
                # User preference: treat reinvested shares as a BUY (share purchase)
                # Dividends that fund this purchase are captured on separate rows as
                # Qualified Dividend / Qual Div Reinvest / Reinvest Dividend / Cash Dividend
                transaction_type = 'BUY'
            elif 'Cash Dividend' in action:
                transaction_type = 'DIVIDEND'
                # For cash dividends, the amount is the dividend payment
                if amount and amount.strip():
                    try:
                        dividend_amount = float(amount.replace('$', '').replace(',', ''))
                    except ValueError:
                        dividend_amount = 0
            elif 'Stock Split' in action:
                transaction_type = 'SPLIT'
            elif 'Reverse Split' in action:
                transaction_type = 'REVERSE_SPLIT'
            elif 'Name Change' in action:
                transaction_type = 'NAME_CHANGE'
            elif 'MoneyLink Transfer' in action:
                transaction_type = 'TRANSFER'
            elif 'Bank Interest' in action:
                transaction_type = 'INTEREST'
            elif 'Cash In Lieu' in action:
                transaction_type = 'CASH_IN_LIEU'
            elif 'Security Transfer' in action:
                transaction_type = 'TRANSFER'
            else:
                print(f"  SKIPPED: Unknown transaction type: '{action}'")
                skipped_count += 1
                continue
            
            print(f"  Transaction type detected: {transaction_type}")
            if transaction_type == 'DIVIDEND':
                print(f"  Dividend amount calculated: ${dividend_amount:.2f}")
            
            # Allow extended transaction types
            if transaction_type not in ['BUY', 'SELL', 'DIVIDEND', 'TRANSFER', 'SPLIT', 'REVERSE_SPLIT', 'INTEREST', 'NAME_CHANGE', 'CASH_IN_LIEU']:
                print(f"  SKIPPED: Transaction type '{transaction_type}' not supported")
                skipped_count += 1
                continue
            
            # Clean up quantity and price
            clean_quantity = 0
            if quantity and quantity.strip():
                try:
                    # For SELL transactions, preserve negative quantities if they exist
                    # Schwab CSV often has negative quantities for sells
                    raw_quantity = quantity.strip()
                    if transaction_type == 'SELL' and raw_quantity.startswith('-'):
                        # Keep negative quantity for sells
                        clean_quantity = float(raw_quantity)
                        print(f"  Clean quantity (SELL, negative): {clean_quantity}")
                    else:
                        # For all other types, use absolute value
                        clean_quantity = abs(float(raw_quantity))
                        print(f"  Clean quantity: {clean_quantity}")
                except ValueError:
                    # For dividends, quantity might be empty
                    if transaction_type == 'DIVIDEND':
                        clean_quantity = 0
                        print(f"  Clean quantity (dividend): {clean_quantity}")
                    else:
                        print(f"  SKIPPED: Invalid quantity value: '{quantity}'")
                        skipped_count += 1
                        continue
            else:
                # For dividends, quantity is often empty but that's okay
                if transaction_type == 'DIVIDEND':
                    clean_quantity = 0
                    print(f"  Clean quantity (dividend, empty): {clean_quantity}")
                else:
                    print(f"  Clean quantity (empty): {clean_quantity}")
            
            clean_price = 0
            if price and price.strip():
                # Remove dollar sign and convert to float
                clean_price = float(price.replace('$', '').replace(',', ''))
                print(f"  Clean price: {clean_price}")
            else:
                print(f"  Clean price (empty): {clean_price}")
            
            # Parse cash amount from Amount column (used for dividends, interest, transfers, cash in lieu)
            cash_amount = 0
            if amount and amount.strip():
                try:
                    cash_amount = float(amount.replace('$', '').replace(',', ''))
                except ValueError:
                    cash_amount = 0

            # For dividends, use the calculated dividend amount as the price
            if transaction_type == 'DIVIDEND':
                clean_price = dividend_amount
                print(f"  Clean price (dividend amount): {clean_price}")
            # For cash-based non-dividend transactions, use Amount column
            elif transaction_type in ['INTEREST', 'TRANSFER', 'CASH_IN_LIEU']:
                clean_price = cash_amount
                print(f"  Clean price (cash amount for {transaction_type}): {clean_price}")
            
            # Determine symbol value: some cash rows have empty symbol
            symbol_value = symbol.upper() if symbol else ('CASH' if transaction_type in ['INTEREST', 'TRANSFER'] else 'UNKNOWN')

            transaction_data = {
                'user_id': user_id,
                'date': date,
                'symbol': symbol_value,
                'transaction_type': transaction_type,
                'quantity': clean_quantity,
                'price': clean_price
            }
            
            print(f"  Transaction data: {transaction_data}")
            transactions.append(transaction_data)
            print(f"  ✓ ADDED to transactions list")
            
        except Exception as e:
            print(f"  ERROR parsing row: {e}")
            import traceback
            traceback.print_exc()
            skipped_count += 1
            continue
    
    print(f"\n=== SCHWAB PARSER COMPLETED ===")
    print(f"Total rows processed: {row_count}")
    print(f"Rows skipped: {skipped_count}")
    print(f"Transactions created: {len(transactions)}")
    
    return transactions

@app.route('/portfolio-value-over-time', methods=['GET'])
@jwt_required()
def portfolio_value_over_time():
    try:
        current_user_id = int(get_jwt_identity())
        print(f"=== PORTFOLIO VALUE OVER TIME REQUEST ===")
        print(f"User ID: {current_user_id}")
        
        db = get_db()
        cursor = db.cursor()
        
        # Get all transactions for the user, ordered by date
        cursor.execute('''
            SELECT transaction_date, transaction_type, symbol, quantity, price
            FROM transactions 
            WHERE user_id = ?
            ORDER BY transaction_date ASC
        ''', (current_user_id,))
        
        transactions = cursor.fetchall()
        print(f"Found {len(transactions)} transactions")
        
        if not transactions:
            return jsonify({
                'portfolio_values': [],
                'message': 'No transactions found'
            }), 200
        
        transactions = reversed(transactions)

        # Calculate portfolio value over time
        portfolio_values = calculate_portfolio_value_over_time(transactions)
        
        print(f"Calculated {len(portfolio_values)} portfolio value points")
        
        return jsonify({
            'portfolio_values': portfolio_values,
            'message': 'Portfolio values calculated successfully'
        }), 200
        
    except Exception as e:
        print(f"PORTFOLIO VALUE ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to calculate portfolio values'}), 500

def calculate_portfolio_value_over_time(transactions):
    """
    Calculate portfolio value over time based on transaction history
    Returns list of {date, value} objects
    """
    from datetime import datetime
    import re
    import yfinance as yf
    
    print(f"=== CALCULATING PORTFOLIO VALUES ===")
    
    # First, calculate current holdings from all transactions
    print("Calculating current holdings from transaction history...")
    current_holdings = {}  # symbol -> quantity
    
    for transaction in transactions:
        date_str, transaction_type, symbol, quantity, price = transaction
        
        if symbol not in current_holdings:
            current_holdings[symbol] = 0.0
        
        if transaction_type == 'BUY':
            current_holdings[symbol] += quantity
        elif transaction_type == 'SELL':
            current_holdings[symbol] -= quantity
        elif transaction_type in ['SPLIT', 'REVERSE_SPLIT']:
            if transaction_type == 'SPLIT':
                current_holdings[symbol] *= 10
            elif transaction_type == 'REVERSE_SPLIT':
                current_holdings[symbol] /= 10
        elif transaction_type == 'CASH_IN_LIEU':
            current_holdings[symbol] = 0
    
    # Filter to only positive holdings (stocks we currently own)
    active_holdings = {sym: qty for sym, qty in current_holdings.items() if qty > 0}
    
    print(f"Current holdings: {active_holdings}")
    
    # Get real-time prices ONLY for stocks we currently own
    symbol_prices = {}
    if active_holdings:
        try:
            print("Fetching real-time prices for current holdings from Yahoo Finance...")
            # Only fetch prices for symbols we currently own
            symbols_to_price = [sym for sym in active_holdings.keys() if sym != 'CASH']
            
            if symbols_to_price:
                tickers = yf.Tickers(' '.join(symbols_to_price))
                for symbol in symbols_to_price:
                    try:
                        ticker = tickers.tickers[symbol]
                        info = ticker.info
                        if 'regularMarketPrice' in info and info['regularMarketPrice']:
                            symbol_prices[symbol] = info['regularMarketPrice']
                            print(f"  {symbol}: ${symbol_prices[symbol]:.2f}")
                        else:
                            # Fallback to last price
                            hist = ticker.history(period="1d")
                            if not hist.empty:
                                symbol_prices[symbol] = hist['Close'].iloc[-1]
                                print(f"  {symbol}: ${symbol_prices[symbol]:.2f} (last close)")
                            else:
                                symbol_prices[symbol] = 100.0  # Fallback price
                                print(f"  {symbol}: $100.00 (fallback)")
                    except Exception as e:
                        print(f"  Error fetching price for {symbol}: {e}")
                        symbol_prices[symbol] = 100.0  # Fallback price
        except Exception as e:
            print(f"Error fetching prices: {e}")
            # Set fallback prices if API fails
            for symbol in symbols_to_price:
                symbol_prices[symbol] = 100.0
    
    # Track holdings for each symbol over time
    holdings = {}  # symbol -> quantity
    portfolio_values = []
    
    # Process transactions chronologically
    for transaction in transactions:
        date_str, transaction_type, symbol, quantity, price = transaction
        
        # Parse date (handle Schwab's "as of" format)
        if " as of " in date_str:
            effective_date = date_str.split(" as of ")[1].strip()
        else:
            effective_date = date_str.strip()
        
        # Convert date to datetime for sorting
        try:
            date_obj = datetime.strptime(effective_date, '%m/%d/%Y')
        except ValueError:
            print(f"Warning: Could not parse date '{effective_date}', skipping transaction")
            continue
        
        # Initialize symbol holdings if not exists
        if symbol not in holdings:
            holdings[symbol] = 0.0
        
        # Update holdings based on transaction type
        if transaction_type == 'BUY':
            holdings[symbol] += quantity
            print(f"  {effective_date}: BUY {quantity} {symbol} @ ${price:.2f} -> Holdings: {holdings[symbol]:.4f}")
        elif transaction_type == 'SELL':
            holdings[symbol] -= quantity
            print(f"  {effective_date}: SELL {quantity} {symbol} @ ${price:.2f} -> Holdings: {holdings[symbol]:.4f}")
        elif transaction_type == 'DIVIDEND':
            # Dividends don't change quantity, just add cash value
            print(f"  {effective_date}: DIVIDEND {symbol} ${price:.2f} -> Holdings: {holdings[symbol]:.4f}")
        elif transaction_type in ['SPLIT', 'REVERSE_SPLIT']:
            # Handle stock splits (quantity changes but no price impact)
            if transaction_type == 'SPLIT':
                # For splits, quantity increases proportionally
                if quantity > 0:
                    holdings[symbol] *= (1 + quantity)
            else:  # REVERSE_SPLIT
                # For reverse splits, quantity decreases proportionally
                if quantity < 0:
                    holdings[symbol] *= (1 + quantity)
            print(f"  {effective_date}: {transaction_type} {symbol} -> Holdings: {holdings[symbol]:.4f}")
        
        # Calculate current portfolio value using real-time prices for current holdings
        current_value = 0.0
        for sym, qty in holdings.items():
            if qty > 0:  # Only count positive holdings
                if sym == 'CASH':
                    # For cash holdings, use the amount directly
                    current_value += qty
                elif sym in symbol_prices:
                    # Use real-time price from Yahoo Finance (only for stocks we currently own)
                    current_value += qty * symbol_prices[sym]
                else:
                    # For stocks we no longer own, use transaction price as historical reference
                    current_value += qty * price
        
        portfolio_values.append({
            'date': effective_date,
            'value': round(current_value, 2),
            'holdings_summary': {sym: round(qty, 4) for sym, qty in holdings.items() if qty > 0}
        })
        
        print(f"  Portfolio value: ${current_value:.2f}")
    
    # Sort by date and remove duplicates (keep latest value per date)
    portfolio_values.sort(key=lambda x: datetime.strptime(x['date'], '%m/%d/%Y'))
    
    # Remove duplicate dates, keeping the latest value
    unique_values = []
    seen_dates = set()
    for value in reversed(portfolio_values):
        if value['date'] not in seen_dates:
            unique_values.append(value)
            seen_dates.add(value['date'])
    
    unique_values.reverse()  # Put back in chronological order
    
    print(f"Final portfolio values: {len(unique_values)} unique date points")
    for value in unique_values[-5:]:  # Show last 5 values
        print(f"  {value['date']}: ${value['value']:.2f}")
    
    return unique_values

@app.route('/current-portfolio-value', methods=['GET'])
@jwt_required()
def current_portfolio_value():
    try:
        current_user_id = int(get_jwt_identity())
        print(f"=== CURRENT PORTFOLIO VALUE REQUEST ===")
        print(f"User ID: {current_user_id}")
        
        db = get_db()
        cursor = db.cursor()
        
        # Get all current holdings for the user
        cursor.execute('''
            SELECT transaction_date, transaction_type, symbol, quantity, price
            FROM transactions 
            WHERE user_id = ?
            ORDER BY transaction_date ASC
        ''', (current_user_id,))
        
        transactions = cursor.fetchall()
        print(f"Found {len(transactions)} transactions")
        
        if not transactions:
            return jsonify({
                'current_value': 0.00,
                'holdings': {},
                'message': 'No transactions found'
            }), 200
        
        # Calculate current portfolio value
        current_value, holdings = calculate_current_portfolio_value(transactions)
        
        return jsonify({
            'current_value': round(current_value, 2),
            'holdings': holdings,
            'message': 'Current portfolio value calculated successfully'
        }), 200
        
    except Exception as e:
        print(f"CURRENT PORTFOLIO VALUE ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to calculate current portfolio value'}), 500

def calculate_current_portfolio_value(transactions):
    """
    Calculate current portfolio value using real-time prices
    Returns (total_value, holdings_dict)
    """
    import yfinance as yf
    
    print(f"=== CALCULATING CURRENT PORTFOLIO VALUE ===")
    
    # Track current holdings
    holdings = {}  # symbol -> quantity
    
    # Process all transactions to build current holdings
    for transaction in transactions:
        print(f"Processing transaction: {transaction}")
        transaction_date, transaction_type, symbol, quantity, price = transaction
        
        if symbol not in holdings:
            holdings[symbol] = 0.0
        
        print(f"  Before: {symbol} = {holdings[symbol]}")
        
        if transaction_type == 'BUY':
            holdings[symbol] += quantity
            print(f"  BUY: +{quantity} -> {holdings[symbol]}")
        elif transaction_type == 'SELL':
            # If quantity is already negative (from CSV), add it; otherwise subtract it
            if quantity < 0:
                holdings[symbol] += quantity  # Add negative = subtract
                print(f"  SELL: +{quantity} (negative) -> {holdings[symbol]}")
            else:
                holdings[symbol] -= quantity  # Subtract positive
                print(f"  SELL: -{quantity} -> {holdings[symbol]}")
        elif transaction_type in ['SPLIT', 'REVERSE_SPLIT']:
            if transaction_type == 'SPLIT' and quantity > 0:
                holdings[symbol] *= (1 + quantity)
                print(f"  SPLIT: *{1 + quantity} -> {holdings[symbol]}")
            elif transaction_type == 'REVERSE_SPLIT' and quantity < 0:
                holdings[symbol] *= (1 + quantity)
                print(f"  REVERSE_SPLIT: *{1 + quantity} -> {holdings[symbol]}")
        
        print(f"  After: {symbol} = {holdings[symbol]}")
    
    # Filter to only positive holdings (stocks we currently own)
    current_holdings = {sym: qty for sym, qty in holdings.items() if qty > 0}
    
    print(f"Current holdings: {current_holdings}")
    
    # Get real-time prices ONLY for stocks we currently own
    total_value = 0.0
    holdings_with_prices = {}
    
    for symbol, quantity in current_holdings.items():
        if symbol == 'CASH':
            # Cash holdings
            holdings_with_prices[symbol] = {
                'quantity': quantity,
                'current_price': 1.00,
                'value': quantity
            }
            total_value += quantity
        else:
            try:
                # Fetch real-time price
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                if 'regularMarketPrice' in info and info['regularMarketPrice']:
                    current_price = info['regularMarketPrice']
                else:
                    # Fallback to last close price
                    hist = ticker.history(period="1d")
                    current_price = hist['Close'].iloc[-1] if not hist.empty else 100.0
                
                value = quantity * current_price
                holdings_with_prices[symbol] = {
                    'quantity': quantity,
                    'current_price': round(current_price, 2),
                    'value': round(value, 2)
                }
                total_value += value
                
                print(f"  {symbol}: {quantity} shares @ ${current_price:.2f} = ${value:.2f}")
                
            except Exception as e:
                print(f"  Error fetching price for {symbol}: {e}")
                # Use fallback price
                fallback_price = 100.0
                value = quantity * fallback_price
                holdings_with_prices[symbol] = {
                    'quantity': quantity,
                    'current_price': fallback_price,
                    'value': round(value, 2)
                }
                total_value += value
    
    print(f"Total portfolio value: ${total_value:.2f}")
    return total_value, holdings_with_prices

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
