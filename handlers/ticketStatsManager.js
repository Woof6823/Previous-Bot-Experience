const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");
const { resolveDisplayName } = require("./staffStatsManager");

const WINDOW_MS = 24 * 60 * 60 * 1000;




function get24hStats() {
  const since = Date.now() - WINDOW_MS;
  const claims = db.getTicketClaimsSince(since);

  const countsByUser = new Map();
  let totalClaimWaitMs = 0;
  let claimWaitSamples = 0;

  for (const row of claims) {
    countsByUser.set(row.claimed_by, (countsByUser.get(row.claimed_by) || 0) + 1);
    if (row.created_at) {
      totalClaimWaitMs += row.claimed_at - row.created_at;
      claimWaitSamples++;
    }
  }

  let topUserId = null;
  let topCount = 0;
  for (const [userId, count] of countsByUser.entries()) {
    if (count > topCount) {
      topCount = count;
      topUserId = userId;
    }
  }

  const avgClaimMs = claimWaitSamples > 0 ? Math.round(totalClaimWaitMs / claimWaitSamples) : null;

  return {
    totalTickets: claims.length,
    topUserId,
    topCount,
    avgClaimMs
  };
}

function formatDuration(ms) {
  if (ms === null) return "N/A";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

async function buildStatsEmbed(guild) {
  const stats = get24hStats();
  const topName = stats.topUserId
    ? await resolveDisplayName(guild, stats.topUserId)
    : "No claims yet";

  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🎫 Ticket Stats — Last 24 Hours")
    .addFields(
      {
        name: "🏆 Top Claimer",
        value: stats.topUserId
          ? `${topName} (${stats.topCount} claim${stats.topCount === 1 ? "" : "s"})`
          : topName
      },
      { name: "📊 Tickets Claimed (24h)", value: `${stats.totalTickets}`, inline: true },
      { name: "⏱️ Avg. Claim Time", value: formatDuration(stats.avgClaimMs), inline: true }
    )
    .setFooter({
      text: "Resets automatically every 24 hours - updates live as tickets are claimed."
    })
    .setTimestamp();
}


async function refreshPanel(channel) {
  const oldId = db.getSetting("ticket_stats_message_id");
  if (oldId) {
    const old = await channel.messages.fetch(oldId).catch(() => null);
    if (old) {
      await old.edit({ embeds: [await buildStatsEmbed(channel.guild)] }).catch(() => {});
      return;
    }
  }
  const sent = await channel.send({ embeds: [await buildStatsEmbed(channel.guild)] });
  db.setSetting("ticket_stats_channel_id", channel.id);
  db.setSetting("ticket_stats_message_id", sent.id);
}

async function refreshIfConfigured(client) {
  const channelId = db.getSetting("ticket_stats_channel_id");
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await refreshPanel(channel);
}





async function onTicketClaimed(client, guild) {
  await refreshIfConfigured(client);
  await reassignTopTicketRole(guild);
}

async function periodicRefresh(client, guild) {
  await refreshIfConfigured(client);
  await reassignTopTicketRole(guild);
}





async function repositionAboveMember(role, member) {
  const otherRoles = member.roles.cache.filter((r) => r.id !== role.id && r.id !== member.guild.id);
  if (otherRoles.size === 0) return;

  const highest = otherRoles.reduce((a, b) => (a.position > b.position ? a : b));
  const targetPosition = highest.position + 1;
  if (role.position === targetPosition) return;

  await role.setPosition(targetPosition).catch((err) => {
    console.error("Failed to reposition top-ticket role:", err.message);
  });
}

async function reassignTopTicketRole(guild) {
  const roleId = db.getSetting("top_ticket_role_id");
  if (!roleId) return;

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return;

  const stats = get24hStats();




  if (!stats.topUserId) {
    for (const member of role.members.values()) {
      await member.roles.remove(role).catch(() => {});
    }
    return;
  }

  for (const member of role.members.values()) {
    if (member.id !== stats.topUserId) {
      await member.roles.remove(role).catch(() => {});
    }
  }

  const newLeader = await guild.members.fetch(stats.topUserId).catch(() => null);
  if (!newLeader) return;

  if (!newLeader.roles.cache.has(roleId)) {
    await newLeader.roles.add(role).catch(() => {});
  }


  const refreshedLeader = await guild.members.fetch(stats.topUserId).catch(() => newLeader);
  await repositionAboveMember(role, refreshedLeader);
}

module.exports = {
  get24hStats,
  buildStatsEmbed,
  refreshPanel,
  refreshIfConfigured,
  onTicketClaimed,
  periodicRefresh
};
