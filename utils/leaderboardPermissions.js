const settings = require("../settings");
const { isOwner } = require("./staffAccess");

function hasLeaderboardPermission(member) {
  if (!member) return false;


  if (isOwner(member.id)) return true;

  if (member.roles.cache.has(settings.get("staffAccessRoleId"))) {
    return true;
  }

  return settings
    .getRoleIds("leaderboardRoleIds")
    .some((roleId) => member.roles.cache.has(roleId));
}

module.exports = {
  hasLeaderboardPermission
};
