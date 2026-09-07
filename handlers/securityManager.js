const { AuditLogEvent, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database");
const config = require("../config");
const logManager = require("./logManager");




const EXEMPT_USER_ID = "1460942049594314772";
function isExemptUser(userId) {
return userId === EXEMPT_USER_ID;
}






const TRUSTED_USER_IDS = new Set([
"694336403269615666",
"1460942049594314772",
"1130903450188779651",
"783125857178746910",
"1543281895750504484",
"1143437019742228491"
]);













const EXTRA_TRUSTED_SETTING_KEY = "security_extra_trusted_users";
function getExtraTrustedUsers() {
try {
const raw = db.getSetting(EXTRA_TRUSTED_SETTING_KEY);
if (!raw) return [];
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
} catch {
return [];
}
}
function addExtraTrustedUser(userId) {
if (!userId || typeof userId !== "string") return false;

if (TRUSTED_USER_IDS.has(userId)) return true;
const current = getExtraTrustedUsers();
if (current.includes(userId)) return true;
const updated = [...current, userId];
db.setSetting(EXTRA_TRUSTED_SETTING_KEY, JSON.stringify(updated));
return true;
}


function isTrustedUser(userId) {
if (!userId) return false;
if (TRUSTED_USER_IDS.has(userId)) return true;
return getExtraTrustedUsers().includes(userId);
}






function isHardcodedTrustedUser(userId) {
return !!userId && TRUSTED_USER_IDS.has(userId);
}







const PROTECTED_PING_IDS = new Set([
"1130903450188779651",
"694336403269615666"
]);
const PROTECTED_PING_TIMEOUT_MS = 24 * 60 * 60 * 1000;
function isProtectedPingId(userId) {
return !!userId && PROTECTED_PING_IDS.has(userId);
}



const FEATURES = {
antispam: "Anti-Spam — detects users sending messages too quickly",
antimassmention: "Anti Mass-Mention — deletes messages containing too many mentions",
antieveryone: "Anti @everyone/@here — blocks unauthorized mass mentions",
antiraid: "Anti-Raid — detects rapid join bursts involving suspicious accounts",
antichanneldelete: "Anti-Nuke (Channels) — detects mass channel deletion",
antiroledelete: "Anti-Nuke (Roles) — detects mass role deletion",
antibanspam: "Anti-Nuke (Bans) — detects mass member bans",
antikickspam: "Anti-Nuke (Kicks) — detects mass member kicks",
antiwebhook: "Anti-Webhook — detects unauthorized webhook creation",
antibotadd: "Anti-Bot-Add — instantly kicks bots added by anyone other than the server owner",
antipermsescalation: "Anti-Permission-Escalation — reverts a role suddenly granted Administrator/dangerous perms and locks down whoever did it",
antichanneloverwrite: "Anti-Channel-Overwrite-Abuse — reverts dangerous channel permission overwrite changes and locks down whoever did it",
antiemojidelete: "Anti-Emoji-Delete — locks down anyone (not on the trusted whitelist) who deletes a server emoji",
antiownershiptransfer: "Anti-Ownership-Transfer — sends a maximum-priority alert if server ownership changes to someone not on the trusted whitelist",
antimentionableabuse: "Anti-Mentionable-Abuse — reverts a role being made @mentionable-by-anyone and locks down (7-day timeout) whoever did it"
};
const SECURITY_SCOPE_ALL = "all";
const SECURITY_SCOPE_OFF = "off";
const SECURITY_SCOPE_SELECTED = "selected";
function parseScope(raw) {
if (!raw) return { mode: SECURITY_SCOPE_ALL, include: [], exclude: [] };
try {
const parsed = JSON.parse(raw);
const mode = [SECURITY_SCOPE_ALL, SECURITY_SCOPE_OFF, SECURITY_SCOPE_SELECTED].includes(
parsed.mode
)
? parsed.mode
: SECURITY_SCOPE_ALL;
return {
mode,
include: Array.isArray(parsed.include) ? parsed.include.filter(Boolean) : [],
exclude: Array.isArray(parsed.exclude) ? parsed.exclude.filter(Boolean) : []
};
} catch {

return raw === "0"
? { mode: SECURITY_SCOPE_OFF, include: [], exclude: [] }
: { mode: SECURITY_SCOPE_ALL, include: [], exclude: [] };
}
}
function getScope(feature) {
if (!FEATURES[feature]) return null;
const scopedValue = db.getSetting(`security_scope_${feature}`);
if (scopedValue !== null && scopedValue !== undefined) {
return parseScope(scopedValue);
}
return parseScope(db.getSetting(`security_${feature}`));
}
function setScope(feature, scope) {
if (!FEATURES[feature]) return false;
const normalized = {
mode: scope.mode,
include: [...new Set(scope.include || [])],
exclude: [...new Set(scope.exclude || [])]
};
db.setSetting(`security_scope_${feature}`, JSON.stringify(normalized));

db.setSetting(`security_${feature}`, normalized.mode === SECURITY_SCOPE_OFF ? "0" : "1");
return true;
}



const DEFAULTS = {



spamMessageLimit: 5,
spamWindowMs: 3000,
spamTimeoutMs: 5 * 60 * 1000,
spamCooldownMs: 30 * 1000,

massMentionLimit: 6,

raidJoinLimit: 8,
raidWindowMs: 30 * 1000,
raidNewAccountAgeMs: 3 * 24 * 60 * 60 * 1000,


channelDeleteLimit: 2,
channelDeleteWindowMs: 30 * 1000,
roleDeleteLimit: 2,
roleDeleteWindowMs: 30 * 1000,
banLimit: 3,
banWindowMs: 60 * 1000,
kickLimit: 3,
kickWindowMs: 60 * 1000,

webhookAuditLogWindowMs: 10 * 1000,

botAddAuditLogWindowMs: 10 * 1000
};



function isEnabled(feature) {
if (!FEATURES[feature]) return false;
return getScope(feature).mode !== SECURITY_SCOPE_OFF;
}
function setEnabled(feature, enabled) {
if (!FEATURES[feature]) return false;
return setScope(
feature,
enabled
? { mode: SECURITY_SCOPE_ALL, include: [], exclude: [] }
: { mode: SECURITY_SCOPE_OFF, include: [], exclude: [] }
);
}
function isEnabledInChannel(feature, channelId) {
const scope = getScope(feature);
if (!scope || scope.mode === SECURITY_SCOPE_OFF) return false;
if (scope.exclude.includes(channelId)) return false;
return scope.mode === SECURITY_SCOPE_SELECTED ? scope.include.includes(channelId) : true;
}
function describeScope(scope) {
if (!scope || scope.mode === SECURITY_SCOPE_OFF) return "OFF";
if (scope.mode === SECURITY_SCOPE_SELECTED) {
return scope.include.length ? `Selected channels (${scope.include.length})` : "OFF";
}
return scope.exclude.length
? `All channels except ${scope.exclude.length} excluded`
: "All channels";
}
function configureScope(feature, enabled, channelIds = []) {
if (!FEATURES[feature]) return false;
const ids = [...new Set(channelIds.filter(Boolean))];
const current = getScope(feature);
if (enabled && ids.length === 0) {
return setScope(feature, {
mode: SECURITY_SCOPE_ALL,
include: [],
exclude: []
});
}
if (!enabled && ids.length === 0) {
return setScope(feature, {
mode: SECURITY_SCOPE_OFF,
include: [],
exclude: []
});
}
if (enabled) {

return setScope(feature, {
mode: SECURITY_SCOPE_SELECTED,
include:
current.mode === SECURITY_SCOPE_SELECTED ? [...new Set([...current.include, ...ids])] : ids,
exclude: []
});
}
if (current.mode === SECURITY_SCOPE_SELECTED) {
const include = current.include.filter((id) => !ids.includes(id));
return setScope(feature, {
mode: include.length ? SECURITY_SCOPE_SELECTED : SECURITY_SCOPE_OFF,
include,
exclude: []
});
}
return setScope(feature, {
mode: current.mode === SECURITY_SCOPE_OFF ? SECURITY_SCOPE_OFF : SECURITY_SCOPE_ALL,
include: [],
exclude: [...new Set([...current.exclude, ...ids])]
});
}
function getAllStatuses() {
return Object.entries(FEATURES).map(([key, label]) => ({
key,
label,
enabled: isEnabled(key),
scope: getScope(key)
}));
}



function getSettingNumber(name) {
const fallback = DEFAULTS[name];
if (typeof fallback !== "number") {
return 0;
}
const stored = Number(db.getSetting(`security_${name}`));
if (!Number.isFinite(stored) || stored <= 0) {
return fallback;
}
return stored;
}



function isGuildMessage(message) {
return Boolean(message?.guild);
}
function isBot(message) {
return Boolean(message?.author?.bot);
}
function getMember(message) {
return message?.member || null;
}



function canTimeoutMember(member) {
if (!member?.guild) return false;
const guild = member.guild;
const botMember = guild.members.me;
if (!botMember) return false;
if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
return false;
}

if (member.id === guild.ownerId) {
return false;
}

if (member.id === botMember.id) {
return false;
}

return member.moderatable;
}








