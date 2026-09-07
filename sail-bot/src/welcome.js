const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./database');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');

const BANNER_PATH = path.join(__dirname, '..', 'assets', 'banner.png');
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

async function sendWelcome(member) {
  const channelId = db.getSetting(SETTINGS_KEYS.WELCOME_CHANNEL);
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const banner = new AttachmentBuilder(BANNER_PATH, { name: 'banner.png' });
  const logo = new AttachmentBuilder(LOGO_PATH, { name: 'logo.png' });

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Welcome here!')
    .setDescription(
      `Hey ${member}! Please follow all our rules and make sure you are polite and respectful to others. Now, have fun!`
    )
    .setThumbnail('attachment://logo.png')
    .setImage('attachment://banner.png')
    .setFooter({ text: BRAND_NAME });

  const message = await channel.send({
    content: `${member} welcome to the server! Please follow all our rules and make sure you are polite and respectful to others. Now, have fun!`,
    embeds: [embed],
    files: [logo, banner],
  });

  await message.react('👋').catch(() => {});
}

module.exports = { sendWelcome };
