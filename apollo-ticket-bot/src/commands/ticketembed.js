const { PermissionsBitField } = require('discord.js');
const { ticketPanelEmbed, bannerAttachment } = require('../utils/embeds');
const { buildTicketSelectRow } = require('../utils/ticketPanelComponents');

module.exports = {
  name: 'ticketembed',
  description: 'Posts the ticket creation panel in this channel. Administrator only.',
  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: '❌ You need the **Administrator** permission to use this command.' })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    await message.channel.send({
      files: [bannerAttachment()],
      embeds: [ticketPanelEmbed()],
      components: [buildTicketSelectRow()]
    });


    if (message.deletable) await message.delete().catch(() => {});
  }
};
