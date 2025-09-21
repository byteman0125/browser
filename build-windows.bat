@echo off
echo ========================================
echo    StealthBrowser Windows Builder
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed
echo.

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist dist (
    call clean-dist.bat
)
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully
echo.

REM Check for ICO file
if not exist "assets/icon.ico" (
    echo ⚠️  ICO file not found. Creating one...
    call create-icon.bat
    if not exist "assets/icon.ico" (
        echo ❌ Could not create ICO file. Please create assets/icon.ico manually.
        echo You can use an online converter like https://convertio.co/svg-ico/
        pause
        exit /b 1
    )
)

echo ✅ ICO file found: assets/icon.ico
echo.

REM Build the application
echo 🚀 Building StealthBrowser for Windows...
echo This will create both installer and portable versions...
echo.

call npm run build-win
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo ✅ Build completed successfully!
echo.

REM Check what was created
if exist "dist\StealthBrowser-Setup-1.0.0.exe" (
    echo 📁 Installer created: dist\StealthBrowser-Setup-1.0.0.exe
    for %%A in ("dist\StealthBrowser-Setup-1.0.0.exe") do echo    Size: %%~zA bytes
)

if exist "dist\StealthBrowser-Portable-1.0.0.exe" (
    echo 📁 Portable version: dist\StealthBrowser-Portable-1.0.0.exe
    for %%A in ("dist\StealthBrowser-Portable-1.0.0.exe") do echo    Size: %%~zA bytes
)

echo.
echo 🎉 Your StealthBrowser is ready for distribution!
echo.
echo 📋 What you can do now:
echo    • Share the installer with users for easy installation
echo    • Use the portable version for testing or USB distribution
echo    • Both versions run without requiring Node.js installation
echo.
echo 📁 Check the 'dist' folder for your executables.
echo.

REM Ask if user wants to open dist folder
set /p openFolder="Do you want to open the dist folder? (y/n): "
if /i "%openFolder%"=="y" (
    start "" "dist"
)

echo.
echo Build process completed!
pause
