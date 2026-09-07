const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('./config');

function baseEmbed() {
  const e = new EmbedBuilder().setColor(config.brand.color).setFooter({ text: config.brand.footer });
  if (config.brand.thumbnail) e.setThumbnail(config.brand.thumbnail);
  return e;
}


function panelEmbed() {
  const typeLines = Object.values(config.ticketTypes)
    .map((t) => `${t.emoji} **${t.label}** — ${t.description}`)
    .join('\n');

  const embed = baseEmbed()
    .setTitle('🎟️  COSMO ESPORTS SUPPORT')
    .setDescription(
      [
        `Welcome to the official **${config.brand.name}** support page!`,
        '',
        'Before opening a ticket, please make sure you have reviewed our rules and announcements.',
      ].join('\n')
    )
    .addFields(
      {
        name: '📂 How to open a ticket',
        value: 'Use the dropdown menu below and select the category that best fits your request.',
      },
      {
        name: '\u200B',
        value: typeLines,
      },
      {
        name: '⚠️ Please note',
        value: [
          '• Tickets are reviewed as quickly as possible.',
          `• Inactive tickets may be closed after ${config.inactivityHours} hours.`,
          '• Please provide all relevant information when opening a ticket.',
          '• Please be respectful when communicating with staff.',
        ].join('\n'),
      },
      {
        name: '\u200B',
        value: `*${config.brand.name} — Focusing on the Future*`,
      }
    );

  return embed;
}

function selectMenuRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(config.selectMenuCustomId)
    .setPlaceholder('Select a topic...')
    .addOptions(
      Object.values(config.ticketTypes).map((t) => ({
        label: t.selectLabel,
        value: t.key,
        description: t.description,
        emoji: t.emoji,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function newTicketEmbed({ type, number, user }) {
  const ticketLabel = `${type.channelPrefix} - ${number}`;
  return baseEmbed()
    .setTitle('🎟️ COSMO ESPORTS — NEW TICKET')
    .addFields(
      { name: 'Ticket', value: `\`${ticketLabel}\``, inline: true },
      { name: 'Category', value: type.label, inline: true },
      { name: 'Status', value: '🟢 Open', inline: true },
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'User ID', value: `\`${user.id}\``, inline: true }
    )
    .setTimestamp();
}

function dmOpenedEmbed({ ticketLabel }) {
  return baseEmbed()
    .setTitle('🎟️ Your Cosmo Esports ticket has been opened!')
    .setDescription(
      [
        'Your ticket is now active.',
        '',
        'Please continue the conversation by replying to this DM — our support team will respond here.',
        '',
        `Ticket: \`${ticketLabel}\``,
        '',
        'Send `!close` at any time to close this ticket.',
      ].join('\n')
    );
}

function dmClosedEmbed({ ticketLabel }) {
  return baseEmbed()
    .setColor(config.brand.closedColor)
    .setTitle('🔒 Your Cosmo Esports ticket has been closed.')
    .setDescription(
      [`Ticket: \`${ticketLabel}\``, '', `Thank you for contacting ${config.brand.supportName}.`].join('\n')
    );
}

module.exports = {
  panelEmbed,
  selectMenuRow,
  newTicketEmbed,
  dmOpenedEmbed,
  dmClosedEmbed,
};
