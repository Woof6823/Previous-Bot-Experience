const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");
const { STAFF_ROLE_ID, OWNER_ID } = require("../utils/staffAccess");

const ACTIVITY_CHANNEL_ID = "1540221054725652530";
const STAFF_STATS_CHANNEL_ID = "1492861774263877712";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;


const REMINDER_ANCHOR_UTC_MS = Date.UTC(2026, 7, 23, 2, 0, 0, 0);








async function backfillRoleGrants(guild) {
  const role = guild.roles.cache.get(STAFF_ROLE_ID);
  if (!role) return;

  await guild.members.fetch().catch(() => {});

  const now = Date.now();
  for (const member of role.members.values()) {
    if (db.getStaffRoleGrantedAt(member.id) === null) {
      db.setStaffRoleGrantedAt(member.id, now);
    }
  }
}






function recordRoleGranted(userId) {
  db.setStaffRoleGrantedAt(userId, Date.now());
}





function classify(messages, tickets) {
  if (messages < 700 || tickets < 10) {
    return { emoji: "🔴", label: "Demotion" };
  }
  if (messages > 900 || tickets > 20) {
    return { emoji: "🟢", label: "Promotion" };
  }
  return { emoji: "🟡", label: "No Role Change" };
}

async function resolveDisplayName(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) return member.displayName;
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user ? user.username : `User ${userId}`;
}





async function buildActivityCheckEmbeds(guild) {
  const role = guild.roles.cache.get(STAFF_ROLE_ID);
  if (!role) {
    return [
      new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle("📊 Weekly Activity Check")
        .setDescription(`Role ${STAFF_ROLE_ID} not found in this server.`)
    ];
  }

  await guild.members.fetch().catch(() => {});

  const now = Date.now();
  const weekAgo = now - WEEK_MS;

  const rows = [];
  for (const member of role.members.values()) {
    const grantedAt = db.getStaffRoleGrantedAt(member.id);
    const since = grantedAt && grantedAt > weekAgo ? grantedAt : weekAgo;

    const messages = db.getMessageCountForUserSince(member.id, since);
    const tickets = db.getClaimedCountForUserSince(member.id, since);
    const { emoji, label } = classify(messages, tickets);
    const displayName = await resolveDisplayName(guild, member.id);
    const partialWindow = since > weekAgo;

    rows.push({
      name: `${emoji} ${displayName}`,
      value:
        `💬 ${messages} messages • 🎫 ${tickets} tickets\n` +
        `**${label}**` +
        (partialWindow ? `\n*(since <t:${Math.floor(since / 1000)}:R> — under 7 days on the role)*` : "")
    });
  }

  if (rows.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle("📊 Weekly Activity Check")
        .setDescription("No one currently holds the staff role.")
    ];
  }

  const description =
    `Activity over the last **7 days** for everyone with <@&${STAFF_ROLE_ID}>.\n\n` +
    `🔴 **Demotion** — under 700 messages or under 10 tickets\n` +
    `🟡 **No Role Change** — 800–899 messages or over 13 tickets\n` +
    `🟢 **Promotion** — over 900 messages or over 20 tickets\n\n` +
    `Promotions and demotions are done weekly — check your stats with \`*staffstats\` in <#${STAFF_STATS_CHANNEL_ID}>.`;



  const CHUNK_SIZE = 25;
  const embeds = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(i === 0 ? "📊 Weekly Activity Check" : "📊 Weekly Activity Check (cont.)")
      .addFields(chunk)
      .setTimestamp();
    if (i === 0) embed.setDescription(description);
    embeds.push(embed);
  }

  return embeds.slice(0, 10);
}





function msUntilNextReminder() {
  const now = Date.now();
  if (REMINDER_ANCHOR_UTC_MS >= now) return REMINDER_ANCHOR_UTC_MS - now;
  const elapsed = now - REMINDER_ANCHOR_UTC_MS;
  const cyclesPassed = Math.ceil(elapsed / WEEK_MS);
  const next = REMINDER_ANCHOR_UTC_MS + cyclesPassed * WEEK_MS;
  return next - now;
}

async function sendReminder(client) {
  const channel = await client.channels.fetch(ACTIVITY_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error(`Activity check reminder: channel ${ACTIVITY_CHANNEL_ID} not found.`);
    return;
  }

  await channel
    .send({
      content: `<@${OWNER_ID}> ⏰ It's time for the weekly activity check! Run \`*activitycheck\` to review this week's stats.`,
      allowedMentions: { parse: ["users"] }
    })
    .catch((err) => console.error("Failed to send activity check reminder:", err.message));
}

function startWeeklyReminder(client) {
  setTimeout(function run() {
    sendReminder(client).finally(() => {
      setInterval(() => sendReminder(client), WEEK_MS);
    });
  }, msUntilNextReminder());
}

module.exports = {
  backfillRoleGrants,
  recordRoleGranted,
  buildActivityCheckEmbeds,
  startWeeklyReminder,
  STAFF_ROLE_ID,
  ACTIVITY_CHANNEL_ID
};
