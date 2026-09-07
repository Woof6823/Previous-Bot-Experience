const db = require("../database");
const config = require("../config");

const insertDefault = db.prepare(`
  INSERT OR IGNORE INTO guild_settings (
    guildId,
    staffRoleId,
    securityChannelId,
    modLogChannelId,
    welcomeChannelId,
    levelUpChannelId,
    ticketCategoryId,
    ticketPanelChannelId,
    ticketLogChannelId,
    ticketStaffRoleId,
    banThreshold,
    banWindowMs,
    kickThreshold,
    kickWindowMs,
    mentionThreshold,
    mentionWindowMs,
    modActionRateLimit,
    modActionWindowMs,
    securityTimeoutMs
  )
  VALUES (
    @guildId,
    @staffRoleId,
    @securityChannelId,
    @modLogChannelId,
    @welcomeChannelId,
    @levelUpChannelId,
    @ticketCategoryId,
    @ticketPanelChannelId,
    @ticketLogChannelId,
    @ticketStaffRoleId,
    @banThreshold,
    @banWindowMs,
    @kickThreshold,
    @kickWindowMs,
    @mentionThreshold,
    @mentionWindowMs,
    @modActionRateLimit,
    @modActionWindowMs,
    @securityTimeoutMs
  )
`);

function ensureGuild(guildId) {
  const existing = db
    .prepare("SELECT guildId FROM guild_settings WHERE guildId = ?")
    .get(guildId);

  if (existing) return;

  insertDefault.run({
    guildId,
    staffRoleId: config.staffRoleId,
    securityChannelId: config.securityChannelId,
    modLogChannelId: config.modLogChannelId,
    welcomeChannelId: config.welcomeChannelId,
    levelUpChannelId: config.levelUpChannelId,
    ticketCategoryId: null,
    ticketPanelChannelId: config.ticketPanelChannelId,
    ticketLogChannelId: config.ticketLogChannelId,
    ticketStaffRoleId: config.ticketStaffRoleId,
    banThreshold: config.defaults.banThreshold,
    banWindowMs: config.defaults.banWindowMs,
    kickThreshold: config.defaults.kickThreshold,
    kickWindowMs: config.defaults.kickWindowMs,
    mentionThreshold: config.defaults.mentionThreshold,
    mentionWindowMs: config.defaults.mentionWindowMs,
    modActionRateLimit: config.defaults.modActionRateLimit,
    modActionWindowMs: config.defaults.modActionWindowMs,
    securityTimeoutMs: config.defaults.securityTimeoutMs
  });

  const now = Date.now();

  for (const id of config.ownerIds) {
    db.prepare(
      "INSERT OR IGNORE INTO owners (guildId, userId) VALUES (?, ?)"
    ).run(guildId, id);
  }

  for (const id of config.initialWhitelistIds) {
    db.prepare(
      `INSERT OR IGNORE INTO whitelist
       (guildId, userId, addedBy, addedAt)
       VALUES (?, ?, ?, ?)`
    ).run(guildId, id, "system", now);
  }
}

function getSettings(guildId) {
  ensureGuild(guildId);

  return db
    .prepare("SELECT * FROM guild_settings WHERE guildId = ?")
    .get(guildId);
}

function updateSetting(guildId, field, value) {
  ensureGuild(guildId);

  const allowed = new Set([
    "staffRoleId",
    "securityChannelId",
    "modLogChannelId",
    "welcomeChannelId",
    "welcomeMessage",
    "levelUpChannelId",
    "ticketCategoryId",
    "ticketPanelChannelId",
    "ticketLogChannelId",
    "ticketStaffRoleId",
    "securityEnabled",
    "roleProtectionEnabled",
    "channelProtectionEnabled",
    "botProtectionEnabled",
    "banThreshold",
    "banWindowMs",
    "kickThreshold",
    "kickWindowMs",
    "mentionThreshold",
    "mentionWindowMs",
    "modActionRateLimit",
    "modActionWindowMs",
    "securityTimeoutMs"
  ]);

  if (!allowed.has(field)) {
    throw new Error(`Unknown setting: ${field}`);
  }

  db.prepare(
    `UPDATE guild_settings SET ${field} = ? WHERE guildId = ?`
  ).run(value, guildId);
}

module.exports = {
  ensureGuild,
  getSettings,
  updateSetting
};
