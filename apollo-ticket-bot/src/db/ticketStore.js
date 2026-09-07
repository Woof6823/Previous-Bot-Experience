const db = require('./database');

const getOpenTicketStmt = db.prepare(
  `SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open'`
);
const getTicketByChannelStmt = db.prepare(
  `SELECT * FROM tickets WHERE channel_id = ?`
);
const insertTicketStmt = db.prepare(
  `INSERT INTO tickets (channel_id, user_id, guild_id, type, status, created_at)
   VALUES (@channel_id, @user_id, @guild_id, @type, 'open', @created_at)`
);
const closeTicketStmt = db.prepare(
  `UPDATE tickets SET status = 'closed', closed_at = @closed_at WHERE channel_id = @channel_id`
);
const getCategoryStmt = db.prepare(
  `SELECT category_id FROM ticket_categories WHERE guild_id = ? AND type = ?`
);
const setCategoryStmt = db.prepare(
  `INSERT INTO ticket_categories (guild_id, type, category_id)
   VALUES (@guild_id, @type, @category_id)
   ON CONFLICT(guild_id, type) DO UPDATE SET category_id = excluded.category_id`
);
const getWelcomeChannelStmt = db.prepare(
  `SELECT welcome_channel_id FROM guild_settings WHERE guild_id = ?`
);
const setWelcomeChannelStmt = db.prepare(
  `INSERT INTO guild_settings (guild_id, welcome_channel_id)
   VALUES (@guild_id, @welcome_channel_id)
   ON CONFLICT(guild_id) DO UPDATE SET welcome_channel_id = excluded.welcome_channel_id`
);

module.exports = {
  getOpenTicket(userId, guildId) {
    return getOpenTicketStmt.get(userId, guildId);
  },
  getTicketByChannel(channelId) {
    return getTicketByChannelStmt.get(channelId);
  },
  createTicket({ channelId, userId, guildId, type }) {
    insertTicketStmt.run({
      channel_id: channelId,
      user_id: userId,
      guild_id: guildId,
      type,
      created_at: Date.now()
    });
  },
  closeTicket(channelId) {
    closeTicketStmt.run({ channel_id: channelId, closed_at: Date.now() });
  },
  getCategoryId(guildId, type) {
    const row = getCategoryStmt.get(guildId, type);
    return row ? row.category_id : null;
  },
  setCategoryId(guildId, type, categoryId) {
    setCategoryStmt.run({ guild_id: guildId, type, category_id: categoryId });
  },
  getWelcomeChannel(guildId) {
    const row = getWelcomeChannelStmt.get(guildId);
    return row ? row.welcome_channel_id : null;
  },
  setWelcomeChannel(guildId, channelId) {
    setWelcomeChannelStmt.run({ guild_id: guildId, welcome_channel_id: channelId });
  }
};
