const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');

function ok(message, text) {
  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setDescription(`✅ ${text}`).setFooter({ text: BRAND_NAME });
  return message.channel.send({ embeds: [embed] });
}

function requireAdmin(message) {
  if (!isAdmin(message.member)) {
    message.reply('❌ Only Administrators can use this command.');
    return false;
  }
  return true;
}


async function setModLog(message) {
  if (!requireAdmin(message)) return;
  db.setSetting(SETTINGS_KEYS.MODLOG_CHANNEL, message.channel.id);
  await ok(message, `Moderation logs will now be posted in ${message.channel}.`);
}


async function setGoodbye(message) {
  if (!requireAdmin(message)) return;
  db.setSetting(SETTINGS_KEYS.GOODBYE_CHANNEL, message.channel.id);
  await ok(message, `Goodbye messages will now be sent in ${message.channel}.`);
}


async function setSuggestions(message) {
  if (!requireAdmin(message)) return;
  db.setSetting(SETTINGS_KEYS.SUGGESTIONS_CHANNEL, message.channel.id);
  await ok(message, `Suggestions will now be posted in ${message.channel}.`);
}


async function setAutoRole(message) {
  if (!requireAdmin(message)) return;
  const role = message.mentions.roles.first();
  if (!role) return message.reply('❌ Please mention a role.');
  db.setSetting(SETTINGS_KEYS.AUTOROLE_ID, role.id);
  await ok(message, `New members will automatically receive ${role}.`);
}


async function filterWord(message, args) {
  if (!requireAdmin(message)) return;
  const [action, ...rest] = args;
  const word = rest.join(' ').trim();

  if (!['add', 'remove'].includes(action) || !word) {
    return message.reply('❌ Usage: `*filterword add <word>` or `*filterword remove <word>`');
  }

  if (action === 'add') {
    db.addFilteredWord(word);
    await ok(message, `Added \`${word}\` to the word filter.`);
  } else {
    db.removeFilteredWord(word);
    await ok(message, `Removed \`${word}\` from the word filter.`);
  }
}


async function toggleFeature(message, args) {
  if (!requireAdmin(message)) return;
  const [feature, state] = args;

  const map = {
    antispam: SETTINGS_KEYS.ANTISPAM_ENABLED,
    wordfilter: SETTINGS_KEYS.WORDFILTER_ENABLED,
    leveling: SETTINGS_KEYS.LEVELING_ENABLED,
  };

  const key = map[(feature || '').toLowerCase()];
  if (!key || !['on', 'off'].includes((state || '').toLowerCase())) {
    return message.reply('❌ Usage: `*toggle <antispam|wordfilter|leveling> <on|off>`');
  }

  db.setSetting(key, state.toLowerCase() === 'on' ? 'true' : 'false');
  await ok(message, `**${feature}** is now **${state.toLowerCase()}**.`);
}


async function setRaidThreshold(message, args) {
  if (!requireAdmin(message)) return;
  const threshold = parseInt(args[0], 10);
  const window = parseInt(args[1], 10);

  if (!Number.isFinite(threshold) || !Number.isFinite(window)) {
    return message.reply('❌ Usage: `*setraid <join count> <window seconds>` e.g. `*setraid 10 10`');
  }

  db.setSetting(SETTINGS_KEYS.RAID_JOIN_THRESHOLD, String(threshold));
  db.setSetting(SETTINGS_KEYS.RAID_WINDOW_SECONDS, String(window));
  await ok(message, `Raid alert will fire if **${threshold}** members join within **${window}s**.`);
}

module.exports = {
  setModLog,
  setGoodbye,
  setSuggestions,
  setAutoRole,
  filterWord,
  toggleFeature,
  setRaidThreshold,
};
