const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");

const config = require("./config");

if (!config.token || !config.guildId || !config.ownerId) {
  console.error(
    "❌ Missing DISCORD_TOKEN, GUILD_ID, or OWNER_ID in .env — see .env.example. Exiting."
  );
  process.exit(1);
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildWebhooks
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const loaded = require(path.join(commandsPath, file));
  const commandList = Array.isArray(loaded) ? loaded : [loaded];
  for (const command of commandList) {
    client.commands.set(command.name, command);
    for (const alias of command.aliases || []) {
      client.commands.set(alias, command);
    }
  }
}
console.log(`Loaded ${client.commands.size} command(s).`);

const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}
console.log("Loaded events.");

client.on("error", (err) => console.error("Discord client error:", err));
client.on("shardDisconnect", () =>
  console.warn("⚠️ Shard disconnected, attempting to reconnect...")
);
client.on("shardReconnecting", () => console.log("🔄 Reconnecting to Discord..."));
client.on("shardResume", () => console.log("✅ Shard resumed."));







if (process.env.ENABLE_PARTY_SYSTEM === "true") {
  try {
    const { startPartyServer } = require("./party/server");
    startPartyServer(client);
  } catch (err) {
    console.error("⚠️ Party backend failed to start (bot is unaffected):", err.message);
  }
}




if (process.env.ENABLE_ROSTER_API === "true") {
  try {
    const { startRosterApi } = require("./web/server");
    startRosterApi(client);
  } catch (err) {
    console.error("⚠️ Roster API failed to start (bot is unaffected):", err.message);
  }
}

client.login(config.token).catch((err) => {
  console.error("❌ Failed to log in — check DISCORD_TOKEN in .env:", err.message);
  process.exit(1);
});





let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  client.destroy();



  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
