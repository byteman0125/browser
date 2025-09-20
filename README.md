# StealthBrowser

A lightweight, privacy-focused web browser built with Electron featuring stealth mode, beautiful design, and advanced customization options.

## Features

- 🌐 **Full Web Browsing**: Navigate to any website with complete browser functionality
- 🥷 **Stealth Mode**: Advanced privacy protection with fingerprinting resistance
- 🍪 **Cookie Management**: View and manage cookies with one-click clearing
- 🎨 **Beautiful Design**: Modern, gradient-based UI with transparency effects
- 🔝 **Always On Top**: Stay above all other windows
- ⌨️ **Global Hotkeys**: Control window position and transparency from anywhere
- 🚀 **Auto-Start**: Automatically launches with system startup
- 🔄 **Auto-Restart**: Automatically restarts if accidentally closed
- 📦 **Portable**: Single executable file with all dependencies included
- 🗂️ **System Tray**: Full system tray integration with context menu
- 👻 **Taskbar Hiding**: Hide from taskbar when minimized to tray
- 📑 **Multi-Tab Support**: Full tab management with individual webviews
- 🔍 **Smart URL Detection**: Automatic protocol detection for domains
- 🌙 **Dark Mode**: Beautiful dark theme with smooth transitions
- 🔎 **Tab-Based Search**: Search functionality within each individual tab
- 🌑 **Default Dark Content**: Web content automatically styled in dark mode

## Hotkeys

- `Ctrl+Shift + Right Arrow`: Move window to the right
- `Ctrl+Shift + Left Arrow`: Move window to the left
- `Ctrl+Shift + Up Arrow`: Increase window transparency
- `Ctrl+Shift + Down Arrow`: Decrease window transparency
- `Ctrl+Shift + .`: Hide/show the browser window
- `Ctrl+F`: Open search in page
- `Escape`: Close modals

## System Tray Features

- **Right-click menu**: Access all major browser functions
- **Quick Navigation**: Direct links to Google, DuckDuckGo, and Tor Project
- **Settings Control**: Toggle stealth mode and always-on-top from tray
- **Cookie Management**: Clear cookies directly from tray menu
- **Window Control**: Show/hide browser window
- **Notifications**: Balloon tips for important actions
- **Double-click**: Quick show/hide toggle

## Tab Management

- **Multiple Tabs**: Create unlimited tabs with individual webviews
- **Tab Switching**: Click tabs to switch between them
- **Tab Closing**: Close tabs with the × button (minimum 1 tab)
- **New Tab Button**: Click + to create new tabs
- **Tab Titles**: Automatically updates with page titles

## Smart URL Detection

- **Domain Detection**: Automatically adds `https://` to domains
- **Localhost Support**: Adds `http://` for localhost and IP addresses
- **Search Integration**: Treats text with spaces as Google searches
- **Protocol Preservation**: Keeps existing protocols (http, https, file)

## Dark Mode

- **Toggle Button**: Click the moon icon to switch themes
- **Persistent Setting**: Remembers your preference
- **Smooth Transitions**: Beautiful animations between themes
- **Complete Coverage**: All UI elements support dark mode

## Tab-Based Search

- **Keyboard Shortcut**: Press `Ctrl+F` to open search in current tab
- **Tab Search Bar**: Search input appears within each tab
- **Text Highlighting**: Search results are highlighted in yellow
- **Real-time Search**: Results update as you type
- **Clear Search**: Click × or press Escape to close search
- **Per-Tab Search**: Each tab maintains its own search state
- **Independent Search**: Search in one tab doesn't affect others

## Dark Content Mode

- **Automatic Injection**: Dark CSS automatically applied to web content
- **Comprehensive Styling**: Covers text, backgrounds, inputs, buttons, links
- **Eye-Friendly**: Reduces eye strain in low-light conditions
- **Consistent Experience**: Matches browser UI dark theme

## Installation & Usage

### Prerequisites
- Node.js (for development only)
- npm (for development only)

### Development Setup
1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm start
   ```

### Building Portable Executable
1. Build for your platform:
   ```bash
   # For Windows
   npm run build-win
   
   # For Linux
   npm run build
   ```
2. Find the portable executable in the `dist` folder

## Stealth Features

- **User Agent Spoofing**: Mimics regular Chrome browser
- **Fingerprinting Protection**: Blocks common tracking methods
- **Canvas Randomization**: Prevents canvas-based tracking
- **WebRTC Protection**: Blocks potential IP leaks
- **Plugin Enumeration Blocking**: Prevents plugin fingerprinting

## System Requirements

- Windows 10+ / Linux (Ubuntu 18.04+) / macOS 10.14+
- 100MB disk space
- 512MB RAM

## Architecture

- **Frontend**: HTML5, CSS3, JavaScript
- **Framework**: Electron
- **Packaging**: electron-builder
- **Auto-Launch**: auto-launch module
- **Settings**: electron-store

## License

MIT License - Feel free to modify and distribute.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
