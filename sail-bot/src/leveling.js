const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const {
  SETTINGS_KEYS,
  BRAND_COLOR,
  BRAND_NAME,
  XP_PER_MESSAGE_MIN,
  XP_PER_MESSAGE_MAX,
  XP_COOLDOWN_MS,
  xpForLevel,
} = require('./config');

function randomXp() {
  return Math.floor(Math.random() * (XP_PER_MESSAGE_MAX - XP_PER_MESSAGE_MIN + 1)) + XP_PER_MESSAGE_MIN;
}

async function handleXpGain(message) {
  if (db.getSetting(SETTINGS_KEYS.LEVELING_ENABLED) !== 'true') return;

  const existing = db.getLevel(message.guild.id, message.author.id);
  const now = Date.now();
  if (now - existing.last_xp_at < XP_COOLDOWN_MS) return;

  const updated = db.addXp(message.guild.id, message.author.id, randomXp());
  const requiredXp = xpForLevel(updated.level);

  if (updated.xp >= requiredXp) {
    const newLevel = updated.level + 1;
    db.setLevel(message.guild.id, message.author.id, newLevel);

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setDescription(`🎉 ${message.author} just reached **Level ${newLevel}**!`)
      .setFooter({ text: BRAND_NAME });

    await message.channel.send({ embeds: [embed] }).catch(() => {});
  }
}

async function showRank(message) {
  const target = message.mentions.members.first() || message.member;
  const row = db.getLevel(message.guild.id, target.id);
  const required = xpForLevel(row.level);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
    .setTitle('📊 Rank')
    .addFields(
      { name: 'Level', value: `${row.level}`, inline: true },
      { name: 'XP', value: `${row.xp} / ${required}`, inline: true }
    )
    .setFooter({ text: BRAND_NAME });

  await message.channel.send({ embeds: [embed] });
}

async function showLeaderboard(message) {
  const rows = db.getLeaderboard(message.guild.id, 10);
  if (rows.length === 0) {
    return message.channel.send('No one has earned XP yet.');
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🏆 ${message.guild.name} Leaderboard`)
    .setDescription(
      rows
        .map((r, i) => `**#${i + 1}** <@${r.user_id}> — Level ${r.level} (${r.xp} XP)`)
        .join('\n')
    )
    .setFooter({ text: BRAND_NAME });

  await message.channel.send({ embeds: [embed] });
}

module.exports = { handleXpGain, showRank, showLeaderboard };
