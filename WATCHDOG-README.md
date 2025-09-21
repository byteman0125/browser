# StealthBrowser Watchdog System

## Overview

The StealthBrowser Watchdog is a separate process that monitors the main browser application and automatically restarts it if it closes unexpectedly. It also restores your last open tabs when the browser restarts.

## Features

- 🔍 **Process Monitoring**: Continuously monitors the main browser process
- 🔄 **Auto-Restart**: Automatically restarts the browser if it crashes or closes
- 📂 **Tab Restoration**: Restores all your last open tabs when restarting
- 🛡️ **Crash Protection**: Prevents the browser from staying closed
- 💾 **Persistent Storage**: Saves tab state to `~/.stealthbrowser/last-tabs.json`
- 🚀 **Auto-Launch**: Can be set to start with the system

## How It Works

1. **Watchdog Process**: Runs as a separate Node.js process without UI
2. **Main Process Monitoring**: Checks if the main browser process is running every second
3. **Tab Persistence**: Saves tab information whenever tabs are created, closed, or navigated
4. **Auto-Recovery**: If the main process dies, the watchdog restarts it and restores tabs
5. **Graceful Shutdown**: Handles system shutdown signals properly

## Usage

### Starting with Watchdog

#### Windows
```bash
# Run the batch file
start-browser.bat

# Or use npm script
npm run start-with-watchdog
```

#### Linux/macOS
```bash
# Run the shell script
./start-browser.sh

# Or use npm script
npm run start-with-watchdog
```

### Direct Watchdog Start
```bash
npm run watchdog
# or
node watchdog.js
```

## Configuration

### Watchdog Settings
The watchdog can be configured by modifying the constants in `watchdog.js`:

```javascript
this.maxRestartAttempts = 5;        // Max restart attempts
this.restartDelay = 2000;           // Delay between restart attempts (ms)
this.checkInterval = 1000;          // Health check interval (ms)
```

### Tab Storage Location
- **Windows**: `%USERPROFILE%\.stealthbrowser\last-tabs.json`
- **Linux/macOS**: `~/.stealthbrowser/last-tabs.json`

## File Structure

```
watchdog.js              # Main watchdog process
start-browser.bat        # Windows startup script
start-browser.sh         # Linux/macOS startup script
src/main.js              # Modified to support tab persistence
src/renderer.js          # Modified to handle tab restoration
```

## Tab Persistence Format

The watchdog saves tab information in JSON format:

```json
{
  "timestamp": 1703123456789,
  "tabs": [
    {
      "id": 0,
      "url": "",
      "title": "New Tab"
    },
    {
      "id": 1,
      "url": "https://chat.openai.com",
      "title": "ChatGPT"
    }
  ]
}
```

## Process Management

### PID Files
- `~/.stealthbrowser/browser.pid` - Main browser process PID
- `~/.stealthbrowser/watchdog.pid` - Watchdog process PID

### Health Checks
- Checks main process every 1 second
- Attempts restart if process is not running
- Maximum 5 restart attempts before giving up

## Auto-Startup Integration

The watchdog can be integrated with the existing auto-launch system:

1. **Windows**: Add the watchdog to startup folder or registry
2. **Linux**: Add to systemd user service or startup applications
3. **macOS**: Add to Login Items

## Troubleshooting

### Watchdog Not Starting
- Ensure Node.js is installed and in PATH
- Check file permissions on startup scripts
- Verify all dependencies are installed

### Tabs Not Restoring
- Check if `~/.stealthbrowser/last-tabs.json` exists
- Verify file permissions on the directory
- Check console logs for error messages

### Browser Not Restarting
- Check watchdog console output for error messages
- Verify main process is not being blocked by antivirus
- Check system resources (memory, CPU)

## Benefits

1. **Never Lose Your Work**: Tabs are automatically restored
2. **Crash Recovery**: Browser automatically restarts after crashes
3. **Background Monitoring**: Watchdog runs silently in the background
4. **System Integration**: Can start with the system
5. **Lightweight**: Minimal resource usage

## Security Notes

- The watchdog process has no UI and runs with minimal privileges
- Tab data is stored locally in your home directory
- No network communication or data transmission
- Process isolation prevents security issues

## Development

To modify the watchdog behavior:

1. Edit `watchdog.js` for watchdog logic
2. Modify `src/main.js` for tab persistence
3. Update `src/renderer.js` for tab restoration
4. Test with `npm run watchdog`

The watchdog system ensures your StealthBrowser is always available and your tabs are never lost!
