const db = require("../database");
const whitelistService = require("./whitelistService");
const configService = require("./configService");


function isStaff(member) {
  const settings = configService.getSettings(member.guild.id);
  if (!settings.staffRoleId) return false;
  return member.roles.cache.has(settings.staffRoleId);
}


function hasFullAccess(guildId, userId) {
  return whitelistService.isWhitelisted(guildId, userId);
}


function canModerate(member, capability) {
  if (!member || !member.guild) return { allowed: false, reason: "Could not resolve member." };
  if (hasFullAccess(member.guild.id, member.id)) return { allowed: true };
  if (isStaff(member)) return { allowed: true };

  const permMap = {
    warn: "ModerateMembers",
    mute: "ModerateMembers",
    kick: "KickMembers",
    ban: "BanMembers",
    role: "ManageRoles",
    purge: "ManageMessages"
  };
  const perm = permMap[capability];
  if (perm && member.permissions.has(perm)) return { allowed: true };
  return { allowed: false, reason: "You do not have permission to do that." };
}

function highestRolePosition(member) {
  return member.roles.highest.position;
}


function canActOnTarget(executorMember, targetMember) {
  if (!targetMember) return { allowed: true };
  if (hasFullAccess(executorMember.guild.id, executorMember.id)) return { allowed: true };
  if (executorMember.id === executorMember.guild.ownerId) return { allowed: true };
  if (targetMember.id === targetMember.guild.ownerId) {
    return { allowed: false, reason: "You cannot act on the server owner." };
  }
  if (highestRolePosition(executorMember) <= highestRolePosition(targetMember)) {
    return { allowed: false, reason: "You cannot act on someone with an equal or higher role than you." };
  }
  return { allowed: true };
}


function canBotActOnTarget(guild, targetMember) {
  if (!targetMember) return { allowed: true };
  const me = guild.members.me;
  if (!me) return { allowed: false, reason: "Bot member not resolvable." };
  if (targetMember.id === guild.ownerId) return { allowed: false, reason: "Cannot act on the server owner." };
  if (highestRolePosition(me) <= highestRolePosition(targetMember)) {
    return { allowed: false, reason: "My highest role is not above the target's highest role." };
  }
  return { allowed: true };
}


function canManageRole(executorMember, role, guild) {
  if (hasFullAccess(guild.id, executorMember.id)) {
    if (role.id === guild.roles.everyone.id) return { allowed: false, reason: "Cannot modify @everyone." };
    return { allowed: true };
  }
  if (role.id === guild.roles.everyone.id) return { allowed: false, reason: "Cannot modify @everyone." };
  if (isProtectedRole(guild.id, role.id)) return { allowed: false, reason: "That role is protected." };
  if (highestRolePosition(executorMember) <= role.position) {
    return { allowed: false, reason: "You can only manage roles below your highest role." };
  }
  const me = guild.members.me;
  if (highestRolePosition(me) <= role.position) {
    return { allowed: false, reason: "My highest role is not above that role — I cannot manage it." };
  }
  return { allowed: true };
}

function isProtectedRole(guildId, roleId) {
  return !!db.prepare(`SELECT 1 FROM protected_roles WHERE guildId = ? AND roleId = ?`).get(guildId, roleId);
}

function isProtectedChannel(guildId, channelId) {
  return !!db
    .prepare(`SELECT 1 FROM protected_channels WHERE guildId = ? AND channelId = ?`)
    .get(guildId, channelId);
}

function addProtectedRole(guildId, roleId) {
  db.prepare(`INSERT OR IGNORE INTO protected_roles (guildId, roleId) VALUES (?, ?)`).run(guildId, roleId);
}
function removeProtectedRole(guildId, roleId) {
  db.prepare(`DELETE FROM protected_roles WHERE guildId = ? AND roleId = ?`).run(guildId, roleId);
}
function addProtectedChannel(guildId, channelId) {
  db.prepare(`INSERT OR IGNORE INTO protected_channels (guildId, channelId) VALUES (?, ?)`).run(
    guildId,
    channelId
  );
}
function removeProtectedChannel(guildId, channelId) {
  db.prepare(`DELETE FROM protected_channels WHERE guildId = ? AND channelId = ?`).run(guildId, channelId);
}
function listProtectedRoles(guildId) {
  return db.prepare(`SELECT roleId FROM protected_roles WHERE guildId = ?`).all(guildId).map((r) => r.roleId);
}
function listProtectedChannels(guildId) {
  return db
    .prepare(`SELECT channelId FROM protected_channels WHERE guildId = ?`)
    .all(guildId)
    .map((r) => r.channelId);
}

module.exports = {
  isStaff,
  hasFullAccess,
  canModerate,
  canActOnTarget,
  canBotActOnTarget,
  canManageRole,
  isProtectedRole,
  isProtectedChannel,
  addProtectedRole,
  removeProtectedRole,
  addProtectedChannel,
  removeProtectedChannel,
  listProtectedRoles,
  listProtectedChannels
};
