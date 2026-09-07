const { AuditLogEvent } = require("discord.js");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");


module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    const guild = member.guild;
    const settings = configService.getSettings(guild.id);
    if (!settings.securityEnabled) return;

    if (securityService.wasBotKick(guild.id, member.id)) return;

    const resolved = await auditService.resolveActor(guild, AuditLogEvent.MemberKick, member.id, 4000);
    if (!resolved?.user) return;

    const actorId = resolved.user.id;
    if (whitelistService.isWhitelisted(guild.id, actorId)) return;

    const actorMember = await guild.members.fetch(actorId).catch(() => null);
    securityService.recordModAction(guild.id, actorId, "kick", member.id);
    const recent = securityService.countRecentActions(guild.id, actorId, "kick", settings.kickWindowMs);
    if (recent >= settings.kickThreshold) {
      await securityService.triggerIncident(guild, {
        actorId,
        actorMember,
        type: "mass_kick",
        details: { target: member.id, count: recent },
        threshold: `${settings.kickThreshold} kicks / ${settings.kickWindowMs / 60000}min`,
        reason: `${recent} kicks performed within the rolling window (detected via Discord audit log).`
      });
    }
  }
};
