const { PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const { OWNER_ID } = require('./config');


function isAdmin(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}


function hasModPerm(member, permission) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  for (const role of member.roles.cache.values()) {
    if (db.roleHasPerm(role.id, permission)) return true;
  }
  return false;
}

module.exports = { isAdmin, hasModPerm };
