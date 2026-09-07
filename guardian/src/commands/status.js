const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

module.exports = {
  name: "status",
  requiresStaff: true,
  capability: "warn",
  async execute(message) {
    let dbHealthy = true;
    try {
      db.prepare("SELECT 1").get();
    } catch {
      dbHealthy = false;
    }
    const lastEvent = db
      .prepare(`SELECT * FROM security_events WHERE guildId = ? ORDER BY createdAt DESC LIMIT 1`)
      .get(message.guild.id);

    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle("🤖 Bot Status")
      .addFields(
        { name: "Online", value: "Yes", inline: true },
        { name: "Uptime", value: formatUptime(message.client.uptime), inline: true },
        { name: "Latency", value: `${message.client.ws.ping}ms`, inline: true },
        { name: "Database", value: dbHealthy ? "Healthy" : "Error", inline: true },
        { name: "Guild", value: message.guild.name, inline: true },
        { name: "Members", value: String(message.guild.memberCount), inline: true },
        { name: "Last Security Event", value: lastEvent ? `${lastEvent.eventId} (${lastEvent.type})` : "None", inline: false }
      )
      .setTimestamp(new Date());
    await message.channel.send({ embeds: [embed] });
  }
};
