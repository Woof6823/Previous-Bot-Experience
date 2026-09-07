const { PermissionsBitField } = require('discord.js');
const { welcomeEmbed, bannerAttachment } = require('../utils/embeds');
const store = require('../db/ticketStore');

module.exports = {
  name: 'testwelcome',
  description: 'Sends a preview of the welcome message to the configured welcome channel. Administrator only.',
  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: '❌ You need the **Administrator** permission to use this command.' })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    const configuredId = store.getWelcomeChannel(message.guild.id);
    const target = (configuredId && message.guild.channels.cache.get(configuredId))
      || message.guild.systemChannel
      || message.guild.channels.cache.find(
        c => c.isTextBased?.() && c.name.toLowerCase().includes('welcome')
      );

    if (!target) {
      return message.reply({ content: '❌ No welcome channel is set. Use `*setwelcome` first.' })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    await target.send({
      content: `${message.author}`,
      files: [bannerAttachment()],
      embeds: [welcomeEmbed(message.member)]
    });

    if (target.id !== message.channel.id) {
      await message.reply({ content: `✅ Sent a preview to ${target}.` })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
    }

    if (message.deletable) await message.delete().catch(() => {});
  }
};
