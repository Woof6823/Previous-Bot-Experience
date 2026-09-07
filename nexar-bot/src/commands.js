const { PREFIX, OWNER_USER_ID } = require('./config');
const { buildTicketPanel } = require('./ticketPanel');
const { setConfig } = require('./database');
const { sendWelcomeMessage } = require('./welcome');

async function handleMessage(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();


  if (message.author.id !== OWNER_USER_ID) return;

  if (commandName === 'ticketembed') {
    const panel = buildTicketPanel();
    await message.channel.send(panel);
    await message.delete().catch(() => {});
    return;
  }

  if (commandName === 'setwelcome') {
    const channel = message.mentions.channels.first() || message.channel;
    setConfig('welcome_channel', channel.id);
    await message.reply(`✅ Welcome channel set to ${channel}.`);
    return;
  }

  if (commandName === 'testwelcome') {

    try {
      await sendWelcomeMessage(message.member);
      await message.reply('📨 Welcome message sent! Check the welcome channel.');
    } catch (err) {
      console.error(err);
      await message.reply('❌ Failed to send welcome message. Is the channel set? (`*setwelcome`)');
    }
    return;
  }
}

module.exports = { handleMessage };
