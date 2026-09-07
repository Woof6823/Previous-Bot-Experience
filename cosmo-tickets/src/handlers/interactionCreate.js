const config = require('../config');
const ticketManager = require('../ticketManager');

module.exports = async function interactionCreate(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== config.selectMenuCustomId) return;




    await interaction.deferReply({ ephemeral: true });

    const typeKey = interaction.values[0];
    const guild = interaction.guild;
    const user = interaction.user;

    const result = await ticketManager.createTicket({ guild, user, typeKey });

    if (!result.ok) {
      if (result.reason === 'already_open') {
        const existingType = config.ticketTypes[result.existing.type];
        const label = `${existingType ? existingType.channelPrefix : result.existing.type} - ${result.existing.number}`;
        await interaction.editReply({
          content: `You already have an open ticket (\`${label}\`). Please use your existing ticket — check your DMs to continue the conversation.`,
        });
        return;
      }
      if (result.reason === 'already_creating') {
        await interaction.editReply({ content: 'A ticket is already being created for you — one moment.' });
        return;
      }
      if (result.reason === 'channel_create_failed') {
        await interaction.editReply({
          content: "Something went wrong creating your ticket channel. Please try again shortly, or contact staff directly.",
        });
        return;
      }
      await interaction.editReply({ content: 'Something went wrong opening your ticket. Please try again.' });
      return;
    }

    if (result.dmFailed) {
      await interaction.editReply({
        content: `Your ticket \`${result.ticketLabel}\` was created, but I couldn't send you a DM. Please enable DMs from server members and reopen a ticket, or wait for staff to reach out.`,
      });
    } else {
      await interaction.editReply({
        content: `Your ticket \`${result.ticketLabel}\` has been created! Check your DMs to continue the conversation with our team.`,
      });
    }
  } catch (err) {
    console.error('[interactionCreate] Unhandled error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An unexpected error occurred. Please try again.' });
      } else {
        await interaction.reply({ content: 'An unexpected error occurred. Please try again.', ephemeral: true });
      }
    } catch (_) {

    }
  }
};
