const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const { db } = require("../database");



const database = require("../database");
const config = require("../config");
const renderer = require("./statsCardRenderer");


let xpManager = null;
try {
xpManager = require("./xpManager");
} catch {
xpManager = null;
}




db.exec(`
CREATE TABLE IF NOT EXISTS channel_user_stats (
channel_id TEXT NOT NULL,
user_id TEXT NOT NULL,
day TEXT NOT NULL,
count INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY (channel_id, user_id, day)
);
`);


const STATS_CHANNEL_ID = "1533983501941211196";
const RANGE_ORDER = [1, 7, 14, 30, 0];
function rangeLabel(r) {
return r === 0 ? "Lifetime" : `Last ${r} day${r === 1 ? "" : "s"}`;
}
function nextRange(r) {
return RANGE_ORDER[(RANGE_ORDER.indexOf(r) + 1) % RANGE_ORDER.length];
}
function dayKey(ts) {
return new Date(ts).toISOString().slice(0, 10);
}
function cutoffDay(days) {
return dayKey(Date.now() - days * 86400000);
}

function getMessageTotal(userId, days) {
try {
if (!days)
return db
.prepare("SELECT COALESCE(SUM(count),0) t FROM message_daily_stats WHERE user_id=?")
.get(userId).t;
return db
.prepare(
"SELECT COALESCE(SUM(count),0) t FROM message_daily_stats WHERE user_id=? AND day>=?"
)
.get(userId, cutoffDay(days)).t;
} catch {
return 0;
}
}
function getVoiceSeconds(userId, days) {
try {
if (!days)
return db
.prepare("SELECT COALESCE(SUM(seconds),0) t FROM voice_daily_stats WHERE user_id=?")
.get(userId).t;
return db
.prepare(
"SELECT COALESCE(SUM(seconds),0) t FROM voice_daily_stats WHERE user_id=? AND day>=?"
)
.get(userId, cutoffDay(days)).t;
} catch {
return 0;
}
}


function getLevel(userId) {
try {
const row = typeof database.getLevelRow === "function" ? database.getLevelRow(userId) : null;
const xp = row && row.xp ? row.xp : 0;
if (xpManager && typeof xpManager.levelFromXp === "function") {
return xpManager.levelFromXp(xp);
}

const baseXp = (config.levels && config.levels.baseXp) || 100;
const xpStep = (config.levels && config.levels.xpStep) || 75;
let level = 0,
total = 0;
for (;;) {
const next = total + baseXp + level * xpStep;
if (next > xp) break;
total = next;
level++;
}
return level;
} catch {
return 0;
}
}
function getRank(kind, userId, days) {
try {
const table = kind === "messages" ? "message_daily_stats" : "voice_daily_stats";
const col = kind === "messages" ? "count" : "seconds";
const total =
kind === "messages" ? getMessageTotal(userId, days) : getVoiceSeconds(userId, days);
const where = days ? "WHERE day>=?" : "";
const params = days ? [cutoffDay(days), total] : [total];
const row = db
.prepare(
`SELECT COUNT(*) c FROM (SELECT SUM(${col}) t FROM ${table} ${where} GROUP BY user_id HAVING t > ?)`
)
.get(...params);
return row.c + 1;
} catch {
return 1;
}
}
function getSeries(userId, days) {
const n = Math.min(days === 0 ? 30 : days, 30);
const labels = [],
messages = [],
voiceHours = [];
const mRows = new Map(),
vRows = new Map();
try {
for (const r of db
.prepare("SELECT day,count FROM message_daily_stats WHERE user_id=? AND day>=?")
.all(userId, cutoffDay(n)))
mRows.set(r.day, r.count);
} catch {}
try {
for (const r of db
.prepare("SELECT day,seconds FROM voice_daily_stats WHERE user_id=? AND day>=?")
.all(userId, cutoffDay(n)))
vRows.set(r.day, r.seconds);
} catch {}
for (let i = n - 1; i >= 0; i--) {
const d = new Date(Date.now() - i * 86400000);
labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
messages.push(mRows.get(dayKey(d.getTime())) || 0);
voiceHours.push(+((vRows.get(dayKey(d.getTime())) || 0) / 3600).toFixed(2));
}
return { labels, messages, voiceHours };
}






