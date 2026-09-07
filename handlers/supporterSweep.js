const { db } = require("../database");
const FORUM_CHANNEL_ID = "1509662387236769912";
const SUPPORTER_ROLE_ID = "1534318801053814825";
const PING_USER_ID = "1460942049594314772";
const SWEEP_INTERVAL_MS = 5 * 1000;
const PING_LIFETIME_MS = 30 * 1000;
const RESEND_INTERVAL_MS = 60 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 60 * 1000;
const DEEP_SWEEP_INTERVAL_MS = 10 * 60 * 1000;


db.exec(`
CREATE TABLE IF NOT EXISTS supporter_sweep_pings (
thread_id TEXT PRIMARY KEY,
pinged_at INTEGER,
last_ping_at INTEGER,
ping_message_id TEXT,
handled INTEGER NOT NULL DEFAULT 0
);
`);
try {
db.exec("ALTER TABLE supporter_sweep_pings ADD COLUMN last_ping_at INTEGER");
} catch {}
try {
db.exec("ALTER TABLE supporter_sweep_pings ADD COLUMN ping_message_id TEXT");
} catch {}
try {
db.exec("ALTER TABLE supporter_sweep_pings ADD COLUMN handled INTEGER NOT NULL DEFAULT 0");
} catch {}



try {
db.exec(
"UPDATE supporter_sweep_pings SET last_ping_at = pinged_at WHERE last_ping_at IS NULL AND pinged_at IS NOT NULL"
);
} catch {}

function getRow(threadId) {
return db.prepare("SELECT * FROM supporter_sweep_pings WHERE thread_id = ?").get(threadId);
}

function recordPing(threadId, messageId, at) {
const row = getRow(threadId);
if (!row) {
db.prepare(
"INSERT INTO supporter_sweep_pings (thread_id, pinged_at, last_ping_at, ping_message_id, handled) VALUES (?, ?, ?, ?, 0)"
).run(threadId, at, at, messageId);
} else {
db.prepare(
"UPDATE supporter_sweep_pings SET last_ping_at = ?, ping_message_id = ?, handled = 0 WHERE thread_id = ?"
).run(at, messageId, threadId);
}
}

function clearMessageId(threadId) {
db.prepare("UPDATE supporter_sweep_pings SET ping_message_id = NULL WHERE thread_id = ?").run(
threadId
);
}

function markHandled(threadId) {
const row = getRow(threadId);
const now = Date.now();
if (!row) {



db.prepare(
"INSERT INTO supporter_sweep_pings (thread_id, pinged_at, last_ping_at, ping_message_id, handled) VALUES (?, ?, ?, NULL, 1)"
).run(threadId, now, now);
} else {
db.prepare(
"UPDATE supporter_sweep_pings SET handled = 1, ping_message_id = NULL WHERE thread_id = ?"
).run(threadId);
}
}

let started = false;
let busy = false;
let clientRef = null;
let lastDeepSweep = 0;

async function deleteLivePing(thread, row) {
if (!row || !row.ping_message_id) return;
await thread.messages.delete(row.ping_message_id).catch(() => {});
clearMessageId(thread.id);
}

async function sweep(client) {
if (busy) return;
busy = true;
try {
const forum =
client.channels.cache.get(FORUM_CHANNEL_ID) ||
(await client.channels.fetch(FORUM_CHANNEL_ID).catch(() => null));
if (!forum || !forum.threads) return;


const active = await forum.threads.fetchActive().catch(() => null);

const archivedThreads = new Map();
const now = Date.now();
const doDeepSweep = now - lastDeepSweep >= DEEP_SWEEP_INTERVAL_MS;





if (doDeepSweep) {
lastDeepSweep = now;
let before = undefined;
for (let page = 0; page < 50; page++) {
const batch = await forum.threads
.fetchArchived({ limit: 100, before })
.catch(() => null);
if (!batch || batch.threads.size === 0) break;
for (const t of batch.threads.values()) archivedThreads.set(t.id, t);
if (!batch.hasMore) break;
const oldest = [...batch.threads.values()].sort(
(a, b) => (a.archivedAt?.getTime() || 0) - (b.archivedAt?.getTime() || 0)
)[0];
if (!oldest?.archivedAt) break;
before = oldest.archivedAt;
}
}

if (!active && archivedThreads.size === 0) return;

const allThreads = new Map();
if (active) for (const t of active.threads.values()) allThreads.set(t.id, t);
for (const t of archivedThreads.values()) allThreads.set(t.id, t);

for (const thread of [...allThreads.values()]) {
const ownerId = thread.ownerId;
if (!ownerId) continue;
if (client.user && ownerId === client.user.id) {
markHandled(thread.id);
continue;
}

let row = getRow(thread.id);


if (
row &&
row.ping_message_id &&
row.last_ping_at &&
now - row.last_ping_at >= PING_LIFETIME_MS
) {
await deleteLivePing(thread, row);
row = getRow(thread.id);
}


if (row && row.handled) continue;

const member = await thread.guild.members
.fetch({ user: ownerId, force: true })
.catch(() => null);

if (!member) {




await deleteLivePing(thread, row);
await thread
.delete("Creator-code sweep: thread creator is no longer in the server")
.catch((err) => {
console.error(`[supporterSweep] Failed to delete thread ${thread.id}:`, err.message);
});
markHandled(thread.id);
continue;
}

if (member.user.bot) {
await deleteLivePing(thread, row);
markHandled(thread.id);
continue;
}

if (member.roles.cache.has(SUPPORTER_ROLE_ID)) {

await deleteLivePing(thread, row);
markHandled(thread.id);
continue;
}



const due =
!row ||
!row.last_ping_at ||
(now - row.last_ping_at >= RESEND_INTERVAL_MS && !row.ping_message_id);

if (!due) continue;

const sent = await thread
.send(
`<@${PING_USER_ID}> — the creator of this thread (<@${ownerId}>) doesn't have the Surge Supporter role yet.`
)
.catch(() => null);

if (sent) {
recordPing(thread.id, sent.id, now);
} else {

recordPing(thread.id, null, now - RESEND_INTERVAL_MS + RETRY_AFTER_FAIL_MS);
}
}
} catch (err) {
console.error("[supporterSweep] sweep failed:", err.message);
} finally {
busy = false;
}
}



async function clearPendingPing(threadId) {
const row = getRow(threadId);
if (!row) return;
if (row.ping_message_id && clientRef) {
const thread = clientRef.channels.cache.get(threadId);
if (thread) await thread.messages.delete(row.ping_message_id).catch(() => {});
}
markHandled(threadId);
}

function ensureStarted(client) {
clientRef = client;
if (started) return;
started = true;
sweep(client);
setInterval(() => sweep(client), SWEEP_INTERVAL_MS);
}

module.exports = { ensureStarted, clearPendingPing };
