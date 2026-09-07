const {
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
StringSelectMenuBuilder,
StringSelectMenuOptionBuilder,
ChannelType,
PermissionsBitField
} = require("discord.js");
const config = require("../config");
const db = require("../database");
const transcriptManager = require("./transcriptManager");
const farmingDetector = require("./farmingDetector");
const ticketStatsManager = require("./ticketStatsManager");
const { STAFF_ROLE_ID } = require("../utils/staffAccess");
const settings = require("../settings");
const logManager = require("./logManager");
const activeTimers = new Map();

async function ensureCategories(guild) {
const categoryIds = {};
for (const [type, def] of Object.entries(config.ticketTypes)) {
const storedId = db.getSetting(`category_${type}`);
let category = storedId ? guild.channels.cache.get(storedId) : null;
if (!category) {
throw new Error(`The ${def.label} ticket category is not configured. Run *setup and select an existing category.`);
}
categoryIds[type] = category.id;
}
return categoryIds;
}

function buildTicketPanelEmbed(client) {
const embed = new EmbedBuilder()
.setColor(config.brandColor)
.setTitle(config.ticketEmbed.title)
.setDescription(config.ticketEmbed.description)
.setFooter({ text: config.ticketEmbed.footer });
const icon = client.user?.displayAvatarURL();
if (icon) embed.setThumbnail(icon);
const menu = new StringSelectMenuBuilder()
.setCustomId("ticket_select")
.setPlaceholder("Select a ticket type...")
.addOptions(
Object.entries(config.ticketTypes).map(([type, def]) =>
new StringSelectMenuOptionBuilder()
.setLabel(def.label)
.setValue(type)
.setEmoji(def.emoji)
.setDescription((def.description || "").slice(0, 100))
)
);
const row = new ActionRowBuilder().addComponents(menu);
return { embeds: [embed], components: [row] };
}

const STATUS_EMOJI_PREFIX = /^[🔴🟢🟡🟣⏳⚪⭐⏸️]/;

function statusEmojiFor(ticket) {
if (ticket.is_pro_waiting) return "⭐";
if (ticket.is_delayed) return "⏸️";
if (ticket.timer_end) return "⏳";
if (ticket.claimed_by) return "🟢";
return "⚪";
}

function statusLabelFor(ticket) {
if (ticket.is_pro_waiting) return "Pro Waiting";
if (ticket.is_delayed) return "Delayed";
if (ticket.timer_end) return "Timer";
if (ticket.claimed_by) return "Claimed";
return "Unclaimed";
}

function statusColorFor(ticket) {
if (ticket.is_pro_waiting) return 0x9b59b6;
if (ticket.is_delayed) return 0xf1c40f;
if (ticket.timer_end) return 0xe67e22;
if (ticket.claimed_by) return 0x2ecc71;
return 0xe74c3c;
}

function computeChannelName(ticket) {
const emoji = statusEmojiFor(ticket);
return `${emoji}${ticket.type}-ticket-${ticket.number}`;
}

