import sqlite3

import yfinance as yf

from portfolio import get_holdings_by_ticker

HOLDINGS_LIST_ID = 'holdings'
HOLDINGS_LIST_NAME = 'My Holdings'
DEFAULT_RANGE = '1D'

RANGE_MAP = {
    '1D': ('1d', '5m'),
    '5D': ('5d', '30m'),
    '1M': ('1mo', '1d'),
    '6M': ('6mo', '1d'),
    'YTD': ('ytd', '1d'),
}


def _normalize_ticker(ticker):
    return ticker.strip().upper()


def normalize_range(range_param):
    key = (range_param or DEFAULT_RANGE).strip().upper()
    if key not in RANGE_MAP:
        return DEFAULT_RANGE
    return key


def _get_owned_list(db, user_id, list_id):
    return db.execute(
        '''
        SELECT id, user_id, name, created_at
        FROM tracker_lists
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL
        ''',
        (list_id, user_id),
    ).fetchone()


def get_lists(db, user_id):
    rows = db.execute(
        '''
        SELECT
            tl.id,
            tl.name,
            tl.created_at,
            COUNT(ts.id) AS stock_count
        FROM tracker_lists tl
        LEFT JOIN tracker_stocks ts ON ts.list_id = tl.id
        WHERE tl.user_id = ? AND tl.deleted_at IS NULL
        GROUP BY tl.id
        ORDER BY tl.created_at ASC, tl.id ASC
        ''',
        (user_id,),
    ).fetchall()

    result = []
    holdings = get_holdings_by_ticker(db, user_id)
    if holdings:
        result.append({
            'id': HOLDINGS_LIST_ID,
            'name': HOLDINGS_LIST_NAME,
            'list_type': 'holdings',
            'stock_count': len(holdings),
            'created_at': None,
        })

    for row in rows:
        item = dict(row)
        item['list_type'] = 'watchlist'
        result.append(item)

    return result


def create_list(db, user_id, name):
    name = name.strip()
    if not name:
        raise ValueError('List name is required')

    cursor = db.execute(
        'INSERT INTO tracker_lists (user_id, name) VALUES (?, ?)',
        (user_id, name),
    )
    db.commit()
    list_id = cursor.lastrowid
    row = db.execute(
        'SELECT id, name, created_at FROM tracker_lists WHERE id = ?',
        (list_id,),
    ).fetchone()
    result = dict(row)
    result['stock_count'] = 0
    result['list_type'] = 'watchlist'
    return result


def delete_list(db, user_id, list_id):
    if not _get_owned_list(db, user_id, list_id):
        return False

    cursor = db.execute(
        '''
        UPDATE tracker_lists
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL
        ''',
        (list_id, user_id),
    )
    db.commit()
    return cursor.rowcount > 0


def get_tickers(db, user_id, list_id):
    if not _get_owned_list(db, user_id, list_id):
        return None

    rows = db.execute(
        '''
        SELECT ticker, added_at
        FROM tracker_stocks
        WHERE list_id = ?
        ORDER BY added_at ASC, id ASC
        ''',
        (list_id,),
    ).fetchall()
    return [row['ticker'] for row in rows]


def add_stock(db, user_id, list_id, ticker):
    if not _get_owned_list(db, user_id, list_id):
        return None

    ticker = _normalize_ticker(ticker)
    if not ticker:
        raise ValueError('Ticker is required')

    if not validate_ticker(ticker):
        raise ValueError('Unknown ticker')

    existing = db.execute(
        'SELECT id FROM tracker_stocks WHERE list_id = ? AND ticker = ?',
        (list_id, ticker),
    ).fetchone()
    if existing:
        raise sqlite3.IntegrityError('Ticker already in list')

    db.execute(
        'INSERT INTO tracker_stocks (list_id, ticker) VALUES (?, ?)',
        (list_id, ticker),
    )
    db.commit()
    quotes = fetch_quotes([ticker])
    return quotes[0] if quotes else {'ticker': ticker, 'name': ticker}


def remove_stock(db, user_id, list_id, ticker):
    if not _get_owned_list(db, user_id, list_id):
        return False

    ticker = _normalize_ticker(ticker)
    cursor = db.execute(
        'DELETE FROM tracker_stocks WHERE list_id = ? AND ticker = ?',
        (list_id, ticker),
    )
    db.commit()
    return cursor.rowcount > 0


def search_tickers(query):
    query = query.strip()
    if not query:
        return []

    try:
        search = yf.Search(query, max_results=8)
        quotes = search.quotes or []
    except Exception:
        return []

    results = []
    for item in quotes:
        symbol = item.get('symbol')
        if not symbol:
            continue
        results.append({
            'symbol': symbol,
            'name': item.get('shortname') or item.get('longname') or symbol,
            'exchange': item.get('exchange'),
        })
    return results


