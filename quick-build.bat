@echo off
echo ========================================
echo    StealthBrowser Quick Build
echo ========================================
echo.

REM Clean and build
echo Cleaning previous builds...
if exist dist rmdir /s /q dist

echo Building Windows Portable...
call npm run build-portable

if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo    Build Completed!
echo ========================================
echo.
echo Portable executable created in dist folder:
dir /b dist\*.exe
echo.
echo You can now run the portable version!
echo.

REM Ask if user wants to run the app
set /p run_app="Run the application now? (y/n): "
if /i "%run_app%"=="y" (
    echo Starting StealthBrowser...
    start "" "dist\StealthBrowser-Portable-1.0.0.exe"
)

pause
