# StockPulse — Smart Stock Monitoring Platform

> A lightweight, real-time stock portfolio manager and monitoring engine built with Flask, SQLite, and vanilla JavaScript.

As a senior engineer, I've designed StockPulse to be a frictionless, self-hosted web application that provides real-time equity tracking without the bloated overhead of modern heavy-weight frameworks. The goal was to build a clean, responsive, glassmorphic UI backed by a snappy Python/Flask server that directly integrates with Yahoo Finance's live tick data. 

Whether you need a daily driver to monitor your holdings, or a foundation to build automated trading alerts, this project delivers out of the box.

---

## ✨ Features

- **Live Smart Monitoring Engine:** Fetches real-time price updates from `yfinance` at 30-second intervals using Server-Sent Events (SSE). No browser refreshes required.
- **Dynamic Portfolio Manager:** Tracks your stock inventory. Automatically calculates weighted average costs if you buy the same ticker multiple times, and groups assets by sector.
- **Intelligent Alert System:** Set background Stop-Loss and Take-Profit thresholds. Triggers browser push notifications and audio cues the second a price boundary is crossed.
- **Market Status Awareness:** The backend mathematically determines if the NYSE is open, closed, or in extended hours based on UTC time, reflecting real-world market conditions.
- **Comprehensive Analytics:** Visualizes historical ticker data (line charts) and portfolio distribution (doughnut charts) using `Chart.js`.
- **Bulk Import & Export:** Drag-and-drop CSV uploads to rapidly populate your portfolio, and export your data directly to CSV or a formatted PDF.

---

## 🛠 Tech Stack

I intentionally chose a stack that balances rapid development with robust data handling:

**Backend:**
- **Python 3.10+**: Core language.
- **Flask**: A lightweight WSGI web application framework to handle routing and our RESTful API.
- **SQLAlchemy**: The Python SQL toolkit and ORM. Used to interact cleanly with an embedded SQLite database (`portfolio.db`).
- **yfinance**: Handles data scraping from Yahoo Finance for real-time stock prices, company info, and historical data.

**Frontend:**
- **HTML5 / Vanilla JS**: Native ES6 async/await fetches. No heavy React/Vue overhead.
- **Bootstrap 5**: Utilized strictly for the responsive grid and modal components.
- **Vanilla CSS3**: Custom glassmorphism design system utilizing CSS variables `--custom-tokens` for theming.
- **Chart.js**: Client-side rendering for analytics.

---

## 🏗 Architecture & Workflow

The application follows a standard Single-Page Application (SPA) feel, utilizing a clean REST API layer to decouple the UI from the database logic.

1. **Database Initialization:** On startup, `models.py` uses SQLAlchemy to bootstrap a local `portfolio.db` file if it doesn't already exist.
2. **REST API:** The UI communicates with `app.py` via structured JSON endpoints (`/api/holdings`, `/api/alerts`, `/api/portfolio/summary`).
3. **Data Hydration:** Upon loading `/portfolio`, JavaScript fetches the holdings. If `yfinance` has cached live price data (cached for 15s to prevent rate-limiting), the backend maps the current price to calculate real-time P&L margins.
4. **SSE Stream:** The `/api/stream` endpoint pushes a continuous stream of live prices and market status updates to the client via `EventSource` in `dashboard.js`.
5. **Alert Daemon:** Every time the SSE loop runs, or when the explicit `/api/alerts/check` endpoint is hit, active alerts are evaluated against the latest cached `yfinance` tick data.

---

## 🚀 Setup & Installation Guide

Running this on a fresh machine? I've streamlined the setup process so you can get the application running in seconds. 

### Prerequisites
- You must have **Python 3.8 or higher** installed and added to your system `PATH`.
- Git (optional, for cloning the repository).

### Step 1: Clone or Copy the Repository
Move the project folder to your desired location on your machine.

### Step 2: Run the Launch Script (Windows)
If you're on a Windows machine, I've provided a batch file that handles the entire virtual environment lifecycle for you.
1. Double-click the `start_app.bat` file in the project directory.
2. The script will automatically:
   - Create an isolated Python Virtual Environment (`venv`).
   - Install all required dependencies from `requirements.txt`.
   - Boot up the Flask server cleanly.
   - Open your default web browser to `http://127.0.0.1:5000`.

### Step 3: Manual Startup (Mac/Linux/Windows Terminal)
If you prefer setting up manually via the terminal:

1. **Open your terminal** and navigate to the project directory:
   ```bash
   cd /path/to/StockPulse
   ```
2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```
3. **Activate the virtual environment:**
   - **Windows:** `venv\Scripts\activate`
   - **Mac/Linux:** `source venv/bin/activate`
4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
5. **Start the background server:**
   ```bash
   python app.py
   ```
6. **Access the application:**
   Open your browser and navigate to `http://127.0.0.1:5000`.

---

## 💡 Usage Tips
- **Bulk CSV Upload:** When using the Bulk Upload feature, ensure your CSV file contains the following exact headers (case sensitive): `ticker`, `buy_price`, `quantity`, `date_purchased`, `sector`.
- **Browser Notifications:** The first time you load the dashboard, allow browser notifications inside your settings to ensure your Stop-Loss alerts can push native OS messages to your screen!

Enjoy the platform!
