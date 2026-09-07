const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../config');
const store = require('../db/ticketStore');
const { ticketOpenEmbed, bannerAttachment } = require('./embeds');

const OVERWRITE_ALLOW = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.EmbedLinks
];


async function getOrCreateCategory(guild, typeKey) {
  const type = config.ticketTypes[typeKey];
  const cachedId = store.getCategoryId(guild.id, typeKey);

  if (cachedId) {
    const existing = guild.channels.cache.get(cachedId);
    if (existing && existing.type === ChannelType.GuildCategory) return existing;
  }

  const byName = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory &&
      c.name.toLowerCase() === type.categoryName.toLowerCase()
  );
  if (byName) {
    store.setCategoryId(guild.id, typeKey, byName.id);
    return byName;
  }

  const created = await guild.channels.create({
    name: type.categoryName,
    type: ChannelType.GuildCategory
  });
  store.setCategoryId(guild.id, typeKey, created.id);
  return created;
}


async function createTicketChannel(guild, member, typeKey) {
  const type = config.ticketTypes[typeKey];
  const category = await getOrCreateCategory(guild, typeKey);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: member.id,
      allow: OVERWRITE_ALLOW
    },
    {
      id: guild.members.me.id,
      allow: [...OVERWRITE_ALLOW, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages]
    },
    ...type.roles.map(roleId => ({
      id: roleId,
      allow: OVERWRITE_ALLOW
    }))
  ];

  const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  const channel = await guild.channels.create({
    name: `${typeKey}-${safeName}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket type: ${type.label} | Opened by: ${member.id}`,
    permissionOverwrites
  });



  try {
    store.createTicket({
      channelId: channel.id,
      userId: member.id,
      guildId: guild.id,
      type: typeKey
    });
  } catch (err) {
    await channel.delete('Rolled back: user already had an open ticket (race detected)').catch(() => {});
    throw new Error('DUPLICATE_TICKET');
  }

  const rolePing = type.roles.map(r => `<@&${r}>`).join(' ');
  await channel.send({ content: rolePing });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    files: [bannerAttachment()],
    embeds: [ticketOpenEmbed({ member, typeKey })],
    components: [closeRow]
  });

  return channel;
}

async function closeTicketChannel(channel, closer) {
  store.closeTicket(channel.id);
  await channel.send(`🔒 Ticket closed by ${closer}. This channel will be deleted shortly.`).catch(() => {});
  setTimeout(() => {
    channel.delete('Ticket closed').catch(() => {});
  }, 5000);
}

module.exports = {
  getOrCreateCategory,
  createTicketChannel,
  closeTicketChannel
};
