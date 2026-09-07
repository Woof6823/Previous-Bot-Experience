const { EmbedBuilder } = require("discord.js");
const moderationService = require("../services/moderationService");
const config = require("../config");

module.exports = {
  name: "warnings",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*warnings <@user|userId>`");
    const warnings = moderationService.getActiveWarnings(message.guild.id, target.id);
    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(`Warnings for ${target.user.tag}`)
      .setDescription(
        warnings.length
          ? warnings
              .map((w) => `**CASE-${w.caseId}** — ${w.reason || "No reason"} (<t:${Math.floor(w.createdAt / 1000)}:R>)`)
              .join("\n")
          : "No active warnings."
      );
    await message.channel.send({ embeds: [embed] });
  }
};
