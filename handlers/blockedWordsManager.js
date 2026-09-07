const db = require("../database");

function containsBlockedWord(content) {
  const words = db.getBlockedWords();
  if (words.length === 0) return null;

  const lower = content.toLowerCase();



  const whitelist = db.getWhitelistedWords();

  for (const phrase of whitelist) {
    if (lower.includes(phrase.toLowerCase())) {
      return null;
    }
  }

  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");

    if (pattern.test(lower)) {
      return word;
    }
  }

  return null;
}

async function handleBlockedMessage(message) {
  await message.delete().catch(() => {});

  const warning = await message.channel
    .send(`⚠️ <@${message.author.id}> please don't use any of our blocked words.`)
    .catch(() => null);

  if (!warning) return;

  setTimeout(() => {
    warning.delete().catch(() => {});
  }, 10000);
}

async function handleBlockedLink(message) {
  await message.delete().catch(() => {});

  const warning = await message.channel
    .send(`🔗 <@${message.author.id}> links from that platform aren't allowed in this channel.`)
    .catch(() => null);

  if (warning) {
    setTimeout(() => {
      warning.delete().catch(() => {});
    }, 10000);
  }
}

module.exports = {
  containsBlockedWord,
  handleBlockedMessage,
  handleBlockedLink
};
