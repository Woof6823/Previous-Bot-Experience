const { PermissionsBitField } = require("discord.js");
const commandPermsOverride = require("./commandPermsOverride");
const { isOwner, hasStaffAccess } = require("./staffAccess");

































function hasModPermission(member, action) {
  if (!member) return false;


  if (isOwner(member.id)) return true;


  if (commandPermsOverride.hasOverride(action, member.id)) return true;

  switch (action) {
    case "warn":
      return hasStaffAccess(member);

    case "mute":
      return (
        hasStaffAccess(member) &&
        member.permissions.has(PermissionsBitField.Flags.ModerateMembers)
      );

    case "kick":
      return member.permissions.has(PermissionsBitField.Flags.KickMembers);

    case "ban":
      return member.permissions.has(PermissionsBitField.Flags.BanMembers);

    default:
      return false;
  }
}

module.exports = {
  hasModPermission,
  canModerateTarget
};























function canModerateTarget(executorMember, targetMember, action) {
  if (!executorMember || !targetMember) {
    return { allowed: false, reason: "no_permission" };
  }



  if (isOwner(targetMember.id)) {
    return { allowed: false, reason: "owner_target" };
  }



  if (isOwner(executorMember.id)) {
    return { allowed: true };
  }

  if (!hasModPermission(executorMember, action)) {
    return { allowed: false, reason: "no_permission" };
  }

  if (executorMember.roles.highest.position <= targetMember.roles.highest.position) {
    return { allowed: false, reason: "hierarchy" };
  }

  return { allowed: true };
}