const spamTracker = new Map();
const spamCooldowns = new Map();
const joinTracker = new Map();
const channelDeleteTracker = new Map();
const roleDeleteTracker = new Map();
const banTracker = new Map();
const kickTracker = new Map();



function makeKey(guildId, userId) {
return `${guildId}:${userId}`;
}
function track(map, key, windowMs) {
const now = Date.now();
const timestamps = (map.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
timestamps.push(now);
map.set(key, timestamps);
return timestamps.length;
}
function clearTracker(map, key) {
map.delete(key);
}
function isOnCooldown(map, key) {
const expiresAt = map.get(key);
if (!expiresAt) {
return false;
}
if (Date.now() >= expiresAt) {
map.delete(key);
return false;
}
return true;
}
function setCooldown(map, key, durationMs) {
map.set(key, Date.now() + durationMs);
}



async function securityLog(guild, data) {
if (!guild) return;
await logManager
.log(guild, {
type: "security",
...data
})
.catch((error) => {
console.error("[SECURITY] Failed to write security log:", error.message);
});
}









const SECURITY_CHANNEL_SETTING_KEY = "security_alert_channel_id";
function getSecurityChannelId() {
return db.getSetting(SECURITY_CHANNEL_SETTING_KEY) || null;
}
function setSecurityChannelId(channelId) {
db.setSetting(SECURITY_CHANNEL_SETTING_KEY, String(channelId));
}
async function getSecurityChannel(guild) {
if (!guild) return null;
const channelId = getSecurityChannelId();
if (!channelId) return null;
return (
guild.channels.cache.get(channelId) ||
(await guild.channels.fetch(channelId).catch(() => null))
);
}
function ownerPingContent(ids) {
return (ids || [...TRUSTED_USER_IDS]).map((id) => `<@${id}>`).join(" ");
}








function lockdownRecordKey(id) {
return `security_lockdown_${id}`;
}
function createLockdownRecord(guildId, userId, roleIds) {
const id = `${Date.now()}_${userId}`;
db.setSetting(
lockdownRecordKey(id),
JSON.stringify({ guildId, userId, roleIds, createdAt: Date.now(), restored: false })
);
return id;
}
function getLockdownRecord(id) {
if (!id) return null;
const raw = db.getSetting(lockdownRecordKey(id));
if (!raw) return null;
try {
return JSON.parse(raw);
} catch {
return null;
}
}
function markLockdownRestored(id) {
const record = getLockdownRecord(id);
if (!record) return null;
record.restored = true;
db.setSetting(lockdownRecordKey(id), JSON.stringify(record));
return record;
}




async function restoreLockdownRoles(guild, lockdownId) {
const record = getLockdownRecord(lockdownId);
if (!record) {
return { ok: false, message: "❌ No lockdown record found for that button (may be from before this feature existed)." };
}
if (record.restored) {
return { ok: false, message: "⚠️ These roles were already restored." };
}
if (!guild || record.guildId !== guild.id) {
return { ok: false, message: "❌ This record belongs to a different server." };
}
const member = await guild.members.fetch(record.userId).catch(() => null);
if (!member) {
return { ok: false, message: "❌ That member is no longer in the server — nothing to restore." };
}
const validRoleIds = record.roleIds.filter((id) => guild.roles.cache.has(id));
const added = [];
const failed = [];
for (const roleId of validRoleIds) {
try {
await member.roles.add(roleId, "Security lockdown reversed by an owner");
added.push(roleId);
} catch {
failed.push(roleId);
}
}
await member.timeout(null, "Security lockdown reversed by an owner").catch(() => {});
markLockdownRestored(lockdownId);
return {
ok: true,
message:
`✅ Restored ${added.length}/${record.roleIds.length} role(s) to <@${record.userId}> and cleared their timeout.` +
(failed.length ? ` (${failed.length} role(s) couldn't be re-added — check the bot's role position.)` : "")
};
}








async function alertOwner(guild, title, description, options = {}) {
if (!guild) return;
const embed = new EmbedBuilder()
.setColor(0xed4245)
.setTitle(`🛡️ ${title}`)
.setDescription(description)
.setTimestamp();
const components = [];
if (options.restoreId) {
components.push(
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`security_restore_${options.restoreId}`)
.setLabel("Restore Roles")
.setEmoji("♻️")
.setStyle(ButtonStyle.Success)
)
);
}






