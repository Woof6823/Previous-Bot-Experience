const { setWelcomeChannel } = require("../database");


async function execute(message) {
  const ownerOnly = message.author.id !== process.env.OWNER_ID;
  if (ownerOnly) {
    return message.reply({
      content: "❌ Only the bot owner can use this command.",
      allowedMentions: { repliedUser: false },
    });
  }


  const channelMention = message.mentions.channels.first();

  if (!channelMention) {
    return message.reply({
      content:
        "⚠️ Please mention a channel. Usage: `*setwelcome #channel`",
      allowedMentions: { repliedUser: false },
    });
  }


  const botMember = await channelMention.guild.members.fetchMe();
  const permissions = channelMention.permissionsFor(botMember);

  if (!permissions.has("SendMessages") || !permissions.has("EmbedLinks")) {
    return message.reply({
      content:
        "❌ I don't have permission to send messages or embed links in that channel. Please grant me those permissions first.",
      allowedMentions: { repliedUser: false },
    });
  }


  setWelcomeChannel(message.guild.id, channelMention.id);

  return message.reply({
    content: `✅ Welcome channel has been set to <#${channelMention.id}>. New members will receive the Exceed Reality welcome message there.`,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

module.exports = { execute };
