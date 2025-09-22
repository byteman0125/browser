@echo off
echo ========================================
echo    StealthBrowser - Development Build
echo ========================================
echo.

REM Create placeholder for AutoHotkey (for development)
echo [1/2] Creating AutoHotkey placeholder...
if not exist type_word.exe (
    echo @echo off > type_word.exe
    echo echo AutoHotkey placeholder - typing disabled >> type_word.exe
    echo exit /b 1 >> type_word.exe
    echo ✓ AutoHotkey placeholder created
) else (
    echo ✓ AutoHotkey executable already exists
)

REM Create dist folder and copy AutoHotkey
echo.
echo [2/2] Preparing development environment...
if not exist dist mkdir dist
if exist type_word.exe (
    copy type_word.exe dist\type_word.exe
    echo ✓ AutoHotkey copied to dist folder
)

echo.
echo ========================================
echo    DEVELOPMENT BUILD COMPLETE!
echo ========================================
echo.
echo To start development:
echo 1. Run: npm start
echo 2. The app will start with all features
echo.
echo Note: For full typing functionality, replace type_word.exe
echo with your compiled AutoHotkey executable.
echo.
pause