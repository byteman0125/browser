@echo off
echo Building StealthBrowser Manually...
echo.

REM Clean previous builds
echo Cleaning previous builds...
call clean-dist.bat
echo.

REM Create dist directory
if not exist dist mkdir dist
if not exist dist\win-unpacked mkdir dist\win-unpacked

echo Copying application files...
REM Copy the main application
xcopy /E /I /Y src dist\win-unpacked\src
xcopy /E /I /Y assets dist\win-unpacked\assets
copy package.json dist\win-unpacked\
copy package-lock.json dist\win-unpacked\ 2>nul

echo Installing production dependencies...
cd dist\win-unpacked
call npm install --production
cd ..\..

echo Downloading Electron...
REM Download Electron for Windows x64
if not exist dist\electron-temp mkdir dist\electron-temp
cd dist\electron-temp

REM Download Electron (this is a simplified approach)
echo Please download Electron manually from:
echo https://github.com/electron/electron/releases/download/v27.3.11/electron-v27.3.11-win32-x64.zip
echo Extract it to dist\win-unpacked\ and rename electron.exe to StealthBrowser.exe
echo.
echo Or use the following PowerShell command:
echo Invoke-WebRequest -Uri "https://github.com/electron/electron/releases/download/v27.3.11/electron-v27.3.11-win32-x64.zip" -OutFile "electron.zip"
echo Expand-Archive -Path "electron.zip" -DestinationPath "..\win-unpacked" -Force
echo.

cd ..\..

echo.
echo Manual build setup completed!
echo.
echo Next steps:
echo 1. Download Electron from the URL above
echo 2. Extract to dist\win-unpacked\
echo 3. Rename electron.exe to StealthBrowser.exe
echo 4. Your portable browser will be ready!
echo.
pause
