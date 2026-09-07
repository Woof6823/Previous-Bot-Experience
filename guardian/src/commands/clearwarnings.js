const moderationService = require("../services/moderationService");

module.exports = {
  name: "clearwarnings",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[0]).catch(() => null));
    if (!target) throw new Error("Usage: `*clearwarnings <@user|userId>`");
    moderationService.clearWarnings(message.guild.id, target.id);
    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`Cleared warnings for ${target.user.tag}.`)]
    });
  }
};
