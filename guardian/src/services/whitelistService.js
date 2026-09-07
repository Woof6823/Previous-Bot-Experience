const db = require("../database");

function isOwner(guildId, userId) {
  return !!db.prepare(`SELECT 1 FROM owners WHERE guildId = ? AND userId = ?`).get(guildId, userId);
}

function isWhitelisted(guildId, userId) {
  if (isOwner(guildId, userId)) return true;
  return !!db.prepare(`SELECT 1 FROM whitelist WHERE guildId = ? AND userId = ?`).get(guildId, userId);
}

function addWhitelist(guildId, userId, addedBy) {
  db.prepare(
    `INSERT OR IGNORE INTO whitelist (guildId, userId, addedBy, addedAt) VALUES (?, ?, ?, ?)`
  ).run(guildId, userId, addedBy, Date.now());
}

function removeWhitelist(guildId, userId) {
  db.prepare(`DELETE FROM whitelist WHERE guildId = ? AND userId = ?`).run(guildId, userId);
}

function listWhitelist(guildId) {
  return db.prepare(`SELECT userId FROM whitelist WHERE guildId = ?`).all(guildId).map((r) => r.userId);
}

function addOwner(guildId, userId) {
  db.prepare(`INSERT OR IGNORE INTO owners (guildId, userId) VALUES (?, ?)`).run(guildId, userId);
}

function listOwners(guildId) {
  return db.prepare(`SELECT userId FROM owners WHERE guildId = ?`).all(guildId).map((r) => r.userId);
}

function isApprovedBot(guildId, botId) {
  return !!db.prepare(`SELECT 1 FROM approved_bots WHERE guildId = ? AND botId = ?`).get(guildId, botId);
}

function addApprovedBot(guildId, botId, addedBy) {
  db.prepare(
    `INSERT OR IGNORE INTO approved_bots (guildId, botId, addedBy, addedAt) VALUES (?, ?, ?, ?)`
  ).run(guildId, botId, addedBy, Date.now());
}

module.exports = {
  isOwner,
  isWhitelisted,
  addWhitelist,
  removeWhitelist,
  listWhitelist,
  addOwner,
  listOwners,
  isApprovedBot,
  addApprovedBot
};
