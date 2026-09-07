const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");

module.exports = {
  name: "unmute",
  aliases: ["untimeout"],
  requiresStaff: true,
  capability: "mute",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*unmute <@user|userId>`");

    const hierarchy = permissionService.canActOnTarget(message.member, target);
    if (!hierarchy.allowed) throw new Error(hierarchy.reason);
    if (!target.moderatable) throw new Error("I cannot moderate that member (role hierarchy).");

    await target.timeout(null, `Unmuted by ${message.author.tag}`);
    const caseId = moderationService.createCase(message.guild.id, target.id, message.author.id, "unmute", "Timeout removed");
    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`Timeout removed successfully. (CASE-${caseId})`)]
    });
  }
};
