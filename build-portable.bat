@echo off
echo Building StealthBrowser Portable Version...
echo.

REM Clean previous builds
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
echo.

REM Build portable version
echo Building portable executable...
call npm run build-simple
echo.

REM Check if build was successful
if exist "dist\StealthBrowser-Portable-1.0.0.exe" (
    echo.
    echo ✅ Portable version created successfully!
    echo 📁 Location: dist\StealthBrowser-Portable-1.0.0.exe
    echo.
    echo This is a portable version that doesn't require installation.
    echo Users can run it directly from any location.
    echo.
    pause
) else (
    echo.
    echo ❌ Build failed! Check the error messages above.
    echo.
    pause
)
