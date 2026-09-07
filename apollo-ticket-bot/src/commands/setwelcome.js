const { PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../db/ticketStore');

module.exports = {
  name: 'setwelcome',
  description: 'Sets this channel (or a mentioned channel) as the welcome message channel. Administrator only.',
  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: '❌ You need the **Administrator** permission to use this command.' })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    const target = message.mentions.channels.first() || message.channel;

    if (target.type !== ChannelType.GuildText) {
      return message.reply({ content: '❌ Please pick a normal text channel.' })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    store.setWelcomeChannel(message.guild.id, target.id);

    await message.channel.send({ content: `✅ Welcome messages will now be sent to ${target}.` });
    if (message.deletable) await message.delete().catch(() => {});
  }
};
