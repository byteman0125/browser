# StealthBrowser Setup Guide

## 🚀 Quick Start

### Windows
1. Double-click `setup.bat`
2. Choose your build option
3. Wait for the build to complete
4. Find your executable in the `dist` folder

### Linux/macOS
1. Run `./setup.sh` in terminal
2. Choose your build option
3. Wait for the build to complete
4. Find your executable in the `dist` folder

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### Platform-Specific Requirements

#### Windows
- Windows 10/11 (64-bit)
- Visual Studio Build Tools (for native modules)

#### Linux
- Ubuntu 18.04+ or equivalent
- `libnss3-dev` and `libatk-bridge2.0-dev` packages
- For AppImage: `appimagetool`

#### macOS
- macOS 10.14+ (Mojave or later)
- Xcode Command Line Tools

## 🛠️ Manual Setup

### 1. Clone the Repository
```bash
git clone https://github.com/byteman0125/browser.git
cd browser
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Options

#### Development Mode
```bash
npm start
```

#### Build Windows
```bash
# Installer
npm run build-installer

# Portable
npm run build-portable

# All Windows formats
npm run build-win
```

#### Build Linux
```bash
electron-builder --linux
```

#### Build macOS
```bash
electron-builder --mac
```

#### Build All Platforms
```bash
npm run dist
```

## 📦 Build Outputs

After building, you'll find these files in the `dist` folder:

### Windows
- `StealthBrowser-Setup-1.0.0.exe` - NSIS installer
- `StealthBrowser-Portable-1.0.0.exe` - Portable executable

### Linux
- `StealthBrowser-1.0.0.AppImage` - AppImage (portable)

### macOS
- `StealthBrowser-1.0.0.dmg` - Disk image installer

## 🎯 Features Included

### ✅ Core Features
- **Stealth Mode**: Invisible to screen capture
- **Always on Top**: Stays above other windows
- **Auto-start**: Launches with system
- **Cookie Management**: Full cookie control
- **Paste Cookies**: Quick cookie import from clipboard
- **Quick Links**: ChatGPT and DeepSeek shortcuts
- **Responsive UI**: Works on any screen size

### ✅ Hotkeys
- `Alt + →` - Move window right
- `Alt + ←` - Move window left
- `Alt + ↑` - Increase transparency
- `Alt + ↓` - Decrease transparency
- `Alt + X` - Hide/Show window
- `Alt + S` - Screen capture mode
- `Alt + L` - Type from clipboard
- `Ctrl + T` - New tab
- `Ctrl + W` - Close tab

### ✅ Cookie Support
- **JSON Array Format**: `[{"name":"cookie","value":"value"}]`
- **Simple Format**: `name=value`
- **Full Format**: `name=value; domain=.example.com; secure`
- **Special Cookies**: `__Host-` and `__Secure-` support

## 🔧 Troubleshooting

### Common Issues

#### Build Fails
1. Ensure Node.js is installed: `node --version`
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and run `npm install` again

#### Dependencies Issues
```bash
# Clear everything and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Windows Build Issues
- Install Visual Studio Build Tools
- Run as Administrator if needed
- Check Windows Defender exclusions

#### Linux Build Issues
```bash
# Install required packages (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2
```

#### macOS Build Issues
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Performance Issues
- Close other applications during build
- Ensure sufficient disk space (2GB+)
- Use SSD for faster builds

## 📁 Project Structure

```
browser/
├── src/                    # Source code
│   ├── main.js            # Main process
│   ├── renderer.js        # Renderer process
│   ├── renderer.html      # UI template
│   ├── styles.css         # Styling
│   └── cookie-management.html
├── assets/                # Icons and images
├── dist/                  # Build outputs
├── setup.bat             # Windows setup script
├── setup.sh              # Linux/macOS setup script
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🚀 Distribution

### Single Executable
The built applications are completely self-contained and don't require Node.js to run.

### Installation
- **Windows**: Run the installer or use portable version
- **Linux**: Make AppImage executable and run
- **macOS**: Mount DMG and drag to Applications

### Auto-Update
The browser includes auto-update functionality for seamless updates.

## 📞 Support

If you encounter any issues:
1. Check this troubleshooting guide
2. Ensure all prerequisites are installed
3. Try the manual setup steps
4. Check the console output for error messages

## 🎉 Success!

Once built successfully, you'll have a fully functional StealthBrowser with all the features you requested:
- ✅ Paste cookie functionality
- ✅ Auto-focus on new tabs
- ✅ Quick link URL filling
- ✅ Responsive design
- ✅ All hotkeys working
- ✅ Stealth mode enabled
