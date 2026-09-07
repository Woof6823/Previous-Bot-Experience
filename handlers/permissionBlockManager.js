const { PermissionsBitField } = require("discord.js");
const db = require("../database");
const settings = require("../settings");

const MODERATION_PERMS = [
  "Administrator",
  "BanMembers",
  "KickMembers",
  "ModerateMembers",
  "ManageMessages",
  "ManageRoles",
  "ManageChannels",
  "ManageGuild",
  "ManageNicknames",
  "MuteMembers",
  "DeafenMembers",
  "MoveMembers",
  "ManageWebhooks",
  "ViewAuditLog"
];

function roleHasModerationPerms(role) {
  return MODERATION_PERMS.some((perm) => role.permissions.has(PermissionsBitField.Flags[perm]));
}

function isPermissionBlocked(userId) {
  return !!db.getBlacklist(userId, "permission");
}






async function stripModerationRoles(member, reason) {
  const toStrip = member.roles.cache.filter(
    (role) => role.id !== member.guild.id && roleHasModerationPerms(role)
  );

  if (toStrip.size === 0) return;

  await member.roles.remove(toStrip, reason).catch((error) => {
    console.error(
      `[PERMISSIONBLOCK] Failed to strip moderation role(s) from ${member.id} (likely above the bot in the role hierarchy):`,
      error.message
    );
  });
}



async function reapplyStaffBlacklistRole(member) {
  const staffBlacklistRoleId = settings.get("staffBlacklistRoleId");
  if (!staffBlacklistRoleId) return;
  if (member.roles.cache.has(staffBlacklistRoleId)) return;

  await member.roles
    .add(staffBlacklistRoleId, "Permanent staff blacklist (permission-blocked)")
    .catch(() => {});
}



async function enforce(member, reason = "Permission-blocked: moderation permissions are never allowed") {
  if (!member || !isPermissionBlocked(member.id)) return;
  await stripModerationRoles(member, reason);
  await reapplyStaffBlacklistRole(member);
}

async function blockUser(guild, userId, reason, blockedBy) {
  db.addBlacklist(userId, "permission", reason, blockedBy);
  db.addBlacklist(userId, "staff", "Permanently staff blacklisted (permission-blocked)", blockedBy);

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    await stripModerationRoles(member, `Permission-blocked by <@${blockedBy}>: ${reason}`);
    await reapplyStaffBlacklistRole(member);
  }
}

async function unblockUser(guild, userId) {
  const wasBlocked = db.removeBlacklist(userId, "permission");
  db.removeBlacklist(userId, "staff");

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    const staffBlacklistRoleId = settings.get("staffBlacklistRoleId");
    if (staffBlacklistRoleId && member.roles.cache.has(staffBlacklistRoleId)) {
      await member.roles.remove(staffBlacklistRoleId, "Permission-unblocked").catch(() => {});
    }
  }

  return wasBlocked;
}

module.exports = {
  isPermissionBlocked,
  roleHasModerationPerms,
  enforce,
  blockUser,
  unblockUser
};
