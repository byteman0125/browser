@echo off
echo ========================================
echo    StealthBrowser Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not available
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully!
echo.

REM Clean previous builds
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo ========================================
echo    Build Options
echo ========================================
echo.
echo 1. Build Windows Installer (NSIS)
echo 2. Build Windows Portable
echo 3. Build All Windows Formats
echo 4. Build Linux AppImage
echo 5. Build All Platforms
echo 6. Development Mode (Run without building)
echo 7. Exit
echo.

set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto build_installer
if "%choice%"=="2" goto build_portable
if "%choice%"=="3" goto build_all_win
if "%choice%"=="4" goto build_linux
if "%choice%"=="5" goto build_all
if "%choice%"=="6" goto dev_mode
if "%choice%"=="7" goto end
goto invalid_choice

:build_installer
echo.
echo Building Windows Installer...
call npm run build-installer
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
goto build_success

:build_portable
echo.
echo Building Windows Portable...
call npm run build-portable
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
goto build_success

:build_all_win
echo.
echo Building All Windows Formats...
call npm run build-win
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
goto build_success

:build_linux
echo.
echo Building Linux AppImage...
call electron-builder --linux
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
goto build_success

:build_all
echo.
echo Building All Platforms...
call npm run dist
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
goto build_success

:dev_mode
echo.
echo Starting Development Mode...
echo Press Ctrl+C to stop the application
call npm start
goto end

:build_success
echo.
echo ========================================
echo    Build Completed Successfully!
echo ========================================
echo.
echo Output files are in the 'dist' folder:
if exist dist\*.exe (
    echo Windows executables:
    dir /b dist\*.exe
)
if exist dist\*.AppImage (
    echo Linux AppImage:
    dir /b dist\*.AppImage
)
echo.
echo You can now distribute these files!
echo.

REM Ask if user wants to open dist folder
set /p open_folder="Open dist folder? (y/n): "
if /i "%open_folder%"=="y" (
    explorer dist
)

goto end

:invalid_choice
echo.
echo Invalid choice. Please run the script again.
pause
exit /b 1

:end
echo.
echo Setup completed!
pause
