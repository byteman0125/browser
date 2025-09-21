#!/usr/bin/env node

/**
 * StealthBrowser Watchdog Process
 * 
 * This process monitors the main browser application and automatically restarts it
 * if it closes unexpectedly. It also restores the last open tabs.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class BrowserWatchdog {
    constructor() {
        this.mainProcess = null;
        this.isRunning = false;
        this.restartAttempts = 0;
        this.maxRestartAttempts = 5;
        this.restartDelay = 2000; // 2 seconds
        this.checkInterval = 1000; // Check every 1 second
        this.tabsFile = path.join(os.homedir(), '.stealthbrowser', 'last-tabs.json');
        this.pidFile = path.join(os.homedir(), '.stealthbrowser', 'browser.pid');
        this.watchdogPidFile = path.join(os.homedir(), '.stealthbrowser', 'watchdog.pid');
        
        // Ensure directory exists
        this.ensureDirectoryExists();
        
        // Check for existing watchdog process
        if (this.isWatchdogAlreadyRunning()) {
            // console.log('⚠️  Another watchdog process is already running. Exiting...');
            process.exit(0);
        }
        
        // Write watchdog PID
        this.writePidFile(this.watchdogPidFile, process.pid);
        
    // Silent startup - no console output
    // // console.log('🔍 StealthBrowser Watchdog started');
    // // console.log('📁 Tabs file:', this.tabsFile);
    // // console.log('🆔 Watchdog PID:', process.pid);
    }

    ensureDirectoryExists() {
        const dir = path.dirname(this.tabsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    writePidFile(filePath, pid) {
        try {
            fs.writeFileSync(filePath, pid.toString());
        } catch (error) {
            console.error('Error writing PID file:', error);
        }
    }

    readPidFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return parseInt(fs.readFileSync(filePath, 'utf8').trim());
            }
        } catch (error) {
            console.error('Error reading PID file:', error);
        }
        return null;
    }

    isWatchdogAlreadyRunning() {
        try {
            const existingPid = this.readPidFile(this.watchdogPidFile);
            if (existingPid && existingPid !== process.pid) {
                // Check if the process is actually running
                if (this.isProcessRunning(existingPid)) {
                    // console.log('Found existing watchdog process with PID:', existingPid);
                    return true;
                } else {
                    // Process is not running, clean up the PID file
                    // console.log('Cleaning up stale PID file for process:', existingPid);
                    if (fs.existsSync(this.watchdogPidFile)) {
                        fs.unlinkSync(this.watchdogPidFile);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for existing watchdog process:', error);
        }
        return false;
    }

    saveLastTabs(tabs) {
        try {
            const tabsData = {
                timestamp: Date.now(),
                tabs: tabs
            };
            fs.writeFileSync(this.tabsFile, JSON.stringify(tabsData, null, 2));
            // console.log('💾 Saved last tabs:', tabs.length);
        } catch (error) {
            console.error('Error saving tabs:', error);
        }
    }

    loadLastTabs() {
        try {
            if (fs.existsSync(this.tabsFile)) {
                const data = JSON.parse(fs.readFileSync(this.tabsFile, 'utf8'));
                // console.log('📂 Loaded last tabs:', data.tabs.length);
                return data.tabs || [];
            }
        } catch (error) {
            console.error('Error loading tabs:', error);
        }
        return [];
    }

    isProcessRunning(pid) {
        try {
            // Check if process is running
            if (os.platform() === 'win32') {
                exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout) => {
                    return stdout.includes(pid.toString());
                });
            } else {
                // Unix-like systems
                process.kill(pid, 0);
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    findExistingElectronProcess() {
        try {
            // Look for electron processes that might be our browser
            const { execSync } = require('child_process');
            
            if (os.platform() === 'win32') {
                // Windows: Look for electron.exe processes
                const output = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV', { encoding: 'utf8' });
                const lines = output.split('\n').filter(line => line.includes('electron.exe'));
                return lines.length > 0;
            } else {
                // Unix-like systems: Look for electron processes
                const output = execSync('ps aux | grep electron | grep -v grep', { encoding: 'utf8' });
                const lines = output.split('\n').filter(line => line.trim() && !line.includes('watchdog'));
                return lines.length > 0;
            }
        } catch (error) {
            // console.log('Error checking for existing Electron processes:', error.message);
            return false;
        }
    }

    startMainProcess() {
        if (this.isRunning) {
            // console.log('⚠️  Main process is already running');
            return;
        }

        // Check for existing main process
        const existingPid = this.readPidFile(this.pidFile);
        if (existingPid && this.isProcessRunning(existingPid)) {
            // console.log('⚠️  Main browser process already running with PID:', existingPid);
            this.isRunning = true;
            // Don't start a new process, just monitor the existing one
            this.monitorExistingProcess(existingPid);
            return;
        }

        // Additional check: Look for any electron processes that might be our browser
        if (this.findExistingElectronProcess()) {
            // console.log('⚠️  Found existing Electron browser process, not starting new one');
            this.isRunning = true;
            return;
        }

        // // console.log('🚀 Starting main browser process...');
        
        // Try to start with electron first, fallback to node
        const mainProcessPath = path.join(__dirname, 'src', 'main.js');
        
        let command, args;
        
        if (os.platform() === 'win32') {
            // Windows: Look for electron.cmd
            const electronCmdPath = path.join(__dirname, 'node_modules', '.bin', 'electron.cmd');
            const electronExePath = path.join(__dirname, 'node_modules', '.bin', 'electron.exe');
            
            if (fs.existsSync(electronCmdPath)) {
                command = electronCmdPath;
                args = ['.'];
            } else if (fs.existsSync(electronExePath)) {
                command = electronExePath;
                args = ['.'];
            } else {
                // Fallback to node
                command = 'node';
                args = [mainProcessPath];
            }
        } else {
            // Unix-like systems: Look for electron
            const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
            
            if (fs.existsSync(electronPath)) {
                command = electronPath;
                args = ['.'];
            } else {
                // Fallback to node
                command = 'node';
                args = [mainProcessPath];
            }
        }
        
        // Start the main process
        this.mainProcess = spawn(command, args, {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        this.isRunning = true;
        this.restartAttempts = 0;

        // Write main process PID
        if (this.mainProcess.pid) {
            this.writePidFile(this.pidFile, this.mainProcess.pid);
            // console.log('🆔 Main process PID:', this.mainProcess.pid);
        }

        // Handle main process output
        this.mainProcess.stdout.on('data', (data) => {
            // console.log('📤 Main process stdout:', data.toString().trim());
        });

        this.mainProcess.stderr.on('data', (data) => {
            // console.log('📤 Main process stderr:', data.toString().trim());
        });

        // Handle main process exit
        this.mainProcess.on('exit', (code, signal) => {
            // console.log(`❌ Main process exited with code ${code}, signal ${signal}`);
            this.isRunning = false;
            this.mainProcess = null;
            
            // Clean up PID file
            if (fs.existsSync(this.pidFile)) {
                fs.unlinkSync(this.pidFile);
            }
            
            // Attempt to restart
            this.scheduleRestart();
        });

        this.mainProcess.on('error', (error) => {
            console.error('❌ Main process error:', error);
            this.isRunning = false;
            this.mainProcess = null;
            this.scheduleRestart();
        });

        // console.log('✅ Main process started successfully');
    }

    scheduleRestart() {
        if (this.restartAttempts >= this.maxRestartAttempts) {
            // console.log('❌ Max restart attempts reached. Watchdog stopping.');
            return;
        }

        this.restartAttempts++;
        // console.log(`🔄 Scheduling restart attempt ${this.restartAttempts}/${this.maxRestartAttempts} in ${this.restartDelay}ms`);
        
        setTimeout(() => {
            this.startMainProcess();
        }, this.restartDelay);
    }

    monitorExistingProcess(pid) {
        // console.log('👁️  Monitoring existing main process with PID:', pid);
        // Set up periodic check for the existing process
        this.existingProcessPid = pid;
    }

    stopMainProcess() {
        if (this.mainProcess) {
            // console.log('🛑 Stopping main process...');
            this.mainProcess.kill('SIGTERM');
            
            // Force kill after 5 seconds if it doesn't stop gracefully
            setTimeout(() => {
                if (this.mainProcess && !this.mainProcess.killed) {
                    // console.log('💀 Force killing main process...');
                    this.mainProcess.kill('SIGKILL');
                }
            }, 5000);
        }
    }

    start() {
        // Silent startup - no console output
        // // console.log('🔍 Starting browser watchdog...');
        
        // Load and restore last tabs
        const lastTabs = this.loadLastTabs();
        // if (lastTabs.length > 0) {
        //     // console.log('📂 Will restore tabs on startup:', lastTabs.map(tab => tab.url || 'New Tab'));
        // }
        
        // Start the main process
        this.startMainProcess();
        
        // Set up periodic health check
        setInterval(() => {
            this.healthCheck();
        }, this.checkInterval);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            // console.log('🛑 Received SIGINT, shutting down gracefully...');
            this.shutdown();
        });
        
        process.on('SIGTERM', () => {
            // console.log('🛑 Received SIGTERM, shutting down gracefully...');
            this.shutdown();
        });
        
        // console.log('✅ Watchdog is now monitoring the browser');
    }

    healthCheck() {
        // Check if we're monitoring an existing process
        if (this.existingProcessPid) {
            if (!this.isProcessRunning(this.existingProcessPid)) {
                // console.log('💓 Health check: Existing main process died, attempting restart...');
                this.existingProcessPid = null;
                this.isRunning = false;
                this.scheduleRestart();
            }
            return;
        }
        
        // Check if we have a spawned process
        if (!this.isRunning && this.restartAttempts < this.maxRestartAttempts) {
            // console.log('💓 Health check: Main process not running, attempting restart...');
            this.scheduleRestart();
        }
    }

    shutdown() {
        // console.log('🛑 Shutting down watchdog...');
        
        // Stop main process
        this.stopMainProcess();
        
        // Clean up PID files
        if (fs.existsSync(this.pidFile)) {
            fs.unlinkSync(this.pidFile);
        }
        if (fs.existsSync(this.watchdogPidFile)) {
            fs.unlinkSync(this.watchdogPidFile);
        }
        
        // console.log('✅ Watchdog shutdown complete');
        process.exit(0);
    }
}

// Start the watchdog
const watchdog = new BrowserWatchdog();
watchdog.start();
