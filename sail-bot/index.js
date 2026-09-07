require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const { ensureCategories } = require('./src/setupCategories');
const { openTicket, claimTicket, closeTicket } = require('./src/tickets');
const { sendWelcome } = require('./src/welcome');
const { sendGoodbye } = require('./src/goodbye');
const { applyAutoRole } = require('./src/autorole');
const { handleMessage } = require('./src/commands');
const { handleReactionAdd, handleReactionRemove } = require('./src/reactionRoles');
const { checkRaidProtection } = require('./src/security');
const { resumeActiveGiveaways } = require('./src/giveaways');
const db = require('./src/database');
const { STAFF_ROLE_ID } = require('./src/config');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Missing DISCORD_TOKEN in your .env file. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);



  db.grantRolePerm(STAFF_ROLE_ID, 'warn');
  db.grantRolePerm(STAFF_ROLE_ID, 'mute');
  console.log(`[setup] Staff role ${STAFF_ROLE_ID} has warn + mute permission tickets`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureCategories(guild);
      console.log(`[setup] Ticket categories ready in "${guild.name}"`);
    } catch (err) {
      console.error(`[setup] Failed to set up categories in ${guild.name}:`, err);
    }
  }
  resumeActiveGiveaways(client);
  client.user.setActivity('for support tickets 🎫', { type: 3 });
});

client.on('guildMemberAdd', async (member) => {
  try {
    await sendWelcome(member);
  } catch (err) {
    console.error('[welcome] Failed to send welcome message:', err);
  }
  try {
    await applyAutoRole(member);
  } catch (err) {
    console.error('[autorole] Failed to apply autorole:', err);
  }
  try {
    await checkRaidProtection(member);
  } catch (err) {
    console.error('[security] Raid check failed:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    await sendGoodbye(member);
  } catch (err) {
    console.error('[goodbye] Failed to send goodbye message:', err);
  }
});

client.on('messageCreate', async (message) => {
  try {
    await handleMessage(message);
  } catch (err) {
    console.error('[commands] Error handling message command:', err);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    await handleReactionAdd(reaction, user);
  } catch (err) {
    console.error('[reactionRoles] Failed to handle reaction add:', err);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  try {
    await handleReactionRemove(reaction, user);
  } catch (err) {
    console.error('[reactionRoles] Failed to handle reaction remove:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      const typeId = interaction.values[0];
      await openTicket(interaction, typeId);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_claim') {
        await claimTicket(interaction);
        return;
      }
      if (interaction.customId === 'ticket_close') {
        await closeTicket(interaction);
        return;
      }
    }
  } catch (err) {
    console.error('[interaction] Error handling interaction:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction
        .reply({ content: '❌ Something went wrong handling that action.', ephemeral: true })
        .catch(() => {});
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

client.login(process.env.DISCORD_TOKEN);
