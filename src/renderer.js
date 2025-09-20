const { ipcRenderer } = require('electron');

class StealthBrowser {
    constructor() {
        this.urlInput = document.getElementById('url-input');
        this.loadingProgress = document.getElementById('loading-progress');
        this.statusText = document.getElementById('status-text');
        this.stealthMode = true; // Always enable stealth mode
        this.currentTabId = 0;
        this.tabs = new Map();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupBrowserViewListeners();
        this.loadSettings();
        this.initializeFirstTab();
    }

    setupEventListeners() {
        // Navigation controls
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                ipcRenderer.invoke('browser-view-back', this.currentTabId);
            });
        }

        const forwardBtn = document.getElementById('forward-btn');
        if (forwardBtn) {
            forwardBtn.addEventListener('click', () => {
                ipcRenderer.invoke('browser-view-forward', this.currentTabId);
            });
        }

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                ipcRenderer.invoke('browser-view-reload', this.currentTabId);
            });
        }

        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.navigateTo('https://www.google.com');
            });
        }

        // Address bar
        if (this.urlInput) {
            this.urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUrlSubmit();
                }
            });
        }

        const goBtn = document.getElementById('go-btn');
        if (goBtn) {
            goBtn.addEventListener('click', () => {
                this.handleUrlSubmit();
            });
        }

        // Stealth mode control
        const stealthBtn = document.getElementById('stealth-btn');
        if (stealthBtn) {
            stealthBtn.addEventListener('click', () => {
                this.toggleStealthMode();
            });
        }

        // Cookie management
        const cookieBtn = document.getElementById('cookie-btn');
        if (cookieBtn) {
            cookieBtn.addEventListener('click', () => {
                this.showCookieModal();
            });
        }

        // Tab management
        const newTabBtn = document.getElementById('new-tab-btn');
        if (newTabBtn) {
            newTabBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.createNewTab();
            };
        }

        // Tab switching and closing - use event delegation on tab bar
        const tabBar = document.getElementById('tab-bar');
        if (tabBar) {
            tabBar.addEventListener('click', (e) => {
                // Handle tab close button clicks
                if (e.target.classList.contains('tab-close')) {
                    e.stopPropagation();
                    const tabId = parseInt(e.target.dataset.tab);
                    this.closeTab(tabId);
                    return;
                }
                
                // Handle tab clicks (but not close button)
                if (e.target.closest('.tab')) {
                    const tabElement = e.target.closest('.tab');
                    const tabId = parseInt(tabElement.dataset.tab);
                    this.switchToTab(tabId);
                }
            });
        }

        // Listen for IPC messages from main process
        ipcRenderer.on('navigate', (event, url) => {
            this.navigateTo(url);
        });

        ipcRenderer.on('toggle-stealth', (event, enabled) => {
            this.setStealthMode(enabled);
        });
    }

    setupBrowserViewListeners() {
        // Listen for BrowserView events from main process
        ipcRenderer.on('browser-view-loading', (event, { tabId, loading }) => {
            if (tabId === this.currentTabId) {
                if (loading) {
                    this.showLoading();
                    this.statusText.textContent = 'Loading...';
                } else {
                    this.hideLoading();
                    this.statusText.textContent = 'Ready';
                    this.updateNavigationButtons();
                }
            }
        });

        ipcRenderer.on('browser-view-url', (event, { tabId, url }) => {
            if (tabId === this.currentTabId) {
                this.urlInput.value = url;
                this.updateSecurityIndicator(url);
            }
        });

        ipcRenderer.on('browser-view-title', (event, { tabId, title }) => {
            // Update tab title
            const tabElement = document.querySelector(`[data-tab="${tabId}"] .tab-title`);
            if (tabElement) {
                tabElement.textContent = title || 'New Tab';
            }
            
            // Update page title if it's the current tab
            if (tabId === this.currentTabId) {
                this.updatePageTitle(title);
            }
        });
    }

    handleUrlSubmit() {
        let url = this.urlInput.value.trim();
        if (!url) return;
        
        url = this.autoDetectUrl(url);
        this.navigateTo(url);
    }

    autoDetectUrl(input) {
        // If it looks like a URL, add protocol if missing
        if (input.includes('.') && !input.includes(' ')) {
            if (!input.startsWith('http://') && !input.startsWith('https://')) {
                return 'https://' + input;
            }
            return input;
        }
        
        // Otherwise, treat as search query
        return 'https://www.google.com/search?q=' + encodeURIComponent(input);
    }

    navigateTo(url) {
        ipcRenderer.invoke('browser-view-navigate', { tabId: this.currentTabId, url });
    }

    updateAddressBar() {
        // Address bar is updated via IPC events from BrowserView
    }

    updateSecurityIndicator(url) {
        const indicator = document.getElementById('security-indicator');
        const connectionStatus = document.getElementById('connection-status');
        
        if (url && url.startsWith('https://')) {
            indicator.style.color = '#4ade80';
            connectionStatus.textContent = 'Secure';
            connectionStatus.className = 'connection-secure';
        } else {
            indicator.style.color = '#f87171';
            connectionStatus.textContent = 'Not Secure';
            connectionStatus.className = 'connection-insecure';
        }
    }

    async updateNavigationButtons() {
        const canGoBack = await ipcRenderer.invoke('browser-view-can-go-back', this.currentTabId);
        const canGoForward = await ipcRenderer.invoke('browser-view-can-go-forward', this.currentTabId);
        
        document.getElementById('back-btn').disabled = !canGoBack;
        document.getElementById('forward-btn').disabled = !canGoForward;
    }

    updatePageTitle(title) {
        const titleElement = document.querySelector('.page-title');
        if (titleElement) {
            titleElement.textContent = title || 'Stealth Browser';
        }
    }

    showLoading() {
        this.loadingProgress.style.width = '0%';
        this.loadingProgress.classList.add('loading');
        this.statusText.textContent = 'Loading...';
    }

    hideLoading() {
        this.loadingProgress.classList.remove('loading');
        this.loadingProgress.style.width = '100%';
        setTimeout(() => {
            this.loadingProgress.style.width = '0%';
        }, 200);
    }

    toggleStealthMode() {
        this.stealthMode = !this.stealthMode;
        this.setStealthMode(this.stealthMode);
    }

    setStealthMode(enabled) {
        this.stealthMode = enabled;
        const stealthBtn = document.getElementById('stealth-btn');
        
        if (stealthBtn) {
            if (enabled) {
                stealthBtn.classList.add('active');
                stealthBtn.style.color = '#a855f7';
            } else {
                stealthBtn.classList.remove('active');
                stealthBtn.style.color = '#e0e0e0';
            }
        }

        // Stealth mode is handled by the main process
    }

    // Stealth mode is handled by the main process for BrowserView

    loadSettings() {
        // Always enable stealth mode
        this.setStealthMode(true);
    }

    saveSettings() {
        localStorage.setItem('stealthMode', this.stealthMode.toString());
    }

    initializeFirstTab() {
        // Initialize the first tab (tab 0)
        this.tabs.set(0, { id: 0, title: 'New Tab', url: 'https://www.google.com' });
        this.currentTabId = 0;
        
        // Update the first tab element
        const firstTab = document.querySelector('[data-tab="0"]');
        if (firstTab) {
            firstTab.classList.add('active');
        }
    }

    // Tab management methods
    async createNewTab(url = 'https://www.google.com') {
        try {
            const newTabId = await ipcRenderer.invoke('create-tab', url);
            this.tabs.set(newTabId, { id: newTabId, title: 'New Tab', url });
            this.createTabElement(newTabId);
            this.switchToTab(newTabId);
        } catch (error) {
            console.error('Error creating new tab:', error);
        }
    }

    createTabElement(tabId) {
        const tabBar = document.getElementById('tab-bar');
        const newTabBtn = tabBar.querySelector('.new-tab-btn');
        
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tab = tabId;
        tabElement.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close" data-tab="${tabId}">×</button>
        `;
        
        tabBar.insertBefore(tabElement, newTabBtn);
    }

    async switchToTab(tabId) {
        const success = await ipcRenderer.invoke('switch-tab', tabId);
        if (success) {
            this.currentTabId = tabId;
            
            // Update active tab
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
            
            // Update navigation buttons
            this.updateNavigationButtons();
        }
    }

    async closeTab(tabId) {
        const newCurrentTabId = await ipcRenderer.invoke('close-tab', tabId);
        if (newCurrentTabId !== false) {
            // Remove tab element
            const tabElement = document.querySelector(`[data-tab="${tabId}"]`);
            if (tabElement) {
                tabElement.remove();
            }
            
            // Switch to new current tab if needed
            if (newCurrentTabId && newCurrentTabId !== this.currentTabId) {
                this.switchToTab(newCurrentTabId);
            }
            
            this.tabs.delete(tabId);
        }
    }

    // Cookie management methods
    showCookieModal() {
        const modal = document.getElementById('cookie-modal');
        if (modal) {
            modal.style.display = 'block';
            this.setupCookieModalEvents();
        }
    }

    hideCookieModal() {
        const modal = document.getElementById('cookie-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    setupCookieModalEvents() {
        // Close modal button
        const closeBtn = document.getElementById('cookie-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.hideCookieModal();
        }

        // Close modal when clicking outside
        const modal = document.getElementById('cookie-modal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.hideCookieModal();
                }
            };
        }

        // View cookies button
        const viewBtn = document.getElementById('view-cookies-btn');
        if (viewBtn) {
            viewBtn.onclick = () => this.viewCookies();
        }

        // Clear cookies button
        const clearBtn = document.getElementById('clear-cookies-btn');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearAllCookies();
        }
    }

    async viewCookies() {
        try {
            const currentUrl = this.urlInput.value;
            if (!currentUrl) {
                alert('No URL available to view cookies');
                return;
            }

            const cookies = await ipcRenderer.invoke('get-cookies', currentUrl);
            this.displayCookies(cookies);
        } catch (error) {
            console.error('Error viewing cookies:', error);
            alert('Error loading cookies');
        }
    }

    displayCookies(cookies) {
        const cookieList = document.getElementById('cookie-list');
        if (!cookieList) return;

        if (cookies.length === 0) {
            cookieList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No cookies found for this site</p>';
            return;
        }

        cookieList.innerHTML = cookies.map(cookie => `
            <div class="cookie-item">
                <div class="cookie-info">
                    <div class="cookie-name">${cookie.name}</div>
                    <div class="cookie-domain">${cookie.domain}</div>
                    <div class="cookie-value">${cookie.value}</div>
                </div>
                <div class="cookie-actions">
                    <button class="cookie-delete" onclick="this.deleteCookie('${cookie.name}', '${cookie.domain}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async clearAllCookies() {
        if (confirm('Are you sure you want to clear all cookies? This action cannot be undone.')) {
            try {
                await ipcRenderer.invoke('clear-cookies');
                alert('All cookies have been cleared');
                this.hideCookieModal();
            } catch (error) {
                console.error('Error clearing cookies:', error);
                alert('Error clearing cookies');
            }
        }
    }
}

// Initialize the browser when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StealthBrowser();
});