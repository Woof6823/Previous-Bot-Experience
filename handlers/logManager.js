const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");

const COLORS = {
  create: 0x57f287,
  delete: 0xed4245,
  update: 0xf5c400,
  mod: 0xed4245,
  join: 0x57f287,
  leave: 0x99aab5,
  voice: 0x5865f2
};

async function getLogChannel(guild) {
  const channelId = db.getSetting("log_channel_id");
  if (!channelId) return null;
  return (
    guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null))
  );
}





async function log(guild, { type, title, description, fields, actor, actorLabel, target, color }) {
  try {
    const channel = await getLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color || COLORS[type] || config.brandColor)
      .setTitle(title)
      .setTimestamp();

    if (description) embed.setDescription(description);

    const allFields = [];
    if (actor) {
      allFields.push({
        name: actorLabel || "👤 Done by",
        value: `${actor} (${actor.id || actor.tag || ""})`.trim(),
        inline: true
      });
    }
    if (target) allFields.push({ name: "🎯 Target", value: `${target}`, inline: true });
    if (fields) allFields.push(...fields);
    if (allFields.length) embed.addFields(allFields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("logManager failed to post:", err.message);
  }
}

module.exports = { log };