async function buildTicketChannelEmbed(guild, ticket) {
const def = config.ticketTypes[ticket.type] || {
label: ticket.type,
emoji: "🎫",
welcomeNote: "Support will be with you shortly."
};
const user = await guild.client.users.fetch(ticket.user_id).catch(() => null);
const tag = user ? user.tag : `User ${ticket.user_id}`;
const avatar = user ? user.displayAvatarURL({ size: 256 }) : null;
const openedSec = Math.floor(ticket.created_at / 1000);
const embed = new EmbedBuilder()
.setColor(statusColorFor(ticket))
.setAuthor({ name: "Surge Esports • Ticket System" })
.setTitle(`${def.emoji} ${def.label} Ticket — #${ticket.number}`)
.setDescription(`Welcome <@${ticket.user_id}>! ${def.welcomeNote}`)
.addFields(
{ name: "👤 Opened By", value: `<@${ticket.user_id}>\n\`${tag}\``, inline: true },
{ name: "📌 Status", value: `${statusEmojiFor(ticket)} **${statusLabelFor(ticket)}**`, inline: true },
{ name: "🕒 Opened", value: `<t:${openedSec}:R>\n<t:${openedSec}:F>`, inline: true }
);
if (avatar) embed.setThumbnail(avatar);
embed.addFields(
{
name: "🙋 Claimed By",
value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : "*Nobody yet — claim it below!*",
inline: true
},
{
name: "⏳ Auto-Close Timer",
value: ticket.timer_end
? `Closes <t:${Math.floor(ticket.timer_end / 1000)}:R> unless <@${ticket.user_id}> replies.`
: "*Not running.*",
inline: true
}
);
if (ticket.is_delayed) {
embed.addFields({
name: "⏸️ Delayed",
value: ticket.delay_reason || "No reason given.",
inline: true
});
}
if (ticket.is_pro_waiting) {
embed.addFields({
name: "⭐ Pro Waiting",
value: "Waiting on a Pro/authority decision.",
inline: true
});
}
const answerEntries = Object.entries(ticket.answers || {});
if (answerEntries.length > 0) {
embed.addFields({ name: "\u200b", value: "📋 **───── Pre-Ticket Answers ─────**" });
for (const [key, value] of answerEntries) {
const questionDef = (def.questions || []).find((q) => q.id === key) || (def.fallbackQuestions || []).find((q) => q.id === key);
const label = questionDef ? questionDef.label : key;
const safe = String(value || "").replace(/`/g, "'").slice(0, 1000);
embed.addFields({ name: `📩 ${label}`, value: safe ? `\`\`\`${safe}\`\`\`` : "*—*" });
}
}
embed.setFooter({ text: `Ticket #${ticket.number} • ${def.label} • Surge Esports` });
embed.setTimestamp();
return embed;
}

function buildTicketOpenedDmEmbed(guild, member, def, channel, ticket) {
return new EmbedBuilder()
.setColor(config.brandColor)
.setAuthor({ name: guild.name, iconURL: guild.iconURL() || null })
.setTitle(`${def.emoji} ${def.label} Ticket — Opened`)
.setDescription(
`Hey <@${member.id}>, your **${def.label}** ticket is now open!\n` +
`📬 **Channel:** ${channel.toString()}\n` +
`🎫 **Ticket:** #${ticket.number}\n` +
`${def.welcomeNote}`
)
.addFields({
name: "💡 Tip",
value: "Have any relevant details ready (usernames, screenshots, links) — the more info you give up front, the faster we can help."
})
.setFooter({ text: "Surge Esports • Ticket System" })
.setTimestamp();
}

