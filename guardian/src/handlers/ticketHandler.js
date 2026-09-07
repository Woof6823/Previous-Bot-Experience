const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");
const db = require("../database");
const config = require("../config");
const configService = require("../services/configService");
const loggingService = require("../services/loggingService");

const TICKET_TYPES = {
  support: {
    label: "Support",
    emoji: "❓",
    description: "Questions, concerns, reports, or general assistance.",
    color: 0x5865f2
  },
  business: {
    label: "Business Inquiries",
    emoji: "💼",
    description: "Partnerships, sponsorships, investments, and business.",
    color: 0x57f287
  },
  roster: {
    label: "Roster Application",
    emoji: "🏆",
    description: "Apply to join our competitive player roster.",
    color: 0xfee75c
  },
  staff: {
    label: "Staff Application",
    emoji: "🛡️",
    description: "Apply to become a member of the staff team.",
    color: 0xed4245
  }
};

function buildPanelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setAuthor({
      name: `${guild.name} • Support Centre`,
      iconURL: guild.iconURL({ extension: "png", size: 128 }) || undefined
    })
    .setTitle("🎫 Open a Ticket")
    .setDescription([
      "## How can we help?",
      "",
      "Choose the category that best matches what you need. A private ticket will be created for you and the appropriate team will be notified.",
      "",
      "### 📚 Support",
      "Questions, concerns, reports, or general assistance.",
      "",
      "### 💼 Business",
      "Partnerships, sponsorships, investments, and business opportunities.",
      "",
      "### 🏆 Roster",
      "Interested in joining our competitive roster? Submit your application here.",
      "",
      "### 🛡️ Staff",
      "Want to become part of the team? Submit a staff application.",
      "",
      "### 🔒 Private & Confidential",
      "Tickets are only visible to you and authorized staff.",
      "",
      "**Select a category below to get started.**"
    ].join("\n"))
    .setThumbnail(guild.iconURL({ extension: "png", size: 256 }) || null)
    .setFooter({
      text: "Guardian Ticket System • Please choose the correct category"
    })
    .setTimestamp();
}

function buildSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("🎫 Select a ticket category...")
      .addOptions(
        Object.entries(TICKET_TYPES).map(([value, type]) => ({
          label: type.label,
          description: type.description,
          value,
          emoji: type.emoji
        }))
      )
  );
}

function buildTicketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🙋"),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );
}

function buildTicketEmbed(type, user) {
  return new EmbedBuilder()
    .setColor(type.color)
    .setAuthor({
      name: `${user.guild.name} • Ticket Support`,
      iconURL: user.guild.iconURL({ extension: "png", size: 128 }) || undefined
    })
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription([
      `## Welcome, ${user}!`,
      "",
      type.description,
      "",
      "A member of our team will assist you as soon as possible.",
      "",
      "### 📌 While you wait",
      "• Please explain your issue clearly.",
      "• Include screenshots or relevant information when useful.",
      "• Please be patient while staff respond.",
      "",
      "### 🔒 Ticket Controls",
      "Use **Claim Ticket** when a staff member takes responsibility for this ticket.",
      "Use **Close Ticket** when the conversation is complete."
    ].join("\n"))
    .setThumbnail(user.user.displayAvatarURL({ extension: "png", size: 512 }))
    .addFields(
      { name: "👤 Opened By", value: `${user}\n\`${user.id}\``, inline: true },
      { name: "📂 Category", value: type.label, inline: true },
      { name: "🟢 Status", value: "Open", inline: true }
    )
    .setFooter({
      text: "Guardian Ticket System • Staff will be with you shortly"
    })
    .setTimestamp();
}

