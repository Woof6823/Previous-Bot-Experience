const db = require("../database");
const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const configService = require("./configService");

function createCase(guildId, targetId, moderatorId, action, reason, durationMs, dmDelivered) {
  const info = db
    .prepare(
      `INSERT INTO moderation_cases (guildId, targetId, moderatorId, action, reason, durationMs, dmDelivered, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, targetId, moderatorId, action, reason || null, durationMs || null, dmDelivered ? 1 : 0, Date.now());
  return info.lastInsertRowid;
}

function getCase(guildId, caseId) {
  return db.prepare(`SELECT * FROM moderation_cases WHERE guildId = ? AND caseId = ?`).get(guildId, caseId);
}

function getHistory(guildId, targetId) {
  return db
    .prepare(`SELECT * FROM moderation_cases WHERE guildId = ? AND targetId = ? ORDER BY createdAt DESC`)
    .all(guildId, targetId);
}

function addWarning(guildId, targetId, moderatorId, reason, caseId) {
  db.prepare(
    `INSERT INTO warnings (guildId, targetId, moderatorId, reason, caseId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(guildId, targetId, moderatorId, reason || null, caseId, Date.now());
}

function getActiveWarnings(guildId, targetId) {
  return db
    .prepare(`SELECT * FROM warnings WHERE guildId = ? AND targetId = ? AND active = 1 ORDER BY createdAt DESC`)
    .all(guildId, targetId);
}

function clearWarnings(guildId, targetId) {
  db.prepare(`UPDATE warnings SET active = 0 WHERE guildId = ? AND targetId = ?`).run(guildId, targetId);
}


async function sendPunishmentDM(user, { action, reason, durationLabel, caseId, guildName }) {
  const actionText = {
    warn: "You have received a warning",
    mute: "You have been muted",
    timeout: "You have been timed out",
    kick: "You have been kicked from the server",
    ban: "You have been banned from the server"
  }[action] || `Action taken: ${action}`;

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`${guildName || "Server"} — Moderation Notice`)
    .setDescription(actionText)
    .addFields(
      { name: "Reason", value: reason || "No reason provided", inline: false },
      ...(durationLabel ? [{ name: "Duration", value: durationLabel, inline: true }] : []),
      { name: "Case ID", value: `CASE-${caseId}`, inline: true }
    )
    .setFooter({ text: "If you believe this was a mistake, contact server staff through the appeal process." })
    .setTimestamp(new Date());

  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

function publicSuccessEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(`✓ ${text}`);
}

async function logToModChannel(guild, { action, target, moderator, reason, caseId, durationLabel, dmDelivered }) {
  const settings = configService.getSettings(guild.id);
  if (!settings.modLogChannelId) return;
  const channel = guild.channels.cache.get(settings.modLogChannelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`Case CASE-${caseId} — ${action.toUpperCase()}`)
    .addFields(
      { name: "Target", value: `<@${target.id}> (${target.id})`, inline: true },
      { name: "Moderator", value: `<@${moderator.id}> (${moderator.id})`, inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false },
      ...(durationLabel ? [{ name: "Duration", value: durationLabel, inline: true }] : []),
      { name: "DM Delivered", value: dmDelivered ? "Yes" : "No", inline: true }
    )
    .setTimestamp(new Date());
  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  createCase,
  getCase,
  getHistory,
  addWarning,
  getActiveWarnings,
  clearWarnings,
  sendPunishmentDM,
  publicSuccessEmbed,
  logToModChannel
};