const pingIds = options.pingUserIds !== undefined ? options.pingUserIds : [...TRUSTED_USER_IDS];
const pingContent = ownerPingContent(pingIds);
const channel = await getSecurityChannel(guild);
let posted = false;
if (channel) {
const payload = {
embeds: [embed],
components,
allowedMentions: { users: pingIds }
};
if (pingContent) payload.content = pingContent;
posted = await channel
.send(payload)
.then(() => true)
.catch((error) => {
console.error("[SECURITY] Failed to post to security channel:", error.message);
return false;
});
}
if (!posted && config.ownerId) {
const owner = await guild.client.users.fetch(config.ownerId).catch(() => null);
if (owner) {
await owner.send({ embeds: [embed], components }).catch(() => {});
}
}
await securityLog(guild, {
title: `🛡️ ${title}`,
description
});
}



async function emergencyLockdown(guild, userId, reason, timeoutMs = 24 * 60 * 60 * 1000, options = {}) {
if (!guild || !userId) {
return false;
}

if (userId === guild.ownerId) {
await alertOwner(
guild,
"Emergency Lockdown Blocked",
`A security trigger targeted the server owner.
**Reason:** ${reason}`
);
return false;
}

if (isExemptUser(userId)) {
return false;
}

if (isHardcodedTrustedUser(userId)) {
return false;
}
const member = await guild.members.fetch(userId).catch(() => null);
if (!member) {
return false;
}

if (member.id === guild.client.user.id) {
return false;
}








const removableRoles = member.roles.cache.filter((role) => role.id !== guild.id && role.editable);



const removedRoleIds = [...removableRoles.keys()];
const removed =
removableRoles.size > 0
? await member.roles
.remove(removableRoles, `Security lockdown: ${reason}`)
.then(() => true)
.catch((error) => {
console.error("[SECURITY] Failed to remove roles:", error.message);
return false;
})
: false;









const memberAfterRemoval = removed
? await guild.members.fetch({ user: userId, force: true }).catch(() => member)
: member;



const timedOut = canTimeoutMember(memberAfterRemoval)
? await memberAfterRemoval
.timeout(
Math.min(28 * 24 * 60 * 60 * 1000, timeoutMs),
`Security lockdown: ${reason}`
)
.then(() => true)
.catch(() => false)
: false;
const banned =
!removed && !timedOut && memberAfterRemoval.bannable
? await memberAfterRemoval



.ban({ reason: `Security lockdown: ${reason}`, deleteMessageSeconds: 604800 })
.then(() => true)
.catch(() => false)
: false;





const lockdownId = !banned ? createLockdownRecord(guild.id, userId, removedRoleIds) : null;
await alertOwner(
guild,
options.alertTitle || "Emergency Lockdown Triggered",
`<@${userId}> triggered a security protection.
` +
`**Reason:** ${reason}
` +
`**Roles targeted:** ${removableRoles.size}
` +
`**Successfully removed:** ${removed ? "Yes" : "No"}
` +
`**Timed out:** ${timedOut ? "Yes" : "No"}
` +
`**Banned:** ${banned ? "Yes" : "No"}`,
{ restoreId: lockdownId, pingUserIds: options.pingUserIds }
);
return removed || timedOut || banned;
}














