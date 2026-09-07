const ticketHandler = require("../handlers/ticketHandler");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
        return ticketHandler.openTicket(interaction, interaction.values[0]);
      }
      if (interaction.isButton() && interaction.customId === "ticket_claim") {
        return ticketHandler.claimTicket(interaction);
      }
      if (interaction.isButton() && interaction.customId === "ticket_close") {
        return ticketHandler.closeTicket(interaction);
      }
    } catch (err) {
      console.error("[interactionCreate]", err);
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ content: "⚠️ Something went wrong handling that.", ephemeral: true }).catch(() => {});
      }
    }
  }
};
