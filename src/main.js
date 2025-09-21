// Force disable GPU at the very beginning
process.env.ELECTRON_DISABLE_GPU = '1';
process.env.CHROME_FLAGS = '--disable-gpu --disable-gpu-sandbox --disable-software-rasterizer';

const { app, BrowserWindow, BrowserView, globalShortcut, ipcMain, session, Tray, Menu, nativeImage, screen, desktopCapturer, clipboard } = require('electron');

// Disable hardware acceleration BEFORE app is ready
app.disableHardwareAcceleration();

// Global error handling to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the app, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the app, just log the error
});

// Prevent app from quitting
app.on('before-quit', (event) => {
  console.log('App before-quit event - preventing quit');
  event.preventDefault();
});

app.on('will-quit', (event) => {
  console.log('App will-quit event - preventing quit');
  event.preventDefault();
});

// Clean up PID file on app exit
app.on('before-quit', () => {
  // Clean up PID file
  const browserPidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
  if (fs.existsSync(browserPidFile)) {
    fs.unlinkSync(browserPidFile);
  }
});

process.on('exit', () => {
  // Clean up PID file
  const browserPidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
  if (fs.existsSync(browserPidFile)) {
    fs.unlinkSync(browserPidFile);
  }
});

process.on('SIGINT', () => {
  // Clean up PID file
  const browserPidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
  if (fs.existsSync(browserPidFile)) {
    fs.unlinkSync(browserPidFile);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  // Clean up PID file
  const browserPidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
  if (fs.existsSync(browserPidFile)) {
    fs.unlinkSync(browserPidFile);
  }
  process.exit(0);
});
const path = require('path');
const AutoLaunch = require('auto-launch');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Initialize store for settings
const store = new Store();

// Tab persistence
const tabsFile = path.join(os.homedir(), '.stealthbrowser', 'last-tabs.json');

function saveTabs() {
  try {
    const tabs = Array.from(browserViews.entries()).map(([tabId, browserView]) => {
      const url = browserView.webContents.getURL();
      return {
        id: tabId,
        url: url === 'about:blank' ? '' : url,
        title: browserView.webContents.getTitle() || 'New Tab'
      };
    });
    
    const tabsData = {
      timestamp: Date.now(),
      tabs: tabs
    };
    
    // Ensure directory exists
    const dir = path.dirname(tabsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tabsFile, JSON.stringify(tabsData, null, 2));
    console.log('💾 Saved tabs:', tabs.length);
  } catch (error) {
    console.error('Error saving tabs:', error);
  }
}

function loadTabs() {
  try {
    if (fs.existsSync(tabsFile)) {
      const data = JSON.parse(fs.readFileSync(tabsFile, 'utf8'));
      console.log('📂 Loaded tabs:', data.tabs.length);
      return data.tabs || [];
    }
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
  return [];
}

function readPidFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return parseInt(fs.readFileSync(filePath, 'utf8').trim());
    }
  } catch (error) {
    console.error('Error reading PID file:', error);
  }
  return null;
}

function writePidFile(filePath, pid) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, pid.toString());
  } catch (error) {
    console.error('Error writing PID file:', error);
  }
}

function isProcessRunning(pid) {
  try {
    // Check if process is running
    if (os.platform() === 'win32') {
      // For Windows, we'll use a simple approach
      // In a real implementation, you might want to use wmic or tasklist
      process.kill(pid, 0);
      return true;
    } else {
      // Unix-like systems
      process.kill(pid, 0);
      return true;
    }
  } catch (error) {
    return false;
  }
}

function restorePreviousTabs() {
  try {
    const savedTabs = loadTabs();
    if (savedTabs.length > 1) { // More than just the default tab
      console.log('🔄 Restoring previous tabs...');
      
      savedTabs.forEach((tab, index) => {
        if (index > 0) { // Skip the first tab (already created)
          const newTabId = ++tabCounter;
          console.log(`Restoring tab ${newTabId}: ${tab.url || 'New Tab'}`);
          
          // Create BrowserView for restored tab
          createBrowserView(newTabId, tab.url || '');
          
          // Send tab creation event to renderer
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('tab-restored', {
              tabId: newTabId,
              url: tab.url || '',
              title: tab.title || 'New Tab'
            });
          }
        }
      });
      
      console.log('✅ Tab restoration complete');
    }
  } catch (error) {
    console.error('Error restoring tabs:', error);
  }
}

// Watchdog functions removed - watchdog is now a separate independent process

// Auto-launch setup
const autoLauncher = new AutoLaunch({
  name: 'StealthBrowser',
  path: app.getPath('exe'),
  isHidden: true, // Start hidden in system tray
});

let mainWindow;
let browserViews = new Map(); // Map of tabId to BrowserView
let currentTabId = 0;
let tabCounter = 0;
let tray = null;
let isHidden = false;
let currentOpacity = 0.95;
// Watchdog is now a separate independent process
let stealthMode = true; // Enhanced stealth mode enabled by default
let performanceMode = false; // Performance optimization mode
const tabUsageHistory = []; // Track tab usage order (most recent first)

// Tab usage history management
function updateTabUsage(tabId) {
  // Remove tabId from history if it exists
  const index = tabUsageHistory.indexOf(tabId);
  if (index > -1) {
    tabUsageHistory.splice(index, 1);
  }
  // Add to beginning (most recent)
  tabUsageHistory.unshift(tabId);
  console.log('Tab usage updated:', tabUsageHistory);
}

function getMostRecentTab() {
  // Find the most recent tab that still exists
  for (const tabId of tabUsageHistory) {
    if (browserViews.has(tabId)) {
      console.log('Most recent tab found:', tabId);
      return tabId;
    }
  }
  // Fallback to first available tab
  const fallbackTab = Array.from(browserViews.keys())[0];
  console.log('Using fallback tab:', fallbackTab);
  return fallbackTab;
}

// Enhanced auto-startup with error handling
async function setupAutoLaunch() {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (!isEnabled) {
      await autoLauncher.enable();
      console.log('✅ Auto-launch enabled successfully');
    } else {
      console.log('✅ Auto-launch already enabled');
    }
  } catch (error) {
    console.error('❌ Failed to enable auto-launch:', error);
    // Fallback: try to enable without async
    try {
      autoLauncher.enable();
    } catch (fallbackError) {
      console.error('❌ Fallback auto-launch also failed:', fallbackError);
    }
  }
}

// Setup auto-launch
setupAutoLaunch();

// Enhanced stealth mode function for maximum screen capture invisibility
function enableMaximumStealth() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      // Apply all possible stealth measures for system-level screen capture protection
      mainWindow.setContentProtection(true);
      mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setSkipTaskbar(true);
      
      // Force window to be treated as system overlay (highest stealth level)
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // Additional protection measures for system screen capture
      mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      
      // Enhanced system-level stealth - make window completely invisible to system capture
      try {
        // Set window to be treated as a system component
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // Force window to be hidden from all capture methods
        mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
        
        // Ensure window is not captured by system tools
        mainWindow.setSkipTaskbar(true);
        
        // Additional system-level protection
        mainWindow.setContentProtection(true);
        
      } catch (systemError) {
        console.error('Error applying system-level stealth:', systemError);
      }
      
      console.log('Maximum stealth mode enabled - window invisible to system screen capture');
    } catch (error) {
      console.error('Error enabling maximum stealth mode:', error);
    }
  }
}

// Function to toggle stealth mode
function toggleStealthMode() {
  stealthMode = !stealthMode;
  if (stealthMode) {
    enableMaximumStealth();
    console.log('Stealth mode enabled - window invisible to system screen capture');
  } else {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setContentProtection(false);
      console.log('Stealth mode disabled - window may be visible to system screen capture');
    }
  }
  
  // Save stealth mode state
  store.set('stealthMode', stealthMode);
  return stealthMode;
}

