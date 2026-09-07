const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { TICKET_TYPES, STAFF_ROLE_IDS, EMBED_COLOR } = require('./config');
const {
  getActiveTicketForUser,
  createActiveTicket,
  removeActiveTicketByChannel,
  getActiveTicketByChannel,
  setTicketClaimed,
  getCategoryId,
  nextTicketNumber,
} = require('./database');

function buildTicketControlRow(claimed) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel(claimed ? '✅ Claimed' : '🔒 Claim Ticket')
      .setStyle(ButtonStyle.Success)
      .setDisabled(claimed),
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🗑️ Close Ticket')
      .setStyle(ButtonStyle.Danger)
  );
}

async function handleOpenTicket(interaction, type) {
  const def = TICKET_TYPES[type];
  if (!def) {
    return interaction.reply({ content: 'Unknown ticket type.', ephemeral: true });
  }

  const existing = getActiveTicketForUser(interaction.user.id);
  if (existing) {
    return interaction.reply({
      content: `⚠️ You already have an open ticket: <#${existing.channel_id}>. Please close it before opening another.`,
      ephemeral: true,
    });
  }

  const categoryId = getCategoryId(type);
  if (!categoryId) {
    return interaction.reply({
      content: '❌ Ticket category is not set up yet. Please contact an admin.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = nextTicketNumber(type);
  const channelName = `${type}-ticket-${ticketNumber}`;
  const guild = interaction.guild;


  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];


  for (const roleId of STAFF_ROLE_IDS) {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }


  if (def.pingRoleId) {
    permissionOverwrites.push({
      id: def.pingRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
  });

  createActiveTicket(interaction.user.id, channel.id, type, ticketNumber);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${def.emoji}  ${def.label} Created`)
    .setDescription(
      `Welcome to your support channel, ${interaction.user}!\n\n` +
      `A staff member will review your request shortly. In the meantime, please provide any relevant details, screenshots, or context regarding your inquiry below.`
    )
    .addFields(
      { name: '📋 Ticket ID', value: `\`#${ticketNumber}\``, inline: true },
      { name: '📂 Category', value: `\`${def.categoryName}\``, inline: true },
      { name: '🟢 Status', value: '`Waiting for Staff...`', inline: true },
      { name: '\u200b', value: '\u200b' },
      {
        name: '⚡ Quick Actions',
        value: '• **Staff:** Use the buttons below to claim or close this ticket.\n• **User:** Please be patient and respectful.'
      }
    )
    .setFooter({ text: 'Nexar Region Support • Focusing on the Future' })
    .setTimestamp();


  const pingContent = def.pingRoleId
    ? `<@&${def.pingRoleId}> ${interaction.user}`
    : `${interaction.user}`;

  await channel.send({
    content: pingContent,
    embeds: [embed],
    components: [buildTicketControlRow(false)],
  });

  await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
}

async function handleClaimTicket(interaction) {
  const member = interaction.member;
  const hasRole = STAFF_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId));

  if (!hasRole) {
    return interaction.reply({
      content: '🚫 You do not have permission to claim this ticket.',
      ephemeral: true,
    });
  }

  const ticket = getActiveTicketByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  }

  if (ticket.claimed_by) {
    return interaction.reply({ content: 'This ticket has already been claimed.', ephemeral: true });
  }

  setTicketClaimed(interaction.channel.id, interaction.user.id);

  await interaction.update({ components: [buildTicketControlRow(true)] });

  await interaction.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`🔒 **Ticket Claimed**\n${interaction.user} is now handling this ticket.`)
    ]
  });
}

async function handleCloseTicket(interaction) {
  const ticket = getActiveTicketByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  }

  const member = interaction.member;
  const hasRole = STAFF_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId));
  const isOwner = ticket.user_id === interaction.user.id;

  if (!hasRole && !isOwner) {
    return interaction.reply({
      content: '🚫 You do not have permission to close this ticket.',
      ephemeral: true,
    });
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('🗑️ **Closing Ticket**\nThis channel will be deleted in 5 seconds...')
    ]
  });

  removeActiveTicketByChannel(interaction.channel.id);

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = { handleOpenTicket, handleClaimTicket, handleCloseTicket, buildTicketControlRow };
