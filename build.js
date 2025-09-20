#!/usr/bin/env node

const { build } = require('electron-builder');
const path = require('path');

async function buildApp() {
    console.log('🚀 Building StealthBrowser...');
    
    try {
        // Build configuration
        const config = {
            directories: {
                output: 'dist'
            },
            files: [
                'src/**/*',
                'assets/**/*',
                'package.json'
            ],
            extraResources: [
                'node_modules/**/*'
            ],
            win: {
                target: 'portable',
                icon: 'assets/icon.svg',
                artifactName: 'StealthBrowser-Portable-${version}.${ext}'
            },
            linux: {
                target: 'AppImage',
                icon: 'assets/icon.svg',
                artifactName: 'StealthBrowser-${version}.${ext}'
            },
            mac: {
                target: 'dmg',
                icon: 'assets/icon.svg',
                artifactName: 'StealthBrowser-${version}.${ext}'
            },
            portable: {
                artifactName: 'StealthBrowser-Portable.exe'
            },
            nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
                createDesktopShortcut: true,
                createStartMenuShortcut: true
            }
        };

        // Determine platform
        const platform = process.platform;
        let targets;
        
        if (platform === 'win32') {
            targets = 'win';
        } else if (platform === 'darwin') {
            targets = 'mac';
        } else {
            targets = 'linux';
        }

        console.log(`📦 Building for ${platform}...`);
        
        const result = await build({
            targets: targets,
            config: config,
            publish: 'never'
        });

        console.log('✅ Build completed successfully!');
        console.log('📁 Output directory: ./dist');
        
        if (platform === 'win32') {
            console.log('🎉 Portable executable: StealthBrowser-Portable.exe');
        } else if (platform === 'linux') {
            console.log('🎉 AppImage: StealthBrowser-*.AppImage');
        } else {
            console.log('🎉 DMG: StealthBrowser-*.dmg');
        }
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

buildApp();