function buildTicketClosedDmEmbed(guild, ticket, def, reason, closerId) {
return new EmbedBuilder()
.setColor(0x99aab5)
.setAuthor({ name: guild.name, iconURL: guild.iconURL() || null })
.setTitle(`🔒 ${def.emoji} ${def.label} Ticket — Closed`)
.setDescription(
`Your **${def.label}** ticket (**#${ticket.number}**) has been closed.` +
(reason ? `\n📋 **Reason:** ${reason}` : "") +
`\nIf you still need help, you're welcome to open a new ticket any time.`
)
.addFields(
{ name: "🕒 Closed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
)
.setFooter({ text: "Surge Esports • Ticket System" })
.setTimestamp();
}

function buildTicketActionRow(ticket) {
const row = new ActionRowBuilder();
if (!ticket.claimed_by) {
row.addComponents(
new ButtonBuilder()
.setCustomId(`ticket_claim_${ticket.channel_id}`)
.setLabel("Claim Ticket")
.setEmoji("🙋")
.setStyle(ButtonStyle.Primary)
);
}
row.addComponents(
new ButtonBuilder()
.setCustomId(`ticket_close_${ticket.channel_id}`)
.setLabel("Close Ticket")
.setEmoji("🔒")
.setStyle(ButtonStyle.Danger)
);
if (!ticket.timer_end && !ticket.is_delayed && !ticket.is_pro_waiting) {
row.addComponents(
new ButtonBuilder()
.setCustomId(`ticket_timer_${ticket.channel_id}`)
.setLabel(`Start ${config.timerHours}h Timer`)
.setEmoji("⏳")
.setStyle(ButtonStyle.Secondary)
);
}
return row;
}

async function refreshTicketMessage(guild, ticket) {
if (!ticket.embed_message_id) {
console.error(
`[TICKET] Can't refresh ticket message for ${ticket.channel_id} — no embed_message_id stored.`
);
return;
}
const channel =
guild.channels.cache.get(ticket.channel_id) ||
(await guild.channels.fetch(ticket.channel_id).catch(() => null));
if (!channel) {
console.error(`[TICKET] Can't refresh ticket message — channel ${ticket.channel_id} not found.`);
return;
}
try {
const message = await channel.messages.fetch({ message: ticket.embed_message_id, force: true });
await message.edit({
embeds: [await buildTicketChannelEmbed(guild, ticket)],
components: [buildTicketActionRow(ticket)]
});
} catch (err) {
console.error(
`[TICKET] Failed to refresh ticket message in ${channel.name} (channel ${ticket.channel_id}, message ${ticket.embed_message_id}):`,
err.message
);
}
}

const creatingTickets = new Set();

async function changeTicketType(guild, channelId, newType) {
const ticket = db.getTicketByChannel(channelId);
if (!ticket) throw new Error("Ticket not found.");
const def = config.ticketTypes[newType];
if (!def) throw new Error(`Unknown ticket type "${newType}".`);
const member = await guild.members.fetch(ticket.user_id).catch(() => null);
if (!member) throw new Error("Couldn't find the ticket opener in this server.");
const channel = guild.channels.cache.get(channelId);
if (!channel) throw new Error("Ticket channel not found.");
const newNumber = db.nextTicketNumber(newType);
const newCategoryId = db.getSetting(`category_${newType}`);
const { permissionOverwrites } = await buildOverwritesForType(guild, member, newType);
await channel.setParent(newCategoryId || null, { lockPermissions: false }).catch(() => {});
await channel.permissionOverwrites.set(permissionOverwrites).catch((err) => {
console.error("Failed to reset permissions on ticket type change:", err.message);
});
db.changeTicketType(channelId, newType, newNumber);
const updated = db.getTicketByChannel(channelId);
queueChannelRename(channel, channelId);
await refreshTicketMessage(guild, updated);
await channel.send(`🔄 <@${ticket.user_id}> this ticket has been changed to a **${def.label}** ticket. Support will be with you shortly.`).catch(() => {});
return updated;
}

async function createTicketChannel(guild, member, type, answers) {
const def = config.ticketTypes[type];
if (def && def.closed) {
throw new Error(`${def.label} applications are currently closed.`);
}
if (creatingTickets.has(member.id)) {
throw new Error("Your ticket is already being created — please wait a moment.");
}
creatingTickets.add(member.id);
try {
const existing = db.getOpenTicketByUser(member.id);
if (existing) {
throw new Error(`You already have an open ticket: <#${existing.channel_id}>. Please close it before opening another.`);
}
return await createTicketChannelInner(guild, member, type, answers);
} finally {
creatingTickets.delete(member.id);
}
}

async function buildOverwritesForType(guild, member, type) {
const def = config.ticketTypes[type];
const botMember = guild.members.me || (await guild.members.fetchMe());
const permissionOverwrites = [
{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
{
id: botMember,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ManageChannels,
PermissionsBitField.Flags.ReadMessageHistory
]
}
];
permissionOverwrites.push({
id: member,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ReadMessageHistory
]
});
if (def.adminOnly) {

} else {
if (settings.get("staffRoleId")) {
const staffRole = await guild.roles.fetch(settings.get("staffRoleId")).catch(() => null);
if (staffRole) {
permissionOverwrites.push({
id: staffRole,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ReadMessageHistory
]
});
}
}
}
const resolvedPingRoles = [];
let pingRoleIds = def.pingRoleIds || [];
if (type === "roster") {
const storedPingRoleIds = db.getSetting("roster_ping_role_ids");
if (storedPingRoleIds) pingRoleIds = JSON.parse(storedPingRoleIds);
}
for (const roleId of pingRoleIds) {
const role = await guild.roles.fetch(roleId).catch(() => null);
if (role) {
resolvedPingRoles.push(role);
permissionOverwrites.push({
id: role,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ReadMessageHistory
]
});
} else {
console.warn(`⚠️ Could not find role ${roleId} (configured in pingRoleIds for "${type}") in the server — it won't be pinged or given access.`);
}
}
return { permissionOverwrites, resolvedPingRoles };
}