function getTopMessageChannel(userId, days) {
try {
const sql = days
? "SELECT channel_id, SUM(count) c FROM channel_user_stats WHERE user_id=? AND day>=? GROUP BY channel_id ORDER BY c DESC LIMIT 1"
: "SELECT channel_id, SUM(count) c FROM channel_user_stats WHERE user_id=? GROUP BY channel_id ORDER BY c DESC LIMIT 1";
const params = days ? [userId, cutoffDay(days)] : [userId];
return db.prepare(sql).get(...params);
} catch {

const cutoff = Date.now() - (days || 3650) * 86400000;
try {
return db
.prepare(
"SELECT channel_id, COUNT(*) c FROM message_log WHERE author_id=? AND created_at>=? GROUP BY channel_id ORDER BY c DESC LIMIT 1"
)
.get(userId, cutoff);
} catch {
try {
return db
.prepare(
"SELECT channel_id, COUNT(*) c FROM message_log WHERE author_id=? GROUP BY channel_id ORDER BY c DESC LIMIT 1"
)
.get(userId);
} catch {
return null;
}
}
}
}
function getTopUsers(metric, days, limit, offset) {
try {
let sql, params;
if (metric === "voice") {
sql = "SELECT user_id, SUM(seconds) t FROM voice_daily_stats";
if (days) {
sql += " WHERE day>=?";
params = [cutoffDay(days)];
} else params = [];
} else {
sql = "SELECT user_id, SUM(count) t FROM message_daily_stats";
if (days) {
sql += " WHERE day>=?";
params = [cutoffDay(days)];
} else params = [];
}
sql += " GROUP BY user_id ORDER BY t DESC LIMIT ? OFFSET ?";
return db.prepare(sql).all(...params, limit, offset);
} catch {
return [];
}
}
function countActive(metric, days) {
try {
const table = metric === "voice" ? "voice_daily_stats" : "message_daily_stats";
const sql =
`SELECT COUNT(*) c FROM (SELECT user_id FROM ${table}` +
(days ? " WHERE day>=?" : "") +
" GROUP BY user_id)";
return db.prepare(sql).get(...(days ? [cutoffDay(days)] : [])).c;
} catch {
return 0;
}
}
function fmtDate(ms) {
if (!ms) return "—";
return new Date(ms).toLocaleDateString("en-US", {
month: "long",
day: "numeric",
year: "numeric"
});
}
function getStreak(series) {
let streak = 0;
for (let i = series.messages.length - 1; i >= 0; i--) {
if (series.messages[i] > 0) streak++;
else break;
}
return streak;
}
function getTrendPct(series) {
const m = series.messages;
if (m.length < 2) return null;
const today = m[m.length - 1],
yesterday = m[m.length - 2];
if (!yesterday) return null;
return Math.round(((today - yesterday) / yesterday) * 100);
}
function getScore(msgRank, voiceRank, days) {
try {
const cut = cutoffDay(days || 14);
const a = db
.prepare("SELECT COUNT(DISTINCT user_id) c FROM message_daily_stats WHERE day>=?")
.get(cut).c;
const b = db
.prepare("SELECT COUNT(DISTINCT user_id) c FROM voice_daily_stats WHERE day>=?")
.get(cut).c;
const n = Math.max(a, b, 1);
const pM = 1 - (Math.min(msgRank, n) - 1) / n;
const pV = 1 - (Math.min(voiceRank, n) - 1) / n;
return Math.max(1, Math.min(100, Math.round(100 * (0.6 * pM + 0.4 * pV))));
} catch {
return 50;
}
}

function statsButtons(ownerId, targetId, range, view, ts) {
const base = (kind) => `stats_${kind}_${ownerId}_${targetId}_${range}_${view}`;
return [
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(base("graph"))
.setLabel(view === "full" ? "View Graph" : "View Card")
.setStyle(ButtonStyle.Primary),
new ButtonBuilder()
.setCustomId(base("range"))
.setLabel(`Range: ${range === 0 ? "Lifetime" : range + "d"}`)
.setStyle(ButtonStyle.Secondary),
new ButtonBuilder()
.setCustomId(base("refresh") + `_${ts}`)
.setLabel("Refresh")
.setStyle(ButtonStyle.Success)
)
];
}


