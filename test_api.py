"""API regression tests for StockPulse."""
import io
import os

os.environ['DATABASE_URL'] = 'sqlite:///test_stockpulse.db'

import pytest

import app as stockpulse
from models import Alert, Holding, SessionLocal


@pytest.fixture(autouse=True)
def clean_database():
    db = SessionLocal()
    db.query(Alert).delete()
    db.query(Holding).delete()
    db.commit()
    db.close()
    yield


@pytest.fixture()
def client():
    stockpulse.app.config.update(TESTING=True)
    return stockpulse.app.test_client()


def test_health_and_pages(client):
    health = client.get('/api/health')
    assert health.status_code == 200
    assert health.get_json()['status'] == 'ok'
    for route in ('/', '/portfolio', '/alerts', '/analytics'):
        assert client.get(route).status_code == 200


def test_holding_crud_and_validation(client, monkeypatch):
    monkeypatch.setattr(stockpulse, '_get_ticker_info', lambda ticker: {
        'name': 'Apple Inc.', 'sector': 'Technology'
    })
    invalid = client.post('/api/holdings', json={
        'ticker': 'AAPL', 'buy_price': -10, 'quantity': 2
    })
    assert invalid.status_code == 400

    created = client.post('/api/holdings', json={
        'ticker': 'aapl', 'buy_price': 170, 'quantity': 5,
        'date_purchased': '2026-01-15'
    })
    assert created.status_code == 201
    holding = created.get_json()
    assert holding['ticker'] == 'AAPL'
    assert len(client.get('/api/holdings').get_json()) == 1

    updated = client.put(f"/api/holdings/{holding['id']}", json={'quantity': 8})
    assert updated.status_code == 200
    assert updated.get_json()['quantity'] == 8
    assert client.delete(f"/api/holdings/{holding['id']}").status_code == 200


def test_summary_alerts_and_exports(client, monkeypatch):
    monkeypatch.setattr(stockpulse, '_get_ticker_info', lambda ticker: {
        'name': ticker, 'sector': 'Technology'
    })
    monkeypatch.setattr(stockpulse, '_fetch_live_prices', lambda tickers: {
        ticker: 200.0 for ticker in tickers
    })
    client.post('/api/holdings', json={
        'ticker': 'AAPL', 'buy_price': 150, 'quantity': 2,
        'name': 'Apple Inc.', 'sector': 'Technology'
    })
    summary = client.get('/api/portfolio/summary').get_json()
    assert summary[0]['market_value'] == 400.0
    assert summary[0]['pnl'] == 100.0

    alert = client.post('/api/alerts', json={
        'ticker': 'AAPL', 'alert_type': 'take-profit', 'threshold_price': 190
    })
    assert alert.status_code == 201
    assert len(client.get('/api/alerts/check').get_json()) == 1
    assert client.get('/api/export/csv').status_code == 200
    assert client.get('/api/export/pdf').status_code == 200


def test_bulk_upload(client, monkeypatch):
    monkeypatch.setattr(stockpulse, '_get_ticker_info', lambda ticker: {
        'name': ticker, 'sector': 'Technology'
    })
    csv_data = b'ticker,buy_price,quantity,date_purchased,sector\nMSFT,400,3,2026-01-02,Technology\n'
    response = client.post(
        '/api/holdings/bulk',
        data={'file': (io.BytesIO(csv_data), 'holdings.csv')},
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    assert response.get_json()['created'] == 1
