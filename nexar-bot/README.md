# Nexar Region Bot

Discord bot with a ticket system and welcome messages, built for the Nexar Region server.

## Features

- **Ticket panel** (`*ticketembed`): posts the ticket embed with 4 buttons (Roster / Staff / Business / Support). Only the hardcoded owner user ID can run it.
- **Auto-created categories**: on first startup the bot creates "Roster Tickets", "Staff Tickets", "Business Tickets", and "Support Tickets" categories if they don't already exist.
- **One ticket per user**: a user can't open a second ticket (in any category) while one is still open.
- **Auto-numbered channels**: each ticket channel is named `{type}-ticket-{number}`, with the number persisted in a SQLite database so it always increments, even across restarts.
- **Claim / Close buttons**: only the two configured staff role IDs can claim a ticket. Anyone with those roles, or the ticket opener, can close it.
- **Welcome messages** (`*setwelcome [#channel]`): sends an embed with the new member's avatar and the Nexar banner image, pings the user above the embed, and reacts with 👋. Only the hardcoded owner user ID can run this command.
- **SQLite database** (`data.sqlite`, created automatically) stores ticket counters, active tickets, category IDs, and the welcome channel.
- **PM2 auto-restart**: the bot restarts automatically if it crashes, and can be configured to start on boot/login.

## Setup on your iMac (via SSH)

1. Unzip this folder somewhere on your Mac, e.g.:
   ```bash
   ssh oliverlarkin@100.115.232.70
   cd ~
   unzip nexar-bot.zip
   cd nexar-bot
   ```

2. Make sure Node.js 18+ is installed (`node -v`). If not:
   ```bash
   brew install node
   ```

3. Run the install script:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   This installs dependencies, installs `pm2` globally, creates your `.env` file, and starts the bot.

4. When prompted, edit `.env` and paste your bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```
   Then start (or restart) the bot:
   ```bash
   pm2 restart nexar-bot
   ```

5. To make the bot survive a full reboot of your iMac, run the `pm2 startup` command it prints out (copy/paste the exact line it gives you), then:
   ```bash
   pm2 save
   ```

## Useful PM2 commands

```bash
pm2 logs nexar-bot      # live logs
pm2 restart nexar-bot   # restart the bot
pm2 stop nexar-bot      # stop the bot
pm2 status              # check if it's running
```

## Configuration

All hardcoded IDs (owner user ID, staff role IDs, ticket type text) live in `src/config.js` if you ever need to change them.

## Required bot permissions / intents

When inviting the bot, make sure these are enabled in the Discord Developer Portal:
- **Server Members Intent** (for welcome messages)
- **Message Content Intent** (for the `*ticketembed` / `*setwelcome` prefix commands)

Invite the bot with at least these permissions: Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions.
