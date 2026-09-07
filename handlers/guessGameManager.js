const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const config = require("../config");
const db = require("../database");

const CLEANUP_DELAY_MS = 12 * 60 * 60 * 1000;
const REMINDER_BEFORE_MS = 15 * 1000;
const BUMP_INTERVAL_MS = 2000;
const BUMP_QUIET_PERIOD_MS = 8000;

const activeTimers = new Map();
const bumpState = new Map();

function clearGameTimers(gameId) {
  const timers = activeTimers.get(gameId);
  if (!timers) return;
  if (timers.reminder) clearTimeout(timers.reminder);
  if (timers.start) clearTimeout(timers.start);
  if (timers.cleanup) clearTimeout(timers.cleanup);
  activeTimers.delete(gameId);
}

function buildAnnounceEmbed(game) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🔢 Guess The Number — starting soon!")
    .setDescription(
      `The number will be between **${game.range_start}** and **${game.range_end}**.\n` +
        `⏰ Starts <t:${Math.floor(game.start_at / 1000)}:R> (<t:${Math.floor(game.start_at / 1000)}:F>)\n` +
        `🔒 This channel is locked until the game starts.`
    );
}

function buildStartEmbed(game) {
  return new EmbedBuilder()
    .setColor(config.successColor)
    .setTitle("🔢 GO! Guess The Number!")
    .setDescription(
      `Guess a number between **${game.range_start}** and **${game.range_end}** — just type it in this channel!\n` +
        `First correct guess wins.`
    );
}

function buildWinnerEmbed(game, winnerId) {
  return new EmbedBuilder()
    .setColor(config.successColor)
    .setTitle("🎉 We have a winner!")
    .setDescription(
      `<@${winnerId}> guessed it — the number was **${game.target_number}**!\nA ticket has been created for you.`
    );
}


async function setChannelLocked(channel, locked) {
  await channel.permissionOverwrites
    .edit(channel.guild.roles.everyone, {
      ViewChannel: true,
      SendMessages: locked ? false : true
    })
    .catch(() => {});
}

async function createGameChannel(guild) {
  const category = await guild.channels.create({
    name: "🔢 Guess The Number",
    type: ChannelType.GuildCategory,
    position: 9999
  });
  const channel = await guild.channels.create({
    name: "guess-the-number",
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ]
  });
  return { category, channel };
}

async function startGame(guild, { rangeStart, rangeEnd, startAt, reactions }) {
  const { category, channel } = await createGameChannel(guild);
  const targetNumber = rangeStart + Math.floor(Math.random() * (rangeEnd - rangeStart + 1));
  const gameId = db.createGuessGame({
    guildId: guild.id,
    channelId: channel.id,
    categoryId: category.id,
    rangeStart,
    rangeEnd,
    targetNumber,
    startAt,
    reactions
  });
  const game = db.getGuessGame(gameId);
  const sent = await channel.send({ content: "@everyone", embeds: [buildAnnounceEmbed(game)] });
  db.setGuessGamePanelMessageId(gameId, sent.id);
  for (const emoji of reactions || []) {
    await sent.react(emoji).catch(() => {});
  }
  scheduleGameTimers(guild.client, db.getGuessGame(gameId));
  return gameId;
}

function scheduleGameTimers(client, game) {
  if (game.status !== "scheduled") return;
  clearGameTimers(game.id);
  const now = Date.now();
  const msUntilStart = game.start_at - now;
  const msUntilReminder = game.start_at - REMINDER_BEFORE_MS - now;
  const timers = {};




  if (!game.reminder_sent && msUntilReminder > 0) {
    timers.reminder = setTimeout(async () => {
      try {
        const channel = await client.channels.fetch(game.channel_id).catch(() => null);
        if (!channel) return;
        await channel.send(
          `@everyone ⏰ **Starting in 15 seconds!** Number will be between **${game.range_start}** and **${game.range_end}** — get ready!`
        );
        db.setGuessGameReminderSent(game.id);
      } catch (err) {
        console.error("Guess game reminder failed:", err.message);
      }
    }, msUntilReminder);
  }

  timers.start = setTimeout(
    async () => {
      try {
        await activateGame(client, game.id);
      } catch (err) {
        console.error("Guess game activation failed:", err.message);
      }
    },
    Math.max(msUntilStart, 0)
  );

  activeTimers.set(game.id, timers);
}

async function activateGame(client, gameId) {
  const game = db.getGuessGame(gameId);
  if (!game || game.status !== "scheduled") return;
  db.setGuessGameActive(gameId);
  const channel = await client.channels.fetch(game.channel_id).catch(() => null);
  if (channel) {
    await setChannelLocked(channel, false);
    await channel.send({ embeds: [buildStartEmbed(game)] }).catch(() => {});
  }
}





