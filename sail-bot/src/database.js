const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { TICKET_TYPES } = require('./config');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'sail.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS counters (
    type TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    type       TEXT NOT NULL,
    number     INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open', -- open | claimed | closed
    claimed_by TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    type TEXT PRIMARY KEY,
    category_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- ── moderation ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS warnings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason      TEXT,
    created_at  INTEGER NOT NULL
  );

  -- role-based permission tickets (only 'warn' and 'mute' can ever be granted here)
  CREATE TABLE IF NOT EXISTS role_perms (
    role_id    TEXT NOT NULL,
    permission TEXT NOT NULL,
    PRIMARY KEY (role_id, permission)
  );

  -- ── security ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS filtered_words (
    word TEXT PRIMARY KEY
  );

  -- ── reaction roles ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS reaction_roles (
    message_id TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    role_id    TEXT NOT NULL,
    PRIMARY KEY (message_id, emoji)
  );

  -- ── leveling ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS levels (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    xp       INTEGER NOT NULL DEFAULT 0,
    level    INTEGER NOT NULL DEFAULT 0,
    last_xp_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  -- ── giveaways ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    prize      TEXT NOT NULL,
    winners    INTEGER NOT NULL DEFAULT 1,
    host_id    TEXT NOT NULL,
    end_at     INTEGER NOT NULL,
    ended      INTEGER NOT NULL DEFAULT 0
  );

  -- ── custom commands ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS custom_commands (
    guild_id TEXT NOT NULL,
    name     TEXT NOT NULL,
    response TEXT NOT NULL,
    PRIMARY KEY (guild_id, name)
  );

  -- ── counting ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS counting_state (
    guild_id  TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    current   INTEGER NOT NULL DEFAULT 0,
    last_user_id TEXT
  );