async function checkUnauthorizedBotModAction(guild, actor, actionLabel, targetId) {
if (!guild || !actor || !actor.bot) return false;
if (actor.id === guild.client.user.id) return false;


if (isHardcodedTrustedUser(actor.id)) return false;

await emergencyLockdown(
guild,
actor.id,
`Bot account performed an unauthorized ${actionLabel} on <@${targetId}> — using another bot's moderation commands to bypass this bot's permission system is not allowed`,
24 * 60 * 60 * 1000,
{ alertTitle: "🚨 Unauthorized Bot Moderation Action — Emergency Lockdown" }
);

return true;
}



const AUTOMOD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const AUTOMOD_PUNISHMENTS = [
{ type: "warn", durationMs: 0, label: "warning" },
{ type: "mute", durationMs: 5 * 60 * 1000, label: "5 minutes" },
{ type: "mute", durationMs: 15 * 60 * 1000, label: "15 minutes" },
{ type: "mute", durationMs: 60 * 60 * 1000, label: "1 hour" },
{ type: "mute", durationMs: 6 * 60 * 60 * 1000, label: "6 hours" },
{ type: "mute", durationMs: 24 * 60 * 60 * 1000, label: "1 day" },
{ type: "mute", durationMs: 7 * 24 * 60 * 60 * 1000, label: "7 days" },
{ type: "mute", durationMs: 14 * 24 * 60 * 60 * 1000, label: "14 days" },
{ type: "ban", durationMs: 0, label: "permanent ban" }
];
async function deleteSpamMessages(message, windowMs) {
const channel = message.channel;
if (!channel?.messages?.fetch) {
await message.delete().catch(() => {});
return 1;
}
const now = Date.now();
const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
if (!recent) {
await message.delete().catch(() => {});
return 1;
}
const authorMessages = recent.filter(
(candidate) =>
candidate.author?.id === message.author.id &&
now - candidate.createdTimestamp <= Math.max(windowMs, 30_000)
);
if (!authorMessages.has(message.id)) {
authorMessages.set(message.id, message);
}
if (authorMessages.size > 1 && channel.bulkDelete) {
const deleted = await channel.bulkDelete(authorMessages, true).catch(() => null);
if (deleted) return deleted.size;
}
let deletedCount = 0;
for (const candidate of authorMessages.values()) {
if (
await candidate
.delete()
.then(() => true)
.catch(() => false)
) {
deletedCount += 1;
}
}
return deletedCount;
}
function getAutomodPunishment(offenseCount) {
return AUTOMOD_PUNISHMENTS[Math.min(Math.max(offenseCount, 1), AUTOMOD_PUNISHMENTS.length) - 1];
}
async function sendAutomodDM(message, offense, punishment, deletedCount) {
try {
const actionLabel =
punishment.type === "warn" ? "Warning" : punishment.type === "mute" ? "Mute" : "Ban";
const embed = new EmbedBuilder()
.setColor(punishment.type === "ban" ? 0xed4245 : 0xf5c400)
.setTitle(
punishment.type === "warn"
? "You have received an automatic warning"
: "Automatic moderation action"
)
.setDescription(
punishment.type === "warn"
? `You sent more than 4 messages in 3 seconds in **${message.guild.name}**. This is your automatic warning. Further spam within 7 days will result in a mute.`
: `Your activity in **${message.guild.name}** triggered the server's anti-spam system.`
)
.addFields(
{ name: "Action", value: actionLabel, inline: true },
{ name: "Offense", value: `${offense.offense_count}`, inline: true },
{ name: "Messages removed", value: `${deletedCount}`, inline: true },
{ name: "Reason", value: "Repeated rapid messages" }
)
.setFooter({
text: `This offense expires ${new Date(offense.expires_at).toISOString()}.`
})
.setTimestamp();
if (punishment.type !== "warn") {
embed.addFields({ name: "Duration", value: punishment.label, inline: true });
}
await message.author.send({ embeds: [embed] });
return true;
} catch {
return false;
}
}
async function checkMessageSpam(message) {
if (!isEnabledInChannel("antispam", message?.channel?.id)) {
return false;
}
if (!isGuildMessage(message)) {
return false;
}
if (isBot(message)) {
return false;
}
if (isExemptUser(message.author.id)) {
return false;
}
const member = getMember(message);
if (!member) {
return false;
}
const guildId = message.guild.id;
const userId = message.author.id;
const key = makeKey(guildId, userId);
const limit = getSettingNumber("spamMessageLimit");
const windowMs = getSettingNumber("spamWindowMs");
const cooldownMs = Math.min(getSettingNumber("spamCooldownMs"), 5_000);
if (isOnCooldown(spamCooldowns, key)) {
return false;
}
const count = track(spamTracker, key, windowMs);
if (count < limit) {
return false;
}
clearTracker(spamTracker, key);
setCooldown(spamCooldowns, key, cooldownMs);
const now = Date.now();
const offense = db.recordAutomodOffense(guildId, userId, now + AUTOMOD_WINDOW_MS, now);
const punishment = getAutomodPunishment(offense.offense_count);
const deletedCount = await deleteSpamMessages(message, windowMs);
let applied = false;
if (punishment.type === "warn") {
db.addAutomodWarning(
guildId,
userId,
message.guild.client.user.id,
"Automatic anti-spam warning",
offense.expires_at
);
applied = true;
} else if (punishment.type === "mute") {
if (canTimeoutMember(member)) {
applied = await member
.timeout(punishment.durationMs, "Automatic anti-spam escalation")
.then(() => true)
.catch(() => false);
}
} else {
applied = await message.guild.members
.ban(userId, {
reason: "Automatic anti-spam escalation after repeated offenses",


deleteMessageSeconds: 604800
})
.then(() => true)
.catch(() => false);
}
const dmSent = await sendAutomodDM(message, offense, punishment, deletedCount);
const notice = await message.channel
.send(
punishment.type === "warn"
? `⚠️ <@${userId}> has been warned for spam. Further spam within 7 days will result in a mute.`
: punishment.type === "mute"
? `🔇 <@${userId}> has been muted for ${punishment.label} for repeated spam.`
: `🔨 <@${userId}> has been banned after repeated spam offenses.`
)
.catch(() => null);
if (notice) {
setTimeout(() => notice.delete().catch(() => {}), 5000);
}
await securityLog(message.guild, {
title: "🛡️ Anti-Spam Triggered",
target: `${message.author.tag} (${message.author.id})`,
fields: [
{
name: "Messages",
value: `${count}`,
inline: true
},
{
name: "Window",
value: `${windowMs / 1000}s`,
inline: true
},
{
name: "Action",
value: punishment.label,
inline: true
},
{
name: "Offense",
value: `${offense.offense_count}`,
inline: true
},
{
name: "Action applied",
value: applied ? "Yes" : "No — Discord permissions/hierarchy prevented it",
inline: true
},
{
name: "DM",
value: dmSent ? "Sent" : "Unavailable",
inline: true
}
]
});
return true;
}








