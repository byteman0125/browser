# Simple StealthBrowser Build Script
Write-Host "Building StealthBrowser (Simple Method)..." -ForegroundColor Green
Write-Host ""

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
Write-Host ""

# Create directories
Write-Host "Creating build directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "dist" -Force | Out-Null
New-Item -ItemType Directory -Path "dist\win-unpacked" -Force | Out-Null
Write-Host ""

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
Copy-Item -Recurse -Force "src" "dist\win-unpacked\"
Copy-Item -Recurse -Force "assets" "dist\win-unpacked\"
Copy-Item -Force "package.json" "dist\win-unpacked\"
if (Test-Path "package-lock.json") {
    Copy-Item -Force "package-lock.json" "dist\win-unpacked\"
}
Write-Host ""

# Install production dependencies
Write-Host "Installing production dependencies..." -ForegroundColor Yellow
Set-Location "dist\win-unpacked"
npm install --production
Set-Location "..\.."
Write-Host ""

# Download Electron
Write-Host "Downloading Electron..." -ForegroundColor Yellow
$electronUrl = "https://github.com/electron/electron/releases/download/v27.3.11/electron-v27.3.11-win32-x64.zip"
$electronZip = "dist\electron.zip"

try {
    Invoke-WebRequest -Uri $electronUrl -OutFile $electronZip -UseBasicParsing
    Write-Host "Electron downloaded successfully" -ForegroundColor Green
    
    # Extract Electron
    Write-Host "Extracting Electron..." -ForegroundColor Yellow
    Expand-Archive -Path $electronZip -DestinationPath "dist\win-unpacked" -Force
    
    # Rename electron.exe to StealthBrowser.exe
    if (Test-Path "dist\win-unpacked\electron.exe") {
        Rename-Item "dist\win-unpacked\electron.exe" "StealthBrowser.exe"
        Write-Host "Renamed electron.exe to StealthBrowser.exe" -ForegroundColor Green
    }
    
    # Clean up
    Remove-Item $electronZip -Force
    
    Write-Host ""
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host "📁 Location: dist\win-unpacked\StealthBrowser.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Your portable StealthBrowser is ready!" -ForegroundColor White
    Write-Host "You can run it directly from the dist\win-unpacked folder." -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "❌ Error downloading Electron:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual download required:" -ForegroundColor Yellow
    Write-Host "1. Download from: $electronUrl" -ForegroundColor Cyan
    Write-Host "2. Extract to: dist\win-unpacked\" -ForegroundColor Cyan
    Write-Host "3. Rename electron.exe to StealthBrowser.exe" -ForegroundColor Cyan
}

Write-Host ""
Read-Host "Press Enter to continue"