def validate_ticker(ticker):
    ticker = _normalize_ticker(ticker)
    if not ticker:
        return False

    try:
        info = yf.Ticker(ticker).fast_info
        price = getattr(info, 'last_price', None)
        if price is None and hasattr(info, 'get'):
            price = info.get('lastPrice') or info.get('regularMarketPrice')
        if price is not None:
            return True

        details = yf.Ticker(ticker).info
        return bool(details.get('symbol') or details.get('regularMarketPrice'))
    except Exception:
        return False


def _timestamp_iso(timestamp):
    try:
        if hasattr(timestamp, 'tzinfo') and timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize('America/New_York')
        if hasattr(timestamp, 'tz_convert'):
            timestamp = timestamp.tz_convert('UTC')
        if hasattr(timestamp, 'isoformat'):
            return timestamp.isoformat()
    except Exception:
        pass
    return str(timestamp)


def _fetch_history(ticker_obj, range_key):
    period, interval = RANGE_MAP[range_key]
    try:
        history = ticker_obj.history(period=period, interval=interval)
        if history.empty and range_key == '1D':
            history = ticker_obj.history(period='1d', interval='15m')
        if history.empty:
            return []

        points = []
        for timestamp, row in history.iterrows():
            close = row.get('Close')
            if close is None:
                continue
            price = float(close)
            if price != price:
                continue
            points.append({'at': _timestamp_iso(timestamp), 'price': round(price, 2)})
        return points
    except Exception:
        return []


def _range_change_from_history(history_points):
    if len(history_points) < 2:
        return None, None
    first = history_points[0]['price']
    last = history_points[-1]['price']
    if not first:
        return None, None
    change = round(last - first, 2)
    change_pct = round((change / first) * 100, 2)
    return change, change_pct


def _quote_from_ticker(ticker_obj, ticker, range_key=DEFAULT_RANGE):
    name = ticker
    price = None
    change = None
    change_pct = None

    try:
        fast = ticker_obj.fast_info
        if hasattr(fast, 'last_price'):
            price = fast.last_price
        elif hasattr(fast, 'get'):
            price = fast.get('lastPrice') or fast.get('regularMarketPrice')

        if hasattr(fast, 'regular_market_change'):
            change = fast.regular_market_change
        elif hasattr(fast, 'get'):
            change = fast.get('regularMarketChange')

        if hasattr(fast, 'regular_market_change_percent'):
            change_pct = fast.regular_market_change_percent
        elif hasattr(fast, 'get'):
            change_pct = fast.get('regularMarketChangePercent')
    except Exception:
        pass

    if price is None or name == ticker:
        try:
            info = ticker_obj.info
            if price is None:
                price = info.get('regularMarketPrice') or info.get('currentPrice')
            if change is None:
                change = info.get('regularMarketChange')
            if change_pct is None:
                change_pct = info.get('regularMarketChangePercent')
            name = info.get('shortName') or info.get('longName') or ticker
        except Exception:
            pass

    history = _fetch_history(ticker_obj, range_key)

    if range_key != '1D' and history:
        range_change, range_change_pct = _range_change_from_history(history)
        if range_change is not None:
            change = range_change
            change_pct = range_change_pct

    return {
        'ticker': ticker,
        'name': name,
        'price': price,
        'change': change,
        'change_pct': change_pct,
        'history': history,
        'intraday': history,
    }


def fetch_quotes(tickers, range_key=DEFAULT_RANGE):
    if not tickers:
        return []

    range_key = normalize_range(range_key)
    normalized = [_normalize_ticker(t) for t in tickers]
    quotes = []

    for ticker in normalized:
        try:
            quotes.append(_quote_from_ticker(yf.Ticker(ticker), ticker, range_key))
        except Exception:
            quotes.append({
                'ticker': ticker,
                'name': ticker,
                'price': None,
                'change': None,
                'change_pct': None,
                'history': [],
                'intraday': [],
            })

    return quotes


def get_stocks_with_quotes(db, user_id, list_id, range_key=DEFAULT_RANGE):
    tickers = get_tickers(db, user_id, list_id)
    if tickers is None:
        return None
    return fetch_quotes(tickers, range_key)


def get_holdings_stocks_with_quotes(db, user_id, range_key=DEFAULT_RANGE):
    holdings_by_ticker = get_holdings_by_ticker(db, user_id)
    if not holdings_by_ticker:
        return []

    tickers = sorted(holdings_by_ticker.keys())
    quotes = fetch_quotes(tickers, range_key)

    for quote in quotes:
        holding = holdings_by_ticker.get(quote['ticker'], {})
        quote['quantity'] = holding.get('quantity')
        quote['market_value'] = holding.get('market_value')
        quote['unrealized_gain'] = holding.get('unrealized_gain')
        quote['unrealized_gain_pct'] = holding.get('unrealized_gain_pct')
        security_name = holding.get('name')
        if security_name and quote.get('name') == quote['ticker']:
            quote['name'] = security_name

    return quotes
