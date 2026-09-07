const { getWelcomeChannel } = require("../database");
const { buildFullWelcome } = require("../utils/welcomeEmbed");


async function execute(message) {
  if (message.author.id !== process.env.OWNER_ID) {
    return message.reply({
      content: "❌ Only the bot owner can use this command.",
      allowedMentions: { repliedUser: false },
    });
  }

  const channelId = getWelcomeChannel(message.guild.id);

  if (!channelId) {
    return message.reply({
      content:
        "⚠️ No welcome channel has been set yet. Use `*setwelcome #channel` first.",
      allowedMentions: { repliedUser: false },
    });
  }

  const welcomeChannel = message.guild.channels.cache.get(channelId);

  if (!welcomeChannel) {
    return message.reply({
      content:
        "❌ The saved welcome channel no longer exists. Please run `*setwelcome #channel` again.",
      allowedMentions: { repliedUser: false },
    });
  }


  const allChannels = message.guild.channels.cache;
  const playerReq =
    allChannels.find((c) => c.name === "player-requirements") || null;
  const staffReq =
    allChannels.find((c) => c.name === "staff-requirements") || null;
  const contactUs =
    allChannels.find((c) => c.name === "contact-us") || null;


  const authorUser = await message.author.fetch();

  const { embeds, files } = buildFullWelcome(authorUser, {
    playerReq,
    staffReq,
    contactUs,
  });

  try {
    await welcomeChannel.send({ embeds, files });
    return message.reply({
      content: `✅ Test welcome message sent to <#${channelId}>.`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
  } catch (err) {
    console.error("[testwelcome] Failed to send:", err);
    return message.reply({
      content: `❌ Failed to send the test message. Error: \`${err.message}\``,
      allowedMentions: { repliedUser: false },
    });
  }
}

module.exports = { execute };