async function createTicketChannelInner(guild, member, type, answers) {
const categoryId = db.getSetting(`category_${type}`);
const number = db.nextTicketNumber(type);
const def = config.ticketTypes[type];
const { permissionOverwrites, resolvedPingRoles } = await buildOverwritesForType(guild, member, type);
const channel = await guild.channels.create({
name: `⚪${type}-ticket-${number}`,
type: ChannelType.GuildText,
parent: categoryId || undefined,
topic: `${def.label} ticket for ${member.user.tag} (${member.id})`,
permissionOverwrites
});
const ticket = db.createTicket({
channelId: channel.id,
type,
number,
userId: member.id,
answers
});
const embed = await buildTicketChannelEmbed(guild, ticket);
const row = buildTicketActionRow(ticket);
let pingContent = "";
if (!def.adminOnly) {
pingContent = `<@${member.id}>`;
}
for (const role of resolvedPingRoles) {
pingContent += `${pingContent ? " " : ""}<@&${role.id}>`;
}
if (!def.adminOnly) {
const ticketPingRoleId = settings.get("ticketPingRoleId");
if (ticketPingRoleId && !resolvedPingRoles.some((r) => r.id === ticketPingRoleId)) {
pingContent += ` <@&${ticketPingRoleId}>`;
}
}
if (def.pingOwner) {
pingContent = `<@${config.ownerId}>${pingContent ? " " + pingContent : ""}`;
}
const message = await channel.send({
content: pingContent || undefined,
embeds: [embed],
components: [row]
});
db.setEmbedMessageId(channel.id, message.id);
member.user.send({ embeds: [buildTicketOpenedDmEmbed(guild, member, def, channel, ticket)] }).catch(() => {});
return channel;
}

async function claimTicket(guild, channelId, staffId) {
const ticket = db.getTicketByChannel(channelId);
if (ticket && ticket.user_id === staffId) {
throw new Error("You cannot claim your own ticket.");
}
const claimed = db.claimTicket(channelId, staffId);
if (!claimed) {
const existing = db.getTicketByChannel(channelId);
throw new Error(`Already claimed by <@${existing?.claimed_by}>.`);
}
db.setTicketClaimedAt(channelId, Date.now());
const updatedTicket = db.getTicketByChannel(channelId);
await refreshTicketMessage(guild, updatedTicket);
const channel = guild.channels.cache.get(channelId);
if (channel) queueChannelRename(channel, channelId);
farmingDetector.recordClaim(guild, staffId, updatedTicket).catch(() => {});
ticketStatsManager.onTicketClaimed(guild.client, guild).catch((err) => {
console.error("Ticket stats refresh failed:", err.message);
});
return updatedTicket;
}

async function unclaimTicket(guild, channelId) {
const wasClaimed = db.unclaimTicket(channelId);
if (!wasClaimed) return false;
const ticket = db.getTicketByChannel(channelId);
await refreshTicketMessage(guild, ticket);
const channel = guild.channels.cache.get(channelId);
if (channel) queueChannelRename(channel, channelId);
if (logManager) {
logManager.log(guild, {
type: "ticket",
title: "↩️ Ticket Unclaimed",
description: `Ticket: ${channel || channelId}`
}).catch(() => {});
}
return true;
}

async function closeTicket(guild, channelId, reason, closerId) {
clearTimerFor(channelId);
const ticket = db.getTicketByChannel(channelId);
db.closeTicket(channelId);
const channel = guild.channels.cache.get(channelId);
if (channel && ticket) {
await transcriptManager.sendTranscript(guild, channel, ticket, closerId || ticket.user_id, reason).catch((err) => {
console.error("Failed to send ticket transcript:", err.message);
});
const def = config.ticketTypes[ticket.type] || { label: ticket.type, emoji: "🎫" };
guild.members.fetch(ticket.user_id).then((member) =>
member.user.send({
embeds: [buildTicketClosedDmEmbed(guild, ticket, def, reason, closerId || ticket.user_id)]
})
).catch(() => {});
const reasonLine = reason ? `\n**Reason:** ${reason}` : "";
await channel.send(`🔒 This ticket will be deleted in 5 seconds...${reasonLine}`);
setTimeout(() => {
channel.delete().catch(() => {});
}, 5000);
}
}

