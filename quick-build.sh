#!/bin/bash

echo "========================================"
echo "    StealthBrowser Quick Build"
echo "========================================"
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Clean and build
echo -e "${BLUE}[INFO]${NC} Cleaning previous builds..."
rm -rf dist

echo -e "${BLUE}[INFO]${NC} Building Linux AppImage..."
if electron-builder --linux; then
    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    Build Completed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo -e "${BLUE}[INFO]${NC} AppImage created in dist folder:"
    ls -la dist/*.AppImage
    echo
    echo -e "${GREEN}[SUCCESS]${NC} You can now run the AppImage!"
    echo
    
    # Ask if user wants to run the app
    read -p "Run the application now? (y/n): " run_app
    if [[ $run_app =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[INFO]${NC} Starting StealthBrowser..."
        chmod +x dist/*.AppImage
        ./dist/*.AppImage &
    fi
else
    echo -e "${RED}[ERROR]${NC} Build failed"
    exit 1
fi
