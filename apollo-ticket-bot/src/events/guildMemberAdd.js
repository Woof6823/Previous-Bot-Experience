const { Events } = require('discord.js');
const { welcomeEmbed, bannerAttachment } = require('../utils/embeds');
const store = require('../db/ticketStore');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const configuredId = store.getWelcomeChannel(member.guild.id);

    const channel = (configuredId && member.guild.channels.cache.get(configuredId))
      || member.guild.systemChannel
      || member.guild.channels.cache.find(
        c => c.isTextBased?.() && c.name.toLowerCase().includes('welcome')
      );

    if (!channel) {
      console.warn(`[welcome] No welcome channel set for ${member.guild.name}; use *setwelcome. Skipping welcome message.`);
      return;
    }

    try {
      await channel.send({
        content: `${member}`,
        files: [bannerAttachment()],
        embeds: [welcomeEmbed(member)]
      });
    } catch (err) {
      console.error('[welcome] Failed to send welcome message:', err);
    }
  }
};
