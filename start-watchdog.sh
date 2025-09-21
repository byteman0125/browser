#!/bin/bash

echo "Starting StealthBrowser Watchdog..."
echo

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js to run the watchdog"
    exit 1
fi

# Start the watchdog process
echo "Starting watchdog process..."
node watchdog.js

echo
echo "Watchdog process ended."
