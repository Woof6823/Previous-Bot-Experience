const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const xpService = require("../services/xpService");

module.exports = {
  name: "level",
  aliases: ["rank"],
  async execute(message, args) {
    const target = message.mentions.members.first() || message.member;
    const row = xpService.getUser(message.guild.id, target.id);
    const rank = xpService.getRank(message.guild.id, target.id);
    const nextLevelXp = xpService.xpNeededForLevel(row.level + 1);
    const currentLevelXp = xpService.xpNeededForLevel(row.level);

    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
      .setTitle(`Level ${row.level}`)
      .addFields(
        { name: "Rank", value: rank ? `#${rank}` : "Unranked", inline: true },
        { name: "XP", value: `${row.xp} (${row.xp - currentLevelXp}/${nextLevelXp - currentLevelXp} to next level)`, inline: true }
      );
    await message.channel.send({ embeds: [embed] });
  }
};
