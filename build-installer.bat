@echo off
echo Building StealthBrowser Installer...
echo.

REM Clean previous builds
echo Cleaning previous builds...
call npm run clean
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
echo.

REM Build the installer
echo Building Windows installer...
call npm run build-installer
echo.

REM Check if build was successful
if exist "dist\StealthBrowser-Setup-1.0.0.exe" (
    echo.
    echo ✅ Installer created successfully!
    echo 📁 Location: dist\StealthBrowser-Setup-1.0.0.exe
    echo.
    echo You can now distribute this installer file.
    echo.
    pause
) else (
    echo.
    echo ❌ Build failed! Check the error messages above.
    echo.
    pause
)
