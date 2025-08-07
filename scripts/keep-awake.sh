#!/bin/bash

# Keep computer awake script
echo "☕ Starting caffeinate to keep your Mac awake..."
echo "Press Ctrl+C to stop and allow sleep again"
echo ""
echo "Options:"
echo "-d: Prevent display from sleeping"
echo "-i: Prevent system from idle sleeping"
echo "-m: Prevent disk from sleeping"
echo "-s: Keep system awake for AC power only"
echo ""
echo "Running with display and system awake..."

# Run caffeinate with display and idle prevention
caffeinate -di