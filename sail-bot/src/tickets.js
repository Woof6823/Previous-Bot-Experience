const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('./database');
const { TICKET_TYPES, STAFF_ROLE_ID, BRAND_COLOR, BRAND_NAME } = require('./config');
const { sendTranscript } = require('./transcripts');

function typeById(id) {
  return TICKET_TYPES.find((t) => t.id === id);
}

function buildControlRow(claimed) {
  const claim = new ButtonBuilder()
    .setCustomId('ticket_claim')
    .setLabel(claimed ? 'Claimed' : 'Claim')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Success)
    .setDisabled(claimed);

  const close = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Close')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(claim, close);
}

async function openTicket(interaction, typeId) {
  const type = typeById(typeId);
  const guild = interaction.guild;
  const user = interaction.user;

  const existing = db.getOpenTicketForUser(user.id);
  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket: <#${existing.channel_id}>. Please close it before opening another.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const categoryId = db.getCategoryId(type.id);
  const number = db.nextTicketNumber(type.id);
  const channelName = `${type.slug}-${number}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    topic: `${type.label} ticket for ${user.tag} (${user.id})`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });

  db.createTicket({
    channelId: channel.id,
    guildId: guild.id,
    userId: user.id,
    type: type.id,
    number,
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: BRAND_NAME, iconURL: guild.iconURL({ size: 256 }) || undefined })
    .setTitle(`${type.emoji}  ${type.label} Ticket Opened`)
    .setDescription(
      [
        `You have opened a **${type.label}** ticket. Support will be with you shortly.`,
        '',
        type.openMessage,
        '',
        `Only <@&${STAFF_ROLE_ID}> can view and claim this ticket.`,
      ].join('\n')
    )
    .addFields(
      { name: 'Opened by', value: `<@${user.id}>`, inline: true },
      { name: 'Ticket #', value: `${type.slug}-${number}`, inline: true },
      { name: 'Status', value: '🟢 Unclaimed', inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${BRAND_NAME} · Ticket System` })
    .setTimestamp();

  await channel.send({
    content: `<@${user.id}> · <@&${STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [buildControlRow(false)],
  });

  await interaction.editReply({
    content: `✅ Your ticket has been created: <#${channel.id}>`,
  });
}

async function claimTicket(interaction) {
  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
  }

  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
    return interaction.reply({
      content: `❌ Only <@&${STAFF_ROLE_ID}> members can claim tickets.`,
      ephemeral: true,
    });
  }

  if (ticket.status === 'claimed') {
    return interaction.reply({
      content: `❌ This ticket has already been claimed by <@${ticket.claimed_by}>.`,
      ephemeral: true,
    });
  }

  db.claimTicket(interaction.channel.id, interaction.user.id);

  const type = typeById(ticket.type);
  const disabledRow = buildControlRow(true);

  await interaction.update({ components: [disabledRow] });

  const claimedEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`🙋 <@${interaction.user.id}> claimed the ticket.`);

  await interaction.channel.send({ embeds: [claimedEmbed] });


  await interaction.channel
    .setTopic(`${type.label} ticket · claimed by ${interaction.user.tag}`)
    .catch(() => {});
}

async function closeTicket(interaction) {
  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
  }

  const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);
  const isOwner = interaction.user.id === ticket.user_id;

  if (!isStaff && !isOwner) {
    return interaction.reply({
      content: `❌ Only <@&${STAFF_ROLE_ID}> or the ticket owner can close this ticket.`,
      ephemeral: true,
    });
  }

  db.closeTicket(interaction.channel.id);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(
      `🔒 This ticket is being closed by <@${interaction.user.id}>. Generating transcript and deleting channel in 5 seconds...`
    );

  await interaction.reply({ embeds: [embed] });


  await sendTranscript(interaction.channel, ticket, interaction.user.id);

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = { openTicket, claimTicket, closeTicket };
