const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { TICKET_TYPES, TICKET_EMBED_TITLE, TICKET_EMBED_DESCRIPTION, EMBED_COLOR } = require('./config');

function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setTitle(TICKET_EMBED_TITLE)
    .setDescription(TICKET_EMBED_DESCRIPTION)
    .setColor(EMBED_COLOR)
    .setFooter({ text: 'Nexar Region Bot • Support System' });


  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_ticket_type')
    .setPlaceholder('🔽 Select a ticket category...')
    .setMinValues(1)
    .setMaxValues(1);


  for (const [type, def] of Object.entries(TICKET_TYPES)) {
    selectMenu.addOptions({
      label: def.label,
      description: def.description,
      value: type,
      emoji: def.emoji,
    });
  }

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return { embeds: [embed], components: [row] };
}

module.exports = { buildTicketPanel };
