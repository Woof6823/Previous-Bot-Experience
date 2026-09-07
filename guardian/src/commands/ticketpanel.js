const ticketHandler = require("../handlers/ticketHandler");

module.exports = {
  name: "ticketpanel",
  ownerOnly: true,
  async execute(message) {
    const embed = ticketHandler.buildPanelEmbed(message.guild);
    const row = ticketHandler.buildSelectMenu();
    await message.channel.send({ embeds: [embed], components: [row] });
  }
};
