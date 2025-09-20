#!/bin/bash

echo "🔧 StealthBrowser Build Script"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "🚀 Building portable executable..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Build completed successfully!"
    echo "📁 Check the 'dist' folder for your executable"
    echo ""
    echo "Available executables:"
    ls -la dist/ | grep -E '\.(exe|AppImage|dmg)$' || echo "No executables found - check dist folder"
else
    echo "❌ Build failed"
    exit 1
fi
