const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const db = require("../database");

async function resolveDisplayName(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) return member.displayName;
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user ? user.username : `User ${userId}`;
}

async function buildStaffStatsEmbed(guild, userId, days) {
  const claimed = db.getClaimedCount(userId, days);
  const messages = db.getMessageCount(userId, days);
  const voiceSeconds = db.getVoiceSeconds(userId, days);
  const displayName = await resolveDisplayName(guild, userId);

  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`📊 Stats for ${displayName}`)
    .setDescription(`Showing activity over the last **${days} day(s)**.`)
    .addFields(
      { name: "🎫 Tickets Claimed", value: `${claimed}`, inline: true },
      { name: "💬 Messages Sent", value: `${messages}`, inline: true },
      { name: "🔊 VC Hours", value: `${(voiceSeconds / 3600).toFixed(1)}h`, inline: true }
    );
}

function buildStaffStatsRow(userId, activeDays) {
  return new ActionRowBuilder().addComponents(
    config.statsPeriods.map((days) =>
      new ButtonBuilder()
        .setCustomId(`staffstats_${userId}_${days}`)
        .setLabel(`${days}d`)
        .setStyle(days === activeDays ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(days === activeDays)
    )
  );
}

module.exports = { buildStaffStatsEmbed, buildStaffStatsRow, resolveDisplayName };
