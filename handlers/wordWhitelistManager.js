const { db } = require("../database");







db.exec(`
CREATE TABLE IF NOT EXISTS word_filter_whitelist (
    user_id TEXT PRIMARY KEY,
    added_by TEXT,
    added_at INTEGER NOT NULL
);
`);

function addWhitelist(userId, addedBy) {
  db.prepare(
    `INSERT INTO word_filter_whitelist (user_id, added_by, added_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
            added_by = excluded.added_by,
            added_at = excluded.added_at`
  ).run(userId, addedBy || null, Date.now());
}

function removeWhitelist(userId) {
  const result = db.prepare("DELETE FROM word_filter_whitelist WHERE user_id = ?").run(userId);
  return result.changes > 0;
}

function isWhitelisted(userId) {
  return !!db.prepare("SELECT 1 FROM word_filter_whitelist WHERE user_id = ?").get(userId);
}

function getAllWhitelisted() {
  return db.prepare("SELECT * FROM word_filter_whitelist ORDER BY added_at DESC").all();
}

module.exports = { addWhitelist, removeWhitelist, isWhitelisted, getAllWhitelisted };
