const { ipcRenderer } = require('electron');

class StealthBrowser {
    constructor() {
        this.urlInput = document.getElementById('url-input');
        this.loadingProgress = document.getElementById('loading-progress');
        this.statusText = document.getElementById('status-text');
        this.autocompleteDropdown = document.getElementById('autocomplete-dropdown');
        this.stealthMode = true; // Always enable stealth mode
        this.currentTabId = 0;
        this.tabs = new Map();
        this.isCreatingTab = false; // Flag to prevent duplicate tab creation
        this.isHandlingQuickLink = false; // Flag to prevent multiple quick link clicks
        this.isNavigating = false; // Flag to prevent concurrent navigation
        this.navigationQueue = []; // Queue for pending navigation requests
        this.loadingStates = new Map(); // Track loading state per tab
        
        // Autocomplete properties
        this.autocompleteSuggestions = [];
        this.selectedSuggestionIndex = -1;
        this.autocompleteTimeout = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupBrowserViewListeners();
        this.setupWindowControls();
        this.loadSettings();
        this.initializeFirstTab();
        this.checkAuthStatus();
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
                const isLoading = this.loadingStates.get(this.currentTabId) || false;
                if (isLoading) {
                    // Stop loading
                    ipcRenderer.invoke('browser-view-stop', this.currentTabId);
                } else {
                    // Refresh page
                    ipcRenderer.invoke('browser-view-reload', this.currentTabId);
                }
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

            // Select all text when clicking on address bar
            this.urlInput.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.target.focus();
                e.target.select();
            });

            // Also select all text when focusing on address bar
            this.urlInput.addEventListener('focus', (e) => {
                e.target.select();
            });

            // Ensure focus works on mousedown as well
            this.urlInput.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.target.focus();
            });

            // Autocomplete functionality
            this.urlInput.addEventListener('input', (e) => {
                this.handleAutocompleteInput(e.target.value);
            });

            this.urlInput.addEventListener('keydown', (e) => {
                this.handleAutocompleteKeydown(e);
            });

            // Hide autocomplete when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.urlInput.contains(e.target) && !this.autocompleteDropdown.contains(e.target)) {
                    this.hideAutocomplete();
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
                this.showCookieManagement();
            });
        }

        // Paste cookie button
        const pasteCookieBtn = document.getElementById('paste-cookie-btn');
        if (pasteCookieBtn) {
            pasteCookieBtn.addEventListener('click', () => {
                this.pasteCookieFromClipboard();
            });
        }



        // Google account management

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

            // Handle middle mouse button (scroll wheel click) on tabs
            tabBar.addEventListener('mousedown', (e) => {
                if (e.button === 1) { // Middle mouse button
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Find the tab element that was clicked
                    const tabElement = e.target.closest('.tab');
                    if (tabElement) {
                        const tabId = parseInt(tabElement.dataset.tab);
                        console.log('Middle click on tab:', tabId);
                        this.closeTab(tabId);
                    }
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

        // Handle tab restoration
        ipcRenderer.on('tab-restored', (event, { tabId, url, title }) => {
            console.log('Tab restored:', { tabId, url, title });
            this.tabs.set(tabId, { id: tabId, title, url });
            this.createTabElement(tabId);
        });

        // Listen for global keyboard shortcuts from main process
        ipcRenderer.on('create-new-tab', () => {
            console.log('Received create-new-tab from main process');
            this.createNewTab();
        });

        ipcRenderer.on('close-current-tab', () => {
            console.log('Received close-current-tab from main process');
            this.closeCurrentTab();
        });

        // Type word from clipboard feedback events
        ipcRenderer.on('type-word-success', (event, message) => {
            this.showTypeWordNotification(message, 'success');
        });

        ipcRenderer.on('type-word-error', (event, error) => {
            this.showTypeWordNotification(error, 'error');
        });

        // Handle quick navigation buttons
        this.setupQuickNavButtons();

        // Hide browser when clicking on empty areas
        const browserContainer = document.querySelector('.browser-container');
        if (browserContainer) {
            browserContainer.addEventListener('click', (e) => {
                // Only hide if clicking on the container itself, not on interactive elements
                if (e.target === browserContainer) {
                    ipcRenderer.invoke('hide-browser');
                }
            });
        }

    }

    setupWindowControls() {
        // Minimize button
        const minimizeBtn = document.getElementById('minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                ipcRenderer.invoke('window-minimize');
            });
        }

        // Maximize button
        const maximizeBtn = document.getElementById('maximize-btn');
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                ipcRenderer.invoke('window-maximize');
            });
        }

        // Close button
        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                ipcRenderer.invoke('window-close');
            });
        }
    }

    setupBrowserViewListeners() {
        // Listen for BrowserView events from main process
        ipcRenderer.on('browser-view-loading', (event, { tabId, loading, timeout, stopped }) => {
            // Update loading state for the tab
            this.loadingStates.set(tabId, loading);
            
            if (tabId === this.currentTabId) {
                if (loading) {
                    this.showLoading();
                    this.statusText.textContent = 'Loading...';
                } else {
                    this.hideLoading();
                    if (stopped) {
                        this.statusText.textContent = 'Stopped';
                    } else if (timeout) {
                        this.statusText.textContent = 'Loading timeout';
                    } else {
                        this.statusText.textContent = 'Ready';
                    }
                    this.updateNavigationButtons();
                    
                    // Process queued navigation requests when loading completes
                    setTimeout(() => {
                        this.processNavigationQueue();
                    }, 500);
                }
            }
        });
        
        // Listen for error events
        ipcRenderer.on('browser-view-error', (event, { tabId, error, errorCode, url }) => {
            console.log(`❌ Browser error in tab ${tabId}:`, error);
            
            if (tabId === this.currentTabId) {
                this.hideLoading();
                this.statusText.textContent = `Error: ${error}`;
                
                // Show error message in address bar
                if (this.addressInput) {
                    this.addressInput.value = url || '';
                }
            }
        });


        ipcRenderer.on('browser-view-url', (event, { tabId, url }) => {
            console.log('Received browser-view-url:', { tabId, url, currentTabId: this.currentTabId });
            if (tabId === this.currentTabId) {
                // Show blank for new tabs, otherwise show the URL
                this.urlInput.value = url === '' ? '' : url;
                this.updateSecurityIndicator(url);
                
                // Show/hide blank page overlay
                console.log('Toggling blank page overlay for URL:', url);
                this.toggleBlankPageOverlay(url === '');
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
        
        // Hide autocomplete when submitting
        this.hideAutocomplete();
        
        // If URL is empty, show blank page
        if (!url) {
            this.navigateTo('');
            return;
        }
        
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

    async navigateTo(url) {
        // Check if we're already navigating
        if (this.isNavigating) {
            console.log('Navigation already in progress, queuing request:', url);
            this.navigationQueue.push({ tabId: this.currentTabId, url });
            return;
        }

        // Check if current tab is loading
        const isLoading = this.loadingStates.get(this.currentTabId);
        if (isLoading) {
            console.log('Tab is currently loading, queuing navigation request:', url);
            this.navigationQueue.push({ tabId: this.currentTabId, url });
            return;
        }

        try {
            this.isNavigating = true;
            console.log('Navigating to:', url, 'in tab:', this.currentTabId);
            
            await ipcRenderer.invoke('browser-view-navigate', { tabId: this.currentTabId, url });
            
            // Process queued navigation requests after a short delay
            setTimeout(() => {
                this.processNavigationQueue();
            }, 1000);
            
        } catch (error) {
            console.error('Navigation failed:', error);
        } finally {
            this.isNavigating = false;
        }
    }

    async processNavigationQueue() {
        if (this.navigationQueue.length === 0 || this.isNavigating) {
            return;
        }

        const nextNavigation = this.navigationQueue.shift();
        if (nextNavigation) {
            console.log('Processing queued navigation:', nextNavigation.url);
            await this.navigateTo(nextNavigation.url);
        }
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
        const isLoading = this.loadingStates.get(this.currentTabId) || false;
        
        document.getElementById('back-btn').disabled = !canGoBack;
        document.getElementById('forward-btn').disabled = !canGoForward;
        
        // Update refresh/stop button based on loading state
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            if (isLoading) {
                refreshBtn.title = 'Stop Loading';
                refreshBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                `;
            } else {
                refreshBtn.title = 'Refresh';
                refreshBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                `;
            }
        }
    }

    updatePageTitle(title) {
        const titleElement = document.querySelector('.page-title');
        if (titleElement) {
            titleElement.textContent = title || 'Stealth Browser';
        }
    }

    showLoading() {
        // Simple loading indicator
        this.statusText.textContent = 'Loading...';
        this.loadingProgress.style.width = '100%';
        this.loadingProgress.classList.add('loading');
        
        // Show stop button during loading
        this.updateNavigationButtons();
    }

    hideLoading() {
        // Simple loading completion
        this.loadingProgress.classList.remove('loading');
        
        // Hide progress bar after completion
        setTimeout(() => {
            this.loadingProgress.style.width = '0%';
        }, 300);
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }

    // Removed fake progress animation - using simple loading indicator instead

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
        this.tabs.set(0, { id: 0, title: 'New Tab', url: '' });
        this.currentTabId = 0;
        
        // Update the first tab element
        const firstTab = document.querySelector('[data-tab="0"]');
        if (firstTab) {
            firstTab.classList.add('active');
        }
        
        // Show the blank page overlay for the new tab
        this.toggleBlankPageOverlay(true);
    }

    // Tab management methods
    async createNewTab(url = '') {
        // Prevent duplicate tab creation
        if (this.isCreatingTab) {
            console.log('Tab creation already in progress, skipping...');
            return;
        }
        
        this.isCreatingTab = true;
        try {
            console.log('Creating new tab with URL:', url);
            const newTabId = await ipcRenderer.invoke('create-tab', url);
            console.log('New tab created with ID:', newTabId);
            
            // Set appropriate title based on URL
            let title = 'New Tab';
            if (url === 'cookie-management') {
                title = 'Cookie Management';
            }
            
            this.tabs.set(newTabId, { id: newTabId, title, url });
            this.createTabElement(newTabId);
            await this.switchToTab(newTabId);
            
            // Auto-focus the URL input for new tabs
            if (this.urlInput) {
                // Small delay to ensure the tab switch is complete
                setTimeout(() => {
                    this.urlInput.focus();
                    this.urlInput.select(); // Select all text for easy replacement
                    console.log('Auto-focused URL input for new tab');
                }, 100);
            }
            
            // Ensure the URL is loaded
            console.log('Switching to new tab and loading URL:', url);
        } catch (error) {
            console.error('Error creating new tab:', error);
        } finally {
            this.isCreatingTab = false;
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
            
            // Update URL bar with current tab's URL
            await this.updateUrlBarForCurrentTab();
            
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
                 this.currentTabId = newCurrentTabId;
                 
                 // Update active tab
                 document.querySelectorAll('.tab').forEach(tab => {
                     tab.classList.remove('active');
                 });
                 const activeTab = document.querySelector(`[data-tab="${newCurrentTabId}"]`);
                 if (activeTab) {
                     activeTab.classList.add('active');
                 }
                 
                 // Update URL bar with new current tab's URL
                 await this.updateUrlBarForCurrentTab();
                 
                 // Update navigation buttons
                 this.updateNavigationButtons();
             }
             
             this.tabs.delete(tabId);
         }
     }

    async closeCurrentTab() {
        // Always try to close the current tab
        // The main process will prevent closing if it's the last tab
        await this.closeTab(this.currentTabId);
    }

    // Autocomplete methods
    async handleAutocompleteInput(value) {
        // Clear previous timeout
        if (this.autocompleteTimeout) {
            clearTimeout(this.autocompleteTimeout);
        }

        // Hide autocomplete if input is too short
        if (!value || value.length < 2) {
            this.hideAutocomplete();
            return;
        }

        // Debounce the search
        this.autocompleteTimeout = setTimeout(async () => {
            try {
                const suggestions = await ipcRenderer.invoke('get-url-suggestions', { 
                    query: value, 
                    limit: 6 
                });
                this.autocompleteSuggestions = suggestions;
                this.selectedSuggestionIndex = -1;
                this.showAutocomplete(suggestions);
            } catch (error) {
                console.error('Error getting search suggestions:', error);
            }
        }, 150);
    }

    handleAutocompleteKeydown(e) {
        if (!this.autocompleteDropdown.classList.contains('show')) {
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedSuggestionIndex = Math.min(
                    this.selectedSuggestionIndex + 1,
                    this.autocompleteSuggestions.length - 1
                );
                this.updateSelectedSuggestion();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
                this.updateSelectedSuggestion();
                break;

            case 'Enter':
                e.preventDefault();
                if (this.selectedSuggestionIndex >= 0) {
                    const suggestion = this.autocompleteSuggestions[this.selectedSuggestionIndex];
                    this.urlInput.value = suggestion.url;
                    this.hideAutocomplete();
                    this.navigateTo(suggestion.url);
                } else {
                    this.handleUrlSubmit();
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.hideAutocomplete();
                break;
        }
    }

    showAutocomplete(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            this.hideAutocomplete();
            return;
        }

        this.autocompleteDropdown.innerHTML = '';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.dataset.index = index;
            
            const timeAgo = this.getTimeAgo(suggestion.lastVisited);
            
            item.innerHTML = `
                <div class="autocomplete-item-title">${this.escapeHtml(suggestion.title)}</div>
                <div class="autocomplete-item-url">${this.escapeHtml(suggestion.url)}</div>
                <div class="autocomplete-item-meta">
                    <span class="autocomplete-item-count">${suggestion.count} visits</span>
                    <span class="autocomplete-item-time">${timeAgo}</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.urlInput.value = suggestion.url;
                this.hideAutocomplete();
                this.navigateTo(suggestion.url);
            });
            
            this.autocompleteDropdown.appendChild(item);
        });
        
        this.autocompleteDropdown.classList.add('show');
    }

    updateSelectedSuggestion() {
        const items = this.autocompleteDropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    hideAutocomplete() {
        this.autocompleteDropdown.classList.remove('show');
        this.autocompleteDropdown.innerHTML = '';
        this.selectedSuggestionIndex = -1;
        this.autocompleteSuggestions = [];
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Cookie management methods
    async showCookieManagement() {
        // Check if cookie management tab is already open
        const cookieManagementTab = this.findCookieManagementTab();
        if (cookieManagementTab) {
            // Switch to existing cookie management tab
            await this.switchToTab(cookieManagementTab.id);
            return;
        }
        
        // Create a new tab for cookie management using special URL
        await this.createNewTab('cookie-management');
    }

    async pasteCookieFromClipboard() {
        try {
            // Get the current tab's URL to determine the domain
            const currentUrl = await ipcRenderer.invoke('get-current-tab-url', this.currentTabId);
            
            if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
                this.showNotification('No active website to paste cookies to', 'error');
                return;
            }

            // Extract domain from URL
            let domain;
            try {
                const url = new URL(currentUrl);
                domain = url.hostname;
            } catch (error) {
                this.showNotification('Invalid URL format', 'error');
                return;
            }

            // Get clipboard content
            const clipboardContent = await navigator.clipboard.readText();
            
            if (!clipboardContent.trim()) {
                this.showNotification('Clipboard is empty', 'error');
                return;
            }

            // Parse cookies from clipboard content
            const cookies = this.parseCookiesFromText(clipboardContent, domain);
            
            if (cookies.length === 0) {
                this.showNotification('No valid cookies found in clipboard', 'error');
                return;
            }

            // Set cookies for the current domain
            let successCount = 0;
            for (const cookie of cookies) {
                try {
                    // Handle special cookie prefixes
                    let cookieConfig = {
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path || '/',
                        secure: cookie.secure || false,
                        httpOnly: cookie.httpOnly || false,
                        sameSite: cookie.sameSite || 'lax'
                    };

                    // Handle __Host- prefix (requires secure, no domain, path=/)
                    if (cookie.name.startsWith('__Host-')) {
                        cookieConfig.secure = true;
                        cookieConfig.domain = undefined; // __Host- cookies cannot have domain
                        cookieConfig.path = '/';
                    }
                    
                    // Handle __Secure- prefix (requires secure)
                    if (cookie.name.startsWith('__Secure-')) {
                        cookieConfig.secure = true;
                    }

                    await ipcRenderer.invoke('set-cookie', cookieConfig);
                    successCount++;
                } catch (error) {
                    console.error('Error setting cookie:', cookie.name, error);
                }
            }

            if (successCount > 0) {
                this.showNotification(`Successfully pasted ${successCount} cookie(s) for ${domain}`, 'success');
                // Refresh the page to apply the new cookies
                ipcRenderer.invoke('browser-view-reload', this.currentTabId);
            } else {
                this.showNotification('Failed to paste any cookies', 'error');
            }

        } catch (error) {
            console.error('Error pasting cookies:', error);
            this.showNotification('Error pasting cookies: ' + error.message, 'error');
        }
    }

    parseCookiesFromText(text, domain) {
        const cookies = [];
        const trimmedText = text.trim();
        
        // First, try to parse as JSON array (most common format from browser dev tools)
        if (trimmedText.startsWith('[') && trimmedText.endsWith(']')) {
            try {
                const cookieArray = JSON.parse(trimmedText);
                if (Array.isArray(cookieArray)) {
                    for (const cookieObj of cookieArray) {
                        if (cookieObj && typeof cookieObj === 'object' && cookieObj.name && cookieObj.value) {
                            cookies.push({
                                name: cookieObj.name,
                                value: cookieObj.value,
                                domain: cookieObj.domain || domain,
                                path: cookieObj.path || '/',
                                secure: cookieObj.secure || false,
                                httpOnly: cookieObj.httpOnly || false,
                                sameSite: cookieObj.sameSite || 'lax'
                            });
                        }
                    }
                    return cookies;
                }
            } catch (error) {
                console.log('Failed to parse JSON array, trying other formats:', error);
            }
        }
        
        // If not JSON array, try parsing line by line
        const lines = text.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // Handle different cookie formats
            let cookieData = null;
            
            // Format 1: "name=value; domain=.example.com; path=/; secure"
            if (trimmedLine.includes('=') && trimmedLine.includes(';')) {
                cookieData = this.parseCookieString(trimmedLine, domain);
            }
            // Format 2: "name=value" (simple format)
            else if (trimmedLine.includes('=') && !trimmedLine.includes(';')) {
                const [name, value] = trimmedLine.split('=', 2);
                if (name && value) {
                    cookieData = {
                        name: name.trim(),
                        value: value.trim(),
                        domain: domain,
                        path: '/',
                        secure: false,
                        httpOnly: false,
                        sameSite: 'lax'
                    };
                }
            }
            // Format 3: JSON object format
            else if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmedLine);
                    if (parsed.name && parsed.value) {
                        cookieData = {
                            name: parsed.name,
                            value: parsed.value,
                            domain: parsed.domain || domain,
                            path: parsed.path || '/',
                            secure: parsed.secure || false,
                            httpOnly: parsed.httpOnly || false,
                            sameSite: parsed.sameSite || 'lax'
                        };
                    }
                } catch (error) {
                    console.log('Failed to parse JSON cookie:', error);
                }
            }
            
            if (cookieData) {
                cookies.push(cookieData);
            }
        }
        
        return cookies;
    }

    parseCookieString(cookieString, defaultDomain) {
        const parts = cookieString.split(';');
        const cookie = {
            domain: defaultDomain,
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: 'lax'
        };
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            
            if (i === 0) {
                // First part is name=value
                const [name, value] = part.split('=', 2);
                if (name && value) {
                    cookie.name = name.trim();
                    cookie.value = value.trim();
                }
            } else {
                // Other parts are attributes
                const [key, value] = part.split('=', 2);
                const lowerKey = key.toLowerCase();
                
                switch (lowerKey) {
                    case 'domain':
                        cookie.domain = value ? value.trim() : defaultDomain;
                        break;
                    case 'path':
                        cookie.path = value ? value.trim() : '/';
                        break;
                    case 'secure':
                        cookie.secure = true;
                        break;
                    case 'httponly':
                        cookie.httpOnly = true;
                        break;
                    case 'samesite':
                        cookie.sameSite = value ? value.trim().toLowerCase() : 'lax';
                        break;
                }
            }
        }
        
        return cookie.name && cookie.value ? cookie : null;
    }
    
    findCookieManagementTab() {
        // Look for a tab that has the cookie management URL or title
        for (const [tabId, tab] of this.tabs) {
            if ((tab.url && tab.url.includes('cookie-management.html')) || 
                (tab.title && tab.title === 'Cookie Management')) {
                return tab;
            }
        }
        return null;
    }

    hideCookieModal() {
        const modal = document.getElementById('cookie-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    setupCookieModalEvents() {
        console.log('Setting up cookie modal events');
        
        // Close modal button
        const closeBtn = document.getElementById('cookie-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log('Close button clicked');
                this.hideCookieModal();
            };
            console.log('Close button event attached');
        } else {
            console.log('Close button not found');
        }

        // Close modal when clicking outside
        const modal = document.getElementById('cookie-modal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    console.log('Modal background clicked');
                    this.hideCookieModal();
                }
            };
        }

        // Refresh cookies button
        const refreshBtn = document.getElementById('refresh-cookies-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                console.log('Refresh button clicked');
                this.refreshCookies();
            };
            console.log('Refresh button event attached');
        } else {
            console.log('Refresh button not found');
        }

        // Clear all cookies button
        const clearAllBtn = document.getElementById('clear-all-cookies-btn');
        if (clearAllBtn) {
            clearAllBtn.onclick = () => {
                console.log('Clear all button clicked');
                this.clearAllCookies();
            };
            console.log('Clear all button event attached');
        } else {
            console.log('Clear all button not found');
        }

        // Search functionality
        const searchInput = document.getElementById('cookie-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                console.log('Search input changed:', e.target.value);
                this.filterCookies(e.target.value);
            });
            console.log('Search input event attached');
        } else {
            console.log('Search input not found');
        }

        // Load cookies when modal opens
        console.log('Loading cookies...');
        this.refreshCookies();
    }

    async refreshCookies() {
        try {
            const cookies = await ipcRenderer.invoke('get-all-cookies');
            this.displayCookiesByDomain(cookies);
            this.updateCookieStats(cookies);
        } catch (error) {
            console.error('Error fetching cookies:', error);
        }
    }

    displayCookiesByDomain(cookies) {
        const cookieDomains = document.getElementById('cookie-domains');
        if (!cookieDomains) return;

        if (!cookies || cookies.length === 0) {
            cookieDomains.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px;">No cookies found</div>';
            return;
        }

        // Group cookies by domain
        const domainGroups = {};
        cookies.forEach(cookie => {
            const domain = cookie.domain || 'Unknown';
            if (!domainGroups[domain]) {
                domainGroups[domain] = [];
            }
            domainGroups[domain].push(cookie);
        });

        let html = '';
        Object.keys(domainGroups).sort().forEach(domain => {
            const domainCookies = domainGroups[domain];
            const domainId = domain.replace(/[^a-zA-Z0-9]/g, '_');
            
            html += `
                <div class="domain-group" data-domain="${domain}">
                    <div class="domain-header" onclick="toggleDomain('${domainId}')">
                        <div class="domain-info">
                            <span class="domain-name">${domain}</span>
                            <span class="domain-count">${domainCookies.length} cookies</span>
                        </div>
                        <div class="domain-actions">
                            <button class="domain-delete-btn" onclick="event.stopPropagation(); clearDomainCookies('${domain}')">
                                Clear Domain
                            </button>
                            <button class="domain-toggle" id="toggle-${domainId}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="domain-cookies" id="cookies-${domainId}">
                        ${domainCookies.map(cookie => `
                            <div class="cookie-item">
                                <div class="cookie-info">
                                    <div class="cookie-name">${cookie.name}</div>
                                    <div class="cookie-value">${cookie.value}</div>
                                </div>
                                <div class="cookie-actions">
                                    <button class="cookie-delete-btn" onclick="deleteCookie('${cookie.name}', '${cookie.domain}')">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        cookieDomains.innerHTML = html;
    }

    updateCookieStats(cookies) {
        const totalCookies = document.getElementById('total-cookies');
        const totalDomains = document.getElementById('total-domains');
        
        if (totalCookies) {
            totalCookies.textContent = cookies ? cookies.length : 0;
        }
        
        if (totalDomains) {
            const domains = new Set();
            if (cookies) {
                cookies.forEach(cookie => {
                    domains.add(cookie.domain || 'Unknown');
                });
            }
            totalDomains.textContent = domains.size;
        }
    }

    filterCookies(searchTerm) {
        const domainGroups = document.querySelectorAll('.domain-group');
        const searchLower = searchTerm.toLowerCase();

        domainGroups.forEach(group => {
            const domainName = group.querySelector('.domain-name').textContent.toLowerCase();
            const cookies = group.querySelectorAll('.cookie-item');
            let hasVisibleCookies = false;

            cookies.forEach(cookie => {
                const cookieName = cookie.querySelector('.cookie-name').textContent.toLowerCase();
                const cookieValue = cookie.querySelector('.cookie-value').textContent.toLowerCase();
                
                const matches = domainName.includes(searchLower) || 
                              cookieName.includes(searchLower) || 
                              cookieValue.includes(searchLower);
                
                cookie.style.display = matches ? 'flex' : 'none';
                if (matches) hasVisibleCookies = true;
            });

            group.style.display = hasVisibleCookies || domainName.includes(searchLower) ? 'block' : 'none';
        });
    }

    async clearAllCookies() {
        if (confirm('Are you sure you want to clear ALL cookies? This action cannot be undone.')) {
            try {
                await ipcRenderer.invoke('clear-all-cookies');
                this.refreshCookies();
            } catch (error) {
                console.error('Error clearing cookies:', error);
            }
        }
    }


    // Update URL bar for current tab
    async updateUrlBarForCurrentTab() {
        try {
            const currentUrl = await ipcRenderer.invoke('get-current-tab-url', this.currentTabId);
            if (this.urlInput) {
                // Show blank for new tabs, otherwise show the URL
                this.urlInput.value = (currentUrl === '') ? '' : currentUrl;
                this.updateSecurityIndicator(currentUrl);
                
                // Show/hide blank page overlay
                this.toggleBlankPageOverlay(currentUrl === '');
            }
        } catch (error) {
            console.error('Error getting current tab URL:', error);
        }
    }

    // Setup quick navigation buttons
    setupQuickNavButtons() {
        const quickNavButtons = document.querySelectorAll('.quick-nav-btn');
        console.log('Setting up quick nav buttons:', quickNavButtons.length);
        quickNavButtons.forEach((button, index) => {
            const url = button.getAttribute('data-url');
            console.log(`Quick nav button ${index}:`, url, button);
            
            // Add click event listener
            button.addEventListener('click', async (e) => {
                console.log('Quick nav button click event triggered!', e);
                e.preventDefault();
                e.stopPropagation();
                console.log('Quick nav button clicked:', url);
                await this.handleQuickLinkClick(url);
            });
        });
    }

    async handleQuickLinkClick(url) {
        // Prevent multiple rapid clicks
        if (this.isHandlingQuickLink) {
            console.log('Already handling quick link, ignoring click');
            return;
        }
        
        this.isHandlingQuickLink = true;
        
        try {
            console.log('Handling quick link click for URL:', url);
            
            // Add a small delay to prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if current tab is a new tab (blank page)
            const currentUrl = await ipcRenderer.invoke('get-current-tab-url', this.currentTabId);
            const isCurrentTabNew = currentUrl === '' || currentUrl === null;
            
            console.log('Current tab URL:', currentUrl, 'Is new tab:', isCurrentTabNew);
            
            if (isCurrentTabNew) {
                // Current tab is new tab - navigate in current tab and update URL bar
                console.log('Navigating in current tab (new tab)');
                this.navigateTo(url);
                // Immediately update the URL bar to show the target URL
                if (this.urlInput) {
                    this.urlInput.value = url;
                    this.updateSecurityIndicator(url);
                    // Focus the URL input after setting the value
                    setTimeout(() => {
                        this.urlInput.focus();
                        this.urlInput.select();
                    }, 100);
                }
            } else {
                // Current tab is not new - check if target URL already exists in another tab
                console.log('Checking for existing tab with URL:', url);
                const existingTabId = await ipcRenderer.invoke('find-tab-with-url', url);
                
                if (existingTabId !== null) {
                    // Target URL already exists - switch to that tab
                    console.log('Switching to existing tab:', existingTabId);
                    await this.switchToTab(existingTabId);
                } else {
                    // Target URL doesn't exist - create new tab
                    console.log('Creating new tab for URL:', url);
                    await this.createNewTab(url);
                    // Ensure URL bar is updated for the new tab
                    if (this.urlInput) {
                        this.urlInput.value = url;
                        this.updateSecurityIndicator(url);
                        // Focus the URL input after setting the value
                        setTimeout(() => {
                            this.urlInput.focus();
                            this.urlInput.select();
                        }, 150);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling quick link click:', error);
            console.error('Error details:', error.message, error.stack);
            
            // Fallback to simple navigation
            console.log('Falling back to simple navigation');
            try {
                this.navigateTo(url);
                // Update URL bar even in fallback case
                if (this.urlInput) {
                    this.urlInput.value = url;
                    this.updateSecurityIndicator(url);
                }
            } catch (fallbackError) {
                console.error('Fallback navigation also failed:', fallbackError);
            }
        } finally {
            // Reset the flag after a delay
            setTimeout(() => {
                this.isHandlingQuickLink = false;
            }, 500);
        }
    }

    // Toggle blank page overlay
    toggleBlankPageOverlay(show) {
        const overlay = document.getElementById('blank-page-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            console.log('Blank page overlay toggled:', show ? 'shown' : 'hidden');
        } else {
            console.log('Blank page overlay element not found');
        }
    }


    showNotification(message, type = 'info') {
        console.log('Showing notification:', message, type);
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification - more concise and modern
        Object.assign(notification.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            padding: '10px 16px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '13px',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '280px',
            wordWrap: 'break-word',
            opacity: '0',
            transform: 'translateX(100%) scale(0.9)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        });
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(69, 160, 73, 0.9))';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, rgba(244, 67, 54, 0.9), rgba(211, 47, 47, 0.9))';
                break;
            case 'info':
            default:
                notification.style.background = 'linear-gradient(135deg, rgba(33, 150, 243, 0.9), rgba(25, 118, 210, 0.9))';
                break;
        }
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0) scale(1)';
        }, 100);
        
        // Auto-remove after 2.5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%) scale(0.9)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }, 2500);
    }

}

// Global functions for cookie management
window.toggleDomain = function(domainId) {
    console.log('toggleDomain called with:', domainId);
    const toggle = document.getElementById(`toggle-${domainId}`);
    const cookies = document.getElementById(`cookies-${domainId}`);
    
    if (!toggle || !cookies) {
        console.log('Toggle or cookies element not found');
        return;
    }
    
    if (cookies.classList.contains('expanded')) {
        cookies.classList.remove('expanded');
        toggle.classList.remove('expanded');
        console.log('Domain collapsed');
    } else {
        cookies.classList.add('expanded');
        toggle.classList.add('expanded');
        console.log('Domain expanded');
    }
};

window.deleteCookie = async function(name, domain) {
    console.log('deleteCookie called:', name, domain);
    try {
        await ipcRenderer.invoke('delete-cookie', { name, domain });
        window.stealthBrowser.refreshCookies();
    } catch (error) {
        console.error('Error deleting cookie:', error);
    }
};

window.clearDomainCookies = async function(domain) {
    console.log('clearDomainCookies called:', domain);
    if (confirm(`Are you sure you want to clear all cookies for ${domain}?`)) {
        try {
            await ipcRenderer.invoke('clear-cookies-for-domain', domain);
            window.stealthBrowser.refreshCookies();
        } catch (error) {
            console.error('Error clearing domain cookies:', error);
        }
    }
};

// Initialize the browser when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.stealthBrowser = new StealthBrowser();
    window.stealthBrowser.init();
});