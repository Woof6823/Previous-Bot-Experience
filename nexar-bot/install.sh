#!/bin/bash
set -e

echo "== Nexar Region Bot Setup =="

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Install it first, e.g. with Homebrew:"
  echo "  brew install node"
  exit 1
fi

echo "Node version: $(node -v)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Install pm2 globally if missing
if ! command -v pm2 &> /dev/null; then
  echo "Installing pm2 globally..."
  npm install -g pm2
fi

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Created .env — edit it now and add your DISCORD_TOKEN before starting the bot:"
  echo "  nano .env"
  echo ""
fi

echo "Starting bot with pm2..."
pm2 start ecosystem.config.js

echo "Saving pm2 process list so it survives reboots..."
pm2 save

echo ""
echo "To make pm2 auto-start on Mac login/boot, run the command pm2 prints below:"
pm2 startup || true

echo ""
echo "Setup complete. Useful commands:"
echo "  pm2 logs nexar-bot     # view logs"
echo "  pm2 restart nexar-bot  # restart bot"
echo "  pm2 stop nexar-bot     # stop bot"
