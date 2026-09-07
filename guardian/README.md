# Guardian Bot

A modular, security-first Discord bot: centralized authorization pipeline,
anti-nuke protection, moderation with case IDs, a dropdown ticket system,
welcome messages, and a leveling system.

## 1. Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

- `BOT_TOKEN` — from the Discord Developer Portal → Bot → Token
- `CLIENT_ID` — your application's Client ID
- `OWNER_IDS` — comma-separated Discord user IDs who can change security config
- `WHITELIST_IDS` — comma-separated Discord user IDs with full bot access (optional; you can also manage this at runtime with `*whitelist add`)
- `STAFF_ROLE_ID` — your Staff Access Role (optional; can also be set with `*security staffrole`)
- The channel IDs are all optional — set them later with `*security channel <type> <#channel>`

### Required bot permissions / privileged intents

In the Developer Portal → Bot, enable:
- **Server Members Intent**
- **Message Content Intent**

Invite the bot with at least: `Manage Roles`, `Manage Channels`, `Kick Members`,
`Ban Members`, `Moderate Members`, `Manage Messages`, `View Audit Log`,
`View Channels`, `Send Messages`, `Embed Links`.

**Important:** the bot's own role must sit ABOVE every role you want it to be
able to strip/manage during security remediation, and above staff so staff
can't out-rank the bot.

## 2. Run

```bash
npm start
```

The database (SQLite) is created automatically at `./data/bot.sqlite` on
first run, along with all tables. Nothing else to configure up front — the
first run for a guild seeds owners/whitelist from your `.env`.

## 3. First-run checklist (in Discord)

1. `*security staffrole @Staff` — set your staff role
2. `*security channel security #security-alerts`
3. `*security channel modlog #mod-logs`
4. `*security channel welcome #welcome`
5. `*security channel levelup #level-ups`
6. `*security channel ticketlog #ticket-logs`
7. `*ticketpanel` in your ticket-panel channel — posts the dropdown ticket menu
8. `*security test` — verifies everything is wired up correctly
9. `*security status` — overview of what's on/off

## 4. Command prefix

Default is `*` (configurable via `PREFIX` in `.env`). Every command's
invoking message is deleted automatically once it's processed.

## 5. Architecture

```
src/
  index.js              entrypoint — client, intents, command/event loading
  config.js              env-based configuration
  database.js             SQLite schema + connection
  services/
    whitelistService.js    whitelist + owner checks
    permissionService.js   staff/hierarchy/protected-object checks
    securityService.js     anti-nuke detection, remediation, incident logging
    moderationService.js   case IDs, warnings, moderator-identity-safe DMs
    auditService.js        Discord audit-log actor resolution
    configService.js       per-guild settings (DB-backed)
    xpService.js            leveling math + storage
  handlers/
    commandHandler.js      the ONE central authorization pipeline every
                            command passes through (identify → guild →
                            whitelist → owner/staff → execute → delete →
                            respond)
    ticketHandler.js        dropdown ticket panel, creation, claim, close
    welcomeHandler.js
    levelHandler.js
    chatModerationHandler.js  blocked words + mass-mention detection
  commands/                one file per *command
  events/                  one file per Discord gateway event
```

## 6. Security model summary

- **Whitelist** is USER-ID based, never role-based, stored in the DB.
- **Owners** (also USER-ID based) are the only ones who can touch security
  configuration — `*security ...`, `*whitelist ...`.
- **Staff** (one configured role) get standard moderation commands, gated
  through the same hierarchy checks as everyone else.
- **Anti-nuke**: 2+ bans/kicks in 3 minutes, or >3 `@everyone`/`@here`
  mentions in 1 minute, or ANY role permission/mentionable change by a
  non-whitelisted user, triggers an automatic strip-roles + 24h timeout +
  security channel alert + DB record with a `SEC-YYYYMMDD-NNNN` case ID.
- **Fail-closed**: if the bot can't identify an actor (e.g. audit log is
  slow/unavailable) or can't confirm authorization, it does nothing rather
  than guessing.
- **Moderator identity is never revealed** to a punished user's DM — only
  internal mod-log/case records store who issued an action.

All thresholds are configurable per guild with `*security thresholds ...`
and persist across restarts.
