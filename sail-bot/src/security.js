const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { SETTINGS_KEYS, BRAND_COLOR, BRAND_NAME, ANTISPAM_MESSAGE_LIMIT, ANTISPAM_WINDOW_MS, ANTISPAM_MUTE_MINUTES } = require('./config');


const messageLog = new Map();


const joinLog = new Map();

async function logSecurityAction(guild, embed) {
  const channelId = db.getSetting(SETTINGS_KEYS.MODLOG_CHANNEL);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}


async function checkWordFilter(message) {
  if (db.getSetting(SETTINGS_KEYS.WORDFILTER_ENABLED) !== 'true') return false;
  if (isAdmin(message.member)) return false;

  const words = db.getFilteredWords();
  if (words.length === 0) return false;

  const content = message.content.toLowerCase();
  const hit = words.find((w) => content.includes(w));
  if (!hit) return false;

  await message.delete().catch(() => {});
  const warned = await message.channel
    .send(`🚫 ${message.author}, that message was removed for containing a filtered word.`)
    .catch(() => null);
  if (warned) setTimeout(() => warned.delete().catch(() => {}), 5000);

  db.addWarning(message.guild.id, message.author.id, message.client.user.id, `Used a filtered word ("${hit}")`);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚫 Word Filter Triggered')
    .addFields(
      { name: 'User', value: `${message.author}`, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true }
    )
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();
  await logSecurityAction(message.guild, embed);

  return true;
}


async function checkAntiSpam(message) {
  if (db.getSetting(SETTINGS_KEYS.ANTISPAM_ENABLED) !== 'true') return false;
  if (isAdmin(message.member)) return false;

  const now = Date.now();
  const timestamps = (messageLog.get(message.author.id) || []).filter(
    (t) => now - t < ANTISPAM_WINDOW_MS
  );
  timestamps.push(now);
  messageLog.set(message.author.id, timestamps);

  if (timestamps.length < ANTISPAM_MESSAGE_LIMIT) return false;

  messageLog.set(message.author.id, []);

  if (message.member?.moderatable) {
    await message.member.timeout(ANTISPAM_MUTE_MINUTES * 60 * 1000, 'Anti-spam auto-mute').catch(() => {});
  }

  const notice = await message.channel
    .send(`🚫 ${message.author} was muted for ${ANTISPAM_MUTE_MINUTES} minutes for spamming.`)
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), 6000);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚫 Anti-Spam Triggered')
    .addFields(
      { name: 'User', value: `${message.author}`, inline: true },
      { name: 'Action', value: `Muted ${ANTISPAM_MUTE_MINUTES}m`, inline: true }
    )
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();
  await logSecurityAction(message.guild, embed);

  return true;
}


async function checkRaidProtection(member) {
  const threshold = parseInt(db.getSetting(SETTINGS_KEYS.RAID_JOIN_THRESHOLD) || '10', 10);
  const windowSec = parseInt(db.getSetting(SETTINGS_KEYS.RAID_WINDOW_SECONDS) || '10', 10);

  const now = Date.now();
  const guildId = member.guild.id;
  const timestamps = (joinLog.get(guildId) || []).filter((t) => now - t < windowSec * 1000);
  timestamps.push(now);
  joinLog.set(guildId, timestamps);

  if (timestamps.length < threshold) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚨 Possible Raid Detected')
    .setDescription(
      `${timestamps.length} members joined within the last ${windowSec} seconds. Consider enabling verification or slowmode.`
    )
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();

  await logSecurityAction(member.guild, embed);
}

module.exports = { checkWordFilter, checkAntiSpam, checkRaidProtection };
