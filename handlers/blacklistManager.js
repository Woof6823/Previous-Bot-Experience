const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");
const settings = require("../settings");

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🚫 Blacklist System")
    .setDescription(
      "`*blacklist <userid> <reason>` — blocks a user from opening ANY ticket.\n" +
        "`*removeblacklist <userid>` — removes a full blacklist.\n\n" +
        "`*staffblacklist <userid> <reason>` — blocks a user from opening Staff tickets only.\n" +
        "`*removestaffblacklist <userid>` — removes a staff blacklist."
    );
}

async function refreshPanel(channel) {
  const oldId = db.getSetting("blacklist_panel_msg_id");
  if (oldId) {
    const old = await channel.messages.fetch(oldId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }
  const sent = await channel.send({ embeds: [buildPanelEmbed()] });
  db.setSetting("blacklist_panel_msg_id", sent.id);
}

function buildApprovalEmbed({ title, userId, requestedBy, reason, approvedBy }) {
  return new EmbedBuilder()
    .setColor(config.successColor)
    .setTitle(`✅ ${title}`)
    .addFields(
      { name: "User ID", value: userId, inline: true },
      { name: "Requested by", value: `<@${requestedBy}>`, inline: true },
      { name: "Status", value: "Approved", inline: true },
      { name: "Reason", value: reason || "No reason given." },
      { name: "Approved by", value: `<@${approvedBy}>`, inline: true },
      { name: "Approved at", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    );
}




async function postConfirmationAndRefreshPanel(channel, confirmationData, type) {
  const sent = await channel.send({ embeds: [buildApprovalEmbed(confirmationData)] });
  if (type) db.setBlacklistApprovalMessage(confirmationData.userId, type, channel.id, sent.id);
  await refreshPanel(channel);
}




async function markRemoved(guild, userId, type, removedByLabel) {
  const record = db.getBlacklist(userId, type);
  const channelId = record?.approval_channel_id || settings.get("blacklistChannelId");
  const messageId = record?.approval_message_id;

  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  if (messageId) {
    const original = await channel.messages.fetch(messageId).catch(() => null);
    if (original) {
      const embed = EmbedBuilder.from(original.embeds[0] || {});
      embed.setColor(0x99aab5);
      embed.setTitle(
        `🗑️ ${(original.embeds[0]?.title || "Blacklist").replace(/^✅\s*/, "")} — Removed`
      );
      const fields = (original.embeds[0]?.fields || []).map((f) =>
        f.name === "Status" ? { ...f, value: "Removed" } : f
      );
      fields.push({ name: "Removed by", value: removedByLabel, inline: true });
      fields.push({
        name: "Removed at",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true
      });
      embed.setFields(fields);
      await original.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }



  await channel
    .send(
      `🗑️ <@${userId}>'s ${type === "staff" ? "staff " : ""}blacklist has been removed by ${removedByLabel}.`
    )
    .catch(() => {});
}

module.exports = { refreshPanel, postConfirmationAndRefreshPanel, markRemoved };
