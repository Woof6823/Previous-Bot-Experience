const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { TICKET_TYPES, BRAND_COLOR, BRAND_NAME } = require('./config');

function buildTicketPanel(guild) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({
      name: `${BRAND_NAME} · Help & Support`,
      iconURL: guild?.iconURL({ size: 256 }) || undefined,
    })
    .setTitle('📩  Need a hand?')
    .setDescription(
      [
        'Welcome to the **SAIL Esports** ticket system.',
        '',
        'Select the category that best matches what you need from the menu below, and a private channel will be opened just for you.',
        '',
        '**🎮 Player Application** — apply to play for SAIL',
        '**🛡️ Staff Application** — apply for a staff role',
        '**💬 Content Creator Application** — apply as a creator',
        '**🎫 Support Ticket** — general help & issues',
        '**💰 Business Inquiry** — sponsorships & partnerships',
        '',
        '> ⚠️ You may only have **one open ticket at a time**. Please provide all relevant details so our team can assist you efficiently.',
      ].join('\n')
    )
    .setThumbnail(guild?.iconURL({ size: 256 }) || null)
    .setFooter({ text: `${BRAND_NAME} · Ticket System`, iconURL: guild?.iconURL({ size: 128 }) || undefined })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select')
    .setPlaceholder('📂 Select a ticket category...')
    .addOptions(
      TICKET_TYPES.map((t) => ({
        label: t.label,
        description: t.description,
        value: t.id,
        emoji: t.emoji,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  return { embeds: [embed], components: [row] };
}

module.exports = { buildTicketPanel };
