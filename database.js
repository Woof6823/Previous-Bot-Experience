const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "surge-bot.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS counters (
    type TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL,
    guild_id TEXT,
    expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'manual'
  );

  CREATE TABLE IF NOT EXISTS automod_offenses (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    offense_count INTEGER NOT NULL DEFAULT 0,
    first_offense_at INTEGER NOT NULL,
    last_offense_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS temp_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    reason TEXT,
    unban_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS mod_permissions (
    action TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (action, role_id)
  );

  CREATE TABLE IF NOT EXISTS blocked_words (
    word TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS whitelisted_words (
    word TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS autoreplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS autoreply_triggers (
    trigger TEXT PRIMARY KEY,
    autoreply_id INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS message_daily_stats (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS voice_daily_stats (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS temp_vcs (
    channel_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vc_cooldowns (
    user_id TEXT PRIMARY KEY,
    last_created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE,
    type TEXT NOT NULL,
    number INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    claimed_by TEXT,
    claimed_at INTEGER,
    answers TEXT,
    embed_message_id TEXT,
    timer_end INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS moderation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    requested_by TEXT,
    approved_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, type)
  );

  CREATE TABLE IF NOT EXISTS loa_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT,
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS afk_status (
    user_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    since INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    last_msg_xp_at INTEGER NOT NULL DEFAULT 0,
    last_reaction_xp_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS trigger_words (
    category TEXT NOT NULL,
    word TEXT NOT NULL,
    PRIMARY KEY (category, word)
  );
`);

try {
  db.exec("ALTER TABLE tickets ADD COLUMN claimed_at INTEGER");
} catch {}

db.exec("UPDATE tickets SET claimed_at = created_at WHERE claimed_by IS NOT NULL AND claimed_at IS NULL");

for (const migration of [
  "ALTER TABLE tickets ADD COLUMN is_delayed INTEGER DEFAULT 0",
  "ALTER TABLE tickets ADD COLUMN delay_reason TEXT",
  "ALTER TABLE tickets ADD COLUMN is_pro_waiting INTEGER DEFAULT 0",
  "ALTER TABLE tickets ADD COLUMN last_opener_message_at INTEGER",
  "ALTER TABLE tickets ADD COLUMN timer_message_id TEXT",
  "ALTER TABLE tickets ADD COLUMN awaiting_staff_since INTEGER",
  "ALTER TABLE tickets ADD COLUMN last_ghost_ping_at INTEGER",
  "ALTER TABLE tickets ADD COLUMN staff_ever_replied INTEGER DEFAULT 0",
  "ALTER TABLE tickets ADD COLUMN timer_run_count INTEGER DEFAULT 0",
  "ALTER TABLE tickets ADD COLUMN last_unclaimed_ping_at INTEGER",
  "ALTER TABLE tickets ADD COLUMN last_staff_message_at INTEGER",
  "ALTER TABLE blacklist ADD COLUMN approval_channel_id TEXT",
  "ALTER TABLE blacklist ADD COLUMN approval_message_id TEXT",
  "ALTER TABLE warnings ADD COLUMN guild_id TEXT",
  "ALTER TABLE warnings ADD COLUMN expires_at INTEGER",
  "ALTER TABLE warnings ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
  "ALTER TABLE moderation_logs ADD COLUMN duration_ms INTEGER"
]) {
  try {
    db.exec(migration);
  } catch {}
}

db.exec("UPDATE tickets SET last_opener_message_at = created_at WHERE last_opener_message_at IS NULL");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_tickets_claimed ON tickets(claimed_by, claimed_at);
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_expiry ON warnings(source, expires_at);
  CREATE INDEX IF NOT EXISTS idx_modlogs_user ON moderation_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_msg_stats ON message_daily_stats(user_id, day);
  CREATE INDEX IF NOT EXISTS idx_voice_stats ON voice_daily_stats(user_id, day);
  CREATE INDEX IF NOT EXISTS idx_temp_bans_active ON temp_bans(active, user_id);

  CREATE TABLE IF NOT EXISTS vc_sessions (
    user_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    staff_name TEXT,
    stars INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_type ON reviews(type, created_at);

  CREATE TABLE IF NOT EXISTS role_races (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    role_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    filled_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS role_race_claims (
    race_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    PRIMARY KEY (race_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_race_claims_race ON role_race_claims(race_id);

  CREATE TABLE IF NOT EXISTS guess_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    panel_message_id TEXT,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    target_number INTEGER NOT NULL,
    start_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    reminder_sent INTEGER DEFAULT 0,
    winner_id TEXT,
    won_at INTEGER,
    ticket_channel_id TEXT,
    ticket_category_id TEXT,
    cleanup_at INTEGER,
    reactions TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_guess_games_status ON guess_games(status);
  CREATE INDEX IF NOT EXISTS idx_guess_games_channel ON guess_games(channel_id);

  CREATE TABLE IF NOT EXISTS message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_tag TEXT NOT NULL,
    content TEXT,
    attachments TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_message_log_channel ON message_log(channel_id, created_at);

  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    content TEXT NOT NULL,
    reactions TEXT,
    send_at INTEGER NOT NULL,
    sent INTEGER DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages(sent, send_at);

  CREATE TABLE IF NOT EXISTS member_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_member_events_created ON member_events(created_at);

  CREATE TABLE IF NOT EXISTS training_sessions (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    trainee_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'welcome',
    state_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );
`);

function createTrainingSession(channelId, guildId, traineeId, adminId) {
  db.prepare(`
    INSERT INTO training_sessions (channel_id, guild_id, trainee_id, admin_id, stage, state_json, status, created_at)
    VALUES (?, ?, ?, ?, 'welcome', '{}', 'active', ?)
  `).run(channelId, guildId, traineeId, adminId, Date.now());
  return getTrainingSession(channelId);
}

function getTrainingSession(channelId) {
  return db.prepare("SELECT * FROM training_sessions WHERE channel_id = ?").get(channelId) || null;
}

function updateTrainingSession(channelId, { stage, state }) {
  const current = getTrainingSession(channelId);
  if (!current) return null;
  db.prepare("UPDATE training_sessions SET stage = ?, state_json = ? WHERE channel_id = ?").run(
    stage ?? current.stage,
    state !== undefined ? JSON.stringify(state) : current.state_json,
    channelId
  );
  return getTrainingSession(channelId);
}

function setTrainingStatus(channelId, status) {
  db.prepare("UPDATE training_sessions SET status = ? WHERE channel_id = ?").run(status, channelId);
}

function getActiveTrainingSessions() {
  return db.prepare("SELECT * FROM training_sessions WHERE status = 'active'").all();
}

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function nextTicketNumber(type) {
  const row = db.prepare("SELECT count FROM counters WHERE type = ?").get(type);
  const next = row ? row.count + 1 : 1;
  db.prepare(`
    INSERT INTO counters (type, count) VALUES (?, ?)
    ON CONFLICT(type) DO UPDATE SET count = excluded.count
  `).run(type, next);
  return next;
}

function createTicket({ channelId, type, number, userId, answers }) {
  const stmt = db.prepare(`
    INSERT INTO tickets (channel_id, type, number, user_id, answers, created_at)
    VALUES (@channelId, @type, @number, @userId, @answers, @createdAt)
  `);
  stmt.run({
    channelId,
    type,
    number,
    userId,
    answers: answers ? JSON.stringify(answers) : null,
    createdAt: Date.now()
  });
  return getTicketByChannel(channelId);
}

function getTicketByChannel(channelId) {
  const row = db.prepare("SELECT * FROM tickets WHERE channel_id = ?").get(channelId);
  if (!row) return null;
  return { ...row, answers: row.answers ? JSON.parse(row.answers) : {} };
}

function setEmbedMessageId(channelId, messageId) {
  db.prepare("UPDATE tickets SET embed_message_id = ? WHERE channel_id = ?").run(messageId, channelId);
}

function claimTicket(channelId, staffId) {
  const result = db.prepare("UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND claimed_by IS NULL").run(staffId, channelId);
  return result.changes > 0;
}

function unclaimTicket(channelId) {
  const result = db.prepare("UPDATE tickets SET claimed_by = NULL, claimed_at = NULL WHERE channel_id = ? AND claimed_by IS NOT NULL").run(channelId);
  return result.changes > 0;
}

function getOpenUnclaimedTickets() {
  return db.prepare("SELECT * FROM tickets WHERE status = 'open' AND claimed_by IS NULL").all();
}

function getTicketsNeedingReminderPing(beforeTimestamp) {




  return db
    .prepare(
      `SELECT * FROM tickets
       WHERE status = 'open'
       AND (last_unclaimed_ping_at IS NULL OR last_unclaimed_ping_at < ?)`
    )
    .all(beforeTimestamp);
}

function setLastUnclaimedPingAt(channelId, timestamp) {
  db.prepare("UPDATE tickets SET last_unclaimed_ping_at = ? WHERE channel_id = ?").run(timestamp, channelId);
}

function closeTicket(channelId) {
  db.prepare("UPDATE tickets SET status = 'closed', timer_end = NULL WHERE channel_id = ?").run(channelId);
}

function setTimer(channelId, timerEnd) {
  db.prepare("UPDATE tickets SET timer_end = ? WHERE channel_id = ?").run(timerEnd, channelId);
}

function clearTimer(channelId) {
  db.prepare("UPDATE tickets SET timer_end = NULL WHERE channel_id = ?").run(channelId);
}

function setAwaitingStaffSince(channelId, timestamp) {
  db.prepare("UPDATE tickets SET awaiting_staff_since = COALESCE(awaiting_staff_since, ?) WHERE channel_id = ?").run(timestamp, channelId);
}

function clearAwaitingStaffState(channelId) {
  db.prepare("UPDATE tickets SET awaiting_staff_since = NULL, last_ghost_ping_at = NULL WHERE channel_id = ?").run(channelId);
}

function setLastGhostPingAt(channelId, timestamp) {
  db.prepare("UPDATE tickets SET last_ghost_ping_at = ? WHERE channel_id = ?").run(timestamp, channelId);
}

function getTicketsNeedingGhostPing(cutoffTimestamp) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
    AND is_delayed = 0
    AND is_pro_waiting = 0
    AND awaiting_staff_since IS NOT NULL
    AND awaiting_staff_since <= ?
    AND (last_ghost_ping_at IS NULL OR last_ghost_ping_at < awaiting_staff_since)
  `).all(cutoffTimestamp);
}

function getOpenTicketsWithTimers() {
  return db.prepare("SELECT * FROM tickets WHERE status = 'open' AND timer_end IS NOT NULL").all()
    .map((row) => ({ ...row, answers: row.answers ? JSON.parse(row.answers) : {} }));
}

function getOpenTicketByUser(userId) {
  const row = db.prepare("SELECT * FROM tickets WHERE user_id = ? AND status = 'open' LIMIT 1").get(userId);
  if (!row) return null;
  return { ...row, answers: row.answers ? JSON.parse(row.answers) : {} };
}

function getAllOpenTickets() {
  return db.prepare("SELECT * FROM tickets WHERE status = 'open'").all()
    .map((row) => ({ ...row, answers: row.answers ? JSON.parse(row.answers) : {} }));
}

function addWarning(userId, moderatorId, reason) {
  db.prepare("INSERT INTO warnings (user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?)").run(userId, moderatorId, reason, Date.now());
}

function removeLatestWarning(userId) {
  const row = db.prepare("SELECT id FROM warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
  if (!row) return false;
  db.prepare("DELETE FROM warnings WHERE id = ?").run(row.id);
  return true;
}

function getWarnings(userId) {
  db.prepare("DELETE FROM warnings WHERE source = 'automod' AND expires_at IS NOT NULL AND expires_at <= ?").run(Date.now());
  return db.prepare("SELECT * FROM warnings WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function addAutomodWarning(guildId, userId, moderatorId, reason, expiresAt) {
  db.prepare(`
    INSERT INTO warnings (user_id, moderator_id, reason, created_at, guild_id, expires_at, source)
    VALUES (?, ?, ?, ?, ?, ?, 'automod')
  `).run(userId, moderatorId, reason, Date.now(), guildId, expiresAt);
}

function removeExpiredAutomodWarnings(guildId, userId, now = Date.now()) {
  db.prepare(`
    DELETE FROM warnings
    WHERE source = 'automod'
    AND expires_at IS NOT NULL
    AND expires_at <= ?
    AND (? IS NULL OR guild_id = ?)
    AND (? IS NULL OR user_id = ?)
  `).run(now, guildId || null, guildId || null, userId || null, userId || null);
}

function getAutomodOffense(guildId, userId, now = Date.now()) {
  const row = db.prepare("SELECT * FROM automod_offenses WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  if (!row) return null;
  if (row.expires_at <= now) {
    db.prepare("DELETE FROM automod_offenses WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
    removeExpiredAutomodWarnings(guildId, userId, now);
    return null;
  }
  return row;
}

function recordAutomodOffense(guildId, userId, expiresAt, now = Date.now()) {
  const current = getAutomodOffense(guildId, userId, now);
  const offenseCount = (current?.offense_count || 0) + 1;
  db.prepare(`
    INSERT INTO automod_offenses (guild_id, user_id, offense_count, first_offense_at, last_offense_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
    offense_count = excluded.offense_count,
    last_offense_at = excluded.last_offense_at,
    expires_at = excluded.expires_at
  `).run(guildId, userId, offenseCount, current?.first_offense_at || now, now, expiresAt);
  return {
    offense_count: offenseCount,
    first_offense_at: current?.first_offense_at || now,
    last_offense_at: now,
    expires_at: expiresAt
  };
}

function clearAutomodOffense(guildId, userId) {
  db.prepare("DELETE FROM automod_offenses WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
}

function addTempBan(userId, guildId, reason, unbanAt) {
  const result = db.prepare("INSERT INTO temp_bans (user_id, guild_id, reason, unban_at, active) VALUES (?, ?, ?, ?, 1)").run(userId, guildId, reason, unbanAt);
  return result.lastInsertRowid;
}

function getActiveTempBans() {
  return db.prepare("SELECT * FROM temp_bans WHERE active = 1").all();
}

function getActiveTempBanByUser(userId) {
  return db.prepare("SELECT * FROM temp_bans WHERE user_id = ? AND active = 1").get(userId) || null;
}

function deactivateTempBan(id) {
  db.prepare("UPDATE temp_bans SET active = 0 WHERE id = ?").run(id);
}

function createTempVC(channelId, ownerId, guildId) {
  db.prepare("INSERT INTO temp_vcs (channel_id, owner_id, guild_id, created_at) VALUES (?, ?, ?, ?)").run(channelId, ownerId, guildId, Date.now());
}

function getTempVC(channelId) {
  return db.prepare("SELECT * FROM temp_vcs WHERE channel_id = ?").get(channelId) || null;
}

function deleteTempVC(channelId) {
  db.prepare("DELETE FROM temp_vcs WHERE channel_id = ?").run(channelId);
}

function setTempVCOwner(channelId, ownerId) {
  db.prepare("UPDATE temp_vcs SET owner_id = ? WHERE channel_id = ?").run(ownerId, channelId);
}

function getAllTempVCs() {
  return db.prepare("SELECT * FROM temp_vcs").all();
}

function getVCCooldown(userId) {
  const row = db.prepare("SELECT last_created_at FROM vc_cooldowns WHERE user_id = ?").get(userId);
  return row ? row.last_created_at : null;
}

function setVCCooldown(userId) {
  db.prepare(`
    INSERT INTO vc_cooldowns (user_id, last_created_at) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET last_created_at = excluded.last_created_at
  `).run(userId, Date.now());
}

const setModRoles = db.transaction((action, roleIds) => {
  db.prepare("DELETE FROM mod_permissions WHERE action = ?").run(action);
  const insert = db.prepare("INSERT INTO mod_permissions (action, role_id) VALUES (?, ?)");
  for (const roleId of roleIds) insert.run(action, roleId);
});

function getModRoles(action) {
  return db.prepare("SELECT role_id FROM mod_permissions WHERE action = ?").all(action).map((r) => r.role_id);
}

function resetModPermissions() {
  db.prepare("DELETE FROM mod_permissions").run();
}

function addBlockedWord(word) {
  db.prepare("INSERT OR IGNORE INTO blocked_words (word) VALUES (?)").run(word.toLowerCase());
}

function removeBlockedWord(word) {
  const result = db.prepare("DELETE FROM blocked_words WHERE word = ?").run(word.toLowerCase());
  return result.changes > 0;
}

function getBlockedWords() {
  return db.prepare("SELECT word FROM blocked_words").all().map((r) => r.word);
}

function addWhitelistedWord(word) {
  db.prepare("INSERT OR IGNORE INTO whitelisted_words (word) VALUES (?)").run(word.toLowerCase());
}

function removeWhitelistedWord(word) {
  const result = db.prepare("DELETE FROM whitelisted_words WHERE word = ?").run(word.toLowerCase());
  return result.changes > 0;
}

function getWhitelistedWords() {
  return db.prepare("SELECT word FROM whitelisted_words").all().map((r) => r.word);
}

function addAutoReply(trigger, response) {
  const triggerLower = trigger.toLowerCase();
  const existing = db.prepare("SELECT id FROM autoreplies WHERE LOWER(response) = LOWER(?)").get(response);
  let autoReplyId;
  if (existing) {
    autoReplyId = existing.id;
  } else {
    const result = db.prepare("INSERT INTO autoreplies (response) VALUES (?)").run(response);
    autoReplyId = result.lastInsertRowid;
  }
  db.prepare(`
    INSERT INTO autoreply_triggers (trigger, autoreply_id) VALUES (?, ?)
    ON CONFLICT(trigger) DO UPDATE SET autoreply_id = excluded.autoreply_id
  `).run(triggerLower, autoReplyId);
  return autoReplyId;
}

function removeAutoReplyTrigger(trigger) {
  const triggerLower = trigger.toLowerCase();
  const row = db.prepare("SELECT autoreply_id FROM autoreply_triggers WHERE trigger = ?").get(triggerLower);
  if (!row) return false;
  db.prepare("DELETE FROM autoreply_triggers WHERE trigger = ?").run(triggerLower);
  const remaining = db.prepare("SELECT COUNT(*) AS count FROM autoreply_triggers WHERE autoreply_id = ?").get(row.autoreply_id);
  if (remaining.count === 0) {
    db.prepare("DELETE FROM autoreplies WHERE id = ?").run(row.autoreply_id);
  }
  return true;
}

function getAllAutoReplies() {
  return db.prepare(`
    SELECT t.trigger AS trigger_word, a.response AS response
    FROM autoreply_triggers t JOIN autoreplies a ON a.id = t.autoreply_id
  `).all();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function incrementMessageCount(userId) {
  const day = todayKey();
  db.prepare(`
    INSERT INTO message_daily_stats (user_id, day, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
  `).run(userId, day);
}

function addVoiceSeconds(userId, seconds) {
  if (seconds <= 0) return;
  const day = todayKey();
  db.prepare(`
    INSERT INTO voice_daily_stats (user_id, day, seconds) VALUES (?, ?, ?)
    ON CONFLICT(user_id, day) DO UPDATE SET seconds = seconds + excluded.seconds
  `).run(userId, day, seconds);
}

function getMessageCount(userId, sinceDays) {
  const cutoff = daysAgoKey(sinceDays);
  const row = db.prepare("SELECT COALESCE(SUM(count),0) AS total FROM message_daily_stats WHERE user_id = ? AND day >= ?").get(userId, cutoff);
  return row.total;
}

function getVoiceSeconds(userId, sinceDays) {
  const cutoff = daysAgoKey(sinceDays);
  const row = db.prepare("SELECT COALESCE(SUM(seconds),0) AS total FROM voice_daily_stats WHERE user_id = ? AND day >= ?").get(userId, cutoff);
  return row.total;
}

function getTopMessages(sinceDays, limit = 10) {
  const cutoff = daysAgoKey(sinceDays);
  return db.prepare(`
    SELECT user_id, SUM(count) AS total FROM message_daily_stats
    WHERE day >= ? GROUP BY user_id ORDER BY total DESC LIMIT ?
  `).all(cutoff, limit);
}

function getTopVoiceSeconds(sinceDays, limit = 10) {
  const cutoff = daysAgoKey(sinceDays);
  return db.prepare(`
    SELECT user_id, SUM(seconds) AS total FROM voice_daily_stats
    WHERE day >= ? GROUP BY user_id ORDER BY total DESC LIMIT ?
  `).all(cutoff, limit);
}

function getTopClaimedTickets(sinceDays, limit = 10) {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  return db.prepare(`
    SELECT claimed_by AS user_id, COUNT(*) AS total FROM tickets
    WHERE claimed_by IS NOT NULL AND COALESCE(claimed_at, created_at) >= ?
    GROUP BY claimed_by ORDER BY total DESC LIMIT ?
  `).all(cutoff, limit);
}

function getClaimedCount(userId, sinceDays) {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const row = db.prepare("SELECT COUNT(*) AS total FROM tickets WHERE claimed_by = ? AND COALESCE(claimed_at, created_at) >= ?").get(userId, cutoff);
  return row.total;
}




function getMessageCountForUserSince(userId, sinceTimestamp) {
  const cutoffDay = new Date(sinceTimestamp).toISOString().slice(0, 10);
  const row = db.prepare("SELECT COALESCE(SUM(count),0) AS total FROM message_daily_stats WHERE user_id = ? AND day >= ?").get(userId, cutoffDay);
  return row.total;
}

function getClaimedCountForUserSince(userId, sinceTimestamp) {
  const row = db.prepare("SELECT COUNT(*) AS total FROM tickets WHERE claimed_by = ? AND COALESCE(claimed_at, created_at) >= ?").get(userId, sinceTimestamp);
  return row.total;
}







function setStaffRoleGrantedAt(userId, timestamp) {
  db.prepare(
    `INSERT INTO staff_role_grants (user_id, granted_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET granted_at = excluded.granted_at`
  ).run(userId, timestamp);
}

function getStaffRoleGrantedAt(userId) {
  const row = db.prepare("SELECT granted_at FROM staff_role_grants WHERE user_id = ?").get(userId);
  return row ? row.granted_at : null;
}


function addCreatorThreadStrike(userId) {
  db.prepare("INSERT INTO creator_thread_strikes (user_id, created_at) VALUES (?, ?)").run(
    userId,
    Date.now()
  );
}

function countCreatorThreadStrikes(userId, sinceTimestamp) {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM creator_thread_strikes WHERE user_id = ? AND created_at >= ?")
    .get(userId, sinceTimestamp);
  return row.total;
}

function setAgeBlacklistPending(userId, guildId, unlockAt) {
  db.prepare(
    `INSERT INTO age_blacklist_pending (user_id, guild_id, unlock_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET guild_id = excluded.guild_id, unlock_at = excluded.unlock_at`
  ).run(userId, guildId, unlockAt);
}

function removeAgeBlacklistPending(userId) {
  db.prepare("DELETE FROM age_blacklist_pending WHERE user_id = ?").run(userId);
}

function getAllAgeBlacklistPending() {
  return db.prepare("SELECT * FROM age_blacklist_pending").all();
}

function setTicketClaimedAt(channelId, timestamp) {
  db.prepare("UPDATE tickets SET claimed_at = ? WHERE channel_id = ?").run(timestamp, channelId);
}

function addModLog(userId, moderatorId, action, reason, durationMs = null) {
  db.prepare("INSERT INTO moderation_logs (user_id, moderator_id, action, reason, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(userId, moderatorId, action, reason, durationMs, Date.now());
}

function getModLogs(userId, limit = 15) {
  return db.prepare("SELECT * FROM moderation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit);
}

function addBlacklist(userId, type, reason, requestedBy) {
  db.prepare(`
    INSERT INTO blacklist (user_id, type, reason, requested_by, approved_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, type) DO UPDATE SET reason = excluded.reason, requested_by = excluded.requested_by, approved_at = excluded.approved_at
  `).run(userId, type, reason, requestedBy, Date.now());
}

function setBlacklistApprovalMessage(userId, type, channelId, messageId) {
  db.prepare("UPDATE blacklist SET approval_channel_id = ?, approval_message_id = ? WHERE user_id = ? AND type = ?").run(channelId, messageId, userId, type);
}

function removeBlacklist(userId, type) {
  const result = db.prepare("DELETE FROM blacklist WHERE user_id = ? AND type = ?").run(userId, type);
  return result.changes > 0;
}

function getBlacklist(userId, type) {
  return db.prepare("SELECT * FROM blacklist WHERE user_id = ? AND type = ?").get(userId, type) || null;
}

function getAllBlacklistByType(type) {
  return db.prepare("SELECT * FROM blacklist WHERE type = ?").all(type);
}

function addLOA(userId, name, startDate, endDate, reason) {
  db.prepare("INSERT INTO loa_requests (user_id, name, start_date, end_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(userId, name, startDate, endDate, reason, Date.now());
}

function setAfk(userId, reason) {
  db.prepare(`
    INSERT INTO afk_status (user_id, reason, since) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, since = excluded.since
  `).run(userId, reason, Date.now());
}

function clearAfk(userId) {
  const result = db.prepare("DELETE FROM afk_status WHERE user_id = ?").run(userId);
  return result.changes > 0;
}

function getAfk(userId) {
  return db.prepare("SELECT * FROM afk_status WHERE user_id = ?").get(userId) || null;
}

function getLevelRow(userId) {
  let row = db.prepare("SELECT * FROM user_levels WHERE user_id = ?").get(userId);
  if (!row) {
    db.prepare("INSERT INTO user_levels (user_id, xp) VALUES (?, 0)").run(userId);
    row = { user_id: userId, xp: 0, last_msg_xp_at: 0, last_reaction_xp_at: 0 };
  }
  return row;
}

function addXp(userId, amount) {
  getLevelRow(userId);
  const before = db.prepare("SELECT xp FROM user_levels WHERE user_id = ?").get(userId);
  db.prepare("UPDATE user_levels SET xp = xp + ? WHERE user_id = ?").run(amount, userId);
  return { oldXp: before.xp, newXp: before.xp + amount };
}

function canEarnMessageXp(userId, cooldownSeconds) {
  getLevelRow(userId);
  const now = Date.now();
  const result = db.prepare("UPDATE user_levels SET last_msg_xp_at = ? WHERE user_id = ? AND (? - last_msg_xp_at) >= ?").run(now, userId, now, cooldownSeconds * 1000);
  return result.changes > 0;
}

function canEarnReactionXp(userId, cooldownSeconds) {
  getLevelRow(userId);
  const now = Date.now();
  const result = db.prepare("UPDATE user_levels SET last_reaction_xp_at = ? WHERE user_id = ? AND (? - last_reaction_xp_at) >= ?").run(now, userId, now, cooldownSeconds * 1000);
  return result.changes > 0;
}

function getXpLeaderboard(limit = 10) {
  return db.prepare("SELECT user_id, xp FROM user_levels ORDER BY xp DESC LIMIT ?").all(limit);
}

function getXpRank(userId) {
  const row = getLevelRow(userId);
  const higher = db.prepare("SELECT COUNT(*) AS c FROM user_levels WHERE xp > ?").get(row.xp);
  return higher.c + 1;
}

function addTriggerWord(category, word) {
  db.prepare("INSERT OR IGNORE INTO trigger_words (category, word) VALUES (?, ?)").run(category, word.toLowerCase());
}

function removeTriggerWord(category, word) {
  const result = db.prepare("DELETE FROM trigger_words WHERE category = ? AND word = ?").run(category, word.toLowerCase());
  return result.changes > 0;
}

function getTriggerWords(category) {
  return db.prepare("SELECT word FROM trigger_words WHERE category = ?").all(category).map((r) => r.word);
}

function startVCSession(userId, channelId) {
  db.prepare(`
    INSERT INTO vc_sessions (user_id, channel_id, joined_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET channel_id = excluded.channel_id, joined_at = excluded.joined_at
  `).run(userId, channelId, Date.now());
}

function endVCSession(userId) {
  const row = db.prepare("SELECT * FROM vc_sessions WHERE user_id = ?").get(userId);
  if (!row) return null;
  db.prepare("DELETE FROM vc_sessions WHERE user_id = ?").run(userId);
  return row;
}

function getAllVCSessions() {
  return db.prepare("SELECT * FROM vc_sessions").all();
}

function clearAllBlockedWords() {
  const result = db.prepare("DELETE FROM blocked_words").run();
  return result.changes;
}

function getTempVCByOwner(userId) {
  return db.prepare("SELECT * FROM temp_vcs WHERE owner_id = ?").get(userId) || null;
}

function setTicketDelayed(channelId, delayed, reason) {
  db.prepare("UPDATE tickets SET is_delayed = ?, delay_reason = ? WHERE channel_id = ?").run(delayed ? 1 : 0, reason || null, channelId);
}

function setTicketProWaiting(channelId, waiting) {
  db.prepare("UPDATE tickets SET is_pro_waiting = ? WHERE channel_id = ?").run(waiting ? 1 : 0, channelId);
}

function setLastOpenerMessageAt(channelId, timestamp = Date.now()) {
  db.prepare("UPDATE tickets SET last_opener_message_at = ? WHERE channel_id = ?").run(timestamp, channelId);
}

function setTicketTimerMessageId(channelId, messageId) {
  db.prepare("UPDATE tickets SET timer_message_id = ? WHERE channel_id = ?").run(messageId, channelId);
}




function setStaffReplied(channelId, timestamp = Date.now()) {
  db.prepare(
    "UPDATE tickets SET staff_ever_replied = 1, last_staff_message_at = ? WHERE channel_id = ?"
  ).run(timestamp, channelId);
}

function getTicketsNeedingAutoTimer(beforeTimestamp) {



  return db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
    AND is_delayed = 0
    AND is_pro_waiting = 0
    AND timer_end IS NULL
    AND staff_ever_replied = 1
    AND last_opener_message_at IS NOT NULL
    AND MAX(last_opener_message_at, COALESCE(last_staff_message_at, 0)) < ?
  `).all(beforeTimestamp);
}







function getTicketsNeedingOpenerSilenceTimer(beforeTimestamp) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
    AND is_delayed = 0
    AND is_pro_waiting = 0
    AND timer_end IS NULL
    AND last_opener_message_at IS NULL
    AND created_at < ?
  `).all(beforeTimestamp);
}

function incrementTimerRunCount(channelId) {
  db.prepare("UPDATE tickets SET timer_run_count = COALESCE(timer_run_count, 0) + 1 WHERE channel_id = ?").run(channelId);
  const row = db.prepare("SELECT timer_run_count FROM tickets WHERE channel_id = ?").get(channelId);
  return row ? row.timer_run_count : 0;
}

function getTicketsNeedingImmediateClosure(cutoffTimestamp) {


  return db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
    AND is_delayed = 0
    AND is_pro_waiting = 0
    AND staff_ever_replied = 1
    AND last_opener_message_at IS NOT NULL
    AND MAX(last_opener_message_at, COALESCE(last_staff_message_at, 0)) < ?
  `).all(cutoffTimestamp);
}

function changeTicketType(channelId, newType, newNumber) {
  db.prepare(`
    UPDATE tickets SET type = ?, number = ?, claimed_by = NULL, claimed_at = NULL,
    is_delayed = 0, delay_reason = NULL, is_pro_waiting = 0 WHERE channel_id = ?
  `).run(newType, newNumber, channelId);
}

function getTicketClaimsSince(sinceTimestamp) {
  return db.prepare(`
    SELECT claimed_by, claimed_at, created_at FROM tickets
    WHERE claimed_by IS NOT NULL AND claimed_at >= ?
  `).all(sinceTimestamp);
}

const MESSAGE_LOG_MAX_PER_CHANNEL = 500;

function addMessageLog({ channelId, authorId, authorTag, content, attachments }) {
  db.prepare(`
    INSERT INTO message_log (channel_id, author_id, author_tag, content, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channelId, authorId, authorTag, content || "", JSON.stringify(attachments || []), Date.now());
  db.prepare(`
    DELETE FROM message_log WHERE channel_id = ? AND id NOT IN (
      SELECT id FROM message_log WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(channelId, channelId, MESSAGE_LOG_MAX_PER_CHANNEL);
}

function getRecentMessages(channelId, limit = 100) {
  const rows = db.prepare(`SELECT * FROM message_log WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?`).all(channelId, limit);
  return rows.map((r) => ({ ...r, attachments: JSON.parse(r.attachments || "[]") })).reverse();
}

function getMessageCountSince(sinceTimestamp, channelId) {
  if (channelId) {
    return db.prepare(`SELECT COUNT(*) AS count FROM message_log WHERE channel_id = ? AND created_at >= ?`).get(channelId, sinceTimestamp).count;
  }
  return db.prepare(`SELECT COUNT(*) AS count FROM message_log WHERE created_at >= ?`).get(sinceTimestamp).count;
}

function getMessageCountsByChannelSince(sinceTimestamp) {
  return db.prepare(`
    SELECT channel_id, COUNT(*) AS count FROM message_log WHERE created_at >= ? GROUP BY channel_id ORDER BY count DESC
  `).all(sinceTimestamp);
}

function addScheduledMessage({ channelId, content, reactions, sendAt, createdBy }) {
  const result = db.prepare(`
    INSERT INTO scheduled_messages (channel_id, content, reactions, send_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channelId, content, JSON.stringify(reactions || []), sendAt, createdBy || null, Date.now());
  return result.lastInsertRowid;
}

function getPendingScheduledMessages() {
  const rows = db.prepare(`SELECT * FROM scheduled_messages WHERE sent = 0 ORDER BY send_at ASC`).all();
  return rows.map((r) => ({ ...r, reactions: JSON.parse(r.reactions || "[]") }));
}

function markScheduledMessageSent(id) {
  db.prepare(`UPDATE scheduled_messages SET sent = 1 WHERE id = ?`).run(id);
}

function deleteScheduledMessage(id) {
  const result = db.prepare(`DELETE FROM scheduled_messages WHERE id = ? AND sent = 0`).run(id);
  return result.changes > 0;
}

function addMemberEvent(type, userId) {
  db.prepare(`INSERT INTO member_events (type, user_id, created_at) VALUES (?, ?, ?)`).run(type, userId, Date.now());
}

function getGrowthByDay(days) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = db.prepare(`SELECT type, created_at FROM member_events WHERE created_at >= ? ORDER BY created_at ASC`).all(since);
  const buckets = new Map();
  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    if (!buckets.has(day)) buckets.set(day, { joins: 0, leaves: 0 });
    buckets.get(day)[row.type === "join" ? "joins" : "leaves"]++;
  }
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bucket = buckets.get(day) || { joins: 0, leaves: 0 };
    result.push({ day, ...bucket });
  }
  return result;
}

function getMemberEventCounts(sinceTimestamp) {
  const rows = db.prepare(`SELECT type, COUNT(*) as count FROM member_events WHERE created_at >= ? GROUP BY type`).all(sinceTimestamp);
  const result = { joins: 0, leaves: 0 };
  for (const row of rows) {
    if (row.type === "join") result.joins = row.count;
    if (row.type === "leave") result.leaves = row.count;
  }
  return result;
}

function addReview({ type, reviewerId, staffName, stars, description }) {
  const result = db.prepare(`
    INSERT INTO reviews (type, reviewer_id, staff_name, stars, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, reviewerId, staffName || null, stars, description, Date.now());
  return result.lastInsertRowid;
}

function createRoleRace({ guildId, channelId, roleId, amount }) {
  const result = db.prepare(`
    INSERT INTO role_races (guild_id, channel_id, role_id, amount, started_at) VALUES (?, ?, ?, ?, ?)
  `).run(guildId, channelId, roleId, amount, Date.now());
  return result.lastInsertRowid;
}

function setRoleRaceMessageId(raceId, messageId) {
  db.prepare("UPDATE role_races SET message_id = ? WHERE id = ?").run(messageId, raceId);
}

function getRoleRace(raceId) {
  return db.prepare("SELECT * FROM role_races WHERE id = ?").get(raceId);
}

function getRoleRaceClaimCount(raceId) {
  return db.prepare("SELECT COUNT(*) AS count FROM role_race_claims WHERE race_id = ?").get(raceId).count;
}

function hasUserClaimedRace(raceId, userId) {
  return !!db.prepare("SELECT 1 FROM role_race_claims WHERE race_id = ? AND user_id = ?").get(raceId, userId);
}

const claimRoleRaceTxn = db.transaction((raceId, userId, amount) => {
  const alreadyClaimed = hasUserClaimedRace(raceId, userId);
  if (alreadyClaimed) return { ok: false, reason: "already_claimed" };
  const count = getRoleRaceClaimCount(raceId);
  if (count >= amount) return { ok: false, reason: "full" };
  db.prepare("INSERT INTO role_race_claims (race_id, user_id, claimed_at) VALUES (?, ?, ?)").run(raceId, userId, Date.now());
  const newCount = count + 1;
  const nowFull = newCount >= amount;
  if (nowFull) {
    db.prepare("UPDATE role_races SET filled_at = ? WHERE id = ?").run(Date.now(), raceId);
  }
  return { ok: true, newCount, nowFull };
});

function claimRoleRace(raceId, userId, amount) {
  return claimRoleRaceTxn(raceId, userId, amount);
}

function createGuessGame({ guildId, channelId, categoryId, rangeStart, rangeEnd, targetNumber, startAt, reactions }) {
  const result = db.prepare(`
    INSERT INTO guess_games (guild_id, channel_id, category_id, range_start, range_end, target_number, start_at, status, reactions)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
  `).run(guildId, channelId, categoryId, rangeStart, rangeEnd, targetNumber, startAt, JSON.stringify(reactions || []));
  return result.lastInsertRowid;
}

function getGuessGame(id) {
  return db.prepare("SELECT * FROM guess_games WHERE id = ?").get(id);
}

function getGuessGameByChannel(channelId) {
  return db.prepare("SELECT * FROM guess_games WHERE channel_id = ? AND status = 'active'").get(channelId);
}

function getGuessGameByTicketChannel(channelId) {
  return db.prepare("SELECT * FROM guess_games WHERE ticket_channel_id = ?").get(channelId);
}

function getPendingGuessGames() {
  return db.prepare("SELECT * FROM guess_games WHERE status IN ('scheduled', 'active') OR (cleanup_at IS NOT NULL)").all();
}

function setGuessGamePanelMessageId(id, messageId) {
  db.prepare("UPDATE guess_games SET panel_message_id = ? WHERE id = ?").run(messageId, id);
}

function setGuessGameReminderSent(id) {
  db.prepare("UPDATE guess_games SET reminder_sent = 1 WHERE id = ?").run(id);
}

function setGuessGameActive(id) {
  db.prepare("UPDATE guess_games SET status = 'active' WHERE id = ?").run(id);
}

function setGuessGameExpired(id, cleanupAt) {
  db.prepare("UPDATE guess_games SET status = 'expired', cleanup_at = ? WHERE id = ?").run(cleanupAt, id);
}

function setGuessGameWinner(id, winnerId, wonAt, cleanupAt) {
  db.prepare("UPDATE guess_games SET status = 'won', winner_id = ?, won_at = ?, cleanup_at = ? WHERE id = ?").run(winnerId, wonAt, cleanupAt, id);
}

function setGuessGameTicket(id, ticketChannelId, ticketCategoryId) {
  db.prepare("UPDATE guess_games SET ticket_channel_id = ?, ticket_category_id = ? WHERE id = ?").run(ticketChannelId, ticketCategoryId, id);
}

function clearGuessGameCleanup(id) {
  db.prepare("UPDATE guess_games SET cleanup_at = NULL WHERE id = ?").run(id);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ltl_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    leaderboard_channel_id TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    test_mode INTEGER NOT NULL DEFAULT 0,
    start_at INTEGER NOT NULL,
    end_at INTEGER,
    started_at INTEGER,
    ended_at INTEGER,
    announcement_message_id TEXT,
    leaderboard_message_id TEXT,
    ping_sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ltl_events_status ON ltl_events(status);
  CREATE INDEX IF NOT EXISTS idx_ltl_events_guild ON ltl_events(guild_id, status);

  CREATE TABLE IF NOT EXISTS ltl_participants (
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    excluded_from_winner INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES ltl_events(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ltl_participants_event ON ltl_participants(event_id);
  CREATE INDEX IF NOT EXISTS idx_ltl_participants_status ON ltl_participants(event_id, status);
`);

function createLtlEvent({ guildId, channelId, leaderboardChannelId = null, startAt, endAt = null, testMode = false, announcementMessageId = null }) {
  const result = db.prepare(`
    INSERT INTO ltl_events (guild_id, channel_id, leaderboard_channel_id, status, test_mode, start_at, end_at, announcement_message_id, created_at)
    VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)
  `).run(guildId, channelId, leaderboardChannelId, testMode ? 1 : 0, startAt, endAt, announcementMessageId, Date.now());
  return getLtlEvent(result.lastInsertRowid);
}

function getLtlEvent(eventId) {
  return db.prepare("SELECT * FROM ltl_events WHERE id = ?").get(eventId) || null;
}

function getActiveLtlEvent(guildId) {
  return db.prepare(`
    SELECT * FROM ltl_events
    WHERE guild_id = ? AND status IN ('scheduled', 'active')
    ORDER BY id DESC LIMIT 1
  `).get(guildId) || null;
}

function getPendingLtlEvents() {
  return db.prepare(`
    SELECT * FROM ltl_events
    WHERE status IN ('scheduled', 'active')
    ORDER BY start_at ASC
  `).all();
}

function setLtlEventActive(eventId, startedAt = Date.now()) {
  db.prepare(`
    UPDATE ltl_events SET status = 'active', started_at = ?
    WHERE id = ? AND status = 'scheduled'
  `).run(startedAt, eventId);
  return getLtlEvent(eventId);
}

function endLtlEvent(eventId, endedAt = Date.now()) {
  db.prepare(`
    UPDATE ltl_events SET status = 'ended', ended_at = ?
    WHERE id = ? AND status IN ('scheduled', 'active')
  `).run(endedAt, eventId);
  return getLtlEvent(eventId);
}

function cancelLtlEvent(eventId, endedAt = Date.now()) {
  db.prepare(`
    UPDATE ltl_events SET status = 'cancelled', ended_at = ?
    WHERE id = ? AND status IN ('scheduled', 'active')
  `).run(endedAt, eventId);
  return getLtlEvent(eventId);
}

function setLtlEventEndAt(eventId, endAt) {
  db.prepare("UPDATE ltl_events SET end_at = ? WHERE id = ?").run(endAt, eventId);
  return getLtlEvent(eventId);
}

function setLtlAnnouncementMessageId(eventId, messageId) {
  db.prepare("UPDATE ltl_events SET announcement_message_id = ? WHERE id = ?").run(messageId, eventId);
}

function setLtlLeaderboardMessageId(eventId, messageId) {
  db.prepare("UPDATE ltl_events SET leaderboard_message_id = ? WHERE id = ?").run(messageId, eventId);
}

function setLtlPingSent(eventId, sent = true) {
  db.prepare("UPDATE ltl_events SET ping_sent = ? WHERE id = ?").run(sent ? 1 : 0, eventId);
}

function addLtlParticipant(eventId, userId, joinedAt = Date.now(), excludedFromWinner = false) {
  db.prepare(`
    INSERT INTO ltl_participants (event_id, user_id, joined_at, left_at, status, excluded_from_winner)
    VALUES (?, ?, ?, NULL, 'active', ?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET
    joined_at = excluded.joined_at,
    left_at = NULL,
    status = 'active',
    excluded_from_winner = excluded.excluded_from_winner
  `).run(eventId, userId, joinedAt, excludedFromWinner ? 1 : 0);
  return getLtlParticipant(eventId, userId);
}

function getLtlParticipant(eventId, userId) {
  return db.prepare(`
    SELECT * FROM ltl_participants
    WHERE event_id = ? AND user_id = ?
  `).get(eventId, userId) || null;
}

function markLtlParticipantLeft(eventId, userId, leftAt = Date.now(), status = "left") {
  db.prepare(`
    UPDATE ltl_participants SET left_at = ?, status = ?
    WHERE event_id = ? AND user_id = ? AND status = 'active'
  `).run(leftAt, status, eventId, userId);
  return getLtlParticipant(eventId, userId);
}

function markLtlParticipantKicked(eventId, userId, leftAt = Date.now()) {
  return markLtlParticipantLeft(eventId, userId, leftAt, "kicked");
}

function markLtlParticipantWinner(eventId, userId) {
  db.prepare(`
    UPDATE ltl_participants SET status = 'winner'
    WHERE event_id = ? AND user_id = ?
  `).run(eventId, userId);
  return getLtlParticipant(eventId, userId);
}

function setLtlParticipantExcluded(eventId, userId, excluded = true) {
  db.prepare(`
    UPDATE ltl_participants SET excluded_from_winner = ?
    WHERE event_id = ? AND user_id = ?
  `).run(excluded ? 1 : 0, eventId, userId);
  return getLtlParticipant(eventId, userId);
}

function getLtlParticipants(eventId) {
  return db.prepare(`
    SELECT p.*,
    CASE
      WHEN p.left_at IS NOT NULL AND e.started_at IS NOT NULL THEN MAX(0, p.left_at - e.started_at)
      WHEN e.started_at IS NOT NULL THEN MAX(0, ? - e.started_at)
      ELSE 0
    END AS duration_ms
    FROM ltl_participants p
    JOIN ltl_events e ON e.id = p.event_id
    WHERE p.event_id = ?
    ORDER BY duration_ms DESC, p.joined_at ASC
  `).all(Date.now(), eventId);
}

function getActiveLtlParticipants(eventId) {
  return db.prepare(`
    SELECT * FROM ltl_participants
    WHERE event_id = ? AND status = 'active'
    ORDER BY joined_at ASC
  `).all(eventId);
}

function getLtlLeaderboard(eventId) {
  return getLtlParticipants(eventId).filter((participant) => !participant.excluded_from_winner);
}

function getLtlWinnerCandidates(eventId) {
  return db.prepare(`
    SELECT p.*,
    CASE
      WHEN p.left_at IS NOT NULL AND e.started_at IS NOT NULL THEN MAX(0, p.left_at - e.started_at)
      WHEN e.started_at IS NOT NULL THEN MAX(0, ? - e.started_at)
      ELSE 0
    END AS duration_ms
    FROM ltl_participants p
    JOIN ltl_events e ON e.id = p.event_id
    WHERE p.event_id = ? AND p.excluded_from_winner = 0
    ORDER BY CASE WHEN p.status = 'active' THEN 1 ELSE 0 END DESC, duration_ms DESC, p.joined_at ASC
  `).all(Date.now(), eventId);
}

function getLtlLastActiveParticipant(eventId) {
  return db.prepare(`
    SELECT p.* FROM ltl_participants p
    WHERE p.event_id = ? AND p.status = 'active' AND p.excluded_from_winner = 0
    ORDER BY p.joined_at ASC LIMIT 1
  `).get(eventId) || null;
}

function removeLtlEvent(eventId) {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM ltl_participants WHERE event_id = ?").run(eventId);
    return db.prepare("DELETE FROM ltl_events WHERE id = ?").run(eventId).changes > 0;
  });
  return transaction();
}




db.exec(`
  CREATE TABLE IF NOT EXISTS underage_dm_sent (
    user_id TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goat_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    image_url TEXT,
    applied_at INTEGER NOT NULL,
    decided_at INTEGER,
    decided_by TEXT
  );

  CREATE TABLE IF NOT EXISTS goat_blacklist (
    user_id TEXT PRIMARY KEY,
    reason TEXT,
    blacklisted_by TEXT,
    blacklisted_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goat_grants (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS goat_cooldowns (
    user_id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS staff_role_grants (
    user_id TEXT PRIMARY KEY,
    granted_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS creator_thread_strikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS age_blacklist_pending (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    unlock_at INTEGER NOT NULL
  );

  -- Linked social media accounts for the website roster cards, keyed by the
  -- Discord user's permanent user ID (never username/nickname, which can
  -- change). Set/updated via the *linkaccounts command. Any column left
  -- NULL means that platform isn't linked and its icon is hidden on the
  -- website.
  CREATE TABLE IF NOT EXISTS social_accounts (
    user_id TEXT PRIMARY KEY,
    youtube TEXT,
    twitch TEXT,
    tiktok TEXT,
    x TEXT,
    instagram TEXT,
    facebook TEXT,
    kick TEXT,
    discord TEXT,
    updated_at INTEGER NOT NULL,
    updated_by TEXT
  );
`);






const SOCIAL_PLATFORM_KEYS = [
  "youtube",
  "twitch",
  "tiktok",
  "x",
  "instagram",
  "facebook",
  "kick",
  "discord"
];

function upsertSocialAccounts(userId, accounts, updatedBy) {
  const values = SOCIAL_PLATFORM_KEYS.map((key) => {
    const val = accounts && typeof accounts[key] === "string" ? accounts[key].trim() : "";
    return val.length ? val : null;
  });

  db.prepare(
    `INSERT INTO social_accounts (user_id, youtube, twitch, tiktok, x, instagram, facebook, kick, discord, updated_at, updated_by)
     VALUES (@user_id, @youtube, @twitch, @tiktok, @x, @instagram, @facebook, @kick, @discord, @updated_at, @updated_by)
     ON CONFLICT(user_id) DO UPDATE SET
       youtube = excluded.youtube,
       twitch = excluded.twitch,
       tiktok = excluded.tiktok,
       x = excluded.x,
       instagram = excluded.instagram,
       facebook = excluded.facebook,
       kick = excluded.kick,
       discord = excluded.discord,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).run({
    user_id: userId,
    youtube: values[0],
    twitch: values[1],
    tiktok: values[2],
    x: values[3],
    instagram: values[4],
    facebook: values[5],
    kick: values[6],
    discord: values[7],
    updated_at: Date.now(),
    updated_by: updatedBy || null
  });
}

function getSocialAccounts(userId) {
  const row = db
    .prepare(
      `SELECT youtube, twitch, tiktok, x, instagram, facebook, kick, discord
       FROM social_accounts WHERE user_id = ?`
    )
    .get(userId);
  if (!row) return {};
  const accounts = {};
  for (const key of SOCIAL_PLATFORM_KEYS) {
    if (row[key]) accounts[key] = row[key];
  }
  return accounts;
}



function getUnderageBlacklists() {
  return db
    .prepare(
      `SELECT b.user_id, b.reason
       FROM blacklist b
       LEFT JOIN underage_dm_sent s ON s.user_id = b.user_id
       WHERE b.type = 'staff' AND b.reason LIKE '%Underage%' AND s.user_id IS NULL`
    )
    .all();
}

function markUnderageDmSent(userId) {
  db.prepare(
    "INSERT OR IGNORE INTO underage_dm_sent (user_id, sent_at) VALUES (?, ?)"
  ).run(userId, Date.now());
}





function createGoatApplication(userId, guildId, imageUrl) {
  const info = db
    .prepare(
      "INSERT INTO goat_applications (user_id, guild_id, status, image_url, applied_at) VALUES (?, ?, 'pending', ?, ?)"
    )
    .run(userId, guildId, imageUrl, Date.now());
  return db.prepare("SELECT * FROM goat_applications WHERE id = ?").get(info.lastInsertRowid);
}

function getGoatApplication(id) {
  return db.prepare("SELECT * FROM goat_applications WHERE id = ?").get(id);
}

function getPendingGoatApplication(userId) {
  return db
    .prepare("SELECT * FROM goat_applications WHERE user_id = ? AND status = 'pending'")
    .get(userId);
}

function setGoatApplicationStatus(id, status, decidedBy = null) {
  db.prepare(
    "UPDATE goat_applications SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?"
  ).run(status, Date.now(), decidedBy, id);
}

function isGoatBlacklisted(userId) {
  return !!db.prepare("SELECT 1 FROM goat_blacklist WHERE user_id = ?").get(userId);
}

function getGoatBlacklist(userId) {
  return db.prepare("SELECT * FROM goat_blacklist WHERE user_id = ?").get(userId);
}

function addGoatBlacklist(userId, reason, blacklistedBy) {
  db.prepare(
    `INSERT INTO goat_blacklist (user_id, reason, blacklisted_by, blacklisted_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, blacklisted_by = excluded.blacklisted_by, blacklisted_at = excluded.blacklisted_at`
  ).run(userId, reason, blacklistedBy, Date.now());
}

function removeGoatBlacklist(userId) {
  const info = db.prepare("DELETE FROM goat_blacklist WHERE user_id = ?").run(userId);
  return info.changes > 0;
}

function setGoatCooldown(userId, expiresAt) {
  db.prepare(
    `INSERT INTO goat_cooldowns (user_id, expires_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at`
  ).run(userId, expiresAt);
}

function getGoatCooldown(userId) {
  const row = db.prepare("SELECT * FROM goat_cooldowns WHERE user_id = ?").get(userId);
  if (row && row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM goat_cooldowns WHERE user_id = ?").run(userId);
    return null;
  }
  return row || null;
}

function clearGoatCooldown(userId) {
  const info = db.prepare("DELETE FROM goat_cooldowns WHERE user_id = ?").run(userId);
  return info.changes > 0;
}

function upsertGoatGrant(userId, guildId, grantedAt, expiresAt) {
  db.prepare(
    `INSERT INTO goat_grants (user_id, guild_id, granted_at, expires_at, active) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET guild_id = excluded.guild_id, granted_at = excluded.granted_at, expires_at = excluded.expires_at, active = 1`
  ).run(userId, guildId, grantedAt, expiresAt);
}

function getActiveGoatGrant(userId) {
  return db
    .prepare("SELECT * FROM goat_grants WHERE user_id = ? AND active = 1")
    .get(userId);
}

function deactivateGoatGrant(userId) {
  db.prepare("UPDATE goat_grants SET active = 0 WHERE user_id = ?").run(userId);
}

function getAllActiveGoatGrants() {
  return db.prepare("SELECT * FROM goat_grants WHERE active = 1").all();
}

function clearAllGoatCooldowns() {
  db.prepare("DELETE FROM goat_cooldowns").run();
}

function cancelAllPendingGoatApplications() {
  db.prepare("UPDATE goat_applications SET status = 'cancelled', decided_at = ? WHERE status = 'pending'").run(
    Date.now()
  );
}

module.exports = {
  db,
  getSetting,
  setSetting,
  nextTicketNumber,
  createTicket,
  getTicketByChannel,
  setEmbedMessageId,
  claimTicket,
  unclaimTicket,
  getOpenUnclaimedTickets,
  getTicketsNeedingReminderPing,
  setLastUnclaimedPingAt,
  closeTicket,
  setTimer,
  clearTimer,
  setAwaitingStaffSince,
  clearAwaitingStaffState,
  setLastGhostPingAt,
  getTicketsNeedingGhostPing,
  getOpenTicketsWithTimers,
  getAllOpenTickets,
  getOpenTicketByUser,
  addWarning,
  getWarnings,
  addAutomodWarning,
  removeExpiredAutomodWarnings,
  getAutomodOffense,
  recordAutomodOffense,
  clearAutomodOffense,
  addTempBan,
  getActiveTempBans,
  deactivateTempBan,
  createTempVC,
  getTempVC,
  deleteTempVC,
  setTempVCOwner,
  getAllTempVCs,
  getVCCooldown,
  setVCCooldown,
  setModRoles,
  getModRoles,
  resetModPermissions,
  addBlockedWord,
  removeBlockedWord,
  getBlockedWords,
  addWhitelistedWord,
  removeWhitelistedWord,
  getWhitelistedWords,
  addAutoReply,
  removeAutoReplyTrigger,
  getAllAutoReplies,
  incrementMessageCount,
  addVoiceSeconds,
  getMessageCount,
  getVoiceSeconds,
  getTopMessages,
  getTopVoiceSeconds,
  getTopClaimedTickets,
  getClaimedCount,
  setTicketClaimedAt,
  addModLog,
  getModLogs,
  addBlacklist,
  setBlacklistApprovalMessage,
  removeBlacklist,
  getBlacklist,
  getAllBlacklistByType,
  addLOA,
  setAfk,
  clearAfk,
  getAfk,
  addXp,
  canEarnMessageXp,
  canEarnReactionXp,
  getXpLeaderboard,
  getXpRank,
  getLevelRow,
  addTriggerWord,
  removeTriggerWord,
  getTriggerWords,
  clearAllBlockedWords,
  startVCSession,
  endVCSession,
  getAllVCSessions,
  getTempVCByOwner,
  setTicketDelayed,
  setTicketProWaiting,
  setLastOpenerMessageAt,
  setStaffReplied,
  setTicketTimerMessageId,
  getTicketsNeedingAutoTimer,
  getTicketsNeedingOpenerSilenceTimer,
  incrementTimerRunCount,
  getTicketsNeedingImmediateClosure,
  changeTicketType,
  getTicketClaimsSince,
  addMessageLog,
  getRecentMessages,
  getMessageCountSince,
  getMessageCountsByChannelSince,
  addScheduledMessage,
  getPendingScheduledMessages,
  markScheduledMessageSent,
  deleteScheduledMessage,
  addMemberEvent,
  getGrowthByDay,
  getMemberEventCounts,
  addReview,
  createRoleRace,
  setRoleRaceMessageId,
  getRoleRace,
  getRoleRaceClaimCount,
  hasUserClaimedRace,
  claimRoleRace,
  createGuessGame,
  getGuessGame,
  getGuessGameByChannel,
  getGuessGameByTicketChannel,
  getPendingGuessGames,
  setGuessGamePanelMessageId,
  setGuessGameReminderSent,
  setGuessGameActive,
  setGuessGameExpired,
  setGuessGameWinner,
  setGuessGameTicket,
  clearGuessGameCleanup,
  removeLatestWarning,
  getActiveTempBanByUser,
  createTrainingSession,
  getTrainingSession,
  updateTrainingSession,
  setTrainingStatus,
  getActiveTrainingSessions,
  createLtlEvent,
  getLtlEvent,
  getActiveLtlEvent,
  getPendingLtlEvents,
  setLtlEventActive,
  endLtlEvent,
  cancelLtlEvent,
  setLtlEventEndAt,
  setLtlAnnouncementMessageId,
  setLtlLeaderboardMessageId,
  setLtlPingSent,
  addLtlParticipant,
  getLtlParticipant,
  markLtlParticipantLeft,
  markLtlParticipantKicked,
  markLtlParticipantWinner,
  setLtlParticipantExcluded,
  getLtlParticipants,
  getActiveLtlParticipants,
  getLtlLeaderboard,
  getLtlWinnerCandidates,
  getLtlLastActiveParticipant,
  removeLtlEvent,
  getUnderageBlacklists,
  markUnderageDmSent,
  createGoatApplication,
  getGoatApplication,
  getPendingGoatApplication,
  setGoatApplicationStatus,
  isGoatBlacklisted,
  getGoatBlacklist,
  addGoatBlacklist,
  removeGoatBlacklist,
  setGoatCooldown,
  getGoatCooldown,
  clearGoatCooldown,
  upsertGoatGrant,
  getActiveGoatGrant,
  deactivateGoatGrant,
  getAllActiveGoatGrants,
  clearAllGoatCooldowns,
  cancelAllPendingGoatApplications,
  getMessageCountForUserSince,
  getClaimedCountForUserSince,
  setStaffRoleGrantedAt,
  getStaffRoleGrantedAt,
  addCreatorThreadStrike,
  countCreatorThreadStrikes,
  setAgeBlacklistPending,
  removeAgeBlacklistPending,
  getAllAgeBlacklistPending,
  upsertSocialAccounts,
  getSocialAccounts,
  SOCIAL_PLATFORM_KEYS
};
