const { app, BrowserWindow, BrowserView, globalShortcut, ipcMain, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const Store = require('electron-store');

// Initialize store for settings
const store = new Store();

// Auto-launch setup
const autoLauncher = new AutoLaunch({
  name: 'StealthBrowser',
  path: app.getPath('exe'),
});

let mainWindow;
let browserViews = new Map(); // Map of tabId to BrowserView
let currentTabId = 0;
let tabCounter = 0;
let tray = null;
let isHidden = false;
let currentOpacity = 0.95;

// Enable auto-startup
autoLauncher.enable();

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      webviewTag: true
    },
    frame: true,
    alwaysOnTop: true,
    opacity: currentOpacity,
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    backgroundColor: '#1a1a1a',
    show: false,
    skipTaskbar: false // Will be controlled by tray
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Restore previous settings
    const savedOpacity = store.get('opacity', 0.95);
    const savedPosition = store.get('position');
    
    currentOpacity = savedOpacity;
    mainWindow.setOpacity(savedOpacity);
    
    if (savedPosition) {
      mainWindow.setPosition(savedPosition.x, savedPosition.y);
    }
  });

  // Prevent window from closing, hide instead and move to tray
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true);
      
      // Show tray notification
      if (tray) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'StealthBrowser',
          content: 'Application was minimized to tray. Use Ctrl+Shift+. to show/hide.'
        });
      }
      
      // Auto-restart after 30 seconds if completely hidden (safety feature)
      setTimeout(() => {
        if (!mainWindow.isVisible() && !isHidden) {
          mainWindow.show();
          mainWindow.setSkipTaskbar(false);
        }
      }, 30000);
    }
  });

  // Handle minimize to tray
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true);
  });

  // Save position when moved
  mainWindow.on('moved', () => {
    const position = mainWindow.getPosition();
    store.set('position', { x: position[0], y: position[1] });
  });

  // Update BrowserView bounds when window is resized
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    browserViews.forEach((browserView) => {
      browserView.setBounds({
        x: 0,
        y: 100, // Space for navigation bar + tab bar
        width: bounds.width,
        height: bounds.height - 100
      });
    });
  });

  // Setup session for stealth mode
  setupStealthMode();
  
  // Setup webview permissions
  setupWebviewPermissions();
  
  // Create first tab
  createBrowserView(0, 'https://www.google.com');
  
  // Create system tray
  createSystemTray();
}

function setupStealthMode() {
  const ses = session.defaultSession;
  
  // Block tracking and ads
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['notifications', 'media'];
    callback(allowedPermissions.includes(permission));
  });

  // Set user agent to mimic regular browser
  ses.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Content protection
  ses.setDisplayMediaRequestHandler((request, callback) => {
    callback({ video: false, audio: false });
  });
}

function setupWebviewPermissions() {
  const ses = session.defaultSession;
  
  // Allow all permissions for webview
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all permissions for webview
    callback(true);
  });
  
  // Set CSP to allow webview loading
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:;']
      }
    });
  });
}

function createBrowserView(tabId = 0, url = 'https://www.google.com') {
  const browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });
  
  // Store the BrowserView
  browserViews.set(tabId, browserView);
  
  // Set the bounds for the BrowserView
  const bounds = mainWindow.getBounds();
  browserView.setBounds({
    x: 0,
    y: 100, // Space for navigation bar + tab bar
    width: bounds.width,
    height: bounds.height - 100
  });
  
  // Load URL with error handling
  browserView.webContents.loadURL(url).catch(err => {
    // Try loading a fallback page
    browserView.webContents.loadURL('data:text/html,<h1>Failed to load page</h1><p>Please check your internet connection.</p>');
  });
  
  // Handle navigation events
  browserView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('browser-view-loading', { tabId, loading: true });
  });
  
  browserView.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('browser-view-loading', { tabId, loading: false });
    mainWindow.webContents.send('browser-view-url', { tabId, url: browserView.webContents.getURL() });
  });
  
  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    mainWindow.webContents.send('browser-view-loading', { tabId, loading: false });
  });
  
  browserView.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('browser-view-title', { tabId, title });
  });
  
  // Set as current view if it's the first tab
  if (tabId === currentTabId) {
    mainWindow.setBrowserView(browserView);
  }
  
  return browserView;
}

function createSystemTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Fallback to a simple icon if SVG doesn't work
      trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    }
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (error) {
    console.log('Error loading tray icon:', error);
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'StealthBrowser',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Show Browser',
      type: 'normal',
      click: () => {
        showMainWindow();
      }
    },
    {
      label: 'Hide Browser',
      type: 'normal',
      click: () => {
        hideMainWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Navigate to...',
      type: 'submenu',
      submenu: [
        {
          label: 'Google',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', 'https://www.google.com');
              showMainWindow();
            }
          }
        },
        {
          label: 'DuckDuckGo (Private)',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', 'https://duckduckgo.com');
              showMainWindow();
            }
          }
        },
        {
          label: 'Tor Project',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', 'https://www.torproject.org');
              showMainWindow();
            }
          }
        }
      ]
    },
    {
      type: 'separator'
    },
    {
      label: 'Stealth Mode',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-stealth', menuItem.checked);
        }
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(menuItem.checked);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Clear Cookies',
      type: 'normal',
      click: async () => {
        await session.defaultSession.clearStorageData({
          storages: ['cookies']
        });
        if (tray) {
          tray.displayBalloon({
            iconType: 'info',
            title: 'StealthBrowser',
            content: 'All cookies have been cleared.'
          });
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'About',
      type: 'normal',
      click: () => {
        if (tray) {
          tray.displayBalloon({
            iconType: 'info',
            title: 'StealthBrowser v1.0.0',
            content: 'Privacy-focused browser with stealth capabilities.\nHotkeys: Ctrl+Shift+Arrow keys, Ctrl+Shift+.'
          });
        }
      }
    },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('StealthBrowser - Privacy-focused web browser');
  
  // Double click to show/hide
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      hideMainWindow();
    } else {
      showMainWindow();
    }
  });
  
  // Single click notification
  tray.on('click', () => {
    if (!mainWindow.isVisible()) {
      tray.displayBalloon({
        iconType: 'info',
        title: 'StealthBrowser',
        content: 'Double-click to show browser or right-click for menu.'
      });
    }
  });
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setSkipTaskbar(false);
    mainWindow.focus();
    isHidden = false;
  }
}

function hideMainWindow() {
  if (mainWindow) {
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true);
    isHidden = true;
  }
}

function registerGlobalShortcuts() {
  // Ctrl+Shift + Right: Move window right
  globalShortcut.register('CommandOrControl+Shift+Right', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + 100, y);
    }
  });

  // Ctrl+Shift + Left: Move window left
  globalShortcut.register('CommandOrControl+Shift+Left', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x - 100, y);
    }
  });

  // Ctrl+Shift + Up: Increase transparency
  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    if (mainWindow && currentOpacity < 1.0) {
      currentOpacity = Math.min(1.0, currentOpacity + 0.1);
      mainWindow.setOpacity(currentOpacity);
      store.set('opacity', currentOpacity);
    }
  });

  // Ctrl+Shift + Down: Decrease transparency
  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    if (mainWindow && currentOpacity > 0.1) {
      currentOpacity = Math.max(0.1, currentOpacity - 0.1);
      mainWindow.setOpacity(currentOpacity);
      store.set('opacity', currentOpacity);
    }
  });

  // Ctrl+Shift + .: Hide/Show window
  globalShortcut.register('CommandOrControl+Shift+.', () => {
    if (mainWindow) {
      if (isHidden || !mainWindow.isVisible()) {
        showMainWindow();
      } else {
        hideMainWindow();
      }
    }
  });
}

// App event handlers
app.whenReady().then(() => {
  // Enable webview tag
  app.commandLine.appendSwitch('enable-webview');
  app.commandLine.appendSwitch('disable-web-security');
  
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Prevent app from quitting, keep running in background
  // Auto-restart after delay
  setTimeout(() => {
    createWindow();
  }, 3000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers for renderer process
ipcMain.handle('navigate-to', async (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('navigate', url);
  }
});

ipcMain.handle('get-cookies', async (event, url) => {
  const cookies = await session.defaultSession.cookies.get({ url });
  return cookies;
});

ipcMain.handle('clear-cookies', async () => {
  await session.defaultSession.clearStorageData({
    storages: ['cookies']
  });
});

ipcMain.handle('set-stealth-mode', async (event, enabled) => {
  const ses = session.defaultSession;
  if (enabled) {
    // Enhanced stealth mode
    ses.setProxy({ mode: 'system' });
  }
});

// BrowserView navigation handlers
ipcMain.handle('browser-view-navigate', (event, { tabId, url }) => {
  const browserView = browserViews.get(tabId);
  if (browserView) {
    browserView.webContents.loadURL(url).catch(err => {
      browserView.webContents.loadURL('data:text/html,<h1>Failed to load page</h1><p>Please check your internet connection.</p>');
    });
  }
});

ipcMain.handle('browser-view-back', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView && browserView.webContents.canGoBack()) {
    browserView.webContents.goBack();
  }
});

ipcMain.handle('browser-view-forward', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView && browserView.webContents.canGoForward()) {
    browserView.webContents.goForward();
  }
});

ipcMain.handle('browser-view-reload', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView) {
    browserView.webContents.reload();
  }
});

ipcMain.handle('browser-view-can-go-back', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  return browserView ? browserView.webContents.canGoBack() : false;
});

ipcMain.handle('browser-view-can-go-forward', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  return browserView ? browserView.webContents.canGoForward() : false;
});

// Tab management handlers
ipcMain.handle('create-tab', (event, url = 'https://www.google.com') => {
  const newTabId = ++tabCounter;
  createBrowserView(newTabId, url);
  return newTabId;
});

ipcMain.handle('switch-tab', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView) {
    currentTabId = tabId;
    mainWindow.setBrowserView(browserView);
    return true;
  }
  return false;
});

ipcMain.handle('close-tab', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView && browserViews.size > 1) {
    browserViews.delete(tabId);
    browserView.destroy();
    
    // Switch to another tab if we closed the current one
    if (tabId === currentTabId) {
      const remainingTabs = Array.from(browserViews.keys());
      if (remainingTabs.length > 0) {
        const newCurrentTab = remainingTabs[0];
        currentTabId = newCurrentTab;
        mainWindow.setBrowserView(browserViews.get(newCurrentTab));
        return newCurrentTab;
      }
    }
    return true;
  }
  return false;
});
