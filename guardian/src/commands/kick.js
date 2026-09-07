const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");

module.exports = {
  name: "kick",
  requiresStaff: true,
  capability: "kick",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*kick <@user|userId> <reason>`");
    const reason = args.slice(1).join(" ") || "No reason provided";

    const hierarchy = permissionService.canActOnTarget(message.member, target);
    if (!hierarchy.allowed) throw new Error(hierarchy.reason);
    const botCheck = permissionService.canBotActOnTarget(message.guild, target);
    if (!botCheck.allowed) throw new Error(botCheck.reason);
    if (!target.kickable) throw new Error("I cannot kick that member (role hierarchy).");


    const caseId = moderationService.createCase(message.guild.id, target.id, message.author.id, "kick", reason);
    const dmDelivered = await moderationService.sendPunishmentDM(target.user, {
      action: "kick",
      reason,
      caseId,
      guildName: message.guild.name
    });

    securityService.markBotKick(message.guild.id, target.id);
    await target.kick(reason);

    await moderationService.logToModChannel(message.guild, {
      action: "kick",
      target: target.user,
      moderator: message.author,
      reason,
      caseId,
      dmDelivered
    });

    const settings = configService.getSettings(message.guild.id);
    const isWl = permissionService.hasFullAccess(message.guild.id, message.author.id);
    securityService.recordModAction(message.guild.id, message.author.id, "kick", target.id);
    if (!isWl) {
      const recent = securityService.countRecentActions(
        message.guild.id,
        message.author.id,
        "kick",
        settings.kickWindowMs
      );
      if (recent >= settings.kickThreshold) {
        await securityService.triggerIncident(message.guild, {
          actorId: message.author.id,
          actorMember: message.member,
          type: "mass_kick",
          details: { target: target.user.tag, count: recent },
          threshold: `${settings.kickThreshold} kicks / ${settings.kickWindowMs / 60000}min`,
          reason: `${recent} kicks performed within the rolling window.`
        });
      }
    }

    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`User was kicked successfully. (CASE-${caseId})`)]
    });
  }
};
