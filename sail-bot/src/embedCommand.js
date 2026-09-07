const { EmbedBuilder } = require('discord.js');
const { OWNER_ID } = require('./config');

function getRandomColor() {
  return Math.floor(Math.random() * 16777215);
}

async function handleEmbedCommand(message) {
  if (message.author.id !== OWNER_ID) {
    return message.reply('❌ You do not have permission to use this command.');
  }

  const promptMsg = await message.channel.send('📝 Please paste the text you want to embed below:');

  const filter = (m) => m.author.id === message.author.id;
  const collected = await message.channel
    .awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
    .catch(() => null);

  await promptMsg.delete().catch(() => {});

  if (!collected || collected.size === 0) {
    return message.channel.send('⏰ Time out. No text received.');
  }

  const userText = collected.first().content;
  await collected.first().delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setDescription(userText)
    .setFooter({ text: `Embedded by ${message.author.tag}` })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

module.exports = { handleEmbedCommand };
