const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { BRAND_COLOR, BRAND_NAME } = require('./config');


async function setCountingChannel(message) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can set the counting channel.');
  }
  db.setCountingChannel(message.guild.id, message.channel.id);
  await message.channel.send('✅ This channel is now the counting channel. The count starts at **1**.');
}



async function handleCountingMessage(message) {
  const state = db.getCountingState(message.guild.id);
  if (!state || state.channel_id !== message.channel.id) return false;

  const num = parseInt(message.content.trim(), 10);
  const expected = state.current + 1;

  if (!Number.isFinite(num) || String(num) !== message.content.trim()) {

    return false;
  }

  if (num !== expected || message.author.id === state.last_user_id) {
    await message.react('❌').catch(() => {});
    db.setCountingChannel(message.guild.id, message.channel.id);
    await message.channel.send(
      `💥 ${message.author} broke the count at **${expected}**! Starting back over at **1**.`
    );
    return true;
  }

  db.updateCounting(message.guild.id, num, message.author.id);
  await message.react('✅').catch(() => {});
  return true;
}

module.exports = { setCountingChannel, handleCountingMessage };
