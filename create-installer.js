const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 StealthBrowser Installer Creator');
console.log('=====================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run this script from the project root directory.');
    process.exit(1);
}

// Check if assets directory exists
if (!fs.existsSync('assets')) {
    console.log('📁 Creating assets directory...');
    fs.mkdirSync('assets');
}

// Check if icon files exist
if (!fs.existsSync('assets/icon.ico') && !fs.existsSync('assets/icon.png')) {
    console.log('⚠️  Warning: No icon files found. Installer will use default Electron icon.');
    console.log('💡 Tip: Add assets/icon.ico (256x256) for custom branding.');
} else if (fs.existsSync('assets/icon.png')) {
    console.log('✅ Found icon.png - will use for Linux/Mac builds');
} else if (fs.existsSync('assets/icon.ico')) {
    console.log('✅ Found icon.ico - will use for Windows builds');
}

console.log('\n🧹 Cleaning previous builds...');
try {
    execSync('npm run clean', { stdio: 'inherit' });
} catch (error) {
    console.log('ℹ️  No previous builds to clean');
}

console.log('\n📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
}

console.log('\n🔨 Building Windows installer...');
try {
    execSync('npm run build-installer', { stdio: 'inherit' });
    console.log('✅ Installer built successfully');
} catch (error) {
    console.error('❌ Error building installer:', error.message);
    process.exit(1);
}

// Check if installer was created
const distDir = 'dist';
if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const installerFile = files.find(file => file.endsWith('.exe') && file.includes('Setup'));
    
    if (installerFile) {
        const installerPath = path.join(distDir, installerFile);
        const stats = fs.statSync(installerPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log('\n🎉 SUCCESS!');
        console.log('===========');
        console.log(`📁 Installer location: ${installerPath}`);
        console.log(`📊 File size: ${fileSizeMB} MB`);
        console.log('\n✨ Your installer is ready for distribution!');
        console.log('\n📋 Installer features:');
        console.log('   • Professional Windows installer');
        console.log('   • Desktop shortcut creation');
        console.log('   • Start menu integration');
        console.log('   • Custom installation directory');
        console.log('   • Auto-launch on system startup');
        console.log('   • Easy uninstallation');
        
    } else {
        console.log('\n⚠️  Installer file not found in dist directory');
        console.log('📁 Files in dist:', files);
    }
} else {
    console.log('\n❌ Dist directory not found');
}

console.log('\n🏁 Build process completed!');
