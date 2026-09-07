const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const xpService = require("../services/xpService");

module.exports = {
  name: "leaderboard",
  aliases: ["top"],
  async execute(message) {
    const rows = xpService.getLeaderboard(message.guild.id, 10);
    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(`🏆 ${message.guild.name} Leaderboard`)
      .setDescription(
        rows.length
          ? rows.map((r, i) => `**${i + 1}.** <@${r.userId}> — Level ${r.level} (${r.xp} XP)`).join("\n")
          : "No one has earned XP yet."
      );
    await message.channel.send({ embeds: [embed] });
  }
};
