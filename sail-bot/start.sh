#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
  echo "❌ No .env file found. Run ./install.sh first, then edit .env with your bot token."
  exit 1
fi

echo "🚀 Starting SAIL Gaming bot with pm2..."
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✅ Bot is running under pm2 (auto-restarts on crash)."
echo ""
echo "Useful commands:"
echo "  pm2 logs sail-bot     -> view live logs"
echo "  pm2 restart sail-bot  -> restart the bot"
echo "  pm2 stop sail-bot     -> stop the bot"
echo ""
echo "To make the bot survive a full reboot of your iMac, run this once and follow"
echo "the printed instructions (it will ask you to run one more sudo command):"
echo ""
echo "  pm2 startup"
echo ""
