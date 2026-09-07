function parseDuration(input) {
  const match = /^(\d+)(s|m|h|d)$/i.exec(input || '');
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}





async function setReminder(message, args) {
  const ms = parseDuration(args[0]);
  const text = args.slice(1).join(' ');

  if (!ms || !text) {
    return message.reply('❌ Usage: `*remind <duration e.g. 10m/2h/1d> <what to remind you about>`');
  }

  await message.reply(`⏰ Got it — I'll remind you in ${args[0]}.`);

  setTimeout(() => {
    message.channel.send(`⏰ ${message.author}, reminder: ${text}`).catch(() => {});
  }, ms);
}

module.exports = { setReminder };