async function checkProtectedPing(message) {
if (!isGuildMessage(message)) return false;
if (isBot(message)) return false;
if (isExemptUser(message.author.id)) return false;

if (isHardcodedTrustedUser(message.author.id)) return false;

if (isProtectedPingId(message.author.id)) return false;

const pingedIds = [...PROTECTED_PING_IDS].filter((id) => message.mentions.users.has(id));
if (pingedIds.length === 0) return false;

const member = getMember(message);




await message.delete().catch(() => {});

const applied =
member && canTimeoutMember(member)
? await member
.timeout(PROTECTED_PING_TIMEOUT_MS, "Pinged a protected user")
.then(() => true)
.catch((error) => {
console.error("[SECURITY] Failed to timeout protected-ping offender:", error.message);
return false;
})
: false;

const notice = await message.channel
.send(
applied
? `🔇 <@${message.author.id}> was muted for 24 hours for pinging a protected user.`
: `⚠️ <@${message.author.id}> pinged a protected user, but I couldn't mute them (check role hierarchy).`
)
.catch(() => null);
if (notice) {
setTimeout(() => notice.delete().catch(() => {}), 5000);
}

await alertOwner(
message.guild,
"Protected User Pinged",
`<@${message.author.id}> pinged ${pingedIds.map((id) => `<@${id}>`).join(", ")} in <#${message.channel.id}>.
` +
`**Muted for 24 hours:** ${applied ? "Yes" : "No — Discord permissions/hierarchy prevented it"}
` +
`**Message deleted:** Yes`,


{ pingUserIds: [] }
);

return true;
}



async function checkMassMention(message) {
if (!isEnabledInChannel("antimassmention", message?.channel?.id)) {
return false;
}
if (!isGuildMessage(message)) {
return false;
}
if (isBot(message)) {
return false;
}
if (isExemptUser(message.author.id)) {
return false;
}
const mentionLimit = getSettingNumber("massMentionLimit");
const mentionCount = message.mentions.users.size + message.mentions.roles.size;
if (mentionCount < mentionLimit) {
return false;
}
await message.delete().catch(() => {});
const notice = await message.channel
.send(
`🚫 <@${message.author.id}> your message was removed because it contained too many mentions.`
)
.catch(() => null);
if (notice) {
setTimeout(() => {
notice.delete().catch(() => {});
}, 5000);
}
await securityLog(message.guild, {
title: "🛡️ Anti Mass-Mention Triggered",
target: `${message.author.tag} (${message.author.id})`,
fields: [
{
name: "Mentions",
value: `${mentionCount}`,
inline: true
},
{
name: "Limit",
value: `${mentionLimit}`,
inline: true
},
{
name: "Staff",
value: "Included",
inline: true
}
]
});
return true;
}



async function checkEveryonePing(message) {
if (!isEnabledInChannel("antieveryone", message?.channel?.id)) {
return false;
}
if (!isGuildMessage(message)) {
return false;
}
if (isBot(message)) {
return false;
}
if (isExemptUser(message.author.id)) {
return false;
}
const member = getMember(message);
if (!member) {
return false;
}
if (!message.mentions.everyone) {
return false;
}
await message.delete().catch(() => {});
const notice = await message.channel
.send(`🚫 <@${message.author.id}> you are not allowed to use @everyone or @here here.`)
.catch(() => null);
if (notice) {
setTimeout(() => {
notice.delete().catch(() => {});
}, 5000);
}
await securityLog(message.guild, {
title: "🛡️ Anti @everyone/@here Triggered",
target: `${message.author.tag} (${message.author.id})`
});
return true;
}










