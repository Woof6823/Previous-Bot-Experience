const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');

function bannerAttachment() {
  return new AttachmentBuilder(config.brand.bannerPath, { name: config.brand.bannerAttachment });
}

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(config.brand.color)
    .setFooter({ text: config.brand.footer, iconURL: config.brand.thumbnail })
    .setTimestamp();
}

function welcomeEmbed(member) {
  const { welcomeChannels } = config;
  return baseEmbed()
    .setAuthor({ name: 'APOLLO REGION' })
    .setTitle(`Welcome to Apollo Region, ${member.user.username}!`)
    .setDescription(
      `We're glad to have you here. Apollo Region is dedicated to developing elite talent ` +
      `through competition, discipline, and opportunity.\n\n` +
      `**Get started:**\n` +
      `📜 Read the rules in <#${welcomeChannels.rules}>\n` +
      `📢 Check out <#${welcomeChannels.info}> for the latest info\n` +
      `🚀 Ready to join the team? Open a ticket in <#${welcomeChannels.verify}> to get started\n\n` +
      `Enjoy your stay!`
    )
    .setImage(config.brand.thumbnail)
    .setThumbnail(config.brand.thumbnail);
}

function ticketPanelEmbed() {
  const { ticketTypes } = config;
  const lines = Object.values(ticketTypes)
    .map(t => `${t.emoji} **${t.label}**\n${t.panelDescription}`)
    .join('\n\n');

  return baseEmbed()
    .setAuthor({ name: 'APOLLO REGION SUPPORT' })
    .setTitle('🎫 Open a Ticket')
    .setDescription(
      `Need something from the Apollo Region team? Select the option that best matches ` +
      `your request from the dropdown below and a private ticket channel will be created for you.\n\n` +
      `${lines}\n\n` +
      `**Note:** You may only have **one open ticket at a time**. Please be patient — our team ` +
      `will respond as soon as possible.`
    )
    .setThumbnail(config.brand.thumbnail);
}

function ticketOpenEmbed({ member, typeKey }) {
  const type = config.ticketTypes[typeKey];
  return baseEmbed()
    .setAuthor({ name: 'APOLLO REGION' })
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription(
      `Welcome, ${member}! Thank you for opening a **${type.label}** ticket.\n\n` +
      `${type.description}\n\n` +
      `Please explain your request in as much detail as possible so our team can assist you ` +
      `quickly. A member of staff will be with you shortly.\n\n` +
      `Use the button below to close this ticket once it's resolved.`
    )
    .setThumbnail(config.brand.thumbnail);
}

function closeConfirmEmbed() {
  return baseEmbed()
    .setColor(0xB33A3A)
    .setTitle('⚠️ Close this ticket?')
    .setDescription('This will archive and remove the channel. This action cannot be undone.\n\nAre you sure?');
}

function alreadyOpenEmbed(existingChannelId) {
  return baseEmbed()
    .setColor(0xB33A3A)
    .setTitle('You already have an open ticket')
    .setDescription(
      `You can only have **one open ticket at a time**.\n\n` +
      `Your existing ticket: <#${existingChannelId}>\n\n` +
      `Please use that ticket, or close it before opening a new one.`
    );
}

module.exports = {
  bannerAttachment,
  baseEmbed,
  welcomeEmbed,
  ticketPanelEmbed,
  ticketOpenEmbed,
  closeConfirmEmbed,
  alreadyOpenEmbed
};
