# StealthBrowser Installer Builder
Write-Host "Building StealthBrowser Installer..." -ForegroundColor Green
Write-Host ""

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
npm run clean
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host ""

# Build the installer
Write-Host "Building Windows installer..." -ForegroundColor Yellow
npm run build-installer
Write-Host ""

# Check if build was successful
if (Test-Path "dist\StealthBrowser-Setup-1.0.0.exe") {
    Write-Host ""
    Write-Host "✅ Installer created successfully!" -ForegroundColor Green
    Write-Host "📁 Location: dist\StealthBrowser-Setup-1.0.0.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now distribute this installer file." -ForegroundColor White
    Write-Host ""
    
    # Ask if user wants to open the dist folder
    $openFolder = Read-Host "Do you want to open the dist folder? (y/n)"
    if ($openFolder -eq "y" -or $openFolder -eq "Y") {
        Start-Process "dist"
    }
} else {
    Write-Host ""
    Write-Host "❌ Build failed! Check the error messages above." -ForegroundColor Red
    Write-Host ""
}

Read-Host "Press Enter to continue"
