# StealthBrowser Installer Creation Guide

## Quick Start

### Method 1: Automated Windows Build (Recommended)
```bash
build-windows.bat
```

### Method 2: Manual Commands
```bash
# Install dependencies
npm install

# Build Windows installer and portable version
npm run build-win
```

### Method 3: Node.js Script
```bash
node create-installer.js
```

## What Gets Created

After building, you'll find in the `dist/` folder:

- **`StealthBrowser-Setup-1.0.0.exe`** - Professional Windows installer
- **`StealthBrowser-Portable-1.0.0.exe`** - Portable version (no installation required)

## Installer Features

### Windows Installer (.exe)
- ✅ Professional installation wizard
- ✅ Custom installation directory selection
- ✅ Desktop shortcut creation
- ✅ Start menu integration
- ✅ Auto-launch on system startup
- ✅ Easy uninstallation
- ✅ No admin privileges required
- ✅ Single executable file

### Portable Version
- ✅ No installation required
- ✅ Run from any location
- ✅ No system modifications
- ✅ Perfect for USB drives

## Distribution

### For End Users
- Share the `StealthBrowser-Setup-1.0.0.exe` file
- Users can install with a simple double-click
- No technical knowledge required

### For Developers
- Use the portable version for testing
- Installer includes all dependencies
- No Node.js installation required on target machines

## Build Configuration

The installer is configured in `package.json` with:

```json
{
  "build": {
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "runAfterFinish": true
    }
  }
}
```

## Troubleshooting

### Build Fails
1. Make sure all dependencies are installed: `npm install`
2. Check if you have enough disk space
3. Try cleaning first: `npm run clean`

### Icon Issues
- The installer uses `assets/icon.ico`
- If missing, it will use a default icon
- Create your own ICO file for custom branding

### Large File Size
- This is normal for Electron apps
- The installer includes the entire Chromium engine
- File size is typically 100-200 MB

## Advanced Options

### Custom Icon
Replace `assets/icon.ico` with your own 256x256 ICO file

### Custom Installer Text
Modify the `nsis` section in `package.json` for custom installer text

### Different Architectures
Change `"arch": ["x64"]` to `"arch": ["x64", "ia32"]` for 32-bit support

## Support

If you encounter issues:
1. Check the console output for error messages
2. Ensure all dependencies are properly installed
3. Try building the portable version first: `npm run build-portable`
