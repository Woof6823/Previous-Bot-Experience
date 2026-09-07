const configService = require("../services/configService");
const moderationService = require("../services/moderationService");

module.exports = {
  name: "setwelcome",
  ownerOnly: true,
  async execute(message, args) {
    const text = args.join(" ");
    if (!text) throw new Error("Usage: `*setwelcome <message>` — use `{user}` and `{count}` as placeholders.");
    configService.updateSetting(message.guild.id, "welcomeMessage", text);
    await message.channel.send({ embeds: [moderationService.publicSuccessEmbed("Welcome message updated.")] });
  }
};
