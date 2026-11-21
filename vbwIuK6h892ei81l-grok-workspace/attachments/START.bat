@echo off
echo ========================================
echo   Car Poster Pro - Quick Start
echo ========================================
echo.

cd /d "%~dp0"

echo Checking for Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in PATH.
    echo Download it from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b
)

echo Installing dependencies (first time only)...
python -m pip install -r requirements.txt --quiet

echo.
echo Starting Car Poster Pro...
echo The app will open in your browser.
echo.
python -m streamlit run app.py

pause
