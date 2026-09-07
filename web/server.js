const express = require("express");
const cors = require("cors");
const rosterConfig = require("../data/rosterConfig");
const roleTimelineManager = require("../handlers/roleTimelineManager");
const db = require("../database");

function serializeMember(member, since) {
if (!member) return null;
return {
userId: member.id,
displayName: member.displayName || member.user.username,
username: member.user.username,
avatarUrl: member.displayAvatarURL({ extension: "png", size: 256 }),
since,



accounts: db.getSocialAccounts(member.id)
};
}

async function buildSection(guild, list, sectionKey) {
const out = [];
for (const entry of list) {


const member = guild.members.cache.get(entry.userId);
if (!member) continue;
const since = roleTimelineManager.getSince(entry.userId, sectionKey);
out.push({ ...serializeMember(member, since), label: entry.label });
}
return out;
}

async function buildProsSection(guild) {
const roleId = rosterConfig.prosRoleId;
if (!roleId) return [];
const role = guild.roles.cache.get(roleId);
if (!role) return [];

const out = [];
for (const [, member] of role.members) {
let since = roleTimelineManager.getSince(member.id, roleId);
if (!since) {

roleTimelineManager.recordSince(member.id, roleId, Date.now());
since = Date.now();
}
out.push(serializeMember(member, since));
}
return out;
}

const crypto = require("crypto");

function requireApiKey(req, res, next) {
const expected = process.env.WEB_API_KEY;
if (!expected) {
return res.status(500).json({ error: "WEB_API_KEY not configured on the bot." });
}
const provided = req.headers["x-api-key"];


const a = Buffer.from(String(provided || ""), "utf8");
const b = Buffer.from(expected, "utf8");
const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
if (!valid) {
return res.status(401).json({ error: "Invalid or missing API key." });
}
next();
}

function startRosterApi(client) {
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.get("/health", (req, res) => {
res.json({ status: "ok", botOnline: !!client?.isReady?.(), timestamp: Date.now() });
});
app.get("/api/roster", requireApiKey, async (req, res) => {
try {
const guildId = process.env.GUILD_ID;
const guild = client.guilds.cache.get(guildId);
if (!guild) {
return res.status(500).json({ error: "Guild not found in cache." });
}
const [operations, directors, board, pros] = await Promise.all([
buildSection(guild, rosterConfig.operations, "ops"),
buildSection(guild, rosterConfig.directors, "directors"),
buildSection(guild, rosterConfig.board, "board"),
buildProsSection(guild)
]);
res.json({
operations,
directors,
board,
pros,
updatedAt: Date.now()
});
} catch (err) {
console.error("Roster API error:", err);
res.status(500).json({ error: "Failed to build roster." });
}
});
const port = process.env.WEB_API_PORT || 8085;
app.listen(port, () => {
console.log(`🌐 Surge roster API listening on port ${port}`);
});
}

module.exports = { startRosterApi };