`);


const seedCounter = db.prepare(`INSERT OR IGNORE INTO counters (type, count) VALUES (?, 0)`);
for (const t of TICKET_TYPES) seedCounter.run(t.id);

module.exports = {
  raw: db,


  nextTicketNumber(type) {
    const tx = db.transaction((type) => {
      db.prepare(`INSERT OR IGNORE INTO counters (type, count) VALUES (?, 0)`).run(type);
      db.prepare(`UPDATE counters SET count = count + 1 WHERE type = ?`).run(type);
      return db.prepare(`SELECT count FROM counters WHERE type = ?`).get(type).count;
    });
    return tx(type);
  },


  getOpenTicketForUser(userId) {
    return db
      .prepare(`SELECT * FROM tickets WHERE user_id = ? AND status != 'closed'`)
      .get(userId);
  },

  createTicket({ channelId, guildId, userId, type, number }) {
    db.prepare(
      `INSERT INTO tickets (channel_id, guild_id, user_id, type, number, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`
    ).run(channelId, guildId, userId, type, number, Date.now());
  },

  getTicket(channelId) {
    return db.prepare(`SELECT * FROM tickets WHERE channel_id = ?`).get(channelId);
  },

  claimTicket(channelId, staffId) {
    db.prepare(`UPDATE tickets SET status = 'claimed', claimed_by = ? WHERE channel_id = ?`).run(
      staffId,
      channelId
    );
  },

  closeTicket(channelId) {
    db.prepare(`UPDATE tickets SET status = 'closed' WHERE channel_id = ?`).run(channelId);
  },


  getCategoryId(type) {
    const row = db.prepare(`SELECT category_id FROM categories WHERE type = ?`).get(type);
    return row ? row.category_id : null;
  },

  setCategoryId(type, categoryId) {
    db.prepare(
      `INSERT INTO categories (type, category_id) VALUES (?, ?)
       ON CONFLICT(type) DO UPDATE SET category_id = excluded.category_id`
    ).run(type, categoryId);
  },


  getSetting(key) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    return row ? row.value : null;
  },

  setSetting(key, value) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, value);
  },


  addWarning(guildId, userId, moderatorId, reason) {
    db.prepare(
      `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(guildId, userId, moderatorId, reason, Date.now());
  },

  getWarnings(guildId, userId) {
    return db
      .prepare(`SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`)
      .all(guildId, userId);
  },

  clearWarnings(guildId, userId) {
    db.prepare(`DELETE FROM warnings WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
  },


  grantRolePerm(roleId, permission) {
    db.prepare(`INSERT OR IGNORE INTO role_perms (role_id, permission) VALUES (?, ?)`).run(
      roleId,
      permission
    );
  },

  revokeRolePerm(roleId, permission) {
    db.prepare(`DELETE FROM role_perms WHERE role_id = ? AND permission = ?`).run(roleId, permission);
  },

  roleHasPerm(roleId, permission) {
    return !!db
      .prepare(`SELECT 1 FROM role_perms WHERE role_id = ? AND permission = ?`)
      .get(roleId, permission);
  },

  listRolePerms(roleId) {
    return db.prepare(`SELECT permission FROM role_perms WHERE role_id = ?`).all(roleId).map((r) => r.permission);
  },


  addFilteredWord(word) {
    db.prepare(`INSERT OR IGNORE INTO filtered_words (word) VALUES (?)`).run(word.toLowerCase());
  },

  removeFilteredWord(word) {
    db.prepare(`DELETE FROM filtered_words WHERE word = ?`).run(word.toLowerCase());
  },

  getFilteredWords() {
    return db.prepare(`SELECT word FROM filtered_words`).all().map((r) => r.word);
  },


  addReactionRole(messageId, emoji, roleId) {
    db.prepare(
      `INSERT OR REPLACE INTO reaction_roles (message_id, emoji, role_id) VALUES (?, ?, ?)`
    ).run(messageId, emoji, roleId);
  },

  getReactionRole(messageId, emoji) {
    return db
      .prepare(`SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?`)
      .get(messageId, emoji);
  },

  removeReactionRolesForMessage(messageId) {
    db.prepare(`DELETE FROM reaction_roles WHERE message_id = ?`).run(messageId);
  },


  getLevel(guildId, userId) {
    return (
      db.prepare(`SELECT * FROM levels WHERE guild_id = ? AND user_id = ?`).get(guildId, userId) || {
        guild_id: guildId,
        user_id: userId,
        xp: 0,
        level: 0,
        last_xp_at: 0,
      }
    );
  },

  addXp(guildId, userId, amount) {
    db.prepare(
      `INSERT INTO levels (guild_id, user_id, xp, level, last_xp_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + ?, last_xp_at = ?`
    ).run(guildId, userId, amount, Date.now(), amount, Date.now());
    return db.prepare(`SELECT * FROM levels WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
  },

  setLevel(guildId, userId, level) {
    db.prepare(`UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?`).run(
      level,
      guildId,
      userId
    );
  },

  getLeaderboard(guildId, limit = 10) {
    return db
      .prepare(`SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?`)
      .all(guildId, limit);
  },


  createGiveaway({ messageId, channelId, guildId, prize, winners, hostId, endAt }) {
    db.prepare(
      `INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners, host_id, end_at, ended)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(messageId, channelId, guildId, prize, winners, hostId, endAt);
  },

  getGiveaway(messageId) {
    return db.prepare(`SELECT * FROM giveaways WHERE message_id = ?`).get(messageId);
  },

  getActiveGiveaways() {
    return db.prepare(`SELECT * FROM giveaways WHERE ended = 0`).all();
  },

  endGiveaway(messageId) {
    db.prepare(`UPDATE giveaways SET ended = 1 WHERE message_id = ?`).run(messageId);
  },


  addCustomCommand(guildId, name, response) {
    db.prepare(
      `INSERT INTO custom_commands (guild_id, name, response) VALUES (?, ?, ?)
       ON CONFLICT(guild_id, name) DO UPDATE SET response = excluded.response`
    ).run(guildId, name.toLowerCase(), response);
  },

  removeCustomCommand(guildId, name) {
    db.prepare(`DELETE FROM custom_commands WHERE guild_id = ? AND name = ?`).run(
      guildId,
      name.toLowerCase()
    );
  },

  getCustomCommand(guildId, name) {
    return db
      .prepare(`SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?`)
      .get(guildId, name.toLowerCase());
  },

  listCustomCommands(guildId) {
    return db.prepare(`SELECT name FROM custom_commands WHERE guild_id = ?`).all(guildId).map((r) => r.name);
  },


  getCountingState(guildId) {
    return db.prepare(`SELECT * FROM counting_state WHERE guild_id = ?`).get(guildId);
  },

  setCountingChannel(guildId, channelId) {
    db.prepare(
      `INSERT INTO counting_state (guild_id, channel_id, current, last_user_id) VALUES (?, ?, 0, NULL)
       ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, current = 0, last_user_id = NULL`
    ).run(guildId, channelId);
  },

  updateCounting(guildId, current, lastUserId) {
    db.prepare(`UPDATE counting_state SET current = ?, last_user_id = ? WHERE guild_id = ?`).run(
      current,
      lastUserId,
      guildId
    );
  },
};
