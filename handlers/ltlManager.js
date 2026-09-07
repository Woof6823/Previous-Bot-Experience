const { EmbedBuilder } = require("discord.js");
const db = require("../database");
const config = require("../config");
const { formatHoursMinutes } = require("../utils/ltlDuration");



const openTimers = new Map();
const lockTimers = new Map();
const leaderboardIntervals = new Map();

const LEADERBOARD_REFRESH_MS = 60 * 1000;

function buildEmbed(title, description, color = config.brandColor) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function lockChannel(channel) {
  await channel.permissionOverwrites
    .edit(channel.guild.roles.everyone, { Connect: false })
    .catch((err) => console.error("Failed to lock LTL channel:", err.message));
}

async function unlockChannel(channel) {
  await channel.permissionOverwrites
    .edit(channel.guild.roles.everyone, { Connect: true })
    .catch((err) => console.error("Failed to unlock LTL channel:", err.message));
}

function buildLeaderboardDescription(eventId, headline) {
  const leaderboard = db.getLtlLeaderboard(eventId);
  if (leaderboard.length === 0) return `${headline}\n\nNobody's joined yet.`;

  const lines = leaderboard.slice(0, 20).map((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    const stillIn = p.status === "active" ? " (still in)" : "";
    return `${medal} <@${p.user_id}> — ${formatHoursMinutes(p.duration_ms)}${stillIn}`;
  });

  return `${headline}\n\n${lines.join("\n")}`;
}




async function scheduleEvent(guild, channel, announceChannel, startAt, lockAt) {
  const event = db.createLtlEvent({
    guildId: guild.id,
    channelId: channel.id,
    leaderboardChannelId: announceChannel.id,
    startAt,
    endAt: lockAt
  });

  await lockChannel(channel);

  await announceChannel
    .send({
      embeds: [
        buildEmbed(
          "🏆 Last To Leave — Scheduled",
          `${channel} opens for joining <t:${Math.floor(startAt / 1000)}:R>, and locks (no more joining) ` +
            `<t:${Math.floor(lockAt / 1000)}:R> after that. Once locked, whoever's the LAST ONE remaining ` +
            `in the channel wins — could take a few minutes, could take days.`
        )
      ]
    })
    .catch(() => {});

  scheduleOpenTimer(guild.client, event.id, startAt);
  return event;
}

function scheduleOpenTimer(client, eventId, startAt) {
  clearTimer(openTimers, eventId);
  const delay = Math.max(0, startAt - Date.now());
  openTimers.set(
    eventId,
    setTimeout(() => {
      openTimers.delete(eventId);
      openEvent(client, eventId).catch((err) =>
        console.error("LTL openEvent failed:", err.message)
      );
    }, delay)
  );
}

function scheduleLockTimer(client, eventId, lockAt) {
  clearTimer(lockTimers, eventId);
  const delay = Math.max(0, lockAt - Date.now());
  lockTimers.set(
    eventId,
    setTimeout(() => {
      lockTimers.delete(eventId);
      lockEvent(client, eventId).catch((err) =>
        console.error("LTL lockEvent failed:", err.message)
      );
    }, delay)
  );
}

function clearTimer(map, eventId) {
  const handle = map.get(eventId);
  if (handle) {
    clearTimeout(handle);
    map.delete(eventId);
  }
}

function startLeaderboardRefresh(client, eventId) {
  if (leaderboardIntervals.has(eventId)) return;
  const handle = setInterval(() => {
    refreshLeaderboardMessage(client, eventId).catch((err) =>
      console.error("LTL leaderboard refresh failed:", err.message)
    );
  }, LEADERBOARD_REFRESH_MS);
  leaderboardIntervals.set(eventId, handle);
}

function stopLeaderboardRefresh(eventId) {
  const handle = leaderboardIntervals.get(eventId);
  if (handle) {
    clearInterval(handle);
    leaderboardIntervals.delete(eventId);
  }
}

