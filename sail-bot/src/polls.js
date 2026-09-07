const { EmbedBuilder } = require('discord.js');
const { BRAND_COLOR, BRAND_NAME } = require('./config');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];


async function createPoll(message, rawContent) {
  const parts = rawContent.match(/"([^"]+)"/g);

  if (!parts || parts.length < 2) {
    return message.reply(
      '❌ Usage: `*poll "Your question" "Option 1" "Option 2" ...` (wrap each part in quotes, up to 10 options, or omit options for a simple yes/no poll).'
    );
  }

  const question = parts[0].replace(/"/g, '');
  const options = parts.slice(1).map((p) => p.replace(/"/g, ''));

  if (options.length > 10) {
    return message.reply('❌ Maximum 10 options.');
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📊 ${question}`)
    .setDescription(options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`).join('\n'))
    .setFooter({ text: `${BRAND_NAME} · Poll started by ${message.author.tag}` })
    .setTimestamp();

  const pollMsg = await message.channel.send({ embeds: [embed] });
  for (let i = 0; i < options.length; i++) {
    await pollMsg.react(NUMBER_EMOJIS[i]).catch(() => {});
  }

  await message.delete().catch(() => {});
}

// ── *yesno "Question" ────────────────────────────────────────────────
async function createYesNoPoll(message, question) {
  if (!question) return message.reply('❌ Usage: `*yesno Your question here`');

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📊 ${question}`)
    .setFooter({ text: `${BRAND_NAME} · Poll started by ${message.author.tag}` })
    .setTimestamp();

  const pollMsg = await message.channel.send({ embeds: [embed] });
  await pollMsg.react('✅').catch(() => {});
  await pollMsg.react('❌').catch(() => {});
  await message.delete().catch(() => {});
}

module.exports = { createPoll, createYesNoPoll };