async function openTicket(interaction, typeKey) {
  const type = TICKET_TYPES[typeKey];
  if (!type) return;

  const guild = interaction.guild;
  const settings = configService.getSettings(guild.id);

  const existing = db.prepare(
    `SELECT * FROM tickets WHERE guildId = ? AND openerId = ? AND category = ? AND status = 'open'`
  ).get(guild.id, interaction.user.id, typeKey);

  if (existing) {
    return interaction.reply({
      content: `⚠️ You already have an open **${type.label}** ticket: <#${existing.channelId}>`,
      ephemeral: true
    });
  }

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (settings.ticketStaffRoleId) {
    overwrites.push({
      id: settings.ticketStaffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const categoryId = db.prepare(
    `SELECT categoryId FROM ticket_categories WHERE guildId = ? AND type = ?`
  ).get(guild.id, typeKey)?.categoryId;

  const channel = await guild.channels.create({
    name: `${typeKey}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90),
    type: ChannelType.GuildText,
    parent: categoryId || settings.ticketCategoryId || undefined,
    permissionOverwrites: overwrites,
    topic: `${type.label} • Opened by ${interaction.user.tag} • Guardian`
  });

  db.prepare(
    `INSERT INTO tickets (guildId, channelId, openerId, category, status, createdAt)
     VALUES (?, ?, ?, ?, 'open', ?)`
  ).run(
    guild.id,
    channel.id,
    interaction.user.id,
    typeKey,
    Date.now()
  );

  await channel.send({
    content: settings.ticketStaffRoleId
      ? `<@&${settings.ticketStaffRoleId}>`
      : undefined,
    embeds: [buildTicketEmbed(type, interaction.member)],
    components: [buildTicketControls()]
  });

  await loggingService.send(guild, {
    title: "🎫 Ticket Opened",
    color: type.color,
    fields: [
      { name: "Ticket", value: `${channel}\n\`${channel.id}\``, inline: true },
      { name: "Opened By", value: `${interaction.user}\n\`${interaction.user.id}\``, inline: true },
      { name: "Category", value: type.label, inline: true }
    ]
  });

  await interaction.reply({
    content: `✅ Your **${type.label}** ticket has been created: ${channel}`,
    ephemeral: true
  });
}

async function claimTicket(interaction) {
  const ticket = db.prepare(
    `SELECT * FROM tickets WHERE channelId = ?`
  ).get(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({
      content: "❌ This isn't a ticket channel.",
      ephemeral: true
    });
  }

  if (ticket.claimedBy) {
    return interaction.reply({
      content: `⚠️ This ticket is already claimed by <@${ticket.claimedBy}>.`,
      ephemeral: true
    });
  }

  db.prepare(
    `UPDATE tickets SET claimedBy = ? WHERE channelId = ?`
  ).run(interaction.user.id, interaction.channel.id);

  await loggingService.send(interaction.guild, {
    title: "🙋 Ticket Claimed",
    color: 0x5865f2,
    fields: [
      { name: "Ticket", value: `#${interaction.channel.name}`, inline: true },
      { name: "Claimed By", value: `${interaction.user}\n\`${interaction.user.id}\``, inline: true },
      { name: "Opened By", value: `<@${ticket.openerId}>`, inline: true }
    ]
  });

  await interaction.reply({
    content: `🙋 **${interaction.user.tag}** has claimed this ticket.`
  });
}

async function closeTicket(interaction) {
  const ticket = db.prepare(
    `SELECT * FROM tickets WHERE channelId = ?`
  ).get(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({
      content: "❌ This isn't a ticket channel.",
      ephemeral: true
    });
  }

  db.prepare(
    `UPDATE tickets SET status = 'closed', closedAt = ?, closedBy = ? WHERE channelId = ?`
  ).run(Date.now(), interaction.user.id, interaction.channel.id);

  await loggingService.send(interaction.guild, {
    title: "🔒 Ticket Closed",
    color: 0xed4245,
    fields: [
      { name: "Ticket", value: `#${interaction.channel.name}\n\`${interaction.channel.id}\``, inline: true },
      { name: "Opened By", value: `<@${ticket.openerId}>`, inline: true },
      { name: "Closed By", value: `${interaction.user}\n\`${interaction.user.id}\``, inline: true },
      { name: "Category", value: TICKET_TYPES[ticket.category]?.label || ticket.category, inline: true },
      { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true }
    ]
  });

  await interaction.reply({
    content: "🔒 This ticket will be closed in **5 seconds**..."
  });

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = {
  TICKET_TYPES,
  buildPanelEmbed,
  buildSelectMenu,
  buildTicketControls,
  openTicket,
  claimTicket,
  closeTicket
};
