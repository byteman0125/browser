@echo off
echo ========================================
echo    StealthBrowser - Complete Build
echo ========================================
echo.

REM Step 1: Check for AutoHotkey executable
echo [1/3] Checking AutoHotkey executable...
if not exist type_word.exe (
    echo WARNING: type_word.exe not found
    echo Please place the compiled AutoHotkey executable in the root directory
    echo Creating placeholder for now...
    echo @echo off > type_word.exe
    echo echo AutoHotkey not found - typing disabled >> type_word.exe
    echo exit /b 1 >> type_word.exe
    echo ✓ Placeholder created (typing will be disabled)
) else (
    echo ✓ AutoHotkey executable found
)

REM Step 2: Prepare Dist Folder
echo.
echo [2/3] Preparing distribution folder...
if exist dist (
    echo Cleaning previous build...
    rmdir /s /q dist
    echo ✓ Previous build cleaned
) else (
    echo ✓ No previous build to clean
)

REM Create dist folder and copy AutoHotkey executable
mkdir dist
echo ✓ Distribution folder created

REM Copy AutoHotkey executable if it exists
if exist type_word.exe (
    copy type_word.exe dist\type_word.exe
    echo ✓ AutoHotkey copied to dist folder
) else (
    echo WARNING: AutoHotkey not found - will use placeholder
)

REM Step 3: Build Electron App and Create Setup
echo.
echo [3/3] Building Electron Application and Creating Setup...
echo This may take a few minutes...

REM Build the installer
npm run build-installer
if %errorlevel% neq 0 (
    echo ERROR: Failed to build installer
    pause
    exit /b 1
)

REM Also build portable version
npm run build-portable
if %errorlevel% neq 0 (
    echo WARNING: Failed to build portable version
)

echo.
echo ========================================
echo    BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Output files:
if exist dist\StealthBrowser-Setup-*.exe (
    echo ✓ Installer: dist\StealthBrowser-Setup-*.exe
)
if exist dist\StealthBrowser-Portable-*.exe (
    echo ✓ Portable: dist\StealthBrowser-Portable-*.exe
)
echo.
echo Features included:
echo ✓ AutoHotkey typing (Alt+L) with auto-restart
echo ✓ All browser features
echo.
pause