function topstatsButtons(metric, range, page, totalPages, ts) {
const tab = (m, label) =>
new ButtonBuilder()
.setCustomId(`topstats_m_${m}_${range}_${page}`)
.setLabel(label)
.setStyle(m === metric ? ButtonStyle.Primary : ButtonStyle.Secondary)
.setDisabled(m === metric);
return [
new ActionRowBuilder().addComponents(tab("messages", "Messages"), tab("voice", "Voice")),
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`topstats_r_${metric}_${nextRange(range)}_${page}`)
.setLabel(`Range: ${range === 0 ? "Lifetime" : range + "d"}`)
.setStyle(ButtonStyle.Secondary),
new ButtonBuilder()
.setCustomId(`topstats_p_${metric}_${range}_${page - 1}`)
.setLabel("Prev")
.setStyle(ButtonStyle.Secondary)
.setDisabled(page <= 0),
new ButtonBuilder()
.setCustomId("topstats_info")
.setLabel(`${page + 1} / ${totalPages}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),
new ButtonBuilder()
.setCustomId(`topstats_p_${metric}_${range}_${page + 1}`)
.setLabel("Next")
.setStyle(ButtonStyle.Secondary)
.setDisabled(page >= totalPages - 1),
new ButtonBuilder()
.setCustomId(`topstats_f_${metric}_${range}_${page}_${ts}`)
.setLabel("Refresh")
.setStyle(ButtonStyle.Success)
)
];
}

async function buildStatsPayload(guild, targetId, range, view, ownerId, ts) {
const member = await guild.members.fetch(targetId).catch(() => null);
const user = member?.user || (await guild.client.users.fetch(targetId).catch(() => null));
if (!user) throw new Error("Couldn't find that user.");
const subRanges =
range === 1
? [1]
: range === 7
? [1, 7]
: range === 30
? [1, 7, 14, 30]
: range === 0
? [1, 7, 14, 30, 0]
: [1, 7, 14];
const series = getSeries(targetId, range);
const msgRank = getRank("messages", targetId, range);
const voiceRank = getRank("voice", targetId, range);
const topMsg = getTopMessageChannel(targetId, range === 0 ? 30 : range);

const topChannels = [];
if (topMsg) {
topChannels.push({
icon: "hash",
name: guild.channels.cache.get(topMsg.channel_id)?.name || "unknown",
value: topMsg.c >= 1000 ? (topMsg.c / 1000).toFixed(2) + "k" : String(topMsg.c),
unit: "msgs"
});
}
const voiceSec = getVoiceSeconds(targetId, range === 0 ? 30 : range);
topChannels.push({
icon: "speaker",
name: "voice activity",
value: voiceSec > 0 ? (voiceSec / 3600).toFixed(2) : null,
unit: "hours"
});
const data = {
serverName: guild.name,
serverIconUrl: guild.iconURL({ size: 64 }),
displayName: member?.displayName || user.username,
username: user.username,
avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
createdLabel: fmtDate(user.createdTimestamp),
joinedLabel: fmtDate(member?.joinedTimestamp),
level: getLevel(targetId),
msgRank,
voiceRank,
score: getScore(msgRank, voiceRank, range === 0 ? 14 : range),
streak: getStreak(series),
trendPct: getTrendPct(series),
messageRows: subRanges.map((r) => ({
label: r === 0 ? "LT" : `${r}d`,
value: getMessageTotal(targetId, r)
})),
voiceRows: subRanges.map((r) => ({
label: r === 0 ? "LT" : `${r}d`,
hours: getVoiceSeconds(targetId, r) / 3600
})),
topChannels,
series,
lookbackLabel: rangeLabel(range)
};
const buf =
view === "graph" ? await renderer.renderStatsGraph(data) : await renderer.renderStatsCard(data);
if (!buf) throw new Error("Stats renderer unavailable on this host.");
return {
files: [new AttachmentBuilder(buf, { name: "stats.png" })],
components: statsButtons(ownerId, targetId, range, view, ts)
};
}
async function buildTopStatsPayload(guild, metric, range, page, ts) {


if (metric !== "voice") metric = "messages";
const totalUsers = countActive(metric, range);
const totalPages = Math.max(1, Math.ceil(totalUsers / 10));
const safePage = Math.min(Math.max(page, 0), totalPages - 1);
const raw = getTopUsers(metric, range, 10, safePage * 10);
const rows = [];
for (let i = 0; i < raw.length; i++) {
const m = await guild.members.fetch(raw[i].user_id).catch(() => null);
const u = m?.user || (await guild.client.users.fetch(raw[i].user_id).catch(() => null));
rows.push({
rank: safePage * 10 + i + 1,
name: m?.displayName || u?.username || `User ${raw[i].user_id}`,
avatarUrl: u ? u.displayAvatarURL({ extension: "png", size: 64 }) : null,
total: raw[i].t
});
}
const metricLabel = metric === "voice" ? "Voice Hours" : "Messages";
const accent = metric === "voice" ? "#e0447c" : "#23a55a";
const format =
metric === "voice"
? (s) => (s / 3600).toFixed(1) + "h"
: (n) => (n >= 1000 ? (n / 1000).toFixed(2) + "k" : String(n));
const buf = await renderer.renderTopStatsCard({
serverName: guild.name,
serverIconUrl: guild.iconURL({ size: 64 }),
rows,
metricLabel,
lookbackLabel: rangeLabel(range),
accent,
format,
page: safePage,
totalPages,
totalUsers
});
if (!buf) throw new Error("Stats renderer unavailable on this host.");
return {
files: [new AttachmentBuilder(buf, { name: "topstats.png" })],
components: topstatsButtons(metric, range, safePage, totalPages, ts)
};
}
module.exports = { STATS_CHANNEL_ID, buildStatsPayload, buildTopStatsPayload, rangeLabel };
