const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const { getSetting, setSetting } = require("../database");

const SETTING_KEY = "staffupdate_channel_id";

async function refreshPanel(channel) {
  if (!channel || !channel.isTextBased()) return null;

  const embed = new EmbedBuilder()
    .setTitle("Staff Updates")
    .setDescription(
      "Use the buttons below to manage staff updates.\n\n" +
      "This panel is automatically refreshed when the staff update command is used."
    )
    .setColor(0x5865f2)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staffupdate_refresh")
      .setLabel("Refresh Panel")
      .setStyle(ButtonStyle.Secondary)
  );

  const messages = await channel.messages.fetch({ limit: 25 });
  const existing = messages.find(
    (m) => m.author?.id === channel.client.user?.id &&
           m.embeds?.[0]?.title === "Staff Updates"
  );

  if (existing) {
    return existing.edit({ embeds: [embed], components: [row] });
  }

  return channel.send({ embeds: [embed], components: [row] });
}

async function getConfiguredChannel(guild) {
  if (!guild) return null;
  const channelId =
    getSetting(SETTING_KEY) ||
    config.staffupdateChannelId ||
    config.staffUpdateChannelId ||
    config.staffupdate?.channelId ||
    config.staffUpdate?.channelId;

  if (!channelId) return null;

  return guild.channels.cache.get(channelId) ||
    await guild.channels.fetch(channelId).catch(() => null);
}

async function ensurePanel(guild) {
  const channel = await getConfiguredChannel(guild);
  if (!channel) return null;
  return refreshPanel(channel);
}

module.exports = {
  refreshPanel,
  getConfiguredChannel,
  ensurePanel,
  SETTING_KEY,
  setSetting,
};
