const {
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const config = require('./config');
const db = require('./db');
const embeds = require('./embeds');





const creatingUsers = new Set();

function isStaffMember(member) {
  return member.roles.cache.some((r) => config.staffRoleIds.includes(r.id));
}

async function findOrCreateCategory(guild, categoryName) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === categoryName
  );
  if (category) return category;

  category = await guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory,
    permissionOverwrites: buildPermissionOverwrites(guild),
  });
  return category;
}

function buildPermissionOverwrites(guild) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ManageChannels,
      ],
    },
  ];

  for (const roleId of config.staffRoleIds) {
    if (!guild.roles.cache.has(roleId)) {
      console.warn(`[ticketManager] Staff role ${roleId} not found on guild ${guild.id} — skipping overwrite for it.`);
      continue;
    }
    overwrites.push({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
      ],
    });
  }

  return overwrites;
}


async function nextTicketNumber(typeKey) {
  return db.mutate((state) => {
    const current = state.counters[typeKey] || 0;
    const next = current + 1;
    state.counters[typeKey] = next;
    return next;
  });
}

function userHasActiveTicket(userId) {
  const state = db.getState();
  return state.active[userId] || null;
}


async function createTicket({ guild, user, typeKey }) {
  const type = config.ticketTypes[typeKey];
  if (!type) return { ok: false, reason: 'Unknown ticket type.' };

  if (creatingUsers.has(user.id)) {
    return { ok: false, reason: 'already_creating' };
  }

  const existing = userHasActiveTicket(user.id);
  if (existing) {
    return { ok: false, reason: 'already_open', existing };
  }

  creatingUsers.add(user.id);
  try {


    const stillExisting = userHasActiveTicket(user.id);
    if (stillExisting) {
      return { ok: false, reason: 'already_open', existing: stillExisting };
    }

    const category = await findOrCreateCategory(guild, type.categoryName);
    const number = await nextTicketNumber(type.key);
    const channelName = `${type.channelPrefix} - ${number}`;

    let channel;
    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: buildPermissionOverwrites(guild),
        topic: `Cosmo Esports ticket • ${type.label} • Owner: ${user.id}`,
      });
    } catch (err) {
      console.error('[ticketManager] Failed to create ticket channel:', err);
      return { ok: false, reason: 'channel_create_failed' };
    }




    await db.mutate((state) => {
      state.active[user.id] = {
        type: type.key,
        number,
        channelId: channel.id,
        createdAt: Date.now(),
        status: 'open',
      };
      state.byChannel[channel.id] = user.id;
    });

    const ticketLabel = `${type.channelPrefix} - ${number}`;
    const pingContent = config.staffRoleIds.map((id) => `<@&${id}>`).join(' ');

    try {
      await channel.send({ content: pingContent, embeds: [embeds.newTicketEmbed({ type, number, user })] });
    } catch (err) {
      console.error('[ticketManager] Failed to send ticket-opened message:', err);
    }

    let dmFailed = false;
    try {
      await user.send({ embeds: [embeds.dmOpenedEmbed({ ticketLabel })] });
    } catch (err) {
      dmFailed = true;
      try {
        await channel.send({
          content: `⚠️ I couldn't DM <@${user.id}> (they may have DMs disabled). Staff will need to reach out to them another way.`,
        });
      } catch (_) {

      }
    }

    return { ok: true, channel, ticketLabel, dmFailed };
  } finally {
    creatingUsers.delete(user.id);
  }
}


async function closeTicket({ guild, userId, channelId, closedBy }) {
  const state = db.getState();

  let resolvedUserId = userId;
  if (!resolvedUserId && channelId) {
    resolvedUserId = state.byChannel[channelId];
  }
  if (!resolvedUserId) {
    return { ok: false, reason: 'not_found' };
  }

  const ticket = state.active[resolvedUserId];
  if (!ticket) {
    return { ok: false, reason: 'not_found' };
  }

  const type = config.ticketTypes[ticket.type];
  const ticketLabel = `${type ? type.channelPrefix : ticket.type} - ${ticket.number}`;



  await db.mutate((s) => {
    delete s.active[resolvedUserId];
    delete s.byChannel[ticket.channelId];
  });


  try {
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) await channel.delete(`Ticket closed by ${closedBy || 'system'}`);
  } catch (err) {
    console.error('[ticketManager] Failed to delete ticket channel (continuing anyway):', err);
  }


  try {
    const user = await guild.client.users.fetch(resolvedUserId);
    await user.send({ embeds: [embeds.dmClosedEmbed({ ticketLabel })] });
  } catch (err) {
    console.error('[ticketManager] Failed to DM close confirmation (continuing anyway):', err);
  }

  return { ok: true, ticketLabel, userId: resolvedUserId };
}


async function handleChannelDeleted(channelId) {
  const state = db.getState();
  const userId = state.byChannel[channelId];
  if (!userId) return;

  const ticket = state.active[userId];
  await db.mutate((s) => {
    delete s.active[userId];
    delete s.byChannel[channelId];
  });

  if (ticket) {
    console.log(`[ticketManager] Detected manual deletion of ${ticket.type} - ${ticket.number}, state cleaned up.`);
  }
}

function getTicketByChannel(channelId) {
  const state = db.getState();
  const userId = state.byChannel[channelId];
  if (!userId) return null;
  return { userId, ticket: state.active[userId] };
}

function getTicketByUser(userId) {
  const state = db.getState();
  const ticket = state.active[userId];
  if (!ticket) return null;
  return { userId, ticket };
}

module.exports = {
  isStaffMember,
  createTicket,
  closeTicket,
  handleChannelDeleted,
  getTicketByChannel,
  getTicketByUser,
  userHasActiveTicket,
};
