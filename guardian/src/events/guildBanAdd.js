const { AuditLogEvent } = require("discord.js");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");

module.exports = {
  name: "guildBanAdd",
  async execute(ban) {
    const guild = ban.guild;
    const settings = configService.getSettings(guild.id);
    if (!settings.securityEnabled) return;
    if (securityService.wasBotKick(guild.id, `ban:${ban.user.id}`)) return;

    const resolved = await auditService.resolveActor(guild, AuditLogEvent.MemberBanAdd, ban.user.id, 4000);
    if (!resolved?.user) return;

    const actorId = resolved.user.id;
    if (whitelistService.isWhitelisted(guild.id, actorId)) return;

    const actorMember = await guild.members.fetch(actorId).catch(() => null);
    securityService.recordModAction(guild.id, actorId, "ban", ban.user.id);
    const recent = securityService.countRecentActions(guild.id, actorId, "ban", settings.banWindowMs);
    if (recent >= settings.banThreshold) {
      await securityService.triggerIncident(guild, {
        actorId,
        actorMember,
        type: "mass_ban",
        details: { target: ban.user.id, count: recent },
        threshold: `${settings.banThreshold} bans / ${settings.banWindowMs / 60000}min`,
        reason: `${recent} bans performed within the rolling window (detected via Discord audit log).`
      });
    }
  }
};
