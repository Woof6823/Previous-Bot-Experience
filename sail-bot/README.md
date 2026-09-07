# SAIL Gaming Discord Bot

Ticket system (dropdown menu, 5 categories, claim/close) + welcome message system,
with a SQLite database and pm2 auto-restart.

## What it does

- **Tickets**: `*ticketembed` (owner-only, user ID `1460942049594314772`) posts a
  ticket panel with a dropdown of 5 categories:
  Support Ticket, Staff Application, Player Application, Business Inquiry,
  Content Creator Application.
  - On first boot the bot auto-creates a Discord category for each ticket type.
  - Opening a ticket creates a channel named `{type}-{number}` (e.g. `support-1`),
    where the number is tracked forever in the database and only ever increases.
  - Only staff role `1533405149907783822` and the ticket opener can see the channel.
  - Each ticket has **Claim** and **Close** buttons. Only staff can claim; claiming
    posts "`{user}` claimed the ticket." Staff or the ticket owner can close (the
    channel is deleted 5 seconds after close).
  - Users can only have **one open ticket at a time**, across all categories.

- **Welcome messages**: `*setwelcome` (same owner-only user) sets the current
  channel as the welcome channel. New members get an `@mention` + embed with
  their avatar as the thumbnail and the SAIL banner image at the bottom, and the
  bot reacts with 👋.

- **Transcripts**: `*settranscripts` (same owner-only user) sets the current
  channel as the transcript log. Whenever a ticket is closed, a full HTML
  transcript of the channel (messages, embeds, attachments) is generated and
  posted there before the ticket channel is deleted, along with who opened,
  claimed, and closed it. If you never run this command, tickets just close
  normally with no transcript logged.

- **Testing**: `*testwelcome` (same owner-only user) fires the welcome message
  for yourself in the configured welcome channel, so you can check it looks
  right without needing someone to actually join the server.

- **`*help`**: shows every command available to you (admins see more).

## 🛡️ Moderation

Two different access levels, exactly as requested:

- **`*warn @user [reason]`** and **`*mute @user [minutes] [reason]`** / **`*unmute @user`**
  — usable by Administrators, **or** by anyone holding a role that's been granted
  the matching permission ticket (checked across **all** of their roles).
- **`*kick @user [reason]`**, **`*ban @user [reason]`**, **`*unban <userId>`**,
  **`*purge <count>`** — **Administrator only, always.** These can never be granted
  to a role via the ticket system.
- **`*addmodrole @role <warn|mute>`** / **`*removemodrole @role <warn|mute>`** (Admin only)
  — grants or revokes a warn/mute permission ticket on a role.
- **`*modroles @role`** — lists which tickets a role currently holds.
- **`*warnings [@user]`**, **`*clearwarnings @user`** (clear = Admin only).

## 🔒 Security

- **`*filterword add <word>`** / **`*filterword remove <word>`** (Admin) — banned
  word list; matching messages are deleted and the author gets a warning logged.
- **`*toggle antispam <on|off>`**, **`*toggle wordfilter <on|off>`**, **`*toggle leveling <on|off>`** (Admin).
- **`*setraid <join count> <window seconds>`** (Admin) — posts an alert to the
  mod-log channel if that many members join within that window (basic raid detection).
- **`*setmodlog`** (Admin) — sets the current channel as the moderation/security log.
- Anti-spam auto-mutes anyone sending messages too fast (no command needed once toggled on).

## 👋 Server Management

- **`*setgoodbye`** (Admin) — sets the current channel for goodbye messages.
- **`*setautorole @role`** (Admin) — automatically gives new members that role.
- **`*reactionrole <messageId> <emoji> @role`** (Admin) — react with that emoji on
  that message to get/lose the role. Run once per emoji/role pair.
- **`*setcounting`** (Admin) — turns the current channel into a counting game
  (count up one at a time, no one can count twice in a row, breaking it resets to 1).
- **`*setsuggestions`** (Admin) — sets where `*suggest <idea>` posts get sent
  (auto-adds 👍/👎 reactions).
- **`*remind <duration e.g. 10m/2h/1d> <text>`** — DMs-in-channel reminder for
  yourself. Note: reminders live in memory and are lost if the bot restarts
  before they fire — fine for short reminders, not for anything long-term/critical.
- **`*addcmd <name> <response>`** / **`*removecmd <name>`** (Admin) / **`*commands`**
  — unlimited custom text commands. Supports `{user}`, `{username}`, `{server}` placeholders.
- **`*embed`** (owner only) — interactive embed builder, unchanged from before.

## 🎮 Leveling & Community

- Automatic XP + leveling on every message (once `*toggle leveling on`), with a
  level-up announcement in the channel it happened in.
