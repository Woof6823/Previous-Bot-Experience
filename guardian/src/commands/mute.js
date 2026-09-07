const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const { parseDuration, formatDuration } = require("../utils/duration");

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
  name: "mute",
  aliases: ["timeout"],
  requiresStaff: true,
  capability: "mute",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*mute <@user|userId> <duration e.g. 10m> <reason>`");

    const durationMs = Math.min(parseDuration(args[1]) || 0, MAX_TIMEOUT_MS);
    if (!durationMs) throw new Error("Provide a valid duration, e.g. `10m`, `2h`, `1d`.");
    const reason = args.slice(2).join(" ") || "No reason provided";

    const hierarchy = permissionService.canActOnTarget(message.member, target);
    if (!hierarchy.allowed) throw new Error(hierarchy.reason);
    const botCheck = permissionService.canBotActOnTarget(message.guild, target);
    if (!botCheck.allowed) throw new Error(botCheck.reason);
    if (!target.moderatable) throw new Error("I cannot moderate that member (role hierarchy).");

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

    await target.timeout(durationMs, reason);

    const caseId = moderationService.createCase(message.guild.id, target.id, message.author.id, "mute", reason, durationMs);
    const durationLabel = formatDuration(durationMs);
    const dmDelivered = await moderationService.sendPunishmentDM(target.user, {
      action: "mute",
      reason,
      durationLabel,
      caseId,
      guildName: message.guild.name
    });
    await moderationService.logToModChannel(message.guild, {
      action: "mute",
      target: target.user,
      moderator: message.author,
      reason,
      caseId,
      durationLabel,
      dmDelivered
    });

    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`User has been timed out for ${durationLabel}. (CASE-${caseId})`)]
    });
  }
};
