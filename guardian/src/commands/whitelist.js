const whitelistService = require("../services/whitelistService");
const moderationService = require("../services/moderationService");

module.exports = {
  name: "whitelist",
  ownerOnly: true,
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    const rawId = args[1]?.replace(/[<@!>]/g, "");

    if (sub === "add") {
      if (!rawId) throw new Error("Usage: `*whitelist add <userId>`");
      whitelistService.addWhitelist(message.guild.id, rawId, message.author.id);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`<@${rawId}> added to the whitelist.`)]
      });
    }
    if (sub === "remove") {
      if (!rawId) throw new Error("Usage: `*whitelist remove <userId>`");
      whitelistService.removeWhitelist(message.guild.id, rawId);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`<@${rawId}> removed from the whitelist.`)]
      });
    }
    if (sub === "list") {
      const ids = whitelistService.listWhitelist(message.guild.id);
      return message.channel.send({
        embeds: [
          moderationService.publicSuccessEmbed(
            ids.length ? `Whitelisted users:\n${ids.map((i) => `<@${i}>`).join(", ")}` : "No whitelisted users."
          )
        ]
      });
    }
    throw new Error("Usage: `*whitelist <add|remove|list> [userId]`");
  }
};