// Enhanced function to protect against system screen capture
function protectFromSystemCapture() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      // Apply maximum system-level stealth protection
      mainWindow.setContentProtection(true);
      mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setSkipTaskbar(true);
      
      // Force window to be treated as system component
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // Additional system-level protection
      mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      
      console.log('System screen capture protection applied');
    } catch (error) {
      console.error('Error applying system capture protection:', error);
    }
  }
}

// Performance monitoring and optimization
function togglePerformanceMode() {
  performanceMode = !performanceMode;
  
  if (performanceMode) {
    // Enable performance optimizations
    console.log('Performance mode enabled - reduced CPU usage');
    
    // Reduce stealth check frequency when in performance mode
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Apply stealth measures less frequently
      setContentProtection(true);
    }
  } else {
    // Disable performance optimizations
    console.log('Performance mode disabled - full stealth protection');
    
    // Restore full stealth protection
    if (mainWindow && !mainWindow.isDestroyed()) {
      enableMaximumStealth();
    }
  }
  
  // Save performance mode state
  store.set('performanceMode', performanceMode);
  return performanceMode;
}

// Function to ensure content protection is always enabled and make window completely invisible to capture
function setContentProtection(enabled) {
  if (mainWindow) {
    if (enabled) {
      // Make window completely invisible to screen capture
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      mainWindow.setSkipTaskbar(true);
      
      // CRITICAL: Enable content protection to make window invisible to screen capture
      mainWindow.setContentProtection(true);
      
      // DON'T override user's opacity setting - keep current opacity
      // mainWindow.setOpacity(1.0); // REMOVED - this was overriding user settings
      
      // Advanced stealth measures
      try {
        // Set window to be completely hidden from capture APIs
        mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
        
        // Force window to be treated as system overlay
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // Additional protection against screen capture
        mainWindow.setSkipTaskbar(true);
        
      } catch (error) {
        console.error('Error setting advanced stealth measures:', error);
      }
    }
  }
}

function createWindow(startHidden = false) {
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
      webviewTag: true,
      // Performance optimizations - enable WebGL for modern websites
      hardwareAcceleration: false,
      offscreen: false,
      // Memory management
      v8CacheOptions: 'code',
      // Smooth rendering
      backgroundThrottling: false,
      // Additional performance settings
      preload: false
    },
    frame: false, // Remove title bar and menu
    alwaysOnTop: true, // Keep browser on top of other windows
    opacity: currentOpacity, // Keep normal opacity for user visibility
    icon: path.join(__dirname, '../assets/icon.png'),
    backgroundColor: '#000000', // Pure black background
    show: !startHidden, // Show window unless starting hidden
    skipTaskbar: true, // Always hide from taskbar
    contentProtection: true, // Enable content protection for screen capture invisibility
    // Enhanced stealth measures for system-level screen capture prevention
    visibleOnAllWorkspaces: false, // Make window completely invisible to system screen capture
    fullscreenable: false, // Prevent fullscreen mode
    minimizable: false, // Prevent minimization
    maximizable: false, // Prevent maximization
    resizable: false, // Prevent resizing
    closable: false, // Prevent closing (we handle this ourselves)
    // Additional stealth properties
    hasShadow: false, // Remove window shadow
    thickFrame: false, // Remove thick frame
    titleBarStyle: 'hidden', // Hide title bar completely
    vibrancy: 'none', // Remove any vibrancy effects
    // Additional stealth properties
    focusable: true, // Keep focusable but invisible
    acceptFirstMouse: false, // Prevent first mouse click
    disableAutoHideCursor: true, // Disable auto-hide cursor
    simpleFullscreen: false, // Disable simple fullscreen
    // Enhanced stealth measures for maximum invisibility
    show: false, // Don't show initially
    skipTaskbar: true, // Hide from taskbar
    alwaysOnTop: true, // Keep on top
    visibleOnAllWorkspaces: false, // Invisible to screen capture
    webSecurity: false, // Disable web security for stealth
    allowRunningInsecureContent: true, // Allow insecure content
    experimentalFeatures: true, // Enable experimental features
    webviewTag: true, // Enable webview tag
    nodeIntegration: true, // Enable node integration
    contextIsolation: false, // Disable context isolation
    enableRemoteModule: true, // Enable remote module
    sandbox: false, // Disable sandbox
    preload: false, // Disable preload
    backgroundThrottling: false, // Disable background throttling
    offscreen: false, // Disable offscreen rendering
    hardwareAcceleration: false, // Disable hardware acceleration
    v8CacheOptions: 'none', // Disable V8 cache
    additionalArguments: ['--disable-gpu', '--disable-gpu-sandbox', '--disable-software-rasterizer', '--disable-features=ScreenCapture,DisplayCapture,DesktopCapture,GetDisplayMedia,ScreenSharing,WebRTC,MediaStream,CanvasCapture,VideoCapture,AudioCapture,ScreenRecording,ScreenMirroring,RemoteDesktop,ScreenCaptureAPI,DisplayMediaAPI,GetUserMedia,MediaDevices,ScreenCapturePermission,DisplayCapturePermission']
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
  mainWindow.setSkipTaskbar(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
  mainWindow.setSkipTaskbar(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Add crash prevention and stability measures
  mainWindow.on('close', (event) => {
    console.log('Window close event triggered - preventing close');
    event.preventDefault();
    mainWindow.hide();
    isHidden = true;
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    console.log('Window closed event triggered');
    mainWindow = null;
  });

  // Handle unresponsive window
  mainWindow.on('unresponsive', () => {
    console.log('Window became unresponsive - attempting recovery');
    // Don't force close, try to recover
  });

  // Handle responsive window
  mainWindow.on('responsive', () => {
    console.log('Window became responsive again');
  });

  // Handle crashed renderer
  mainWindow.webContents.on('crashed', (event) => {
    console.log('Renderer crashed - attempting recovery');
    // Don't exit, try to reload
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 1000);
  });

  // Handle renderer process gone
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.log('Render process gone:', details);
    // Don't exit, try to reload
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 1000);
  });    
  // Show window after loading to ensure it's visible to user but invisible to capture
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Enable maximum stealth mode by default
    enableMaximumStealth();
    setContentProtection(true);
    
    // Restore previous settings
    const savedOpacity = store.get('opacity', 0.8);
    const savedPosition = store.get('position');
    const savedStealthMode = store.get('stealthMode', true);
    const savedPerformanceMode = store.get('performanceMode', false);
    
    currentOpacity = savedOpacity;
    stealthMode = savedStealthMode;
    performanceMode = savedPerformanceMode;
    mainWindow.setOpacity(savedOpacity);
    
    if (savedPosition) {
      mainWindow.setPosition(savedPosition.x, savedPosition.y);
    }
    
    // Ensure content protection is always enabled
    setContentProtection(true);
    enableMaximumStealth();
  });

  // Handle window close - hide instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault(); // Prevent actual closing
      mainWindow.hide(); // Hide the window instead
      mainWindow.setSkipTaskbar(true);
      isHidden = true;
    }
  });

  // Allow normal window behavior - no auto-hide or minimize prevention
  mainWindow.on('minimize', (event) => {
    // Prevent minimize - only allow hiding via hotkey
    event.preventDefault();
    mainWindow.setSkipTaskbar(true);
    // Keep window visible - don't minimize
    mainWindow.show();
  });

  mainWindow.on('blur', (event) => {
    // Keep window visible when losing focus
    mainWindow.setSkipTaskbar(true);
    // Ensure content protection is always enabled
    setContentProtection(true);
  });

  mainWindow.on('focus', (event) => {
    // Keep window visible when gaining focus
    mainWindow.setSkipTaskbar(true);
    // Ensure content protection is always enabled
    setContentProtection(true);
  });

  // Note: Click handler moved to renderer process to avoid interfering with browser functionality

  mainWindow.on('restore', (event) => {
    // Keep window visible when restored
    mainWindow.setSkipTaskbar(true);
    // Ensure content protection is always enabled
    setContentProtection(true);
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
        y: 128, // Space for window controls + tab bar + navigation bar
        width: bounds.width,
        height: bounds.height - 128
      });
    });
  });

  // Setup session for stealth mode
  setupStealthMode();
  
  // Setup webview permissions
  setupWebviewPermissions();
  
  // Create first tab
  createBrowserView(0, '');
  
  // Restore previous tabs after a short delay
  setTimeout(() => {
    restorePreviousTabs();
  }, 1000);
  
  // Create system tray
  createSystemTray();
  
  // Setup zoom controls
  setupZoomControls();
  
  // Optimized periodic check to ensure content protection with minimal CPU usage
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Apply stealth measures efficiently - only when needed
      if (stealthMode) {
        try {
          // Lightweight stealth check - only apply if not already set
          if (!mainWindow.isAlwaysOnTop()) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
          }
          
          // Only apply content protection if stealth mode is enabled
          setContentProtection(true);
          
          // DON'T override user's opacity - keep their setting
          // The stealth protection should not interfere with transparency
          
        } catch (error) {
          console.error('Error applying stealth measures:', error);
        }
      }
    }
  }, performanceMode ? 5000 : 2000); // Check every 5 seconds in performance mode, 2 seconds in normal mode
}

