const db = require("../database");
const config = require("../config");

function xpNeededForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += config.levels.baseXp + i * config.levels.xpStep;
  }
  return total;
}

function levelFromXp(xp) {
  let level = 0;
  while (xpNeededForLevel(level + 1) <= xp) level++;
  return level;
}

function getUser(guildId, userId) {
  let row = db.prepare(`SELECT * FROM xp WHERE guildId = ? AND userId = ?`).get(guildId, userId);
  if (!row) {
    db.prepare(`INSERT INTO xp (guildId, userId, xp, level, lastMessageAt) VALUES (?, ?, 0, 0, 0)`).run(
      guildId,
      userId
    );
    row = db.prepare(`SELECT * FROM xp WHERE guildId = ? AND userId = ?`).get(guildId, userId);
  }
  return row;
}


function awardMessageXp(guildId, userId) {
  const row = getUser(guildId, userId);
  const now = Date.now();
  if (now - row.lastMessageAt < config.levels.xpCooldownMs) return null;

  const gained =
    Math.floor(Math.random() * (config.levels.xpPerMessageMax - config.levels.xpPerMessageMin + 1)) +
    config.levels.xpPerMessageMin;
  const newXp = row.xp + gained;
  const newLevel = levelFromXp(newXp);
  const leveledUp = newLevel > row.level;

  db.prepare(`UPDATE xp SET xp = ?, level = ?, lastMessageAt = ? WHERE guildId = ? AND userId = ?`).run(
    newXp,
    newLevel,
    now,
    guildId,
    userId
  );

  return { leveledUp, newLevel, xp: newXp };
}

function getLeaderboard(guildId, limit = 10) {
  return db
    .prepare(`SELECT * FROM xp WHERE guildId = ? ORDER BY xp DESC LIMIT ?`)
    .all(guildId, limit);
}

function getRank(guildId, userId) {
  const rows = db.prepare(`SELECT userId FROM xp WHERE guildId = ? ORDER BY xp DESC`).all(guildId);
  const idx = rows.findIndex((r) => r.userId === userId);
  return idx === -1 ? null : idx + 1;
}

module.exports = { xpNeededForLevel, levelFromXp, getUser, awardMessageXp, getLeaderboard, getRank };
