const { EmbedBuilder } = require("discord.js");
const moderationService = require("../services/moderationService");
const config = require("../config");

module.exports = {
  name: "modhistory",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*modhistory <@user|userId>`");
    const cases = moderationService.getHistory(message.guild.id, target.id).slice(0, 15);
    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(`Moderation History — ${target.user.tag}`)
      .setDescription(
        cases.length
          ? cases
              .map(
                (c) =>
                  `**CASE-${c.caseId}** \`${c.action}\` — ${c.reason || "No reason"} (<t:${Math.floor(
                    c.createdAt / 1000
                  )}:R>)`
              )
              .join("\n")
          : "No moderation history."
      );
    await message.channel.send({ embeds: [embed] });
  }
};
