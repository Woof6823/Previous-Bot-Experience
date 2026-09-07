const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const configService = require("../services/configService");

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildWelcomeEmbed(member) {
  const settings = configService.getSettings(member.guild.id);
  const custom = settings.welcomeMessage;

  const description = custom
    ? custom.replace("{user}", `<@${member.id}>`).replace("{count}", member.guild.memberCount)
    : [
        `### Welcome to ${member.guild.name}! 👋`,
        "",
        `Hey <@${member.id}> — we're glad to have you here!`,
        "",
        `You're our **${ordinal(member.guild.memberCount)} member**. 🎉`,
        "",
        `Take a look around, get involved, and don't be afraid to say hello!`,
        "",
        `**We're excited to have you with us. 💙**`
      ].join("\n");

  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setAuthor({
      name: `${member.guild.name} • Welcome`,
      iconURL: member.guild.iconURL({ extension: "png", size: 128 }) || undefined
    })
    .setTitle("✨ A New Member Has Arrived!")
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 512 }))
    .addFields(
      {
        name: "👤 Member",
        value: `${member}\n\`${member.user.tag}\``,
        inline: true
      },
      {
        name: "👥 Server Size",
        value: `**${member.guild.memberCount}** members`,
        inline: true
      },
      {
        name: "📅 Account",
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true
      }
    )
    .setFooter({
      text: "Welcome to the community • Guardian"
    })
    .setTimestamp();
}

async function handleMemberJoin(member) {
  const settings = configService.getSettings(member.guild.id);
  if (!settings.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(settings.welcomeChannelId);
  if (!channel?.isTextBased()) return;

  const embed = buildWelcomeEmbed(member);

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [embed]
  }).catch(() => {});
}

async function testWelcome(member) {
  const settings = configService.getSettings(member.guild.id);
  const channel = settings.welcomeChannelId
    ? member.guild.channels.cache.get(settings.welcomeChannelId)
    : member.channel;

  if (!channel?.isTextBased()) {
    throw new Error("The configured welcome channel could not be found.");
  }

  const embed = buildWelcomeEmbed(member)
    .setTitle("🧪 Welcome Message Test")
    .setFooter({ text: "Guardian • Welcome System Test" });

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [embed]
  });
}

module.exports = {
  handleMemberJoin,
  testWelcome,
  buildWelcomeEmbed
};
