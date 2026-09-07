const { EmbedBuilder } = require("discord.js");
const moderationService = require("../services/moderationService");
const config = require("../config");
const { formatDuration } = require("../utils/duration");

module.exports = {
  name: "case",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const caseId = parseInt(args[0]?.replace(/^CASE-/i, ""), 10);
    if (!caseId) throw new Error("Usage: `*case <caseId>`");
    const c = moderationService.getCase(message.guild.id, caseId);
    if (!c) throw new Error("No case found with that ID.");

    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(`CASE-${c.caseId}`)
      .addFields(
        { name: "Action", value: c.action, inline: true },
        { name: "Target", value: `<@${c.targetId}>`, inline: true },
        { name: "Moderator", value: `<@${c.moderatorId}>`, inline: true },
        { name: "Reason", value: c.reason || "No reason provided", inline: false },
        ...(c.durationMs ? [{ name: "Duration", value: formatDuration(c.durationMs), inline: true }] : []),
        { name: "DM Delivered", value: c.dmDelivered ? "Yes" : "No", inline: true },
        { name: "Timestamp", value: `<t:${Math.floor(c.createdAt / 1000)}:F>`, inline: false }
      );
    await message.channel.send({ embeds: [embed] });
  }
};
