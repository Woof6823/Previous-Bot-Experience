const moderationService = require("../services/moderationService");

module.exports = {
  name: "purge",
  requiresStaff: true,
  capability: "purge",
  async execute(message, args) {
    const count = parseInt(args[0], 10);
    if (!count || count < 1 || count > 100) throw new Error("Usage: `*purge <1-100>`");
    const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
    const sent = await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`Purged ${deleted?.size ?? 0} messages.`)]
    });
    setTimeout(() => sent.delete().catch(() => {}), 5000);
  }
};
