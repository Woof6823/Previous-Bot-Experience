const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_settings (
  guildId TEXT PRIMARY KEY,
  staffRoleId TEXT,
  securityChannelId TEXT,
  modLogChannelId TEXT,
  welcomeChannelId TEXT,
  welcomeMessage TEXT,
  levelUpChannelId TEXT,
  ticketCategoryId TEXT,
  ticketPanelChannelId TEXT,
  ticketLogChannelId TEXT,
  ticketStaffRoleId TEXT,
  securityEnabled INTEGER DEFAULT 1,
  roleProtectionEnabled INTEGER DEFAULT 1,
  channelProtectionEnabled INTEGER DEFAULT 1,
  botProtectionEnabled INTEGER DEFAULT 1,
  banThreshold INTEGER DEFAULT 2,
  banWindowMs INTEGER DEFAULT 180000,
  kickThreshold INTEGER DEFAULT 2,
  kickWindowMs INTEGER DEFAULT 180000,
  mentionThreshold INTEGER DEFAULT 3,
  mentionWindowMs INTEGER DEFAULT 60000,
  modActionRateLimit INTEGER DEFAULT 10,
  modActionWindowMs INTEGER DEFAULT 60000,
  securityTimeoutMs INTEGER DEFAULT 86400000
);

CREATE TABLE IF NOT EXISTS ticket_categories (
  guildId TEXT NOT NULL,
  type TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  PRIMARY KEY (guildId, type)
);

CREATE TABLE IF NOT EXISTS owners (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  PRIMARY KEY (guildId, userId)
);

CREATE TABLE IF NOT EXISTS whitelist (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  addedBy TEXT,
  addedAt INTEGER,
  PRIMARY KEY (guildId, userId)
);

CREATE TABLE IF NOT EXISTS approved_bots (
  guildId TEXT NOT NULL,
  botId TEXT NOT NULL,
  addedBy TEXT,
  addedAt INTEGER,
  PRIMARY KEY (guildId, botId)
);

CREATE TABLE IF NOT EXISTS protected_roles (
  guildId TEXT NOT NULL,
  roleId TEXT NOT NULL,
  PRIMARY KEY (guildId, roleId)
);

CREATE TABLE IF NOT EXISTS protected_channels (
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  PRIMARY KEY (guildId, channelId)
);

CREATE TABLE IF NOT EXISTS moderation_cases (
  caseId INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  targetId TEXT NOT NULL,
  moderatorId TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  durationMs INTEGER,
  dmDelivered INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  targetId TEXT NOT NULL,
  moderatorId TEXT NOT NULL,
  reason TEXT,
  caseId INTEGER,
  createdAt INTEGER NOT NULL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS security_events (
  eventId TEXT PRIMARY KEY,
  guildId TEXT NOT NULL,
  actorId TEXT,
  type TEXT NOT NULL,
  details TEXT,
  rolesStripped TEXT,
  timeoutApplied INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mod_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  actorId TEXT NOT NULL,
  actionType TEXT NOT NULL,
  targetId TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mention_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS xp (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  lastMessageAt INTEGER DEFAULT 0,
  PRIMARY KEY (guildId, userId)
);

CREATE TABLE IF NOT EXISTS blocked_words (
  guildId TEXT NOT NULL,
  word TEXT NOT NULL,
  PRIMARY KEY (guildId, word)
);

CREATE TABLE IF NOT EXISTS tickets (
  ticketId INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL UNIQUE,
  openerId TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  claimedBy TEXT,
  createdAt INTEGER NOT NULL,
  closedAt INTEGER,
  closedBy TEXT
);

CREATE TABLE IF NOT EXISTS command_permissions (
  guildId TEXT NOT NULL,
  commandName TEXT NOT NULL,
  roleId TEXT NOT NULL,
  PRIMARY KEY (guildId, commandName, roleId)
);
`);

module.exports = db;
