const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");

module.exports = {
  name: "ban",
  requiresStaff: true,
  capability: "ban",
  async execute(message, args) {
    const rawId = args[0]?.replace(/[<@!>]/g, "");
    if (!rawId) throw new Error("Usage: `*ban <@user|userId> <reason>`");
    const reason = args.slice(1).join(" ") || "No reason provided";

    const targetMember = await message.guild.members.fetch(rawId).catch(() => null);
    if (targetMember) {
      const hierarchy = permissionService.canActOnTarget(message.member, targetMember);
      if (!hierarchy.allowed) throw new Error(hierarchy.reason);
      const botCheck = permissionService.canBotActOnTarget(message.guild, targetMember);
      if (!botCheck.allowed) throw new Error(botCheck.reason);
      if (!targetMember.bannable) throw new Error("I cannot ban that member (role hierarchy).");
    }

    const caseId = moderationService.createCase(message.guild.id, rawId, message.author.id, "ban", reason);
    let dmDelivered = false;
    if (targetMember) {
      dmDelivered = await moderationService.sendPunishmentDM(targetMember.user, {
        action: "ban",
        reason,
        caseId,
        guildName: message.guild.name
      });
    }

    securityService.markBotKick(message.guild.id, `ban:${rawId}`);
    await message.guild.members.ban(rawId, { reason });

    await moderationService.logToModChannel(message.guild, {
      action: "ban",
      target: targetMember?.user || { id: rawId, tag: rawId },
      moderator: message.author,
      reason,
      caseId,
      dmDelivered
    });

    const settings = configService.getSettings(message.guild.id);
    const isWl = permissionService.hasFullAccess(message.guild.id, message.author.id);
    securityService.recordModAction(message.guild.id, message.author.id, "ban", rawId);
    if (!isWl) {
      const recent = securityService.countRecentActions(
        message.guild.id,
        message.author.id,
        "ban",
        settings.banWindowMs
      );
      if (recent >= settings.banThreshold) {
        await securityService.triggerIncident(message.guild, {
          actorId: message.author.id,
          actorMember: message.member,
          type: "mass_ban",
          details: { target: rawId, count: recent },
          threshold: `${settings.banThreshold} bans / ${settings.banWindowMs / 60000}min`,
          reason: `${recent} bans performed within the rolling window.`
        });
      }
    }

    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`User was banned successfully. (CASE-${caseId})`)]
    });
  }
};
