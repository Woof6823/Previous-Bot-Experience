const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { BRAND_COLOR, BRAND_NAME } = require('./config');

const GIVEAWAY_EMOJI = '🎉';

function parseDuration(input) {
  const match = /^(\d+)(s|m|h|d)$/i.exec(input || '');
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}


async function startGiveaway(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can start giveaways.');
  }

  const durationMs = parseDuration(args[0]);
  const winners = parseInt(args[1], 10);
  const prize = args.slice(2).join(' ');

  if (!durationMs || !Number.isFinite(winners) || winners < 1 || !prize) {
    return message.reply('❌ Usage: `*giveaway <duration e.g. 1h/30m/2d> <winner count> <prize>`');
  }

  const endAt = Date.now() + durationMs;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🎉 Giveaway: ${prize}`)
    .setDescription(
      `React with ${GIVEAWAY_EMOJI} to enter!\n\nWinners: **${winners}**\nEnds: <t:${Math.floor(endAt / 1000)}:R>\nHosted by: ${message.author}`
    )
    .setFooter({ text: BRAND_NAME })
    .setTimestamp(endAt);

  const giveawayMsg = await message.channel.send({ embeds: [embed] });
  await giveawayMsg.react(GIVEAWAY_EMOJI).catch(() => {});

  db.createGiveaway({
    messageId: giveawayMsg.id,
    channelId: message.channel.id,
    guildId: message.guild.id,
    prize,
    winners,
    hostId: message.author.id,
    endAt,
  });

  await message.delete().catch(() => {});

  setTimeout(() => {
    drawWinners(message.client, giveawayMsg.id).catch(console.error);
  }, durationMs);
}

async function drawWinners(client, messageId) {
  const giveaway = db.getGiveaway(messageId);
  if (!giveaway || giveaway.ended) return;

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel) return;

  const giveawayMsg = await channel.messages.fetch(messageId).catch(() => null);
  db.endGiveaway(messageId);
  if (!giveawayMsg) return;

  const reaction = giveawayMsg.reactions.cache.get(GIVEAWAY_EMOJI);
  const users = reaction ? await reaction.users.fetch() : new Map();
  const entrants = [...users.values()].filter((u) => !u.bot);

  if (entrants.length === 0) {
    await channel.send(`😔 No valid entries — the **${giveaway.prize}** giveaway had no winner.`);
    return;
  }

  const shuffled = entrants.sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, giveaway.winners);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(`Prize: **${giveaway.prize}**\nWinner(s): ${chosen.map((u) => `<@${u.id}>`).join(', ')}`)
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();

  await channel.send({ content: chosen.map((u) => `<@${u.id}>`).join(' '), embeds: [embed] });
}


async function rerollGiveaway(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can reroll giveaways.');
  }
  const messageId = args[0];
  if (!messageId) return message.reply('❌ Please provide the giveaway message ID.');

  db.raw.prepare(`UPDATE giveaways SET ended = 0 WHERE message_id = ?`).run(messageId);
  await drawWinners(message.client, messageId);
}


function resumeActiveGiveaways(client) {
  const active = db.getActiveGiveaways();
  for (const g of active) {
    const remaining = g.end_at - Date.now();
    if (remaining <= 0) {
      drawWinners(client, g.message_id).catch(console.error);
    } else {
      setTimeout(() => drawWinners(client, g.message_id).catch(console.error), remaining);
    }
  }
}

module.exports = { startGiveaway, rerollGiveaway, resumeActiveGiveaways };
