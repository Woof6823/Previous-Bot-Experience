require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleMessage } = require('./commands');
const { ensureCategoriesExist } = require('./setupCategories');
const { sendWelcomeMessage } = require('./welcome');
const { handleOpenTicket, handleClaimTicket, handleCloseTicket } = require('./tickets');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureCategoriesExist(guild);
    } catch (err) {
      console.error(`Failed to set up categories for guild ${guild.id}:`, err);
    }
  }
});

client.on('guildCreate', async (guild) => {
  try {
    await ensureCategoriesExist(guild);
  } catch (err) {
    console.error(`Failed to set up categories for new guild ${guild.id}:`, err);
  }
});

client.on('messageCreate', async (message) => {
  try {
    await handleMessage(message);
  } catch (err) {
    console.error('Error handling message command:', err);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    await sendWelcomeMessage(member);
  } catch (err) {
    console.error('Error sending welcome message:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
      const type = interaction.values[0];
      await handleOpenTicket(interaction, type);
      return;
    }


    if (interaction.isButton()) {
      if (interaction.customId === 'claim_ticket') {
        await handleClaimTicket(interaction);
        return;
      }
      if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
        return;
      }
    }
  } catch (err) {
    console.error('Error handling interaction:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction
        .reply({ content: 'Something went wrong handling that action.', ephemeral: true })
        .catch(() => {});
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

client.login(process.env.DISCORD_TOKEN);
