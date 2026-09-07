const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS ticket_counters (
    type TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS active_tickets (
    user_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    type TEXT NOT NULL,
    ticket_number INTEGER NOT NULL,
    claimed_by TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    type TEXT PRIMARY KEY,
    category_id TEXT NOT NULL
  );
`);

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

function nextTicketNumber(type) {
  db.prepare(
    'INSERT INTO ticket_counters (type, count) VALUES (?, 1) ON CONFLICT(type) DO UPDATE SET count = count + 1'
  ).run(type);
  const row = db.prepare('SELECT count FROM ticket_counters WHERE type = ?').get(type);
  return row.count;
}

function getActiveTicketForUser(userId) {
  return db.prepare('SELECT * FROM active_tickets WHERE user_id = ?').get(userId);
}

function createActiveTicket(userId, channelId, type, ticketNumber) {
  db.prepare(
    'INSERT INTO active_tickets (user_id, channel_id, type, ticket_number) VALUES (?, ?, ?, ?)'
  ).run(userId, channelId, type, ticketNumber);
}

function removeActiveTicketByChannel(channelId) {
  db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
}

function getActiveTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM active_tickets WHERE channel_id = ?').get(channelId);
}

function setTicketClaimed(channelId, staffId) {
  db.prepare('UPDATE active_tickets SET claimed_by = ? WHERE channel_id = ?').run(staffId, channelId);
}

function setCategoryId(type, categoryId) {
  db.prepare(
    'INSERT INTO categories (type, category_id) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET category_id = excluded.category_id'
  ).run(type, categoryId);
}

function getCategoryId(type) {
  const row = db.prepare('SELECT category_id FROM categories WHERE type = ?').get(type);
  return row ? row.category_id : null;
}

module.exports = {
  db,
  getConfig,
  setConfig,
  nextTicketNumber,
  getActiveTicketForUser,
  createActiveTicket,
  removeActiveTicketByChannel,
  getActiveTicketByChannel,
  setTicketClaimed,
  setCategoryId,
  getCategoryId,
};
