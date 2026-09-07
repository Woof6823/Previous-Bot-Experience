const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const configService = require("../services/configService");
const xpService = require("../services/xpService");

function buildLevelUpEmbed(member, level) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setAuthor({
      name: `${member.guild.name} • Level System`,
      iconURL: member.guild.iconURL({ extension: "png", size: 128 }) || undefined
    })
    .setTitle("🎉 LEVEL UP!")
    .setDescription([
      `## Congratulations, ${member}! 🚀`,
      "",
      `You've reached **Level ${level}**!`,
      "",
      `Keep chatting, keep participating, and keep growing with the community. 💙`
    ].join("\n"))
    .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 512 }))
    .addFields(
      {
        name: "🏆 New Level",
        value: `**LEVEL ${level}**`,
        inline: true
      },
      {
        name: "👤 Member",
        value: member.user.tag,
        inline: true
      },
      {
        name: "✨ Achievement",
        value: "Community Level Up",
        inline: true
      }
    )
    .setFooter({
      text: "Keep going — your next level is waiting! • Guardian"
    })
    .setTimestamp();
}

async function handleMessageXp(message) {
  const result = xpService.awardMessageXp(message.guild.id, message.author.id);
  if (!result || !result.leveledUp) return;

  const settings = configService.getSettings(message.guild.id);
  const channel = settings.levelUpChannelId
    ? message.guild.channels.cache.get(settings.levelUpChannelId)
    : message.channel;

  if (!channel?.isTextBased()) return;

  const embed = buildLevelUpEmbed(message.member, result.newLevel);

  await channel.send({
    content: `🎊 <@${message.author.id}>`,
    embeds: [embed]
  }).catch(() => {});
}

async function testLevelUp(member) {
  const settings = configService.getSettings(member.guild.id);
  const channel = settings.levelUpChannelId
    ? member.guild.channels.cache.get(settings.levelUpChannelId)
    : member.guild.channels.cache.find(
        c => c.isTextBased() && c.name === "level-ups"
      );

  if (!channel?.isTextBased()) {
    throw new Error("The configured level-up channel could not be found.");
  }

  const embed = buildLevelUpEmbed(member, 10)
    .setTitle("🧪 Level-Up Message Test")
    .setFooter({ text: "Guardian • Level System Test" });

  await channel.send({
    content: `🎊 <@${member.id}>`,
    embeds: [embed]
  });
}

module.exports = {
  handleMessageXp,
  testLevelUp,
  buildLevelUpEmbed
};
