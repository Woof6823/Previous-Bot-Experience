const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    channel_id   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    guild_id     TEXT NOT NULL,
    type         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    created_at   INTEGER NOT NULL,
    closed_at    INTEGER
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_ticket_per_user
    ON tickets(user_id, guild_id)
    WHERE status = 'open';

  CREATE TABLE IF NOT EXISTS ticket_categories (
    guild_id      TEXT NOT NULL,
    type          TEXT NOT NULL,
    category_id   TEXT NOT NULL,
    PRIMARY KEY (guild_id, type)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id            TEXT PRIMARY KEY,
    welcome_channel_id  TEXT
  );
`);

module.exports = db;
