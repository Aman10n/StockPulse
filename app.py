"""
Smart Stock Monitoring Platform — Main Flask Application
=========================================================
Serves the web UI and provides REST API endpoints for portfolio
management, live prices, smart alerts, analytics, and exports.
"""
import os
import csv
import io
import json
import re
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import (
    Flask, render_template, request, jsonify, Response, send_file, stream_with_context
)
from flask_cors import CORS
import yfinance as yf
from fpdf import FPDF
from dotenv import load_dotenv

from models import init_db, SessionLocal, Holding, Alert

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
load_dotenv()

APP_VERSION = '2.0.0'
app = Flask(__name__)
app.config.update(JSON_SORT_KEYS=False, MAX_CONTENT_LENGTH=2 * 1024 * 1024)
CORS(app, resources={r'/api/*': {'origins': '*'}})
init_db()

# Simple in-memory price cache (ticker -> {price, timestamp})
_price_cache: dict = {}
CACHE_TTL = int(os.getenv('PRICE_CACHE_TTL', '15'))
TICKER_PATTERN = re.compile(r'^[A-Z][A-Z0-9.\-]{0,9}$')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
SECTOR_CHOICES = [
    'Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer Goods',
    'Industrials', 'Utilities', 'Real Estate', 'Telecommunications',
    'Materials', 'Uncategorized',
]


def _fetch_live_prices(tickers: list[str]) -> dict:
    """Return {ticker: current_price} using yfinance with caching."""
    now = time.time()
    result = {}
    to_fetch = []

    for t in tickers:
        cached = _price_cache.get(t)
        if cached and (now - cached['ts'] < CACHE_TTL):
            result[t] = cached['price']
        else:
            to_fetch.append(t)

    if to_fetch:
        try:
            data = yf.download(to_fetch, period='1d', interval='1m',
                               progress=False, threads=True)
            if not data.empty:
                if len(to_fetch) == 1:
                    ticker = to_fetch[0]
                    last = data['Close'].dropna()
                    if not last.empty:
                        price = float(last.iloc[-1])
                        result[ticker] = price
                        _price_cache[ticker] = {'price': price, 'ts': now}
                else:
                    close = data['Close']
                    for ticker in to_fetch:
                        if ticker in close.columns:
                            last = close[ticker].dropna()
                            if not last.empty:
                                price = float(last.iloc[-1])
                                result[ticker] = price
                                _price_cache[ticker] = {'price': price, 'ts': now}
        except Exception:
            pass  # Graceful degradation

    return result


def _get_market_status() -> dict:
    """Return a timezone-aware approximation of US equity market hours."""
    now_et = datetime.now(timezone.utc).astimezone(ZoneInfo('America/New_York'))
    et_hour = now_et.hour
    et_min = now_et.minute
    weekday = now_et.weekday()

    if weekday >= 5:
        return {'status': 'closed', 'label': 'Market Closed (Weekend)'}

    et_time = et_hour * 60 + et_min
    if et_time < 4 * 60:  # before 4 AM
        return {'status': 'closed', 'label': 'Market Closed'}
    elif et_time < 9 * 60 + 30:  # 4 AM — 9:30 AM
        return {'status': 'pre-market', 'label': 'Pre-Market Trading'}
    elif et_time < 16 * 60:  # 9:30 AM — 4:00 PM
        return {'status': 'open', 'label': 'Market Open'}
    elif et_time < 20 * 60:  # 4 PM — 8 PM
        return {'status': 'post-market', 'label': 'After-Hours Trading'}
    else:
        return {'status': 'closed', 'label': 'Market Closed'}


def _get_ticker_info(ticker_symbol: str) -> dict:
    """Fetch ticker name and sector from yfinance."""
    try:
        tk = yf.Ticker(ticker_symbol)
        info = tk.info
        return {
            'name': info.get('shortName', info.get('longName', ticker_symbol)),
            'sector': info.get('sector', 'Uncategorized'),
        }
    except Exception:
        return {'name': ticker_symbol, 'sector': 'Uncategorized'}


def _positive_number(value, field_name: str) -> float:
    """Parse and validate a positive numeric API field."""
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{field_name} must be a number') from exc
    if parsed <= 0:
        raise ValueError(f'{field_name} must be greater than zero')
    return parsed


def _ticker_symbol(value) -> str:
    """Normalize a ticker and reject malformed symbols early."""
    ticker = str(value or '').upper().strip()
    if not TICKER_PATTERN.fullmatch(ticker):
        raise ValueError('ticker must be 1-10 letters, numbers, dots, or hyphens')
    return ticker


