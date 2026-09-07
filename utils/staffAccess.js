const securityManager = require("../handlers/securityManager");
const settings = require("../settings");



















function getOwnerIds() {






  return [...securityManager.TRUSTED_USER_IDS];
}

function isOwner(userId) {
  if (!userId) return false;
  return getOwnerIds().includes(String(userId));
}













function hasStaffAccess(member) {
  if (!member) return false;



  if (isOwner(member.id)) {
    return true;
  }

  if (member.permissions?.has?.("Administrator")) {
    return true;
  }

  const staffAccessRoleId = settings.get("staffAccessRoleId");
  if (staffAccessRoleId && member.roles?.cache?.has?.(String(staffAccessRoleId))) {
    return true;
  }

  return false;
}









function isCommunityCommand(command) {
  return Boolean(command) && !command.ownerOnly && !command.staffOnly;
}

module.exports = {
  getOwnerIds,
  isOwner,
  hasStaffAccess,
  isCommunityCommand
};


const STAFF_ROLE_NAME = process.env.STAFF_ROLE_NAME || null;
module.exports.STAFF_ROLE_NAME = STAFF_ROLE_NAME;
