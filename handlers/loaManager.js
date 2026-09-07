const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("📋 Leave of Absence")
    .setDescription(
      "Run `*loa` to submit a Leave of Absence request. The bot will ask you a few questions."
    );
}

async function refreshPanel(channel) {
  const oldId = db.getSetting("loa_panel_msg_id");
  if (oldId) {
    const old = await channel.messages.fetch(oldId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }
  const sent = await channel.send({ embeds: [buildPanelEmbed()] });
  db.setSetting("loa_panel_msg_id", sent.id);
}

function buildLOAEmbed({ userId, name, startDate, endDate, reason }) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("📋 Leave of Absence Request")
    .addFields(
      { name: "User", value: `<@${userId}>`, inline: true },
      { name: "Name", value: name, inline: true },
      { name: "Starts", value: startDate, inline: true },
      { name: "Ends", value: endDate, inline: true },
      { name: "Reason", value: reason }
    )
    .setTimestamp();
}

async function postLOAAndRefreshPanel(channel, data) {
  await channel.send({ embeds: [buildLOAEmbed(data)] });
  await refreshPanel(channel);
}

module.exports = { refreshPanel, postLOAAndRefreshPanel, buildPanelEmbed };
