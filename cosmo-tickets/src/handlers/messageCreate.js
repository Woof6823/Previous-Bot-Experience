const { ChannelType, EmbedBuilder } = require('discord.js');
const config = require('../config');
const db = require('../db');
const embeds = require('../embeds');
const ticketManager = require('../ticketManager');

function attachmentsToFiles(message) {



  return [...message.attachments.values()];
}

async function handleDm(message, client) {
  const content = message.content.trim();

  if (content.toLowerCase() === `${config.prefix}close`) {
    const found = ticketManager.getTicketByUser(message.author.id);
    if (!found) {
      await message.channel.send("You don't have an open ticket to close.").catch(() => {});
      return;
    }
    const guild = await client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) {
      await message.channel.send('Something went wrong closing your ticket. Please contact staff directly.').catch(() => {});
      return;
    }
    const result = await ticketManager.closeTicket({ guild, userId: message.author.id, closedBy: message.author.tag });
    if (!result.ok) {
      await message.channel.send("You don't have an open ticket to close.").catch(() => {});
    }

    return;
  }

  const found = ticketManager.getTicketByUser(message.author.id);
  if (!found) {
    await message.channel
      .send(
        "You don't have an open ticket right now. Head to the Cosmo Esports server and use the ticket panel to open one."
      )
      .catch(() => {});
    return;
  }

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return;
  const channel = await guild.channels.fetch(found.ticket.channelId).catch(() => null);
  if (!channel) {

    await ticketManager.handleChannelDeleted(found.ticket.channelId);
    await message.channel
      .send('Your ticket channel no longer exists. Please open a new ticket from the server panel.')
      .catch(() => {});
    return;
  }

  try {
    const relay = new EmbedBuilder()
      .setColor(config.brand.color)
      .setAuthor({ name: `${message.author.tag} has replied with:`, iconURL: message.author.displayAvatarURL() })
      .setDescription(content ? `> ${content.replace(/\n/g, '\n> ')}` : '*[no text content]*')
      .setTimestamp(message.createdAt);

    await channel.send({
      content: `🎟️ **<@${message.author.id}> has replied with:**`,
      embeds: content ? [relay] : [],
      files: attachmentsToFiles(message),
    });

    await message.react('✅').catch(() => {});
  } catch (err) {
    console.error('[messageCreate] Failed to relay DM to ticket channel:', err);
    await message.channel
      .send('Your message could not be delivered to staff right now. Please try again shortly.')
      .catch(() => {});
  }
}

async function handleGuildMessage(message, client) {
  const found = ticketManager.getTicketByChannel(message.channel.id);
  if (!found) return;

  const content = message.content.trim();

  if (content.toLowerCase() === `${config.prefix}close`) {
    const member = message.member;
    if (!member || !ticketManager.isStaffMember(member)) {
      await message.reply("You don't have permission to close this ticket.").catch(() => {});
      return;
    }
    const result = await ticketManager.closeTicket({
      guild: message.guild,
      channelId: message.channel.id,
      closedBy: message.author.tag,
    });
    if (!result.ok) {
      await message.reply('This ticket could not be found in the system.').catch(() => {});
    }
    return;
  }




  const member = message.member;
  if (!member || !ticketManager.isStaffMember(member)) return;

  try {
    const user = await client.users.fetch(found.userId);
    const relay = new EmbedBuilder()
      .setColor(config.brand.color)
      .setAuthor({ name: `${message.author.tag} has replied with:`, iconURL: message.author.displayAvatarURL() })
      .setDescription(content ? `> ${content.replace(/\n/g, '\n> ')}` : '*[no text content]*')
      .setTimestamp(message.createdAt);

    await user.send({
      content: `👤 **Staff Member has replied with:**`,
      embeds: content ? [relay] : [],
      files: attachmentsToFiles(message),
    });
  } catch (err) {
    console.error('[messageCreate] Failed to relay staff message to DM:', err);
    await message.reply("Couldn't deliver that message to the user (they may have DMs disabled).").catch(() => {});
  }
}

async function handleTicketEmbedCommand(message) {
  if (message.author.id !== config.ticketEmbedUserId) {
    await message.reply("You don't have permission to use this command.").catch(() => {});
    return;
  }
  await message.channel.send({ embeds: [embeds.panelEmbed()], components: [embeds.selectMenuRow()] });
}

module.exports = async function messageCreate(message, client) {
  try {


    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
      await handleDm(message, client);
      return;
    }

    if (message.guild && message.guild.id === config.guildId) {
      const content = message.content.trim();
      if (content.toLowerCase() === `${config.prefix}ticketembed`) {
        await handleTicketEmbedCommand(message);
        return;
      }
      await handleGuildMessage(message, client);
    }
  } catch (err) {
    console.error('[messageCreate] Unhandled error:', err);
  }
};
