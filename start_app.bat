@echo off
title StockPulse — Smart Stock Monitoring Platform
echo.
echo  ========================================
echo   StockPulse - Smart Stock Monitor
echo  ========================================
echo.
echo  Setting up the application...
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo  [1/3] Creating virtual environment...
    python -m venv venv
) else (
    echo  [1/3] Virtual environment already exists.
)

:: Activate virtual environment
echo  [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

:: Install/update dependencies
echo  [3/3] Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo  ========================================
echo   Starting StockPulse...
echo   Open http://127.0.0.1:5000 in your browser
echo  ========================================
echo.

:: Launch the app
python app.py

pause