def _purchase_date(value) -> str:
    """Return an ISO purchase date, defaulting to today when omitted."""
    date_value = value or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    try:
        parsed = datetime.strptime(str(date_value), '%Y-%m-%d').date()
    except (TypeError, ValueError) as exc:
        raise ValueError('date_purchased must use YYYY-MM-DD') from exc
    if parsed > datetime.now(timezone.utc).date():
        raise ValueError('date_purchased cannot be in the future')
    return parsed.isoformat()


@app.after_request
def add_security_headers(response):
    """Apply safe browser defaults to every response."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response


# ---------------------------------------------------------------------------
# Page Routes
# ---------------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('dashboard.html')


@app.route('/portfolio')
def portfolio_page():
    return render_template('portfolio.html')


@app.route('/alerts')
def alerts_page():
    return render_template('alerts.html')


@app.route('/analytics')
def analytics_page():
    return render_template('analytics.html')


@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'stockpulse',
        'version': APP_VERSION,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------------------
# API — Holdings (Portfolio)
# ---------------------------------------------------------------------------
@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    db = SessionLocal()
    try:
        holdings = db.query(Holding).order_by(Holding.ticker).all()
        return jsonify([h.to_dict() for h in holdings])
    finally:
        db.close()


@app.route('/api/holdings', methods=['POST'])
def add_holding():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        ticker = _ticker_symbol(data.get('ticker'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    buy_price = data.get('buy_price')
    quantity = data.get('quantity')

    if buy_price is None or quantity is None:
        return jsonify({'error': 'ticker, buy_price and quantity are required'}), 400

    try:
        buy_price = _positive_number(buy_price, 'buy_price')
        quantity = _positive_number(quantity, 'quantity')
        date_purchased = _purchase_date(data.get('date_purchased'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    sector = (data.get('sector') or '').strip()
    name = (data.get('name') or '').strip()

    # Auto-fill name/sector from yfinance if not supplied
    if not name or not sector or sector == 'Uncategorized':
        info = _get_ticker_info(ticker)
        if not name:
            name = info['name']
        if not sector or sector == 'Uncategorized':
            sector = info['sector']

    db = SessionLocal()
    try:
        holding = Holding(
            ticker=ticker,
            name=name,
            sector=sector if sector else 'Uncategorized',
            buy_price=buy_price,
            quantity=quantity,
            date_purchased=date_purchased,
        )
        db.add(holding)
        db.commit()
        db.refresh(holding)
        return jsonify(holding.to_dict()), 201
    finally:
        db.close()


@app.route('/api/holdings/<int:holding_id>', methods=['PUT'])
def update_holding(holding_id):
    data = request.json
    db = SessionLocal()
    try:
        holding = db.query(Holding).filter(Holding.id == holding_id).first()
        if not holding:
            return jsonify({'error': 'Holding not found'}), 404

        if 'ticker' in data:
            holding.ticker = _ticker_symbol(data['ticker'])
        if 'name' in data:
            holding.name = data['name']
        if 'sector' in data:
            holding.sector = data['sector']
        if 'buy_price' in data:
            holding.buy_price = _positive_number(data['buy_price'], 'buy_price')
        if 'quantity' in data:
            holding.quantity = _positive_number(data['quantity'], 'quantity')
        if 'date_purchased' in data:
            holding.date_purchased = _purchase_date(data['date_purchased'])

        db.commit()
        db.refresh(holding)
        return jsonify(holding.to_dict())
    finally:
        db.close()


@app.route('/api/holdings/<int:holding_id>', methods=['DELETE'])
def delete_holding(holding_id):
    db = SessionLocal()
    try:
        holding = db.query(Holding).filter(Holding.id == holding_id).first()
        if not holding:
            return jsonify({'error': 'Holding not found'}), 404
        db.delete(holding)
        db.commit()
        return jsonify({'message': 'Deleted'})
    finally:
        db.close()


@app.route('/api/holdings/bulk', methods=['POST'])
def bulk_upload():
    """Accept a CSV file with columns: ticker, buy_price, quantity, date_purchased, sector."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are accepted'}), 400

    stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
    reader = csv.DictReader(stream)
    created = []
    errors = []

    db = SessionLocal()
    try:
        for i, row in enumerate(reader, start=2):
            try:
                ticker = _ticker_symbol(row.get('ticker'))
                buy_price = _positive_number(row.get('buy_price'), 'buy_price')
                quantity = _positive_number(row.get('quantity'), 'quantity')
                date_purchased = _purchase_date(row.get('date_purchased'))
                info = _get_ticker_info(ticker)
                holding = Holding(
                    ticker=ticker,
                    name=row.get('name', '').strip() or info['name'],
                    sector=row.get('sector', '').strip() or info['sector'],
                    buy_price=buy_price,
                    quantity=quantity,
                    date_purchased=date_purchased,
                )
                db.add(holding)
                created.append(ticker)
            except Exception as e:
                errors.append(f'Row {i}: {str(e)}')

        db.commit()
        return jsonify({'created': len(created), 'tickers': created, 'errors': errors})
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API — Aggregated Portfolio (weighted avg per ticker)
# ---------------------------------------------------------------------------
@app.route('/api/portfolio/summary', methods=['GET'])
def portfolio_summary():
    """Return aggregated holdings with weighted average cost per ticker."""
    db = SessionLocal()
    try:
        holdings = db.query(Holding).order_by(Holding.ticker).all()
        agg: dict = {}
        for h in holdings:
            if h.ticker not in agg:
                agg[h.ticker] = {
                    'ticker': h.ticker,
                    'name': h.name,
                    'sector': h.sector,
                    'total_qty': 0,
                    'total_cost': 0,
                    'entries': [],
                }
            agg[h.ticker]['total_qty'] += h.quantity
            agg[h.ticker]['total_cost'] += h.buy_price * h.quantity
            agg[h.ticker]['entries'].append(h.to_dict())

        tickers = list(agg.keys())
        prices = _fetch_live_prices(tickers) if tickers else {}

        result = []
        for t, info in agg.items():
            avg_cost = info['total_cost'] / info['total_qty'] if info['total_qty'] else 0
            current_price = prices.get(t)
            pnl = None
            pnl_pct = None
            market_value = None
            if current_price is not None:
                market_value = round(current_price * info['total_qty'], 2)
                pnl = round((current_price - avg_cost) * info['total_qty'], 2)
                pnl_pct = round(((current_price - avg_cost) / avg_cost) * 100, 2) if avg_cost else 0

            result.append({
                'ticker': t,
                'name': info['name'],
                'sector': info['sector'],
                'avg_cost': round(avg_cost, 2),
                'total_qty': round(info['total_qty'], 4),
                'total_invested': round(info['total_cost'], 2),
                'current_price': round(current_price, 2) if current_price else None,
                'market_value': market_value,
                'pnl': pnl,
                'pnl_pct': pnl_pct,
                'entries': info['entries'],
            })

        return jsonify(result)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API — Live Prices & Market Status
