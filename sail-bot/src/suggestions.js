const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');


async function suggest(message, text) {
  const channelId = db.getSetting(SETTINGS_KEYS.SUGGESTIONS_CHANNEL);
  if (!channelId) {
    return message.reply('❌ No suggestions channel has been set yet. Ask an admin to run `*setsuggestions`.');
  }
  if (!text) return message.reply('❌ Usage: `*suggest <your suggestion>`');

  const channel = message.guild.channels.cache.get(channelId);
  if (!channel) return message.reply('❌ The configured suggestions channel no longer exists.');

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(text)
    .setFooter({ text: `${BRAND_NAME} · Suggestion` })
    .setTimestamp();

  const posted = await channel.send({ embeds: [embed] });
  await posted.react('👍').catch(() => {});
  await posted.react('👎').catch(() => {});

  await message.reply(`✅ Your suggestion was posted in ${channel}.`);
}

module.exports = { suggest };
