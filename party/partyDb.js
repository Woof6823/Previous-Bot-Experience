const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");




const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "surge-party.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL,
  owner_name TEXT,
  party_name TEXT,
  platform TEXT NOT NULL,          -- 'youtube' | 'twitch'
  stream_url TEXT NOT NULL,
  video_id_or_channel TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public', -- 'public' | 'private'
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  ended INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_parties_visibility ON parties(visibility, ended, last_active);
`);

function generateId() {
  return crypto.randomBytes(6).toString("hex");
}

function generateOwnerToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createParty({ ownerName, partyName, platform, streamUrl, videoIdOrChannel, visibility }) {
  const id = generateId();
  const ownerToken = generateOwnerToken();
  const now = Date.now();

  db.prepare(
    `INSERT INTO parties
      (id, owner_token_hash, owner_name, party_name, platform, stream_url, video_id_or_channel, visibility, created_at, last_active, ended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    id,
    hashToken(ownerToken),
    ownerName || null,
    partyName || null,
    platform,
    streamUrl,
    videoIdOrChannel,
    visibility === "private" ? "private" : "public",
    now,
    now
  );

  return { party: getParty(id), ownerToken };
}

function getParty(id) {
  return db.prepare("SELECT * FROM parties WHERE id = ?").get(id) || null;
}

function isOwner(id, ownerToken) {
  if (!ownerToken) return false;
  const party = getParty(id);
  if (!party) return false;




  const a = Buffer.from(party.owner_token_hash, "utf8");
  const b = Buffer.from(hashToken(ownerToken), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function updateParty(id, { partyName, visibility }) {
  const party = getParty(id);
  if (!party) return null;

  db.prepare(
    `UPDATE parties SET
       party_name = COALESCE(?, party_name),
       visibility = COALESCE(?, visibility)
     WHERE id = ?`
  ).run(
    partyName ?? null,
    visibility === "public" || visibility === "private" ? visibility : null,
    id
  );

  return getParty(id);
}

function endParty(id) {
  db.prepare("UPDATE parties SET ended = 1 WHERE id = ?").run(id);
}

function heartbeat(id) {
  db.prepare("UPDATE parties SET last_active = ? WHERE id = ?").run(Date.now(), id);
}


function getPublicActiveParties(limit = 50) {
  const cutoff = Date.now() - 10 * 60 * 1000;
  return db
    .prepare(
      `SELECT * FROM parties
       WHERE visibility = 'public' AND ended = 0 AND last_active >= ?
       ORDER BY last_active DESC
       LIMIT ?`
    )
    .all(cutoff, limit);
}

module.exports = {
  createParty,
  getParty,
  isOwner,
  updateParty,
  endParty,
  heartbeat,
  getPublicActiveParties
};
