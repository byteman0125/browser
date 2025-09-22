#!/bin/bash

echo "========================================"
echo "    StealthBrowser Setup Script"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not available"
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"
echo

# Install dependencies
print_status "Installing dependencies..."
if ! npm install; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_status "Dependencies installed successfully!"
echo

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist
rm -rf node_modules/.cache

echo
print_header "========================================"
print_header "    Build Options"
print_header "========================================"
echo
echo "1. Build Linux AppImage"
echo "2. Build macOS DMG"
echo "3. Build Windows (requires Wine)"
echo "4. Build All Platforms"
echo "5. Development Mode (Run without building)"
echo "6. Exit"
echo

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        print_status "Building Linux AppImage..."
        if ! electron-builder --linux; then
            print_error "Build failed"
            exit 1
        fi
        ;;
    2)
        print_status "Building macOS DMG..."
        if ! electron-builder --mac; then
            print_error "Build failed"
            exit 1
        fi
        ;;
    3)
        print_warning "Building Windows requires Wine to be installed"
        print_status "Building Windows..."
        if ! electron-builder --win; then
            print_error "Build failed"
            exit 1
        fi
        ;;
    4)
        print_status "Building All Platforms..."
        if ! npm run dist; then
            print_error "Build failed"
            exit 1
        fi
        ;;
    5)
        print_status "Starting Development Mode..."
        print_warning "Press Ctrl+C to stop the application"
        npm start
        exit 0
        ;;
    6)
        print_status "Exiting..."
        exit 0
        ;;
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo
print_header "========================================"
print_header "    Build Completed Successfully!"
print_header "========================================"
echo
print_status "Output files are in the 'dist' folder:"

if [ -d "dist" ]; then
    if ls dist/*.AppImage 1> /dev/null 2>&1; then
        echo "Linux AppImage:"
        ls -la dist/*.AppImage
    fi
    
    if ls dist/*.dmg 1> /dev/null 2>&1; then
        echo "macOS DMG:"
        ls -la dist/*.dmg
    fi
    
    if ls dist/*.exe 1> /dev/null 2>&1; then
        echo "Windows executables:"
        ls -la dist/*.exe
    fi
fi

echo
print_status "You can now distribute these files!"
echo

# Ask if user wants to open dist folder
read -p "Open dist folder? (y/n): " open_folder
if [[ $open_folder =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open dist
    elif command -v open &> /dev/null; then
        open dist
    else
        print_warning "Cannot open folder automatically. Please open 'dist' folder manually."
    fi
fi

echo
print_status "Setup completed!"