async function checkGuess(message) {
  const bump = bumpState.get(message.channel.id);
  if (bump) bump.lastActivityAt = Date.now();

  if (message.author.bot) return;
  const game = db.getGuessGameByChannel(message.channel.id);
  if (!game) return;

  const guess = parseInt(message.content.trim(), 10);
  if (!Number.isInteger(guess) || String(guess) !== message.content.trim()) return;
  if (guess !== game.target_number) return;

  await declareWinner(message.client, game, message.member);
}

async function declareWinner(client, game, winnerMember) {
  const guild = winnerMember.guild;
  const wonAt = Date.now();
  const cleanupAt = wonAt + CLEANUP_DELAY_MS;
  db.setGuessGameWinner(game.id, winnerMember.id, wonAt, cleanupAt);

  const channel = await client.channels.fetch(game.channel_id).catch(() => null);
  if (channel) {
    await setChannelLocked(channel, true);
    const embed = buildWinnerEmbed(game, winnerMember.id);
    const sent = await channel.send({ embeds: [embed] }).catch(() => null);
    if (sent) startBumping(channel, game.channel_id, sent.id, embed);
  }

  const ticketCategory = await guild.channels.create({
    name: "🏆 Guess Winner",
    type: ChannelType.GuildCategory,
    position: 9999
  });
  const ticketChannel = await guild.channels.create({
    name: `guess-winner-${winnerMember.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: ticketCategory.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: winnerMember.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: config.ownerId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  db.setGuessGameTicket(game.id, ticketChannel.id, ticketCategory.id);

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🏆 You won!")
    .setDescription(
      `Congrats <@${winnerMember.id}> — you guessed **${game.target_number}** correctly!\n` +
        `<@${config.ownerId}> please wait for the owner to assist you here.`
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`guessticket_close_${ticketChannel.id}`)
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
  );
  await ticketChannel.send({
    content: `<@${config.ownerId}> <@${winnerMember.id}>`,
    embeds: [embed],
    components: [row]
  });

  scheduleCleanup(client, game.id, cleanupAt);
}




function startBumping(channel, channelKey, initialMessageId, embed) {
  const state = { messageId: initialMessageId, lastActivityAt: Date.now() };
  bumpState.set(channelKey, state);

  const interval = setInterval(async () => {
    if (Date.now() - state.lastActivityAt > BUMP_QUIET_PERIOD_MS) {
      clearInterval(interval);
      bumpState.delete(channelKey);
      return;
    }
    try {
      const old = await channel.messages.fetch(state.messageId).catch(() => null);
      if (old) await old.delete().catch(() => {});
      const resent = await channel.send({ embeds: [embed] });
      state.messageId = resent.id;
    } catch (err) {
      console.error("Winner message bump failed:", err.message);
    }
  }, BUMP_INTERVAL_MS);

  state.interval = interval;
}




function stopBumping(channelKey) {
  const state = bumpState.get(channelKey);
  if (!state) return;
  if (state.interval) clearInterval(state.interval);
  bumpState.delete(channelKey);
}

function scheduleCleanup(client, gameId, cleanupAt) {
  const timers = activeTimers.get(gameId) || {};
  const delay = Math.max(cleanupAt - Date.now(), 0);
  timers.cleanup = setTimeout(() => runCleanup(client, gameId), delay);
  activeTimers.set(gameId, timers);
}

async function runCleanup(client, gameId) {
  const game = db.getGuessGame(gameId);
  if (!game) return;




  stopBumping(game.channel_id);



  for (const channelId of [game.channel_id, game.ticket_channel_id]) {
    if (!channelId) continue;
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete().catch(() => {});
  }
  for (const categoryId of [game.category_id, game.ticket_category_id]) {
    if (!categoryId) continue;
    const cat = await client.channels.fetch(categoryId).catch(() => null);
    if (cat) await cat.delete().catch(() => {});
  }

  db.clearGuessGameCleanup(gameId);
  clearGameTimers(gameId);
}






async function closeGuessTicket(channel) {
  const game = db.getGuessGameByTicketChannel(channel.id);
  const guild = channel.guild;
  const categoryId = game?.ticket_category_id || null;

  await channel.send("🔒 Closing this ticket in 5 seconds...").catch(() => {});

  setTimeout(async () => {
    await channel.delete().catch(() => {});



    if (categoryId) {
      const cat = await guild.channels.fetch(categoryId).catch(() => null);
      if (cat) await cat.delete().catch(() => {});
    }
  }, 5000);

  if (game) {



    db.setGuessGameTicket(game.id, null, game.ticket_category_id);
  }
}



function restorePendingGames(client) {
  const games = db.getPendingGuessGames();
  for (const game of games) {
    if (game.status === "scheduled") {
      scheduleGameTimers(client, game);
    } else if (game.cleanup_at) {
      scheduleCleanup(client, game.id, game.cleanup_at);
    }
  }
  if (games.length > 0) {
    console.log(`Restored ${games.length} guess-the-number game timer(s) from database.`);
  }
}

module.exports = {
  startGame,
  checkGuess,
  closeGuessTicket,
  restorePendingGames
};