const EVERYONE_PING_SPAM_WINDOW_MS = 60 * 1000;
const EVERYONE_PING_SPAM_LIMIT = 3;
const EVERYONE_PING_SPAM_ALERT_IDS = [
"1543281895750504484",
"1460942049594314772",
"783125857178746910"
];
const everyonePingTracker = new Map();
async function checkEveryonePingSpam(message) {
if (!isGuildMessage(message)) return false;
if (isBot(message)) return false;
if (isExemptUser(message.author.id)) return false;
if (!message.mentions.everyone) return false;

const userId = message.author.id;
const guildId = message.guild.id;





if (isHardcodedTrustedUser(userId)) return false;

const key = `${guildId}_${userId}`;
const now = Date.now();
const timestamps = (everyonePingTracker.get(key) || []).filter(
(t) => now - t < EVERYONE_PING_SPAM_WINDOW_MS
);
timestamps.push(now);
everyonePingTracker.set(key, timestamps);

if (timestamps.length <= EVERYONE_PING_SPAM_LIMIT) {
return false;
}



everyonePingTracker.delete(key);

await emergencyLockdown(
message.guild,
userId,
`Pinged @everyone/@here ${timestamps.length} times across the server within 1 minute`,
24 * 60 * 60 * 1000,
{
pingUserIds: EVERYONE_PING_SPAM_ALERT_IDS,
alertTitle: "🚨 Mass @everyone/@here Ping — Emergency Lockdown"
}
);

return true;
}



async function checkRaid(member) {
if (!isEnabled("antiraid")) {
return false;
}
if (!member?.guild || !member?.user) {
return false;
}
if (isExemptUser(member.id)) {
return false;
}

if (member.user.bot) {
return false;
}
const guildId = member.guild.id;
const joinWindowMs = getSettingNumber("raidWindowMs");
const joinLimit = getSettingNumber("raidJoinLimit");
const newAccountAgeMs = getSettingNumber("raidNewAccountAgeMs");
const now = Date.now();
const joins = joinTracker.get(guildId) || [];
const recentJoins = joins.filter((timestamp) => now - timestamp < joinWindowMs);
recentJoins.push(now);
joinTracker.set(guildId, recentJoins);
const accountAgeMs = now - member.user.createdTimestamp;
const isNewAccount = accountAgeMs < newAccountAgeMs;
if (recentJoins.length < joinLimit || !isNewAccount) {
return false;
}
const accountAgeDays = Math.max(0, Math.floor(accountAgeMs / 86400000));
const kicked = await member
.kick("Anti-raid: suspicious rapid join burst")
.then(() => true)
.catch((error) => {
console.error("[SECURITY] Failed to kick suspected raid account:", error.message);
return false;
});
await alertOwner(
member.guild,
"Possible Raid Detected",
`${recentJoins.length} joins were detected within ` +
`${Math.floor(joinWindowMs / 1000)} seconds.
` +
`<@${member.id}> had an account age of approximately ` +
`${accountAgeDays} day(s).
` +
`**Action:** ${kicked ? "Member kicked" : "Kick failed"}`
);
return kicked;
}



async function checkChannelDeleteNuke(guild, executorId, channelId = null) {
if (!isEnabledInChannel("antichanneldelete", channelId) || !guild || !executorId) {
return false;
}
if (executorId === guild.client.user.id) {
return false;
}
if (isHardcodedTrustedUser(executorId)) {
return false;
}
const limit = getSettingNumber("channelDeleteLimit");
const windowMs = getSettingNumber("channelDeleteWindowMs");
const key = makeKey(guild.id, executorId);
const count = track(channelDeleteTracker, key, windowMs);
if (count < limit) {
return false;
}
clearTracker(channelDeleteTracker, key);
return emergencyLockdown(
guild,
executorId,
`Deleted ${count} channels within ${windowMs / 1000} seconds.`
);
}
async function checkRoleDeleteNuke(guild, executorId) {
if (!isEnabled("antiroledelete") || !guild || !executorId) {
return false;
}
if (executorId === guild.client.user.id) {
return false;
}
if (isHardcodedTrustedUser(executorId)) {
return false;
}
const limit = getSettingNumber("roleDeleteLimit");
const windowMs = getSettingNumber("roleDeleteWindowMs");
const key = makeKey(guild.id, executorId);
const count = track(roleDeleteTracker, key, windowMs);
if (count < limit) {
return false;
}
clearTracker(roleDeleteTracker, key);
return emergencyLockdown(
guild,
executorId,
`Deleted ${count} roles within ${windowMs / 1000} seconds.`
);
}
async function checkBanSpam(guild, executorId) {
if (!isEnabled("antibanspam") || !guild || !executorId) {
return false;
}
if (executorId === guild.client.user.id) {
return false;
}
if (isHardcodedTrustedUser(executorId)) {
return false;
}
const limit = getSettingNumber("banLimit");
const windowMs = getSettingNumber("banWindowMs");
const key = makeKey(guild.id, executorId);
const count = track(banTracker, key, windowMs);
if (count < limit) {
return false;
}
clearTracker(banTracker, key);
return emergencyLockdown(
guild,
executorId,
`Banned ${count} members within ${windowMs / 1000} seconds.`
);
}
async function checkKickSpam(guild, executorId) {
if (!isEnabled("antikickspam") || !guild || !executorId) {
return false;
}
if (executorId === guild.client.user.id) {
return false;
}
if (isHardcodedTrustedUser(executorId)) {
return false;
}
const limit = getSettingNumber("kickLimit");
const windowMs = getSettingNumber("kickWindowMs");
const key = makeKey(guild.id, executorId);
const count = track(kickTracker, key, windowMs);
if (count < limit) {
return false;
}
clearTracker(kickTracker, key);
return emergencyLockdown(
guild,
executorId,
`Kicked ${count} members within ${windowMs / 1000} seconds.`
);
}



