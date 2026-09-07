# Cosmo Esports — Ticket System

A DM-based Discord ticket bot for the Cosmo Esports server.

## What it does

- `!ticketembed` (restricted to one user ID) posts the support panel with a
  dropdown of 3 ticket types: **Roster**, **Staff**, **Business/Support**.
- Selecting an option creates a private ticket channel under the matching
  category, pings all staff roles, and DMs the user to continue there.
- Every DM the user sends is relayed into the ticket channel; every message
  staff send in the ticket channel is relayed back to the user's DMs.
- `!close` works from either the user's DM or the ticket channel (staff only).
- Ticket numbers are per-category, persistent across restarts, and never reused.
- One active ticket per user across all three categories at once.

All server/role/user IDs and branding text live in `src/config.js`.

## 1. Local setup (one-time)

You'll need **Node.js 18+** installed.

```bash
cd cosmo-tickets
cp .env.example .env
# edit .env and paste your bot token:
#   DISCORD_TOKEN=your-bot-token-here
npm install
```

### Discord Developer Portal — required settings

In your bot's application on https://discord.com/developers/applications:

- **Bot → Privileged Gateway Intents**: enable
  - `SERVER MEMBERS INTENT`
  - `MESSAGE CONTENT INTENT`
- Invite the bot to the server with at least these permissions:
  `View Channels, Send Messages, Manage Channels, Embed Links, Attach Files, Read Message History`

## 2. Run it

```bash
npm start
```

You should see:

```
[ready] Logged in as YourBotName#0000
[ready] Cosmo Esports ticket system is online.
```

Keep it running with a process manager (recommended) so it survives
terminal/SSH disconnects and restarts on crash:

```bash
npm install -g pm2
pm2 start src/index.js --name cosmo-tickets
pm2 save
pm2 startup   # optional: auto-start on machine boot, follow its printed instructions
```

## 3. Deploying to your iMac over SSH

From the machine holding this folder/zip:

```bash
# copy the project up
scp -r cosmo-tickets oliverlarkin@100.115.232.70:~/cosmo-tickets

# then ssh in and set it up
ssh oliverlarkin@100.115.232.70
cd ~/cosmo-tickets
cp .env.example .env
nano .env              # paste your bot token, save & exit
npm install
npm install -g pm2      # if not already installed
pm2 start src/index.js --name cosmo-tickets
pm2 save
```

To check on it later:

```bash
ssh oliverlarkin@100.115.232.70 "pm2 logs cosmo-tickets --lines 50"
```

## Data / persistence

State lives in `data/tickets.json` (auto-created on first run — active
tickets, the DM↔channel routing table, and per-category ticket counters).
Back this file up if you care about ticket history continuity; deleting it
resets all counters to 0.

## Config reference (`src/config.js`)

| Key | Purpose |
|---|---|
| `guildId` | The Cosmo Esports server ID |
| `staffRoleIds` | Roles with ticket access + creation pings |
| `ticketEmbedUserId` | Only user allowed to run `!ticketembed` |
| `ticketTypes` | The 3 categories (label, emoji, channel prefix, category name) |
| `brand` | Embed color, footer text, optional thumbnail URL |

## Troubleshooting

- **Dropdown does nothing / no response**: confirm `MESSAGE CONTENT INTENT`
  and `SERVER MEMBERS INTENT` are enabled in the Developer Portal.
- **"already has an open ticket" but channel is gone**: this self-heals —
  the bot detects manually-deleted ticket channels via the `channelDelete`
  event and frees up the user automatically. If it doesn't, check the logs
  for `[channelDelete]` errors (usually a missing `Guilds` intent).
- **Bot can't DM a user**: expected if they have DMs disabled for the
  server — the ticket channel gets a warning message so staff know to
  follow up another way.
