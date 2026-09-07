#!/usr/bin/env bash
set -e

echo "🚀 Setting up SAIL Gaming Discord bot..."

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Install it first, e.g. with Homebrew:  brew install node"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  echo "⚠️  IMPORTANT: edit .env and add your DISCORD_TOKEN + GUILD_ID before starting the bot."
fi

# Install pm2 globally if missing (used for auto-restart / crash recovery)
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing pm2 globally for process management + auto-restart..."
  npm install -g pm2
fi

echo ""
echo "✅ Install complete!"
echo ""
echo "Next steps:"
echo "  1. nano .env         (add your bot token)"
echo "  2. ./start.sh         (start the bot with pm2, auto-restarts on crash/reboot)"
echo ""
