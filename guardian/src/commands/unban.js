const moderationService = require("../services/moderationService");

module.exports = {
  name: "unban",
  requiresStaff: true,
  capability: "ban",
  async execute(message, args) {
    const rawId = args[0]?.replace(/[<@!>]/g, "");
    if (!rawId) throw new Error("Usage: `*unban <userId> <reason>`");
    const reason = args.slice(1).join(" ") || "No reason provided";

    await message.guild.bans.remove(rawId, reason).catch(() => {
      throw new Error("That user is not banned or the ID is invalid.");
    });

    const caseId = moderationService.createCase(message.guild.id, rawId, message.author.id, "unban", reason);
    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`User was unbanned successfully. (CASE-${caseId})`)]
    });
  }
};
