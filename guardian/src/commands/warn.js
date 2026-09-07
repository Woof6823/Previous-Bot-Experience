const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");

module.exports = {
  name: "warn",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*warn <@user|userId> <reason>`");
    const reason = args.slice(1).join(" ") || "No reason provided";

    const hierarchy = permissionService.canActOnTarget(message.member, target);
    if (!hierarchy.allowed) throw new Error(hierarchy.reason);

    const settings = configService.getSettings(message.guild.id);
    const isWl = permissionService.hasFullAccess(message.guild.id, message.author.id);
    if (!isWl) {
      const recent = securityService.countRecentActions(
        message.guild.id,
        message.author.id,
        "warn_mute",
        settings.modActionWindowMs
      );
      if (recent >= settings.modActionRateLimit) {
        throw new Error("You've hit the responsible-moderation rate limit. Try again shortly.");
      }
    }
    securityService.recordModAction(message.guild.id, message.author.id, "warn_mute", target.id);

    const caseId = moderationService.createCase(message.guild.id, target.id, message.author.id, "warn", reason);
    moderationService.addWarning(message.guild.id, target.id, message.author.id, reason, caseId);
    const dmDelivered = await moderationService.sendPunishmentDM(target.user, {
      action: "warn",
      reason,
      caseId,
      guildName: message.guild.name
    });

    await moderationService.logToModChannel(message.guild, {
      action: "warn",
      target: target.user,
      moderator: message.author,
      reason,
      caseId,
      dmDelivered
    });

    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`Warning issued successfully. (CASE-${caseId})`)]
    });
  }
};
