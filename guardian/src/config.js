require("dotenv").config();

function splitIds(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  prefix: process.env.PREFIX || "*",

  ownerIds: splitIds(process.env.OWNER_IDS),
  initialWhitelistIds: splitIds(process.env.WHITELIST_IDS),

  staffRoleId: process.env.STAFF_ROLE_ID || null,

  securityChannelId: process.env.SECURITY_CHANNEL_ID || null,
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID || null,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  levelUpChannelId: process.env.LEVEL_UP_CHANNEL_ID || null,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || null,
  ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || null,
  ticketLogChannelId: process.env.TICKET_LOG_CHANNEL_ID || null,
  ticketStaffRoleId: process.env.TICKET_STAFF_ROLE_ID || null,

  brandColor: process.env.BRAND_COLOR || "#5865F2",
  serverName: process.env.SERVER_NAME || "the server",

  databasePath: process.env.DATABASE_PATH || "./data/bot.sqlite",


  defaults: {
    banThreshold: 2,
    banWindowMs: 3 * 60 * 1000,
    kickThreshold: 2,
    kickWindowMs: 3 * 60 * 1000,
    mentionThreshold: 3,
    mentionWindowMs: 60 * 1000,
    modActionRateLimit: 10,
    modActionWindowMs: 60 * 1000,
    securityTimeoutMs: 24 * 60 * 60 * 1000
  },

  levels: {
    baseXp: 100,
    xpStep: 50,
    xpPerMessageMin: 15,
    xpPerMessageMax: 25,
    xpCooldownMs: 60 * 1000
  }
};
