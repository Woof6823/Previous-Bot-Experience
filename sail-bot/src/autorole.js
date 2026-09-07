const db = require('./database');
const { SETTINGS_KEYS } = require('./config');

async function applyAutoRole(member) {
  const roleId = db.getSetting(SETTINGS_KEYS.AUTOROLE_ID);
  if (!roleId) return;

  const role = member.guild.roles.cache.get(roleId);
  if (!role) return;

  await member.roles.add(role).catch(() => {});
}

module.exports = { applyAutoRole };
