const { AuditLogEvent } = require("discord.js");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");

module.exports = {
  name: "roleUpdate",
  async execute(oldRole, newRole) {
    const guild = newRole.guild;
    const settings = configService.getSettings(guild.id);
    if (!settings.securityEnabled || !settings.roleProtectionEnabled) return;

    const permsChanged = !oldRole.permissions.equals(newRole.permissions);
    const becameMentionable = !oldRole.mentionable && newRole.mentionable;
    if (!permsChanged && !becameMentionable) return;

    const resolved = await auditService.resolveActor(guild, AuditLogEvent.RoleUpdate, newRole.id);
    if (!resolved?.user) return;

    const actorId = resolved.user.id;
    if (whitelistService.isWhitelisted(guild.id, actorId)) return;

    const actorMember = await guild.members.fetch(actorId).catch(() => null);

    if (becameMentionable) {

      await newRole.setMentionable(false, "Automated security revert — unauthorized mentionable change").catch(() => {});
      await securityService.triggerIncident(guild, {
        actorId,
        actorMember,
        type: "role_mentionable_change",
        details: { target: newRole.id, roleName: newRole.name },
        threshold: "any non-whitelisted mentionable change",
        reason: `Role "${newRole.name}" was made mentionable by a non-whitelisted user.`
      });
      return;
    }

    if (permsChanged) {
      await securityService.triggerIncident(guild, {
        actorId,
        actorMember,
        type: "role_permission_change",
        details: { target: newRole.id, roleName: newRole.name },
        threshold: "any non-whitelisted permission change",
        reason: `Permissions on role "${newRole.name}" were changed by a non-whitelisted user.`
      });
    }
  }
};