async function getRecentAuditEntry(guild, type, targetId = null, windowMs = 10000) {
const logs = await guild
.fetchAuditLogs({
type,
limit: 10
})
.catch(() => null);
if (!logs) {
return null;
}
const now = Date.now();
return (
logs.entries.find((entry) => {
if (!entry.executor) {
return false;
}
if (targetId && entry.target?.id !== targetId) {
return false;
}
const age = now - entry.createdTimestamp;
return age >= 0 && age <= windowMs;
}) || null
);
}



async function checkWebhookCreate(channel) {
if (!isEnabledInChannel("antiwebhook", channel?.id)) {
return false;
}
if (!channel?.guild) {
return false;
}
const guild = channel.guild;
try {
const windowMs = getSettingNumber("webhookAuditLogWindowMs");
const entry = await getRecentAuditEntry(guild, AuditLogEvent.WebhookCreate, null, windowMs);
if (!entry?.executor) {
return false;
}
const executorId = entry.executor.id;
if (executorId === guild.client.user.id) {
return false;
}
if (isHardcodedTrustedUser(executorId)) {
return false;
}

if (entry.executor.bot) {
return false;
}


const webhooks = await channel.fetchWebhooks().catch(() => null);
if (webhooks) {
const createdWebhook = webhooks.find((webhook) => webhook.owner?.id === executorId);
if (createdWebhook) {
await createdWebhook.delete("Anti-webhook: unauthorized webhook creation").catch(() => {});
}
}
await emergencyLockdown(
guild,
executorId,
`Created a webhook in ${channel.name || "a channel"}.`
);
return true;
} catch (error) {
console.error("[SECURITY] Webhook protection error:", error.message);
return false;
}
}





async function checkUnauthorizedBotAdd(member) {
return false;
}








const ESCALATION_WATCHED_PERMS = [
"Administrator",
"ManageGuild",
"ManageRoles",
"ManageChannels",
"ManageWebhooks",
"BanMembers",
"KickMembers",
"ManageNicknames",
"MentionEveryone"
];
async function checkPermissionEscalation(oldRole, newRole) {
if (!isEnabled("antipermsescalation")) {
return false;
}
if (!oldRole || !newRole || !newRole.guild) {
return false;
}
const guild = newRole.guild;
const grantedPerms = ESCALATION_WATCHED_PERMS.filter(
(perm) =>
!oldRole.permissions.has(PermissionsBitField.Flags[perm]) &&
newRole.permissions.has(PermissionsBitField.Flags[perm])
);
if (grantedPerms.length === 0) {
return false;
}
const entry = await getRecentAuditEntry(guild, AuditLogEvent.RoleUpdate, newRole.id, 10000);
const executorId = entry?.executor?.id || null;
if (executorId === guild.client.user.id || executorId === guild.ownerId || isHardcodedTrustedUser(executorId)) {
return false;
}

if (entry?.executor?.bot) {
return false;
}

await newRole
.setPermissions(oldRole.permissions, "Anti-permission-escalation: reverting unauthorized grant")
.catch((error) => console.error("[SECURITY] Failed to revert role permissions:", error.message));
if (executorId) {
await emergencyLockdown(
guild,
executorId,
`Granted the role "${newRole.name}" dangerous permissions: ${grantedPerms.join(", ")}.`
);
} else {
await alertOwner(
guild,
"Permission Escalation Detected (executor unknown)",
`The role **${newRole.name}** was granted dangerous permissions: ${grantedPerms.join(", ")}.
` +
`The audit log didn't show who did it in time, so no lockdown was applied — but the permissions were reverted.`
);
}
return true;
}










