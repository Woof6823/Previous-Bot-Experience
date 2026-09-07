const db = require("../database");

const activeUnbanTimers = new Map();
const MAX_TIMEOUT_MS = 2147483647;

function scheduleUnban(client, guildId, userId, tempBanId, unbanAt) {
  const existing = activeUnbanTimers.get(tempBanId);
  if (existing) clearTimeout(existing);

  const delay = Math.max(unbanAt - Date.now(), 0);

  if (delay > MAX_TIMEOUT_MS) {

    const timeout = setTimeout(() => {
      scheduleUnban(client, guildId, userId, tempBanId, unbanAt);
    }, MAX_TIMEOUT_MS);
    activeUnbanTimers.set(tempBanId, timeout);
    return;
  }

  const timeout = setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      await guild.members.unban(userId, "Temporary ban expired.").catch(() => {});
      db.deactivateTempBan(tempBanId);
      activeUnbanTimers.delete(tempBanId);
    } catch (err) {
      console.error("Failed to auto-unban:", err.message);
    }
  }, delay);
  activeUnbanTimers.set(tempBanId, timeout);
}

function restoreBans(client) {
  const bans = db.getActiveTempBans();
  for (const ban of bans) {
    scheduleUnban(client, ban.guild_id, ban.user_id, ban.id, ban.unban_at);
  }
  if (bans.length > 0) {
    console.log(`Restored ${bans.length} active temp ban timer(s) from database.`);
  }
}

function cancelUnbanTimer(tempBanId) {
  const timeout = activeUnbanTimers.get(tempBanId);
  if (timeout) {
    clearTimeout(timeout);
    activeUnbanTimers.delete(tempBanId);
  }
}

module.exports = { scheduleUnban, restoreBans, cancelUnbanTimer };