function clearTimerFor(channelId) {
const timeout = activeTimers.get(channelId);
if (timeout) {
clearTimeout(timeout);
activeTimers.delete(channelId);
}
}

async function startTicketTimer(client, guild, channelId, startedById = null) {
const ticket = db.getTicketByChannel(channelId);
if (!ticket || ticket.status !== "open") return false;
if (ticket.timer_end) return false;
if (ticket.is_delayed) return false;
if (ticket.is_pro_waiting) return false;
if (startedById && ticket.user_id === startedById) {
return false;
}
const runCount = db.incrementTimerRunCount(channelId);
if (runCount >= 3) {
await closeTicket(guild, channelId, "Inactive and late responses", ticket.user_id);
return true;
}
const timerEnd = Date.now() + config.timerHours * 60 * 60 * 1000;
db.setTimer(channelId, timerEnd);
scheduleTimer(client, guild.id, channelId, timerEnd);
const refreshed = db.getTicketByChannel(channelId);
await refreshTicketMessage(guild, refreshed);
const channel = guild.channels.cache.get(channelId);
if (channel) {
queueChannelRename(channel, channelId);
if (ticket.timer_message_id) {
const stale = await channel.messages.fetch(ticket.timer_message_id).catch(() => null);
if (stale) await stale.delete().catch(() => {});
}
const startedByLine = startedById
? `\n**Started by:** <@${startedById}>`
: `\n**Started by:** Automatically (no reply for over ${config.timerAutoStartAfterStaffReplyMinutes} minutes since staff last spoke)`;
const sent = await channel.send(
`⏳ <@${ticket.user_id}> a ${config.timerHours} hour closure timer has started. This ticket will automatically close <t:${Math.floor(timerEnd / 1000)}:R> unless you reply.${startedByLine}`
).catch(() => null);
if (sent) db.setTicketTimerMessageId(channelId, sent.id);
if (logManager) {
logManager.log(guild, {
type: "ticket",
title: `⏳ ${config.timerHours}h Timer Started`,
description: `Ticket: ${channel}\nStarted by: ${startedById ? `<@${startedById}>` : `Automatic (${config.timerInactivityMinutes}m+ inactivity)`}`
}).catch(() => {});
}
}
return true;
}

function scheduleTimer(client, guildId, channelId, timerEnd) {
clearTimerFor(channelId);
const delay = Math.max(timerEnd - Date.now(), 0);
const timeout = setTimeout(async () => {
try {
const guild = await client.guilds.fetch(guildId);
const ticket = db.getTicketByChannel(channelId);
if (!ticket || ticket.status !== "open" || !ticket.timer_end) return;
await closeTicket(guild, channelId, `No response within ${config.timerHours} hours (auto-close)`, ticket.user_id);
} catch (err) {
console.error("Failed to auto-close ticket:", err.message);
}
}, delay);
activeTimers.set(channelId, timeout);
}

async function renameAllOpenTicketChannels(client) {
const tickets = db.getAllOpenTickets();
for (const ticket of tickets) {
try {
const guild = await client.guilds.fetch(config.guildId);
const channel = guild.channels.cache.get(ticket.channel_id);
if (!channel) continue;
const desired = computeChannelName(ticket);
if (channel.name === desired) continue;
await channel.setName(desired).catch((err) => {
console.error(`Failed to rename ticket channel ${ticket.channel_id}:`, err.message);
});
} catch (err) {
console.error(`Renaming ticket channel ${ticket.channel_id} failed:`, err.message);
}
}
}

const pendingRenames = new Map();

function queueChannelRename(channel, channelId) {
const existing = pendingRenames.get(channelId);
if (existing) clearTimeout(existing);
const timeout = setTimeout(async () => {
pendingRenames.delete(channelId);
const latest = db.getTicketByChannel(channelId);
if (!latest) return;
const desired = computeChannelName(latest);
if (channel.name === desired) return;
await channel.setName(desired).catch((err) => {
console.error(`Failed to rename ticket channel ${channelId}:`, err.message);
});
}, 2000);
pendingRenames.set(channelId, timeout);
}

