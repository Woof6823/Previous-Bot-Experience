const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');

async function sendGoodbye(member) {
  const channelId = db.getSetting(SETTINGS_KEYS.GOODBYE_CHANNEL);
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Goodbye 👋')
    .setDescription(`**${member.user.tag}** has left the server. We hope to see you again!`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendGoodbye };
