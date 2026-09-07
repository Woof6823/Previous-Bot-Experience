const { EmbedBuilder, ActivityType } = require("discord.js");
const config = require("../config");
const settings = require("../settings");

const STATUS_PRESETS = {
  maintenance: {
    presence: "🛠️ Under Maintenance",
    title: "🛠️ Maintenance",
    description:
      "The bot/server is currently under maintenance. Some things may not work as expected.",
    color: 0xf5c400
  },
  working: {
    presence: "✅ Fully Working",
    title: "✅ Fully Working",
    description: "Everything is up and running normally.",
    color: 0x57f287
  },
  notworking: {
    presence: "❌ Not Working",
    title: "❌ Not Working",
    description: "The bot/server is currently down. Staff have been notified.",
    color: 0xed4245
  }
};

async function announce(client, key) {
  const preset = STATUS_PRESETS[key];
  if (!preset) throw new Error(`Unknown status preset: ${key}`);

  const channel = await client.channels.fetch(config.botStatusChannelId).catch(() => null);
  if (!channel) throw new Error("Bot status channel not found.");

  client.user.setPresence({
    activities: [{ name: preset.presence, type: ActivityType.Custom, state: preset.presence }],
    status: key === "notworking" ? "dnd" : key === "maintenance" ? "idle" : "online"
  });

  const staffRoleId = settings.get("staffAccessRoleId");
  const embed = new EmbedBuilder()
    .setColor(preset.color)
    .setTitle(preset.title)
    .setDescription(preset.description);

  await channel.send({
    content: staffRoleId ? `<@&${staffRoleId}>` : undefined,
    embeds: [embed]
  });
}

module.exports = { announce, STATUS_PRESETS };