async function handlePossibleUserReply(guild, message) {
const ticket = db.getTicketByChannel(message.channel.id);
if (!ticket || ticket.status !== "open") return;
if (message.author.id !== ticket.user_id) {
db.clearAwaitingStaffState(message.channel.id);
db.setStaffReplied(message.channel.id, message.createdTimestamp);
return;
}
db.setLastOpenerMessageAt(message.channel.id, message.createdTimestamp);
db.setAwaitingStaffSince(message.channel.id, message.createdTimestamp);
if (!ticket.timer_end) return;
clearTimerFor(message.channel.id);
db.clearTimer(message.channel.id);
if (ticket.timer_message_id) {
const notice = await message.channel.messages.fetch(ticket.timer_message_id).catch(() => null);
if (notice) await notice.delete().catch(() => {});
db.setTicketTimerMessageId(message.channel.id, null);
}
const refreshed = db.getTicketByChannel(message.channel.id);
await refreshTicketMessage(guild, refreshed);
queueChannelRename(message.channel, message.channel.id);
const cancelNotice = await message.channel.send(`✅ Timer cancelled — thanks for replying, <@${ticket.user_id}>.`).catch(() => null);
if (cancelNotice) setTimeout(() => cancelNotice.delete().catch(() => {}), 15000);
}

async function checkGhostPings(client) {
const cutoff = Date.now() - 10 * 60 * 1000;
const candidates = db.getTicketsNeedingGhostPing(cutoff);
for (const ticket of candidates) {
try {
const guild = await client.guilds.fetch(config.guildId);
const channel = guild.channels.cache.get(ticket.channel_id);
if (!channel) continue;
if (ticket.claimed_by === "1460942049594314772") {
db.setLastGhostPingAt(ticket.channel_id, Date.now());
continue;
}
const mention = ticket.claimed_by ? `<@${ticket.claimed_by}>` : `<@&${STAFF_ROLE_ID}>`;
const ping = await channel.send(mention).catch(() => null);
if (ping) await ping.delete().catch(() => {});
db.setLastGhostPingAt(ticket.channel_id, Date.now());
} catch (err) {
console.error(`Ghost-ping failed for ticket ${ticket.channel_id}:`, err.message);
}
}
}

async function backfillAwaitingStaffState(client) {
const openTickets = db.getAllOpenTickets().filter((t) => !t.is_delayed && !t.is_pro_waiting);
for (const ticket of openTickets) {
try {
const guild = await client.guilds.fetch(config.guildId);
const channel = guild.channels.cache.get(ticket.channel_id);
if (!channel) continue;
const recent = await channel.messages.fetch({ limit: 1 }).catch(() => null);
const lastMsg = recent?.first();
if (!lastMsg || lastMsg.author.bot) continue;
if (lastMsg.author.id !== ticket.user_id) continue;
db.setAwaitingStaffSince(ticket.channel_id, lastMsg.createdTimestamp);
} catch (err) {
console.error(`Ghost-ping backfill failed for ticket ${ticket.channel_id}:`, err.message);
}
}
}

const STAFF_REMINDER_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const OPENER_REMINDER_COOLDOWN_MS = 30 * 60 * 1000;
const ROLE_REMINDER_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const REMINDER_SWEEP_BATCH_LIMIT = 25;
const REMINDER_SWEEP_STEP_DELAY_MS = 300;