function setupStealthMode() {
  const ses = session.defaultSession;
  
  // Enhanced stealth mode with aggressive content protection
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow more permissions for better website compatibility
    const allowedPermissions = [
      'notifications', 
      'media',
      'camera',
      'microphone',
      'geolocation',
      'midi',
      'persistent-storage',
      'push',
      'background-sync',
      'ambient-light-sensor',
      'accelerometer',
      'gyroscope',
      'magnetometer',
      'accessibility-events',
      'clipboard-read',
      'clipboard-write',
      'payment-handler',
      'idle-detection',
      'periodic-background-sync'
    ];
    callback(allowedPermissions.includes(permission));
  });
  
  // Block screen capture permissions but allow other permissions for better compatibility
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    // Only block screen capture related permissions, allow others for website compatibility
    const blockedPermissions = [
      'screen-capture',
      'display-capture', 
      'desktop-capture',
      'screen-sharing',
      'getDisplayMedia',
      'window-capture',
      'tab-capture',
      'application-capture',
      'browser-capture',
      'desktop-capture-api',
      'screen-capture-api',
      'display-capture-api',
      'window-capture-api',
      'tab-capture-api',
      'application-capture-api',
      'browser-capture-api',
      'screenCapturePermission',
      'displayCapturePermission',
      'windowCapturePermission',
      'tabCapturePermission',
      'applicationCapturePermission',
      'browserCapturePermission'
    ];
    
    if (blockedPermissions.includes(permission)) {
      console.log('Blocked screen capture permission request:', permission);
      return false;
    }
    
    // Allow all other permissions for better website compatibility
    console.log('Allowed permission request:', permission, 'from:', requestingOrigin);
    return true;
  });

  // Set user agent to mimic regular browser
  ses.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Enhanced content protection - block all display media requests
  ses.setDisplayMediaRequestHandler((request, callback) => {
    console.log('Blocked display media request');
    callback({ video: false, audio: false });
  });
  
  // Allow media device access for better website compatibility
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    // Only block screen capture related permissions
    const blockedMediaPermissions = [
      'screen-capture',
      'display-capture',
      'desktop-capture',
      'getDisplayMedia'
    ];
    
    if (blockedMediaPermissions.includes(permission)) {
      console.log('Blocked screen capture media permission:', permission);
      callback(false);
      return;
    }
    
    // Allow camera, microphone, and getUserMedia for website functionality
    console.log('Allowed media permission:', permission);
    callback(true);
  });

  // Block tracking scripts and ads
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.toLowerCase();
    
    // Block common tracking domains
    const blockedDomains = [
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.com/tr',
      'doubleclick.net',
      'googlesyndication.com',
      'amazon-adsystem.com',
      'adsystem.amazon.com'
    ];
    
    if (blockedDomains.some(domain => url.includes(domain))) {
      callback({ cancel: true });
      return;
    }
    
    callback({});
  });

  // Block tracking headers
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = details.requestHeaders;
    
    // Check if requestHeaders is an array
    if (Array.isArray(requestHeaders)) {
      // Remove tracking headers
      const blockedHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip',
        'x-cluster-client-ip'
      ];
      
      const filteredHeaders = requestHeaders.filter(header => 
        !blockedHeaders.includes(header.name.toLowerCase())
      );
      
      callback({ requestHeaders: filteredHeaders });
    } else {
      callback({});
    }
  });

  // Disable web security for better compatibility
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return true;
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

