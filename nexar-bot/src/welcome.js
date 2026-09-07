const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { WELCOME_BANNER_PATH, WAVE_EMOJI, EMBED_COLOR } = require('./config');
const { getConfig } = require('./database');

async function sendWelcomeMessage(member) {
  const channelId = getConfig('welcome_channel');
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const bannerAttachment = new AttachmentBuilder(WELCOME_BANNER_PATH, { name: 'banner.png' });


  const description =
    `Hello ${member}! Welcome To Nexar Region\n\n` +
    `If your looking to join go here\n\n` +
    `<#1537859548092829715>\n` +
    `And\n` +
    `<#1537859548373712946>\n\n` +
    `To apply For Nexar Region`;

  const embed = new EmbedBuilder()
    .setTitle('Welcome To Nexar Region')
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setImage('attachment://banner.png')
    .setColor(EMBED_COLOR);

  const message = await channel.send({
    content: `${member} Welcome To Nexar Region`,
    embeds: [embed],
    files: [bannerAttachment],
  });

  await message.react(WAVE_EMOJI).catch(() => {});
}

module.exports = { sendWelcomeMessage };