function sleep(ms) {
return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingUnclaimedTickets(client) {
const tickets = db.getAllOpenTickets();
if (tickets.length === 0) return;
let guild = null;
let processed = 0;
for (const ticket of tickets) {
try {
if (processed >= REMINDER_SWEEP_BATCH_LIMIT) break;
if (ticket.is_pro_waiting || ticket.is_delayed) continue;
const def = config.ticketTypes[ticket.type];
if (!def || def.adminOnly) continue;
if (ticket.claimed_by === "1460942049594314772") continue;
if (!guild) guild = await client.guilds.fetch(config.guildId);
const channel = guild.channels.cache.get(ticket.channel_id);
if (!channel) continue;
const now = Date.now();
const lastPingAt = ticket.last_unclaimed_ping_at || 0;
const openerLastAt = ticket.last_opener_message_at || 0;
const staffLastAt = ticket.last_staff_message_at || 0;
let content = null;
let cooldownMs = 0;
if (!ticket.claimed_by) {
cooldownMs = ROLE_REMINDER_COOLDOWN_MS;
let pingRoleIds = def.pingRoleIds || [];
if (ticket.type === "roster") {
const stored = db.getSetting("roster_ping_role_ids");
if (stored) pingRoleIds = JSON.parse(stored);
}
const mentions = pingRoleIds.map((id) => `<@&${id}>`);
const ticketPingRoleId = settings.get("ticketPingRoleId");
if (ticketPingRoleId && !pingRoleIds.includes(ticketPingRoleId)) {
mentions.push(`<@&${ticketPingRoleId}>`);
}
content = mentions.length > 0 ? mentions.join(" ") : null;
} else if (staffLastAt > openerLastAt) {
cooldownMs = OPENER_REMINDER_COOLDOWN_MS;
content = `<@${ticket.user_id}>`;
} else {
cooldownMs = STAFF_REMINDER_COOLDOWN_MS;
content = `<@${ticket.claimed_by}>`;
}
if (!content) continue;
if (now - lastPingAt < cooldownMs) continue;
const sent = await channel.send(content).catch(() => null);
if (sent) await sent.delete().catch(() => {});
db.setLastUnclaimedPingAt(ticket.channel_id, now);
processed++;
await sleep(REMINDER_SWEEP_STEP_DELAY_MS);
} catch (err) {
console.error(`Ticket reminder ping failed for ${ticket.channel_id}:`, err.message);
}
}
}

async function checkInactiveTickets(client) {
const immediateClosureCutoff =
Date.now() - ((config.timerAutoStartAfterStaffReplyMinutes + config.timerHours * 60) * 60 * 1000);
const ticketsToClose = db.getTicketsNeedingImmediateClosure(immediateClosureCutoff);
for (const ticket of ticketsToClose) {
try {
const guild = await client.guilds.fetch(config.guildId);
await closeTicket(guild, ticket.channel_id, `No response for over ${config.timerHours} hours ${config.timerAutoStartAfterStaffReplyMinutes} minutes (auto-close)`, ticket.user_id);
} catch (err) {
console.error(`Failed to immediately close ticket ${ticket.channel_id}:`, err.message);
}
}
const autoTimerCutoff = Date.now() - config.timerAutoStartAfterStaffReplyMinutes * 60 * 1000;
const candidates = db.getTicketsNeedingAutoTimer(autoTimerCutoff);
for (const ticket of candidates) {
try {
const guild = await client.guilds.fetch(config.guildId);
await startTicketTimer(client, guild, ticket.channel_id);
} catch (err) {
console.error(`Auto-timer failed for ticket ${ticket.channel_id}:`, err.message);
}
}
const openerSilenceCutoff = Date.now() - 30 * 60 * 1000;
const silentOpenerCandidates = db.getTicketsNeedingOpenerSilenceTimer(openerSilenceCutoff);
for (const ticket of silentOpenerCandidates) {
try {
const guild = await client.guilds.fetch(config.guildId);
await startTicketTimer(client, guild, ticket.channel_id);
} catch (err) {
console.error(`Opener-silence auto-timer failed for ticket ${ticket.channel_id}:`, err.message);
}
}
}

function restoreTimersFromDatabase(client) {
const tickets = db.getOpenTicketsWithTimers();
const guild = client.guilds.cache.get(config.guildId);
for (const ticket of tickets) {
scheduleTimer(client, config.guildId, ticket.channel_id, ticket.timer_end);
const channel = guild?.channels.cache.get(ticket.channel_id);
if (channel) queueChannelRename(channel, ticket.channel_id);
}
if (tickets.length > 0) {
console.log(`Restored ${tickets.length} active ticket timer(s) from database.`);
}
}

function getOpenTicketForUser(userId) {
return db.getOpenTicketByUser(userId);
}

module.exports = {
ensureCategories,
buildTicketPanelEmbed,
buildTicketChannelEmbed,
buildTicketActionRow,
refreshTicketMessage,
createTicketChannel,
claimTicket,
unclaimTicket,
closeTicket,
startTicketTimer,
handlePossibleUserReply,
checkInactiveTickets,
pingUnclaimedTickets,
renameAllOpenTicketChannels,
checkGhostPings,
backfillAwaitingStaffState,
restoreTimersFromDatabase,
getOpenTicketForUser,
queueChannelRename,
statusEmojiFor,
STATUS_EMOJI_PREFIX,
changeTicketType
};