# ---------------------------------------------------------------------------
@app.route('/api/prices', methods=['GET'])
def get_prices():
    db = SessionLocal()
    try:
        tickers = [r[0] for r in db.query(Holding.ticker).distinct().all()]
    finally:
        db.close()

    if not tickers:
        return jsonify({})

    prices = _fetch_live_prices(tickers)
    return jsonify(prices)


@app.route('/api/market-status', methods=['GET'])
def market_status():
    return jsonify(_get_market_status())


@app.route('/api/stream')
def price_stream():
    """Server-Sent Events endpoint for live price updates."""
    def generate():
        while True:
            db = SessionLocal()
            try:
                tickers = [r[0] for r in db.query(Holding.ticker).distinct().all()]
            finally:
                db.close()

            if tickers:
                prices = _fetch_live_prices(tickers)
                market = _get_market_status()
                payload = json.dumps({'prices': prices, 'market': market})
                yield f"data: {payload}\n\n"

            time.sleep(30)  # Update every 30 seconds

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


# ---------------------------------------------------------------------------
# API — Alerts
# ---------------------------------------------------------------------------
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    db = SessionLocal()
    try:
        alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
        return jsonify([a.to_dict() for a in alerts])
    finally:
        db.close()


@app.route('/api/alerts', methods=['POST'])
def create_alert():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        ticker = _ticker_symbol(data.get('ticker'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    alert_type = data.get('alert_type', '').strip()
    threshold = data.get('threshold_price')

    if not ticker or alert_type not in ('stop-loss', 'take-profit') or threshold is None:
        return jsonify({'error': 'ticker, alert_type (stop-loss|take-profit), and threshold_price are required'}), 400

    try:
        threshold = _positive_number(threshold, 'threshold_price')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db = SessionLocal()
    try:
        alert = Alert(ticker=ticker, alert_type=alert_type, threshold_price=threshold)
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return jsonify(alert.to_dict()), 201
    finally:
        db.close()


@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return jsonify({'error': 'Alert not found'}), 404
        db.delete(alert)
        db.commit()
        return jsonify({'message': 'Deleted'})
    finally:
        db.close()


@app.route('/api/alerts/check', methods=['GET'])
def check_alerts():
    """Evaluate active alerts against current prices. Returns triggered alerts."""
    db = SessionLocal()
    try:
        active = db.query(Alert).filter(Alert.is_triggered == False).all()
        if not active:
            return jsonify([])

        tickers = list(set(a.ticker for a in active))
        prices = _fetch_live_prices(tickers)
        triggered = []

        for a in active:
            price = prices.get(a.ticker)
            if price is None:
                continue
            hit = False
            if a.alert_type == 'stop-loss' and price <= a.threshold_price:
                hit = True
            elif a.alert_type == 'take-profit' and price >= a.threshold_price:
                hit = True

            if hit:
                a.is_triggered = True
                a.triggered_at = datetime.now(timezone.utc)
                triggered.append({
                    **a.to_dict(),
                    'current_price': round(price, 2),
                })

        db.commit()
        return jsonify(triggered)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API — Analytics / History
# ---------------------------------------------------------------------------
@app.route('/api/history/<ticker>', methods=['GET'])
def get_history(ticker):
    try:
        ticker = _ticker_symbol(ticker)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    period = request.args.get('period', '1mo')  # 1d,5d,1mo,3mo,6mo,1y,2y,5y,max
    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(period=period)
        if hist.empty:
            return jsonify({'error': 'No data found'}), 404

        records = []
        for idx, row in hist.iterrows():
            records.append({
                'date': idx.strftime('%Y-%m-%d'),
                'open': round(row['Open'], 2),
                'high': round(row['High'], 2),
                'low': round(row['Low'], 2),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume']),
            })
        return jsonify(records)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/portfolio/distribution', methods=['GET'])
def portfolio_distribution():
    """Return sector breakdown of total invested value."""
    db = SessionLocal()
    try:
        holdings = db.query(Holding).all()
        sectors: dict = {}
        for h in holdings:
            s = h.sector or 'Uncategorized'
            sectors[s] = sectors.get(s, 0) + (h.buy_price * h.quantity)
        return jsonify(sectors)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API — Export
# ---------------------------------------------------------------------------
@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    db = SessionLocal()
    try:
        holdings = db.query(Holding).order_by(Holding.ticker).all()
    finally:
        db.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Ticker', 'Name', 'Sector', 'Buy Price', 'Quantity', 'Total Cost', 'Date Purchased'])
    for h in holdings:
        writer.writerow([h.ticker, h.name, h.sector, h.buy_price, h.quantity,
                         round(h.buy_price * h.quantity, 2), h.date_purchased])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=portfolio_export.csv'},
    )


@app.route('/api/export/pdf', methods=['GET'])
def export_pdf():
    db = SessionLocal()
    try:
        holdings = db.query(Holding).order_by(Holding.ticker).all()
    finally:
        db.close()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'Portfolio Report', new_x='LMARGIN', new_y='NEXT', align='C')
    pdf.set_font('Helvetica', '', 9)
    pdf.cell(0, 8, f'Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}',
             new_x='LMARGIN', new_y='NEXT', align='C')
    pdf.ln(5)

    # Table header
    pdf.set_font('Helvetica', 'B', 9)
    col_widths = [20, 40, 30, 25, 20, 28, 27]
    headers = ['Ticker', 'Name', 'Sector', 'Buy Price', 'Qty', 'Total Cost', 'Date']
    for w, h in zip(col_widths, headers):
        pdf.cell(w, 8, h, border=1, align='C')
    pdf.ln()

    pdf.set_font('Helvetica', '', 8)
    for h in holdings:
        vals = [h.ticker, (h.name or '')[:20], (h.sector or '')[:15],
                f'{h.buy_price:.2f}', f'{h.quantity:.2f}',
                f'{h.buy_price * h.quantity:.2f}', h.date_purchased or '']
        for w, v in zip(col_widths, vals):
            pdf.cell(w, 7, str(v), border=1, align='C')
        pdf.ln()

    buf = io.BytesIO(pdf.output())
    buf.seek(0)
    return send_file(buf, mimetype='application/pdf', download_name='portfolio_report.pdf', as_attachment=True)


# ---------------------------------------------------------------------------
# API — Sector list
# ---------------------------------------------------------------------------
@app.route('/api/sectors', methods=['GET'])
def get_sectors():
    return jsonify(SECTOR_CHOICES)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    print('\n  Smart Stock Monitoring Platform')
    print('  ================================')
    print('  Open http://127.0.0.1:5000 in your browser\n')
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.getenv('PORT', '5000'))
    app.run(debug=debug, port=port, threaded=True)