function createBrowserView(tabId = 0, url = '') {
  const browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: url.includes('cookie-management.html') ? true : false,
      contextIsolation: url.includes('cookie-management.html') ? false : true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      enableRemoteModule: false,
      sandbox: false,
      // Enhanced stealth properties
      backgroundThrottling: false,
      offscreen: false,
      // Content protection
      partition: `persist:stealth-${tabId}`,
      // Disable features that could be used for tracking
      disableBlinkFeatures: 'Auxclick',
      // Additional security
      allowDisplayingInsecureContent: true,
      allowRunningInsecureContent: true,
      // Performance optimizations - enable WebGL for modern websites
      hardwareAcceleration: false,
      webgl: true,
      plugins: true,
      images: true,
      javascript: true,
      // Memory management
      v8CacheOptions: 'code',
      // Disable unnecessary features for speed
      disableDialogs: false,
      enableRemoteModule: false,
      // Additional performance settings
      preload: false,
      // Smooth scrolling and rendering
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
      disableBlinkFeatures: 'Auxclick,TranslateUI'
    }
  });
  
  // Store the BrowserView
  browserViews.set(tabId, browserView);
  
  // Save tabs when a new one is created
  saveTabs();
  
  // Add crash protection for BrowserView
  browserView.webContents.on('crashed', (event) => {
    console.log(`BrowserView ${tabId} crashed - attempting recovery`);
    // Don't destroy, try to reload
    setTimeout(() => {
      if (browserView && !browserView.webContents.isDestroyed()) {
        browserView.webContents.reload();
      }
    }, 1000);
  });

  browserView.webContents.on('render-process-gone', (event, details) => {
    console.log(`BrowserView ${tabId} render process gone:`, details);
    // Don't destroy, try to reload
    setTimeout(() => {
      if (browserView && !browserView.webContents.isDestroyed()) {
        browserView.webContents.reload();
      }
    }, 1000);
  });

  browserView.webContents.on('unresponsive', () => {
    console.log(`BrowserView ${tabId} became unresponsive`);
    // Don't force close, just log
  });

  browserView.webContents.on('responsive', () => {
    console.log(`BrowserView ${tabId} became responsive again`);
  });
  
  // Set the bounds for the BrowserView
  const bounds = mainWindow.getBounds();
  browserView.setBounds({
    x: 0,
    y: 128, // Space for window controls + tab bar + navigation bar
    width: bounds.width,
    height: bounds.height - 128
  });
  
  // Apply current zoom level to new BrowserView
  if (mainWindow && mainWindow.webContents) {
    const currentZoom = mainWindow.webContents.getZoomFactor();
    browserView.webContents.setZoomFactor(currentZoom);
  }
  
  // Load URL with error handling
  console.log('Loading URL in BrowserView:', url);
  
  // Check if it's a blank page request
  if (url === '') {
    // Load a simple blank page without custom HTML
    browserView.webContents.loadURL('about:blank').then(() => {
      console.log('Successfully loaded blank page');
      // Send empty URL to renderer to show blank in address bar
      mainWindow.webContents.send('browser-view-url', { tabId, url: '' });
    }).catch(err => {
      console.error('Failed to load blank page:', err);
    });
  } else {
    // Handle regular URLs
    // Ensure URL is properly formatted (but don't modify file:// URLs)
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url;
    }
    
    browserView.webContents.loadURL(url).then(() => {
      console.log('Successfully loaded URL:', url);
    }).catch(err => {
      console.error('Failed to load URL:', url, err);
      // Try loading Google.com as fallback
      console.log('Trying fallback to Google.com');
      browserView.webContents.loadURL('https://www.google.com').catch(fallbackErr => {
        console.error('Fallback also failed:', fallbackErr);
        // Last resort - show error page
        browserView.webContents.loadURL('data:text/html,<h1>Failed to load page</h1><p>Please check your internet connection.</p>');
      });
    });
  }
  
  // Handle navigation events
  browserView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('browser-view-loading', { tabId, loading: true });
  });
  
  browserView.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('browser-view-loading', { tabId, loading: false });
    const currentUrl = browserView.webContents.getURL();
    // Send empty string for about:blank to show blank in address bar
    const displayUrl = currentUrl === 'about:blank' ? '' : currentUrl;
    mainWindow.webContents.send('browser-view-url', { tabId, url: displayUrl });
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
  
  // Track tab usage
  updateTabUsage(tabId);
  
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
      checked: stealthMode,
      click: (menuItem) => {
        const newStealthState = toggleStealthMode();
        menuItem.checked = newStealthState;
        if (mainWindow) {
          mainWindow.webContents.send('toggle-stealth', newStealthState);
        }
      }
    },
    {
      label: 'System Capture Protection',
      type: 'normal',
      click: () => {
        protectFromSystemCapture();
        if (mainWindow) {
          mainWindow.webContents.send('system-capture-protection-applied');
        }
      }
    },
    {
      label: 'Performance Mode',
      type: 'checkbox',
      checked: performanceMode,
      click: (menuItem) => {
        const newPerformanceState = togglePerformanceMode();
        menuItem.checked = newPerformanceState;
        if (mainWindow) {
          mainWindow.webContents.send('performance-mode-toggled', newPerformanceState);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Window Size',
      type: 'submenu',
      submenu: [
        {
          label: 'Small (800x600)',
          click: () => {
            if (mainWindow) {
              mainWindow.setSize(800, 600);
            }
          }
        },
        {
          label: 'Medium (1200x800)',
          click: () => {
            if (mainWindow) {
              mainWindow.setSize(1200, 800);
            }
          }
        },
        {
          label: 'Large (1600x1000)',
          click: () => {
            if (mainWindow) {
              mainWindow.setSize(1600, 1000);
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Toggle Fullscreen',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isFullScreen()) {
                mainWindow.setFullScreen(false);
              } else {
                mainWindow.setFullScreen(true);
              }
            }
          }
        },
        {
          label: 'Toggle Maximize',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
              } else {
                mainWindow.maximize();
              }
            }
          }
        }
      ]
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(menuItem.checked);
          store.set('alwaysOnTop', menuItem.checked);
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
        // No notification needed
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'About',
      type: 'normal',
      click: () => {
        // No notification needed
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
  
  // Double click to show (only show, never hide automatically)
  tray.on('double-click', () => {
    if (!mainWindow.isVisible()) {
      showMainWindow();
    }
    // Don't hide on double-click - only show if hidden
  });
  
  // Single click notification
  tray.on('click', () => {
    // No notification needed
  });
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
    mainWindow.focus();
    isHidden = false;
  }
}

function hideMainWindow() {
  if (mainWindow) {
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
    isHidden = true;
  }
}

function registerGlobalShortcuts() {
  console.log('Registering global shortcuts...');
  
  // Ctrl+Shift + Right: Move window right
  globalShortcut.register('CommandOrControl+Alt+Right', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + 100, y);
    }
  });

  // Ctrl+Shift + Left: Move window left
  globalShortcut.register('CommandOrControl+Alt+Left', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x - 100, y);
    }
  });

  // Ctrl+Alt + 1: Set window to small size (800x600)
  globalShortcut.register('CommandOrControl+Alt+1', () => {
    if (mainWindow) {
      mainWindow.setSize(800, 600);
      console.log('Window size set to: 800x600 (small)');
    }
  });

  // Ctrl+Alt + 2: Set window to medium size (1200x800)
  globalShortcut.register('CommandOrControl+Alt+2', () => {
    if (mainWindow) {
      mainWindow.setSize(1200, 800);
      console.log('Window size set to: 1200x800 (medium)');
    }
  });

  // Ctrl+Alt + 3: Set window to large size (1600x1000)
  globalShortcut.register('CommandOrControl+Alt+3', () => {
    if (mainWindow) {
      mainWindow.setSize(1600, 1000);
      console.log('Window size set to: 1600x1000 (large)');
    }
  });

  // Ctrl+Alt + 4: Toggle fullscreen
  globalShortcut.register('CommandOrControl+Alt+4', () => {
    if (mainWindow) {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        console.log('Window set to windowed mode');
      } else {
        mainWindow.setFullScreen(true);
        console.log('Window set to fullscreen mode');
      }
    }
  });

  // Ctrl+Alt + 5: Toggle maximize
  globalShortcut.register('CommandOrControl+Alt+5', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        console.log('Window unmaximized');
      } else {
        mainWindow.maximize();
        console.log('Window maximized');
      }
    }
  });

  // Ctrl+Alt + Up: Make window MORE OPAQUE (less transparent)
  globalShortcut.register('CommandOrControl+Alt+Up', () => {
    console.log('MAKE MORE OPAQUE hotkey triggered!');
    console.log('Current opacity before change:', currentOpacity);
    if (mainWindow && currentOpacity < 1.0) {
      currentOpacity = Math.min(1.0, currentOpacity + 0.1);
      mainWindow.setOpacity(currentOpacity);
      store.set('opacity', currentOpacity);
      console.log('Window made MORE OPAQUE to:', (currentOpacity * 100).toFixed(0) + '%');
      console.log('Window opacity set to:', mainWindow.getOpacity());
    } else if (mainWindow && currentOpacity >= 1.0) {
      console.log('Window already at maximum opacity (100%) - keeping current value');
      console.log('Current opacity:', (currentOpacity * 100).toFixed(0) + '%');
    } else {
      console.log('Cannot change opacity - window not available');
      console.log('Current opacity:', currentOpacity, 'Window available:', !!mainWindow);
    }
  });

  // Ctrl+Alt + Down: Make window MORE TRANSPARENT (less opaque)
  globalShortcut.register('CommandOrControl+Alt+Down', () => {
    console.log('MAKE MORE TRANSPARENT hotkey triggered!');
    console.log('Current opacity before change:', currentOpacity);
    if (mainWindow && currentOpacity > 0.4) {
      currentOpacity = Math.max(0.4, currentOpacity - 0.1);
      mainWindow.setOpacity(currentOpacity);
      store.set('opacity', currentOpacity);
      console.log('Window made MORE TRANSPARENT to:', (currentOpacity * 100).toFixed(0) + '%');
      console.log('Window opacity set to:', mainWindow.getOpacity());
    } else if (mainWindow && currentOpacity <= 0.4) {
      console.log('Window already at minimum opacity (40%) - keeping current value');
      console.log('Current opacity:', (currentOpacity * 100).toFixed(0) + '%');
    } else {
      console.log('Cannot change opacity - window not available');
      console.log('Current opacity:', currentOpacity, 'Window available:', !!mainWindow);
    }
  });

  // Ctrl+Shift + .: Hide/Show window
  globalShortcut.register('CommandOrControl+Alt+.', () => {
    if (mainWindow) {
      if (isHidden || !mainWindow.isVisible()) {
        showMainWindow();
      } else {
        hideMainWindow();
      }
    }
  });

 

  // Ctrl+T: Create new tab (global shortcut)
  globalShortcut.register('CommandOrControl+T', () => {
    if (mainWindow) {
      mainWindow.webContents.send('create-new-tab');
    }
  });

  // Ctrl+W: Close current tab (global shortcut)
  globalShortcut.register('CommandOrControl+W', () => {
    if (mainWindow) {
      mainWindow.webContents.send('close-current-tab');
    }
  });

  // Ctrl+Shift+`: Screen capture mode
  globalShortcut.register('CommandOrControl+Shift+`', () => {
    if (mainWindow) {
      startScreenCapture();
    }
  });

  // Test hotkey to check transparency status
  globalShortcut.register('CommandOrControl+Alt+0', () => {
    console.log('=== TRANSPARENCY STATUS TEST ===');
    console.log('Current opacity variable:', currentOpacity);
    if (mainWindow) {
      console.log('Window opacity:', mainWindow.getOpacity());
      console.log('Window is visible:', mainWindow.isVisible());
      console.log('Window is focused:', mainWindow.isFocused());
      console.log('Window bounds:', mainWindow.getBounds());
      
      // Force sync the opacity
      console.log('Forcing opacity to match variable...');
      mainWindow.setOpacity(currentOpacity);
      console.log('Window opacity after sync:', mainWindow.getOpacity());
    } else {
      console.log('Main window is not available');
    }
    console.log('===============================');
  });

  // Verify all hotkeys are registered
  try {
    const registeredShortcuts = globalShortcut.getAll();
    console.log('All registered shortcuts:', registeredShortcuts);
  } catch (error) {
    console.log('Hotkeys registered successfully (getAll not available in this Electron version)');
  }
}

