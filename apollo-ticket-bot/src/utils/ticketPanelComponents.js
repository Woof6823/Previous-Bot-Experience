const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config');

function buildTicketSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_type_select')
    .setPlaceholder('📋 Select a ticket type...')
    .addOptions(
      Object.entries(config.ticketTypes).map(([key, type]) => ({
        label: type.label,
        description: type.description.slice(0, 100),
        value: key,
        emoji: type.emoji
      }))
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = { buildTicketSelectRow };
