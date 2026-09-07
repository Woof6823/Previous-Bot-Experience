const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const rosterConfig = require("../data/rosterConfig");
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });



const db = new Database(path.join(dataDir, "surge-bot.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS role_timeline (
user_id TEXT NOT NULL,
role_id TEXT NOT NULL,
since INTEGER NOT NULL,
PRIMARY KEY (user_id, role_id)
);
`);

function recordSince(userId, roleId, whenMs) {
const existing = db
.prepare("SELECT since FROM role_timeline WHERE user_id = ? AND role_id = ?")
.get(userId, roleId);
if (existing) {
if (whenMs < existing.since) {
db.prepare(
"UPDATE role_timeline SET since = ? WHERE user_id = ? AND role_id = ?"
).run(whenMs, userId, roleId);
}
return;
}
db.prepare(
"INSERT INTO role_timeline (user_id, role_id, since) VALUES (?, ?, ?)"
).run(userId, roleId, whenMs);
}

function getSince(userId, roleId) {
const row = db
.prepare("SELECT since FROM role_timeline WHERE user_id = ? AND role_id = ?")
.get(userId, roleId);
return row ? row.since : null;
}






async function backfillFromGuild(guild) {
const now = Date.now();
const staticSections = [
["ops", rosterConfig.operations],
["directors", rosterConfig.directors],
["board", rosterConfig.board]
];

for (const [sectionKey, list] of staticSections) {
for (const entry of list) {
const member = guild.members.cache.get(entry.userId);
if (!member) continue;
if (!getSince(entry.userId, sectionKey)) {
recordSince(entry.userId, sectionKey, now);
}
}
}

const prosRoleId = rosterConfig.prosRoleId;
if (prosRoleId) {
const role = guild.roles.cache.get(prosRoleId);
if (role) {
for (const [, member] of role.members) {
if (!getSince(member.id, prosRoleId)) {
recordSince(member.id, prosRoleId, now);
}
}
}
}
}



function handleRoleUpdate(oldMember, newMember) {
const prosRoleId = rosterConfig.prosRoleId;
if (!prosRoleId) return;
const hadPros = oldMember.roles.cache.has(prosRoleId);
const hasPros = newMember.roles.cache.has(prosRoleId);
if (!hadPros && hasPros) {
recordSince(newMember.id, prosRoleId, Date.now());
}
}

module.exports = {
backfillFromGuild,
handleRoleUpdate,
getSince,
recordSince
};
