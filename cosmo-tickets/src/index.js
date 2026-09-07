require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const readyHandler = require('./handlers/ready');
const interactionCreateHandler = require('./handlers/interactionCreate');
const messageCreateHandler = require('./handlers/messageCreate');
const channelDeleteHandler = require('./handlers/channelDelete');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and set your bot token.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],


  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', () => readyHandler(client));

client.on('interactionCreate', (interaction) => interactionCreateHandler(interaction));

client.on('messageCreate', (message) => messageCreateHandler(message, client));

client.on('channelDelete', (channel) => channelDeleteHandler(channel));


process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

client.login(process.env.DISCORD_TOKEN);