// Setup zoom controls
function setupZoomControls() {
  if (mainWindow) {
    // Handle zoom with Ctrl + Scroll
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.type === 'mouseWheel') {
        event.preventDefault();
        
        const currentZoom = mainWindow.webContents.getZoomFactor();
        let newZoom = currentZoom;
        
        if (input.wheelDeltaY > 0) {
          // Zoom in
          newZoom = Math.min(3.0, currentZoom + 0.1);
        } else if (input.wheelDeltaY < 0) {
          // Zoom out
          newZoom = Math.max(0.25, currentZoom - 0.1);
        }
        
        mainWindow.webContents.setZoomFactor(newZoom);
        
        // Also apply zoom to all BrowserViews
        for (const [tabId, browserView] of browserViews) {
          if (browserView && browserView.webContents) {
            browserView.webContents.setZoomFactor(newZoom);
          }
        }
        
        console.log(`Zoom level set to: ${(newZoom * 100).toFixed(0)}%`);
      }
    });
    
    // Handle Ctrl + 0 to reset zoom
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key === '0') {
        event.preventDefault();
        
        const resetZoom = 1.0;
        mainWindow.webContents.setZoomFactor(resetZoom);
        
        // Also reset zoom for all BrowserViews
        for (const [tabId, browserView] of browserViews) {
          if (browserView && browserView.webContents) {
            browserView.webContents.setZoomFactor(resetZoom);
          }
        }
        
        console.log('Zoom level reset to: 100%');
      }
    });
    
    // Handle Ctrl + Plus to zoom in
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && (input.key === '+' || input.key === '=')) {
        event.preventDefault();
        
        const currentZoom = mainWindow.webContents.getZoomFactor();
        const newZoom = Math.min(3.0, currentZoom + 0.1);
        
        mainWindow.webContents.setZoomFactor(newZoom);
        
        // Also apply zoom to all BrowserViews
        for (const [tabId, browserView] of browserViews) {
          if (browserView && browserView.webContents) {
            browserView.webContents.setZoomFactor(newZoom);
          }
        }
        
        console.log(`Zoom level set to: ${(newZoom * 100).toFixed(0)}%`);
      }
    });
    
    // Handle Ctrl + Minus to zoom out
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key === '-') {
        event.preventDefault();
        
        const currentZoom = mainWindow.webContents.getZoomFactor();
        const newZoom = Math.max(0.25, currentZoom - 0.1);
        
        mainWindow.webContents.setZoomFactor(newZoom);
        
        // Also apply zoom to all BrowserViews
        for (const [tabId, browserView] of browserViews) {
          if (browserView && browserView.webContents) {
            browserView.webContents.setZoomFactor(newZoom);
          }
        }
        
        console.log(`Zoom level set to: ${(newZoom * 100).toFixed(0)}%`);
      }
    });
  }
}

// Cleanup function to destroy all BrowserViews
function cleanupBrowserViews() {
  console.log('Cleaning up all BrowserViews...');
  browserViews.forEach((browserView, tabId) => {
    try {
      if (mainWindow.getBrowserView() === browserView) {
        mainWindow.setBrowserView(null);
      }
      browserView.webContents.destroy();
      // BrowserView doesn't have a destroy method, just remove it from the window
      console.log('BrowserView cleaned up for tab:', tabId);
    } catch (error) {
      console.error('Error destroying BrowserView for tab', tabId, ':', error);
    }
  });
  browserViews.clear();
  tabUsageHistory.length = 0;
}

// Screen capture functionality
let captureWindow = null;
let isCapturing = false;

function startScreenCapture() {
  if (isCapturing) {
    console.log('Screen capture already in progress');
    return;
  }

  isCapturing = true;
  console.log('Starting screen capture mode...');

  // Hide the main browser window temporarily
  if (mainWindow) {
    mainWindow.hide();
  }

  // Create a transparent overlay window for area selection with stealth protection
  captureWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    // Enhanced stealth measures for capture overlay
    contentProtection: true, // Make overlay invisible to screen capture
    visibleOnAllWorkspaces: false, // Invisible to screen capture
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      // Additional stealth properties
      hardwareAcceleration: false,
      backgroundThrottling: false,
      offscreen: false
    },
    show: false
  });

  // Load the capture overlay HTML
  captureWindow.loadFile(path.join(__dirname, 'capture-overlay.html'));

  captureWindow.once('ready-to-show', () => {
    // Apply maximum stealth protection to capture overlay
    try {
      // Enable content protection to make overlay invisible to screen capture
      captureWindow.setContentProtection(true);
      captureWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      captureWindow.setAlwaysOnTop(true, 'screen-saver');
      captureWindow.setSkipTaskbar(true);
      
      // Additional stealth measures for capture overlay
      captureWindow.setContentProtection(true); // Ensure it's set
      
      console.log('Capture overlay content protection enabled - invisible to screen capture');
    } catch (error) {
      console.error('Error applying stealth protection to capture overlay:', error);
    }
    
    // Get all displays
    const displays = screen.getAllDisplays();
    
    // Find the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    
    // Set the capture window to cover the entire primary display
    captureWindow.setBounds({ x, y, width, height });
    captureWindow.show();
    captureWindow.focus();
    
    // Send display info to the overlay
    captureWindow.webContents.send('display-info', {
      x, y, width, height,
      displays: displays.map(display => ({
        id: display.id,
        bounds: display.bounds,
        isPrimary: display === primaryDisplay
      }))
    });
  });

  // Handle capture completion
  captureWindow.webContents.on('ipc-message', (event, channel, data) => {
    if (channel === 'capture-complete') {
      handleCaptureComplete(data);
    } else if (channel === 'capture-cancel') {
      handleCaptureCancel();
    }
  });

  // Handle window close
  captureWindow.on('closed', () => {
    captureWindow = null;
    isCapturing = false;
    
    // Don't automatically show main window here - let takeScreenshot handle it
  });
  
  // Optimized periodic stealth protection for capture overlay
  const captureStealthInterval = setInterval(() => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      try {
        // Ensure content protection is always enabled for capture overlay
        captureWindow.setContentProtection(true);
        
        // Lightweight stealth check - only apply if needed
        if (!captureWindow.isAlwaysOnTop()) {
          captureWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        
        // Additional stealth measures
        captureWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
        captureWindow.setSkipTaskbar(true);
        
      } catch (error) {
        console.error('Error maintaining capture overlay stealth:', error);
      }
    } else {
      // Clear interval if capture window is destroyed
      clearInterval(captureStealthInterval);
    }
  }, 1000); // Check every 1 second for better CPU performance
}