- **`*rank [@user]`** — shows level/XP. **`*leaderboard`** — top 10 in the server.
- **`*giveaway <duration e.g. 1h/30m/2d> <winner count> <prize>`** (Admin) — reaction
  giveaway, auto-draws winners when it ends (and resumes correctly across restarts).
- **`*greroll <messageId>`** (Admin) — re-draws winners for a past giveaway.
- **`*poll "Question" "Option A" "Option B" ...`** — up to 10 numbered options.
- **`*yesno <question>`** — quick ✅/❌ poll.

## 🚧 What's not in this pass (V2/V3 from your roadmap)

Being upfront: **economy, prestige, missions/daily tasks, invite/growth
analytics with graphs, server backups, social (X/YouTube/stream) notifications,
the web dashboard, and website integration** are all genuinely separate builds —
especially the dashboard, which needs its own web app with Discord OAuth and a
real API layer talking to this bot. The architecture here (modular `src/`
files, one SQLite DB, settings table for all config) is deliberately set up so
none of that requires a rewrite — each one just becomes a new module plus a
few new tables, same as everything added in this pass. Happy to build any of
those next, in whatever order matters most to you.

## 1. Deploy to your iMac

From your Mac, unzip this folder somewhere permanent, e.g. `~/sail-bot`, then SSH in
(or you're already local) and run:

```bash
cd ~/sail-bot
chmod +x install.sh start.sh
./install.sh
```

This installs Node dependencies and `pm2` (used for auto-restart on crash), and
creates a `.env` file for you from the template.

## 2. Add your bot token

```bash
nano .env
```

Fill in:

```
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_server_id_here
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

## 3. Start the bot (with auto-restart)

```bash
./start.sh
```

The bot now runs under `pm2`, which will automatically restart it if it ever
crashes. Useful commands:

```bash
pm2 logs sail-bot       # view live logs
pm2 restart sail-bot    # restart manually
pm2 stop sail-bot       # stop it
pm2 startup             # (run once) makes pm2 survive a full reboot of the Mac
```

After running `pm2 startup` it will print one command starting with `sudo` —
run that once, then `pm2 save` again, and the bot will come back up
automatically even after the iMac restarts.

## 4. Bot permissions / invite

When inviting the bot, make sure it has these permissions:
`Manage Channels`, `Manage Roles`, `View Channels`, `Send Messages`,
`Embed Links`, `Attach Files`, `Read Message History`, `Add Reactions`.

Required Gateway Intents (already enabled in the code, just make sure they're
toggled ON in the Discord Developer Portal → Bot page):
`SERVER MEMBERS INTENT`, `MESSAGE CONTENT INTENT`.

## 5. Set everything up in your server

1. Run `*ticketembed` in whatever channel you want the ticket panel in.
2. Run `*setwelcome` in whatever channel you want welcome messages in.
3. Run `*settranscripts` in whatever channel you want ticket transcripts logged in.

That's it — categories are created automatically the first time the bot starts.

## Project structure

```
sail-bot/
├── index.js              # bot entry point
├── ecosystem.config.js   # pm2 config (auto-restart)
├── install.sh            # one-time setup script
├── start.sh              # starts the bot under pm2
├── .env.example          # copy to .env and add your token
├── assets/                # banner.png, logo.png (welcome images)
├── data/sail.sqlite      # auto-created database (everything lives here)
└── src/
    ├── config.js         # IDs, ticket types, XP curve, mod-perm constants
    ├── database.js       # SQLite access layer (all tables)
    ├── permissions.js    # isAdmin() / hasModPerm() - the core access model
    ├── setupCategories.js
    ├── ticketPanel.js    # dropdown embed
    ├── tickets.js        # ticket open/claim/close logic
    ├── transcripts.js    # HTML transcript generation on ticket close
    ├── welcome.js        # welcome embed + banner + reaction
    ├── goodbye.js        # goodbye embed on member leave
    ├── autorole.js        # auto-role on member join
    ├── moderation.js     # warn/mute/kick/ban/purge/mod-role tickets
    ├── security.js       # word filter, anti-spam, raid alerting
    ├── reactionRoles.js  # reaction role setup + add/remove handlers
    ├── leveling.js       # XP gain, level-up, rank, leaderboard
    ├── giveaways.js      # giveaway start/draw/reroll/resume-on-boot
    ├── polls.js          # numbered polls + yes/no polls
    ├── counting.js       # counting channel game
    ├── customCommands.js # unlimited admin-managed text commands
    ├── suggestions.js    # suggestion channel with vote reactions
    ├── reminders.js      # simple in-memory reminders
    ├── serverConfig.js   # all the *setXXX admin config commands
    ├── embedCommand.js   # *embed interactive builder
    └── commands.js       # routes every *command to the right module
```