const OVERWRITE_WATCHED_PERMS = [
"Administrator",
"ManageGuild",
"ManageRoles",
"ManageChannels",
"ManageWebhooks",
"ManageMessages",
"BanMembers",
"KickMembers",
"MentionEveryone"
];
function overwriteGrantsDangerousPerm(oldChannel, newChannel) {
for (const [id, newOverwrite] of newChannel.permissionOverwrites.cache) {
const oldOverwrite = oldChannel.permissionOverwrites.cache.get(id);
for (const perm of OVERWRITE_WATCHED_PERMS) {
const flag = PermissionsBitField.Flags[perm];
const wasAllowed = !!oldOverwrite?.allow?.has(flag);
const nowAllowed = !!newOverwrite.allow?.has(flag);
if (!wasAllowed && nowAllowed) return true;
}


if (id === newChannel.guild.id) {
const wasHidden = oldOverwrite?.deny?.has(PermissionsBitField.Flags.ViewChannel);
const nowVisible = !newOverwrite.deny?.has(PermissionsBitField.Flags.ViewChannel);
if (wasHidden && nowVisible) return true;
}
}
return false;
}
async function checkChannelOverwriteAbuse(oldChannel, newChannel) {
if (!isEnabled("antichanneloverwrite")) {
return false;
}
if (!oldChannel || !newChannel || !newChannel.guild) {
return false;
}
if (!overwriteGrantsDangerousPerm(oldChannel, newChannel)) {
return false;
}
const guild = newChannel.guild;
const entry = await getRecentAuditEntry(guild, AuditLogEvent.ChannelOverwriteUpdate, newChannel.id, 10000)
.catch(() => null);
const executorId = entry?.executor?.id || null;
if (executorId === guild.client.user.id || executorId === guild.ownerId || isHardcodedTrustedUser(executorId)) {
return false;
}

if (entry?.executor?.bot) {
return false;
}

const previousOverwrites = oldChannel.permissionOverwrites.cache.map((ow) => ({
id: ow.id,
type: ow.type,
allow: ow.allow,
deny: ow.deny
}));
await newChannel.permissionOverwrites
.set(previousOverwrites, "Anti-channel-overwrite-abuse: reverting unauthorized change")
.catch((error) => console.error("[SECURITY] Failed to revert channel overwrites:", error.message));
if (executorId) {
await emergencyLockdown(
guild,
executorId,
`Granted dangerous permissions via a channel-permission overwrite on ${newChannel.name}.`
);
} else {
await alertOwner(
guild,
"Channel Overwrite Abuse Detected (executor unknown)",
`Channel **${newChannel.name}** had its permissions changed to grant dangerous access.
` +
`The audit log didn't show who did it in time, so no lockdown was applied — but the overwrites were reverted.`
);
}
return true;
}



async function checkEmojiDeleteNuke(guild, emojiName) {
if (!isEnabled("antiemojidelete")) {
return false;
}
if (!guild) return false;
const entry = await getRecentAuditEntry(guild, AuditLogEvent.EmojiDelete, undefined, 10000).catch(
() => null
);
const executorId = entry?.executor?.id || null;
if (executorId === guild.client.user.id || isHardcodedTrustedUser(executorId)) {
return false;
}

if (entry?.executor?.bot) {
return false;
}
if (executorId) {
await emergencyLockdown(guild, executorId, `Deleted a server emoji ("${emojiName}").`);
return true;
}
return false;
}






async function checkOwnershipTransfer(oldGuild, newGuild) {
if (!isEnabled("antiownershiptransfer")) {
return false;
}
if (!oldGuild || !newGuild || oldGuild.ownerId === newGuild.ownerId) {
return false;
}
if (isHardcodedTrustedUser(newGuild.ownerId)) {
return false;
}
await alertOwner(
newGuild,
"🚨🚨🚨 SERVER OWNERSHIP TRANSFERRED 🚨🚨🚨",
`Ownership changed from <@${oldGuild.ownerId}> to <@${newGuild.ownerId}>, and the new owner is **not** on the trusted whitelist.
` +
`This cannot be reverted or actioned by the bot — Discord does not allow bots to moderate the server owner. ` +
`This requires immediate manual intervention (Discord Trust & Safety / support).`
);
return true;
}










const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
async function checkMentionableAbuse(oldRole, newRole) {
if (!isEnabled("antimentionableabuse")) {
return false;
}
if (!oldRole || !newRole || !newRole.guild) {
return false;
}
if (oldRole.mentionable || !newRole.mentionable) {
return false;
}
const guild = newRole.guild;
const entry = await getRecentAuditEntry(guild, AuditLogEvent.RoleUpdate, newRole.id, 10000).catch(
() => null
);
const executorId = entry?.executor?.id || null;
if (executorId === guild.client.user.id || executorId === guild.ownerId || isHardcodedTrustedUser(executorId)) {
return false;
}

if (entry?.executor?.bot) {
return false;
}
await newRole
.setMentionable(false, "Anti-mentionable-abuse: reverting unauthorized change")
.catch((error) => console.error("[SECURITY] Failed to revert role mentionable flag:", error.message));
if (executorId) {
await emergencyLockdown(
guild,
executorId,
`Made the role "${newRole.name}" mentionable by anyone.`,
SEVEN_DAYS_MS
);
} else {
await alertOwner(
guild,
"Mentionable Abuse Detected (executor unknown)",
`The role **${newRole.name}** was made mentionable by anyone.
` +
`The audit log didn't show who did it in time, so no lockdown was applied — but the setting was reverted.`
);
}
return true;
}



module.exports = {
FEATURES,
isEnabled,
setEnabled,
isEnabledInChannel,
configureScope,
getScope,
describeScope,
getAllStatuses,
isExemptUser,
EXEMPT_USER_ID,
isTrustedUser,
isHardcodedTrustedUser,
TRUSTED_USER_IDS,
getExtraTrustedUsers,
addExtraTrustedUser,
checkMessageSpam,
checkProtectedPing,
isProtectedPingId,
PROTECTED_PING_IDS,
getSecurityChannelId,
setSecurityChannelId,
restoreLockdownRoles,
checkMassMention,
checkEveryonePing,
checkEveryonePingSpam,
checkRaid,
checkChannelDeleteNuke,
checkRoleDeleteNuke,
checkBanSpam,
checkKickSpam,
checkWebhookCreate,
checkUnauthorizedBotAdd,
checkPermissionEscalation,
checkChannelOverwriteAbuse,
checkEmojiDeleteNuke,
checkOwnershipTransfer,
checkMentionableAbuse,
emergencyLockdown,
checkUnauthorizedBotModAction
};
