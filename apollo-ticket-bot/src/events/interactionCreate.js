const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const store = require('../db/ticketStore');
const { createTicketChannel, closeTicketChannel } = require('../utils/ticketManager');
const { alreadyOpenEmbed, closeConfirmEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
        return handleTicketTypeSelect(interaction);
      }

      if (interaction.isButton()) {
        if (interaction.customId === 'ticket_close') return handleCloseRequest(interaction);
        if (interaction.customId === 'ticket_close_confirm') return handleCloseConfirm(interaction);
        if (interaction.customId === 'ticket_close_cancel') return handleCloseCancel(interaction);
      }
    } catch (err) {
      console.error('[interactionCreate] Unhandled error:', err);
      const payload = { content: '❌ Something went wrong handling that. Please try again or contact an admin.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
};

async function handleTicketTypeSelect(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const typeKey = interaction.values[0];
  const type = config.ticketTypes[typeKey];
  if (!type) {
    return interaction.editReply({ content: '❌ Unknown ticket type.' });
  }

  const { guild, member } = interaction;


  const existing = store.getOpenTicket(member.id, guild.id);
  if (existing) {
    const channelStillExists = guild.channels.cache.has(existing.channel_id);
    if (channelStillExists) {
      return interaction.editReply({ embeds: [alreadyOpenEmbed(existing.channel_id)] });
    }

    store.closeTicket(existing.channel_id);
  }

  try {
    const channel = await createTicketChannel(guild, member, typeKey);
    return interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
  } catch (err) {
    if (err.message === 'DUPLICATE_TICKET') {
      const stillOpen = store.getOpenTicket(member.id, guild.id);
      return interaction.editReply({ embeds: [alreadyOpenEmbed(stillOpen?.channel_id)] });
    }
    console.error('[ticket_type_select] Failed to create ticket:', err);
    return interaction.editReply({ content: '❌ Failed to create your ticket. Please contact an admin.' });
  }
}

async function handleCloseRequest(interaction) {
  const ticket = store.getTicketByChannel(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') {
    return interaction.reply({ content: '❌ This channel is not an open ticket.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger).setEmoji('✅'),
    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
  );

  return interaction.reply({ embeds: [closeConfirmEmbed()], components: [row], ephemeral: true });
}

async function handleCloseConfirm(interaction) {
  const ticket = store.getTicketByChannel(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') {
    return interaction.update({ content: '❌ This ticket is already closed.', embeds: [], components: [] });
  }

  await interaction.update({ content: '🔒 Closing ticket...', embeds: [], components: [] });
  await closeTicketChannel(interaction.channel, interaction.user);
}

async function handleCloseCancel(interaction) {
  return interaction.update({ content: 'Cancelled.', embeds: [], components: [] });
}
