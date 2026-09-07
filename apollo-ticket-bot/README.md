# Apollo Region — Welcome & Ticket Bot

A self-contained Discord.js bot: welcome embed for new members, and a full
ticket system (dropdown-based) with SQLite-backed one-ticket-per-user
enforcement.

## What's included

- `src/index.js` — entry point, loads commands/events, logs in
- `src/config.js` — **all IDs live here** (roles, channels, ticket types, colors)
- `src/db/` — SQLite (better-sqlite3) persistence for open tickets + category cache
- `src/utils/embeds.js` — all branded embeds (welcome, ticket panel, ticket-open, close confirm, already-open)
- `src/utils/ticketManager.js` — category get-or-create, channel creation w/ permission overwrites, closing
- `src/utils/ticketPanelComponents.js` — the dropdown (select menu) for ticket types
- `src/events/guildMemberAdd.js` — sends the welcome embed
- `src/events/interactionCreate.js` — handles the dropdown + close button flow
- `src/events/messageCreate.js` — prefix-command router (`*`)
- `src/commands/ticketembed.js` — `*ticketembed`, Administrator-only, posts the ticket panel
- `assets/apollo_banner.png` — your Apollo Region banner, used as the embed image/thumbnail everywhere

## 1. Create the bot application

1. Go to https://discord.com/developers/applications → **New Application**.
2. Go to the **Bot** tab → **Reset Token** → copy it. You'll paste this into `.env`.
3. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent** (required for the welcome message)
   - **Message Content Intent** (required for the `*ticketembed` prefix command)
4. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot permissions: `Administrator` is simplest. If you'd rather scope it down, it needs at minimum: `Manage Channels`, `Manage Roles` (only needed if you want it to manage category overwrites), `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`.
   - Open the generated URL and invite the bot to your server.

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
DISCORD_TOKEN=your-bot-token-here
GUILD_ID=your-server-id
COMMAND_PREFIX=*
```

All role IDs, channel IDs, and ticket-type definitions from your spec are
already filled in at the top of `src/config.js` — you don't need to touch
that file unless the IDs change.

## 3. Deploy to your iMac over SSH

From this machine (or wherever you unzip the project), copy it up:

```bash
scp -r apollo-region-bot oliverlarkin@100.115.232.70:~/apollo-region-bot
```

Then SSH in and set it up:

```bash
ssh oliverlarkin@100.115.232.70
cd ~/apollo-region-bot
cp .env.example .env
nano .env        # paste in your token + guild ID, save with Ctrl+O, exit Ctrl+X
```

Make sure Node.js 18+ is installed on the iMac (`node -v`). If not:

```bash
brew install node
```

Install dependencies (this rebuilds the native SQLite binding for macOS —
important, since it was installed on a different platform when this project
was assembled):

```bash
npm install
```

Run it:

```bash
node src/index.js
```

You should see:

```
✅ Logged in as YourBot#1234
✅ Loaded 1 command(s), watching prefix "*"
```

### Keep it running after you close the terminal / SSH session

Install PM2 (process manager) once:

```bash
npm install -g pm2
```

Then:

```bash
pm2 start src/index.js --name apollo-ticket-bot
pm2 save
pm2 startup   # follow the printed instructions to auto-start on iMac reboot
```

Useful PM2 commands:

```bash
pm2 logs apollo-ticket-bot     # tail logs
pm2 restart apollo-ticket-bot  # restart after editing config
pm2 stop apollo-ticket-bot
```

## 4. Post the ticket panel

In any channel, as an **Administrator**, type:

```
*ticketembed
```

This posts the branded ticket panel with the dropdown. Members select a
ticket type from the dropdown and a private channel is created for them
automatically.

## How the "one ticket at a time" rule works

Every open ticket is a row in `data.sqlite` (created automatically on first
run, next to `src/`). There's a **database-level unique index** that makes it
physically impossible for a user to have two rows with `status = 'open'` at
once — even if two dropdown clicks land at the exact same millisecond, the
second insert is rejected and the bot rolls back the channel it started
creating. This is why it doesn't rely on scanning Discord channels or role
state, per your requirement.

When a ticket is closed (via the close button → confirm), its row is marked
`closed`, which immediately frees the user to open a new ticket of any type.

## Permissions per ticket, exactly as specified

- `@everyone`: no `View Channel`
- Ticket creator: `View Channel` + `Send Messages` + related permissions
- Only the role(s) listed for that specific ticket type in `src/config.js`: same access
- No other staff roles get added
- The bot: full manage permissions on the channel (to close/delete it)

Only the roles attached to the selected ticket type are pinged when a ticket
opens — e.g. a Players Application only pings the Players Application role,
not Support or Business roles.

## Categories

Each ticket type has its own Discord category (`Players Applications`,
`Staff Applications`, `Business Enquiries`, `Support`). On first use the bot
looks for an existing category with that exact name (case-insensitive) and
reuses it; if none exists, it creates it and remembers the ID in the database
so it doesn't need to search by name again.

## Known limitations / things to double check

- The bot needs a role **above** all four ticket-access roles in the server's
  role hierarchy (standard Discord requirement) to reliably set channel
  permission overwrites for those roles.
- The welcome message is sent to the server's configured **System Messages
  channel**, or a channel with "welcome" in its name as a fallback. If neither
  exists/is set, welcome messages are skipped and a warning is logged — set a
  system channel in Server Settings → Overview if you want a specific one.
- `*ticketembed` requires the Discord **Administrator** permission specifically
  (as you asked), not just "Manage Server" or a role name — this is a hard
  permission bit check, not spoofable via a role called "Admin".
- If you rename a ticket category in Discord after it's been created once, the
  bot will keep using it (ID-based), so renames are safe.
