const { AuditLogEvent } = require("discord.js");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");

module.exports = {
  name: "roleCreate",
  async execute(role) {
    const guild = role.guild;
    const settings = configService.getSettings(guild.id);
    if (!settings.securityEnabled || !settings.roleProtectionEnabled) return;

    const resolved = await auditService.resolveActor(guild, AuditLogEvent.RoleCreate, role.id);
    if (!resolved?.user) return;
    const actorId = resolved.user.id;
    if (whitelistService.isWhitelisted(guild.id, actorId)) return;

    const actorMember = await guild.members.fetch(actorId).catch(() => null);
    await securityService.triggerIncident(guild, {
      actorId,
      actorMember,
      type: "unauthorized_role_create",
      details: { target: role.id, roleName: role.name },
      threshold: "any non-whitelisted role creation",
      reason: `Role "${role.name}" was created by a non-whitelisted user.`
    });
  }
};