async function refreshLeaderboardMessage(client, eventId) {
  const event = db.getLtlEvent(eventId);
  if (!event || event.status !== "active") return stopLeaderboardRefresh(eventId);

  const guild = client.guilds.cache.get(event.guild_id);
  const channel =
    guild && event.leaderboard_channel_id
      ? await guild.channels.fetch(event.leaderboard_channel_id).catch(() => null)
      : null;
  if (!channel) return;

  const embed = buildEmbed(
    "🏆 Last To Leave — Live Standings",
    buildLeaderboardDescription(eventId, "Channel is locked — no more joining. Current standings:"),
    0x5865f2
  );

  if (event.leaderboard_message_id) {
    const msg = await channel.messages.fetch(event.leaderboard_message_id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) db.setLtlLeaderboardMessageId(eventId, sent.id);
}

async function openEvent(client, eventId) {
  const event = db.setLtlEventActive(eventId);
  if (!event) return;

  const guild = client.guilds.cache.get(event.guild_id);
  if (!guild) return;

  const channel = await guild.channels.fetch(event.channel_id).catch(() => null);
  const announceChannel = event.leaderboard_channel_id
    ? await guild.channels.fetch(event.leaderboard_channel_id).catch(() => null)
    : null;

  if (channel) await unlockChannel(channel);

  if (announceChannel) {
    await announceChannel
      .send({
        content: "@everyone",
        embeds: [
          buildEmbed(
            "🏆 Last To Leave — OPEN NOW",
            `${channel ? channel.toString() : "The event VC"} is now open — join now! It locks ` +
              `<t:${Math.floor(event.end_at / 1000)}:R> — after that, last one remaining in the channel wins.`,
            0x57f287
          )
        ],
        allowedMentions: { parse: ["everyone"] }
      })
      .catch(() => {});
  }

  db.setLtlPingSent(eventId, true);
  if (event.end_at) scheduleLockTimer(client, eventId, event.end_at);
}



async function lockEvent(client, eventId) {
  const event = db.getLtlEvent(eventId);
  if (!event || event.status !== "active") return;

  const guild = client.guilds.cache.get(event.guild_id);
  if (!guild) return;

  const channel = event.channel_id
    ? await guild.channels.fetch(event.channel_id).catch(() => null)
    : null;
  const announceChannel = event.leaderboard_channel_id
    ? await guild.channels.fetch(event.leaderboard_channel_id).catch(() => null)
    : null;

  if (channel) await lockChannel(channel);

  if (announceChannel) {
    await announceChannel
      .send({
        embeds: [
          buildEmbed(
            "🏆 Last To Leave — Locked",
            buildLeaderboardDescription(
              eventId,
              "The channel is now locked — nobody new can join. Last one remaining in the channel wins."
            ),
            0x5865f2
          )
        ]
      })
      .catch(() => {});
  }

  startLeaderboardRefresh(client, eventId);
}



async function endEvent(client, guildId) {
  const event = db.getActiveLtlEvent(guildId);
  if (!event) return false;

  db.endLtlEvent(event.id);
  stopLeaderboardRefresh(event.id);
  clearTimer(openTimers, event.id);
  clearTimer(lockTimers, event.id);

  const guild = client.guilds.cache.get(event.guild_id);
  if (!guild) return true;

  const channel = event.channel_id
    ? await guild.channels.fetch(event.channel_id).catch(() => null)
    : null;
  const announceChannel = event.leaderboard_channel_id
    ? await guild.channels.fetch(event.leaderboard_channel_id).catch(() => null)
    : null;

  if (channel) await lockChannel(channel);

  const leaderboard = db.getLtlLeaderboard(event.id);
  const winner = leaderboard[0] || null;
  if (winner) db.markLtlParticipantWinner(event.id, winner.user_id);

  if (announceChannel) {
    await announceChannel
      .send({
        embeds: [
          buildEmbed(
            "🏆 Last To Leave — Final Results",
            winner
              ? buildLeaderboardDescription(event.id, `🎉 <@${winner.user_id}> wins!`)
              : "The event ended with no participants.",
            winner ? 0x57f287 : 0x99aab5
          )
        ]
      })
      .catch(() => {});
  }

  return true;
}

async function cancelEvent(client, guildId) {
  const event = db.getActiveLtlEvent(guildId);
  if (!event) return false;

  db.cancelLtlEvent(event.id);
  stopLeaderboardRefresh(event.id);
  clearTimer(openTimers, event.id);
  clearTimer(lockTimers, event.id);

  const guild = client.guilds.cache.get(event.guild_id);
  const channel = guild ? await guild.channels.fetch(event.channel_id).catch(() => null) : null;
  if (channel) await lockChannel(channel);

  return true;
}





async function restorePendingEvents(client) {
  const pending = db.getPendingLtlEvents();
  if (pending.length === 0) return;

  for (const event of pending) {
    const guild = client.guilds.cache.get(event.guild_id);
    if (!guild) continue;

    if (event.status === "scheduled") {
      scheduleOpenTimer(client, event.id, event.start_at);
      continue;
    }

    if (event.status === "active") {
      const channel = await guild.channels.fetch(event.channel_id).catch(() => null);
      if (channel) {
        const inChannelIds = new Set([...channel.members.values()].map((m) => m.id));
        for (const participant of db.getActiveLtlParticipants(event.id)) {
          if (!inChannelIds.has(participant.user_id)) {
            db.markLtlParticipantLeft(event.id, participant.user_id, Date.now(), "left");
          }
        }
        for (const id of inChannelIds) {
          if (!db.getLtlParticipant(event.id, id)) {
            db.addLtlParticipant(event.id, id, Date.now(), false);
          }
        }
      }

      const stillInJoinWindow = event.end_at && Date.now() < event.end_at;
      if (stillInJoinWindow) {
        scheduleLockTimer(client, event.id, event.end_at);
      } else {



        if (channel) await lockChannel(channel);

        const eligibleRemaining = db
          .getActiveLtlParticipants(event.id)
          .filter((p) => !p.excluded_from_winner);

        if (eligibleRemaining.length <= 1) {
          await endEvent(client, event.guild_id);
        } else {
          startLeaderboardRefresh(client, event.id);
        }
      }
    }
  }
}

module.exports = {
  scheduleEvent,
  openEvent,
  lockEvent,
  endEvent,
  cancelEvent,
  restorePendingEvents
};