function handleCaptureComplete(captureData) {
  console.log('Capture completed:', captureData);
  
  // Close the capture window immediately
  if (captureWindow) {
    captureWindow.close();
    captureWindow = null;
  }
  
  // Process the captured area
  if (captureData && captureData.x !== undefined && captureData.y !== undefined && 
      captureData.width !== undefined && captureData.height !== undefined) {
    
    // Take screenshot of the selected area
    takeScreenshot(captureData);
  }
  
  isCapturing = false;
  
  // Restore main window stealth protection
  if (mainWindow && !mainWindow.isDestroyed()) {
    enableMaximumStealth();
    setContentProtection(true);
    console.log('Main window stealth protection restored after capture');
  }
}

function handleCaptureCancel() {
  console.log('Capture cancelled');
  
  // Close the capture window
  if (captureWindow) {
    captureWindow.close();
    captureWindow = null;
  }
  
  // Show the main browser window and restore stealth protection
  if (mainWindow) {
    mainWindow.show();
    enableMaximumStealth();
    setContentProtection(true);
    console.log('Main window stealth protection restored after capture cancellation');
  }
  
  isCapturing = false;
}

async function takeScreenshot(captureData) {
  try {
    
    // Get all displays
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Get screen sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: primaryDisplay.bounds.width, height: primaryDisplay.bounds.height }
    });
    
    if (sources.length > 0) {
      // Get the primary screen source
      const primarySource = sources.find(source => source.display_id === primaryDisplay.id) || sources[0];
      
      // Get the full screen image
      const fullImage = primarySource.thumbnail;
      
      // Crop to the selected area
      const croppedImage = fullImage.crop({
        x: captureData.x,
        y: captureData.y,
        width: captureData.width,
        height: captureData.height
      });
      
      // Convert to PNG buffer
      const buffer = croppedImage.toPNG();
      
      // Save to clipboard
      const image = nativeImage.createFromBuffer(buffer);
      clipboard.writeImage(image);
      
      console.log('Screenshot saved to clipboard');
      
      // Show the main browser window and restore stealth protection
      if (mainWindow) {
        mainWindow.show();
        enableMaximumStealth();
        setContentProtection(true);
        console.log('Main window stealth protection restored after screenshot');
      }
      
    } else {
      console.error('No screen sources available');
      // Show the main browser window and restore stealth protection
      if (mainWindow) {
        mainWindow.show();
        enableMaximumStealth();
        setContentProtection(true);
        console.log('Main window stealth protection restored after screenshot error');
      }
    }
    
  } catch (error) {
    console.error('Error taking screenshot:', error);
    // Show the main browser window and restore stealth protection
    if (mainWindow) {
      mainWindow.show();
      enableMaximumStealth();
      setContentProtection(true);
      console.log('Main window stealth protection restored after screenshot error');
    }
  }
}

