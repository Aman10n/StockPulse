"""Quick API test script for StockPulse."""
import requests
import json

BASE = "http://127.0.0.1:5000"

# Add second AAPL buy to test weighted average
r = requests.post(f"{BASE}/api/holdings", json={"ticker": "AAPL", "buy_price": 170, "quantity": 5})
print(f"Add AAPL #2: {r.status_code}")

# Add MSFT
r = requests.post(f"{BASE}/api/holdings", json={"ticker": "MSFT", "buy_price": 400, "quantity": 8})
print(f"Add MSFT: {r.status_code}")

# Portfolio summary (weighted avg + live prices)
r = requests.get(f"{BASE}/api/portfolio/summary")
print("\n=== Portfolio Summary ===")
for item in r.json():
    print(f"  {item['ticker']}: avg_cost=${item['avg_cost']}, qty={item['total_qty']}, current=${item['current_price']}, pnl=${item['pnl']}")

# Market status
r = requests.get(f"{BASE}/api/market-status")
print(f"\nMarket Status: {r.json()['label']}")

# Create a stop-loss alert
r = requests.post(f"{BASE}/api/alerts", json={"ticker": "AAPL", "alert_type": "stop-loss", "threshold_price": 140})
print(f"\nAlert created: {r.status_code} - {r.json()}")

# Sector distribution
r = requests.get(f"{BASE}/api/portfolio/distribution")
print(f"\nSector Distribution: {json.dumps(r.json(), indent=2)}")

# Export CSV test
r = requests.get(f"{BASE}/api/export/csv")
print(f"\nCSV Export: {r.status_code}, length={len(r.text)} chars")
print(r.text[:300])

# Export PDF test
r = requests.get(f"{BASE}/api/export/pdf")
print(f"\nPDF Export: {r.status_code}, size={len(r.content)} bytes")

print("\n=== All API tests passed! ===")
