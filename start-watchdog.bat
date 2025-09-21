@echo off
echo Starting StealthBrowser Watchdog...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js to run the watchdog
    pause
    exit /b 1
)

REM Start the watchdog process
echo Starting watchdog process...
node watchdog.js

echo.
echo Watchdog process ended.
pause