// App event handlers
app.whenReady().then(() => {
  // Selective GPU disabling - keep some features for website compatibility
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-3d-apis');
  // Enable WebGL for modern websites
  // app.commandLine.appendSwitch('disable-webgl');
  // app.commandLine.appendSwitch('disable-webgl2');
  app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('disable-accelerated-jpeg-decoding');
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
  app.commandLine.appendSwitch('disable-accelerated-video-encode');
  app.commandLine.appendSwitch('force-gpu-rasterization', 'false');
  app.commandLine.appendSwitch('enable-software-rasterizer');
  
  // Performance optimizations
  app.commandLine.appendSwitch('enable-webview');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-features', 'TranslateUI');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('max-active-webgl-contexts', '0');
  
  // Additional GPU process disabling
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  app.commandLine.appendSwitch('disable-gpu-watchdog');
  app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
  app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
  
  // Additional stealth switches to prevent screen capture and sharing
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
  app.commandLine.appendSwitch('disable-default-apps');
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-plugins');
  app.commandLine.appendSwitch('disable-plugins-discovery');
  app.commandLine.appendSwitch('disable-preconnect');
  app.commandLine.appendSwitch('disable-translate');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-client-side-phishing-detection');
  app.commandLine.appendSwitch('disable-component-update');
  app.commandLine.appendSwitch('disable-domain-reliability');
  app.commandLine.appendSwitch('disable-features', 'BlinkGenPropertyTrees');
  app.commandLine.appendSwitch('disable-hang-monitor');
  app.commandLine.appendSwitch('disable-prompt-on-repost');
  
  // Selective screen capture prevention - allow some features for website compatibility
  app.commandLine.appendSwitch('disable-features', 'ScreenCapture');
  app.commandLine.appendSwitch('disable-features', 'DisplayCapture');
  app.commandLine.appendSwitch('disable-features', 'DesktopCapture');
  app.commandLine.appendSwitch('disable-features', 'GetDisplayMedia');
  app.commandLine.appendSwitch('disable-features', 'ScreenSharing');
  // Allow WebRTC for modern websites
  // app.commandLine.appendSwitch('disable-features', 'WebRTC');
  // Allow MediaStream for website functionality
  // app.commandLine.appendSwitch('disable-features', 'MediaStream');
  app.commandLine.appendSwitch('disable-features', 'CanvasCapture');
  // Allow video/audio capture for websites
  // app.commandLine.appendSwitch('disable-features', 'VideoCapture');
  // app.commandLine.appendSwitch('disable-features', 'AudioCapture');
  app.commandLine.appendSwitch('disable-features', 'ScreenRecording');
  app.commandLine.appendSwitch('disable-features', 'ScreenMirroring');
  app.commandLine.appendSwitch('disable-features', 'RemoteDesktop');
  app.commandLine.appendSwitch('disable-features', 'ScreenCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'DisplayMediaAPI');
  // Allow getUserMedia and MediaDevices for website functionality
  // app.commandLine.appendSwitch('disable-features', 'GetUserMedia');
  // app.commandLine.appendSwitch('disable-features', 'MediaDevices');
  app.commandLine.appendSwitch('disable-features', 'ScreenCapturePermission');
  app.commandLine.appendSwitch('disable-features', 'DisplayCapturePermission');
  
  // Additional switches to make window completely invisible to screen capture
  app.commandLine.appendSwitch('disable-features', 'WindowCapture');
  app.commandLine.appendSwitch('disable-features', 'TabCapture');
  app.commandLine.appendSwitch('disable-features', 'ApplicationCapture');
  app.commandLine.appendSwitch('disable-features', 'BrowserCapture');
  app.commandLine.appendSwitch('disable-features', 'DesktopCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'ScreenCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'DisplayCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'WindowCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'TabCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'ApplicationCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'BrowserCaptureAPI');
  app.commandLine.appendSwitch('disable-features', 'DesktopCapturePermission');
  app.commandLine.appendSwitch('disable-features', 'WindowCapturePermission');
  app.commandLine.appendSwitch('disable-features', 'TabCapturePermission');
  app.commandLine.appendSwitch('disable-features', 'ApplicationCapturePermission');
  app.commandLine.appendSwitch('disable-features', 'BrowserCapturePermission');
  
  // Set environment variables to force software rendering and prevent screen capture
  process.env.CHROME_FLAGS = '--disable-gpu --disable-gpu-sandbox --disable-software-rasterizer --disable-features=ScreenCapture,DisplayCapture,DesktopCapture,GetDisplayMedia,ScreenSharing,WebRTC,MediaStream,CanvasCapture,VideoCapture,AudioCapture,ScreenRecording,ScreenMirroring,RemoteDesktop,ScreenCaptureAPI,DisplayMediaAPI,GetUserMedia,MediaDevices,ScreenCapturePermission,DisplayCapturePermission --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=TranslateUI --disable-ipc-flooding-protection --max-active-webgl-contexts=0 --disable-gpu-process-crash-limit --disable-gpu-watchdog --disable-gpu-driver-bug-workarounds --disable-gpu-memory-buffer-video-frames --disable-features=VizDisplayCompositor --disable-component-extensions-with-background-pages --disable-default-apps --disable-extensions --disable-plugins --disable-plugins-discovery --disable-preconnect --disable-translate --disable-sync --disable-background-networking --disable-client-side-phishing-detection --disable-component-update --disable-domain-reliability --disable-features=BlinkGenPropertyTrees --disable-hang-monitor --disable-prompt-on-repost';
  process.env.ELECTRON_DISABLE_GPU = '1';
  process.env.ELECTRON_DISABLE_SCREEN_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_SCREEN_SHARING = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_GET_DISPLAY_MEDIA = '1';
  process.env.ELECTRON_DISABLE_SCREEN_SHARING = '1';
  process.env.ELECTRON_DISABLE_WEBRTC = '1';
  process.env.ELECTRON_DISABLE_MEDIA_STREAM = '1';
  process.env.ELECTRON_DISABLE_CANVAS_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_VIDEO_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_AUDIO_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_SCREEN_RECORDING = '1';
  process.env.ELECTRON_DISABLE_SCREEN_MIRRORING = '1';
  process.env.ELECTRON_DISABLE_REMOTE_DESKTOP = '1';
  process.env.ELECTRON_DISABLE_WINDOW_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_SHARING = '1';
  process.env.ELECTRON_DISABLE_SCREEN_MIRRORING = '1';
  process.env.ELECTRON_DISABLE_SCREEN_RECORDING = '1';
  process.env.ELECTRON_DISABLE_SCREEN_SHARING = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_SHARING = '1';
  process.env.ELECTRON_DISABLE_WINDOW_SHARING = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_MIRRORING = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_MIRRORING = '1';
  process.env.ELECTRON_DISABLE_WINDOW_MIRRORING = '1';
  process.env.ELECTRON_DISABLE_TAB_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_APPLICATION_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_BROWSER_CAPTURE = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_WINDOW_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_TAB_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_APPLICATION_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_BROWSER_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_GET_DISPLAY_MEDIA_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_SHARING_API = '1';
  process.env.ELECTRON_DISABLE_WEBRTC_API = '1';
  process.env.ELECTRON_DISABLE_MEDIA_STREAM_API = '1';
  process.env.ELECTRON_DISABLE_CANVAS_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_VIDEO_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_AUDIO_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_RECORDING_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_MIRRORING_API = '1';
  process.env.ELECTRON_DISABLE_REMOTE_DESKTOP_API = '1';
  process.env.ELECTRON_DISABLE_WINDOW_CAPTURE_API = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_SHARING_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_MIRRORING_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_RECORDING_API = '1';
  process.env.ELECTRON_DISABLE_SCREEN_SHARING_API = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_SHARING_API = '1';
  process.env.ELECTRON_DISABLE_WINDOW_SHARING_API = '1';
  process.env.ELECTRON_DISABLE_DESKTOP_MIRRORING_API = '1';
  process.env.ELECTRON_DISABLE_DISPLAY_MIRRORING_API = '1';
  process.env.ELECTRON_DISABLE_WINDOW_MIRRORING_API = '1';
  
  // Check if app was launched at startup (hidden)
  const isStartupLaunch = process.argv.includes('--hidden') || process.env.STARTUP_LAUNCH === 'true';
  
  createWindow(isStartupLaunch);
  registerGlobalShortcuts();

  // Write main process PID immediately
  const browserPidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
  writePidFile(browserPidFile, process.pid);
  console.log('🆔 Main process PID written:', process.pid);

  // No notification needed for startup

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cleanup all BrowserViews when all windows are closed
  cleanupBrowserViews();
  
  // Prevent app from quitting, keep running in background
  // Auto-restart after delay
  setTimeout(() => {
    if (!app.isQuiting) {
      createWindow();
    }
  }, 2000);
});

// Enhanced auto-restart functionality
app.on('before-quit', (event) => {
  if (!app.isQuiting) {
    event.preventDefault();
    app.isQuiting = true;
    
    // Cleanup all BrowserViews before restart
    cleanupBrowserViews();
    
    // No notification needed
    
    // Restart after delay
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 3000);
  }
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

ipcMain.handle('get-all-cookies', async (event) => {
  // Get cookies from all browser sessions (all tabs)
  let allCookies = [];
  
  // Get cookies from default session
  try {
    const defaultCookies = await session.defaultSession.cookies.get({});
    allCookies = allCookies.concat(defaultCookies);
  } catch (error) {
    console.error('Error getting default session cookies:', error);
  }
  
  // Get cookies from all BrowserView sessions
  for (const [tabId, browserView] of browserViews) {
    try {
      const sessionCookies = await browserView.webContents.session.cookies.get({});
      allCookies = allCookies.concat(sessionCookies);
    } catch (error) {
      console.error(`Error getting cookies from tab ${tabId}:`, error);
    }
  }
  
  // Remove duplicates based on name and domain
  const uniqueCookies = allCookies.filter((cookie, index, self) => 
    index === self.findIndex(c => c.name === cookie.name && c.domain === cookie.domain)
  );
  
  return uniqueCookies;
});

ipcMain.handle('clear-cookies', async () => {
  await session.defaultSession.clearStorageData({
    storages: ['cookies']
  });
});

ipcMain.handle('clear-cookies-for-domain', async (event, domain) => {
  const cookies = await session.defaultSession.cookies.get({ domain });
  for (const cookie of cookies) {
    await session.defaultSession.cookies.remove(cookie.url, cookie.name);
  }
});

ipcMain.handle('delete-cookie', async (event, { name, domain }) => {
  // Delete cookie from all sessions
  let deleted = false;
  
  // Try default session
  try {
    const defaultCookies = await session.defaultSession.cookies.get({ domain });
    const cookieToDelete = defaultCookies.find(cookie => cookie.name === name);
    if (cookieToDelete) {
      const cookieUrl = cookieToDelete.url || `https://${domain}`;
      await session.defaultSession.cookies.remove(cookieUrl, cookieToDelete.name);
      deleted = true;
    }
  } catch (error) {
    console.error('Error deleting cookie from default session:', error);
  }
  
  // Try all BrowserView sessions
  for (const [tabId, browserView] of browserViews) {
    try {
      const sessionCookies = await browserView.webContents.session.cookies.get({ domain });
      const cookieToDelete = sessionCookies.find(cookie => cookie.name === name);
      if (cookieToDelete) {
        const cookieUrl = cookieToDelete.url || `https://${domain}`;
        await browserView.webContents.session.cookies.remove(cookieUrl, cookieToDelete.name);
        deleted = true;
      }
    } catch (error) {
      console.error(`Error deleting cookie from tab ${tabId}:`, error);
    }
  }
  
  return deleted;
});

ipcMain.handle('clear-domain-cookies', async (event, domain) => {
  // Clear cookies for domain from all sessions
  let cleared = false;
  
  // Clear from default session
  try {
    const defaultCookies = await session.defaultSession.cookies.get({ domain });
    for (const cookie of defaultCookies) {
      const cookieUrl = cookie.url || `https://${domain}`;
      await session.defaultSession.cookies.remove(cookieUrl, cookie.name);
      cleared = true;
    }
  } catch (error) {
    console.error('Error clearing cookies from default session:', error);
  }
  
  // Clear from all BrowserView sessions
  for (const [tabId, browserView] of browserViews) {
    try {
      const sessionCookies = await browserView.webContents.session.cookies.get({ domain });
      for (const cookie of sessionCookies) {
        const cookieUrl = cookie.url || `https://${domain}`;
        await browserView.webContents.session.cookies.remove(cookieUrl, cookie.name);
        cleared = true;
      }
    } catch (error) {
      console.error(`Error clearing cookies from tab ${tabId}:`, error);
    }
  }
  
  return cleared;
});

ipcMain.handle('clear-all-cookies', async (event) => {
  // Clear all cookies from all sessions
  let cleared = false;
  
  // Clear from default session
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    cleared = true;
  } catch (error) {
    console.error('Error clearing cookies from default session:', error);
  }
  
  // Clear from all BrowserView sessions
  for (const [tabId, browserView] of browserViews) {
    try {
      await browserView.webContents.session.clearStorageData({
        storages: ['cookies']
      });
      cleared = true;
    } catch (error) {
      console.error(`Error clearing cookies from tab ${tabId}:`, error);
    }
  }
  
  return cleared;
});

ipcMain.handle('clear-all-storage', async () => {
  await session.defaultSession.clearStorageData({
    storages: ['cookies', 'localStorage', 'sessionStorage', 'indexedDB', 'websql', 'cacheStorage']
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
    // If URL is empty, load blank page
    if (url === '') {
      browserView.webContents.loadURL('about:blank').then(() => {
        console.log('Successfully loaded blank page');
        // Send empty URL to renderer to show blank in address bar
        mainWindow.webContents.send('browser-view-url', { tabId, url: '' });
      }).catch(err => {
        console.error('Failed to load blank page:', err);
      });
    } else {
      // Handle regular URLs
      browserView.webContents.loadURL(url).catch(err => {
        browserView.webContents.loadURL('data:text/html,<h1>Failed to load page</h1><p>Please check your internet connection.</p>');
      });
    }
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
ipcMain.handle('create-tab', (event, url = '') => {
  try {
    console.log('Creating new tab with URL:', url);
    const newTabId = ++tabCounter;
    console.log('New tab ID:', newTabId);
    
    // Handle special cookie management URL
    let finalUrl = url;
    if (url === 'cookie-management') {
      finalUrl = `file://${path.join(__dirname, 'cookie-management.html').replace(/\\/g, '/')}`;
    }
    
    createBrowserView(newTabId, finalUrl);
    return newTabId;
  } catch (error) {
    console.error('Error creating tab:', error);
    return null;
  }
});

ipcMain.handle('switch-tab', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView) {
    currentTabId = tabId;
    mainWindow.setBrowserView(browserView);
    // Track tab usage when switching
    updateTabUsage(tabId);
    return true;
  }
  return false;
});

ipcMain.handle('close-tab', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView && browserViews.size > 1) {
    console.log('Closing tab:', tabId);
    
    // Remove the BrowserView from the main window first
    if (mainWindow.getBrowserView() === browserView) {
      mainWindow.setBrowserView(null);
    }
    
    // Properly destroy the BrowserView to free memory
    try {
      // Clear all web contents and destroy the view
      browserView.webContents.destroy();
      // BrowserView doesn't have a destroy method, just remove it from the window
      console.log('BrowserView cleaned up for tab:', tabId);
    } catch (error) {
      console.error('Error destroying BrowserView:', error);
    }
    
    // Remove from our tracking map
    browserViews.delete(tabId);
    
    // Remove from usage history
    const historyIndex = tabUsageHistory.indexOf(tabId);
    if (historyIndex > -1) {
      tabUsageHistory.splice(historyIndex, 1);
    }
    
    // Save tabs when one is closed
    saveTabs();
    
    // Switch to another tab if we closed the current one
    if (tabId === currentTabId) {
      const remainingTabs = Array.from(browserViews.keys());
      if (remainingTabs.length > 0) {
        // Use the most recently used tab instead of just the first one
        const newCurrentTab = getMostRecentTab();
        if (newCurrentTab && browserViews.has(newCurrentTab)) {
          currentTabId = newCurrentTab;
          mainWindow.setBrowserView(browserViews.get(newCurrentTab));
          return newCurrentTab;
        }
      }
    }
    return true;
  }
  return false;
});

// Get current tab URL
ipcMain.handle('get-current-tab-url', (event, tabId) => {
  const browserView = browserViews.get(tabId);
  if (browserView) {
    const currentUrl = browserView.webContents.getURL();
    // Return empty string for about:blank to show blank in address bar
    return currentUrl === 'about:blank' ? '' : currentUrl;
  }
  return null;
});

// Find existing tab with specific URL or domain
ipcMain.handle('find-tab-with-url', (event, targetUrl) => {
  try {
    console.log('Finding tab with URL:', targetUrl);
    
    for (const [tabId, browserView] of browserViews) {
      if (browserView && browserView.webContents && !browserView.webContents.isDestroyed()) {
        try {
          const currentUrl = browserView.webContents.getURL();
          
          // Check if URLs match exactly (handle about:blank case)
          if ((currentUrl === 'about:blank' && targetUrl === '') || 
              (currentUrl !== 'about:blank' && currentUrl === targetUrl)) {
            console.log('Found exact URL match:', currentUrl);
            return tabId;
          }
          
          // Check if domains match for quick link services
          if (currentUrl !== 'about:blank' && targetUrl !== '') {
            try {
              const currentDomain = new URL(currentUrl).hostname;
              const targetDomain = new URL(targetUrl).hostname;
              
              // Define domain groups for quick links
              const domainGroups = {
                'chatgpt': ['chat.openai.com', 'chatgpt.com'],
                'deepseek': ['chat.deepseek.com', 'deepseek.com']
              };
              
              // Check if both URLs belong to the same service domain group
              for (const [service, domains] of Object.entries(domainGroups)) {
                if (domains.includes(currentDomain) && domains.includes(targetDomain)) {
                  console.log(`Found existing tab for ${service} service:`, currentUrl);
                  return tabId;
                }
              }
            } catch (error) {
              console.log('Error parsing URLs for domain comparison:', error);
              // Continue with normal flow if URL parsing fails
            }
          }
        } catch (error) {
          console.log('Error getting URL from browserView:', error);
          // Continue to next browserView
        }
      }
    }
  } catch (error) {
    console.error('Error in find-tab-with-url:', error);
  }
  
  return null; // No existing tab found
});

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    // Don't minimize - only allow hiding via hotkey
    mainWindow.setSkipTaskbar(true);
    // Keep window visible
    mainWindow.show();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.hide(); // Hide instead of close
    isHidden = true;
  }
});

// Hide browser handler
ipcMain.handle('hide-browser', () => {
  if (mainWindow) {
    mainWindow.hide();
    isHidden = true;
  }
});
