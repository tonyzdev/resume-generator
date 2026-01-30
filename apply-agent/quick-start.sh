#!/bin/bash

# Quick Start Script for Indeed Auto Apply Agent

echo "============================================================"
echo "  Indeed Auto Apply Agent - Quick Start"
echo "============================================================"
echo ""

# Check if Chrome is running
if ! curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
  echo "⚠️  Chrome is not running in debug mode!"
  echo ""
  echo "Please start Chrome first:"
  echo "  cd .."
  echo "  ./start-chrome-debug.sh"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "✓ Chrome is running"
echo ""

# Run the agent in interactive mode
node main.js
