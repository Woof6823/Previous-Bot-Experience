const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");
const settings = require("../settings");
const levelCardRenderer = require("./levelCardRenderer");
function xpNeededForLevel(level) {
let total = 0;
for (let i = 0; i < level; i++) {
total += config.levels.baseXp + i * config.levels.xpStep;
}
return total;
}
function levelFromXp(xp) {
let level = 0;
while (xpNeededForLevel(level + 1) <= xp) level++;
return level;
}
function getLevelRoleForLevel(level) {
const levelRoles = settings.getObject("levelRoles");
const thresholds = Object.keys(levelRoles)
.map(Number)
.sort((a, b) => a - b);
let roleId = null;
for (const threshold of thresholds) {
if (level >= threshold) roleId = levelRoles[threshold];
}
return roleId;
}
async function applyLevelRole(member, level) {
const correctRoleId = getLevelRoleForLevel(level);
const allLevelRoleIds = Object.values(settings.getObject("levelRoles"));
const toRemove = allLevelRoleIds.filter(
(id) => id !== correctRoleId && member.roles.cache.has(id)
);
for (const id of toRemove) {
await member.roles.remove(id).catch(() => {});
}
if (correctRoleId && !member.roles.cache.has(correctRoleId)) {
await member.roles.add(correctRoleId).catch(() => {});
}
}
async function reapplyLevelRole(member) {
const row = db.getLevelRow(member.id);
const level = levelFromXp(row.xp);
await applyLevelRole(member, level);
}
async function announceLevelUp(guild, userId, newLevel) {
const channel = guild.channels.cache.get(settings.get("levelUpChannelId"));
const rank = db.getXpRank(userId);
if (!channel) {
console.warn(
`⚠️  Level-up channel ${settings.get("levelUpChannelId")} not found in this guild.`
);
return;
}
const member = await guild.members.fetch(userId).catch(() => null);
const user = member?.user || (await guild.client.users.fetch(userId).catch(() => null));
const username = member?.displayName || user?.username || `User ${userId}`;
const avatarUrl = user ? user.displayAvatarURL({ extension: "png", size: 128 }) : null;
const card = await levelCardRenderer.renderLevelUpCard({
username,
avatarUrl,
level: newLevel,
rank
});
if (card) {
await channel
.send({
content: `<@${userId}>`,
files: [new AttachmentBuilder(card, { name: "level-up.png" })]
})
.catch(() => {});
return;
}

const embed = new EmbedBuilder()
.setColor(config.brandColor)
.setTitle("🎉 Level Up!")
.setDescription(
`<@${userId}> just reached **Level ${newLevel}**!
` +
`📊 Current leaderboard spot: **#${rank}**
` +
`Check it out with \`*level\` or \`*leaderboard\` in <#${settings.get("levelLeaderboardChannelId")}>`
);
await channel.send({ content: `<@${userId}>`, embeds: [embed] }).catch(() => {});
}
async function awardXp(guild, userId, amount) {
const { oldXp, newXp } = db.addXp(userId, amount);
const oldLevel = levelFromXp(oldXp);
const newLevel = levelFromXp(newXp);
if (newLevel > oldLevel) {
const member = await guild.members.fetch(userId).catch(() => null);
if (member) await applyLevelRole(member, newLevel).catch(() => {});
await announceLevelUp(guild, userId, newLevel).catch(() => {});
}
}
module.exports = {
xpNeededForLevel,
levelFromXp,
awardXp,
announceLevelUp,
getLevelRoleForLevel,
applyLevelRole,
reapplyLevelRole
};
