const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("./config");
const commandHandler = require("./handlers/commandHandler");
const loggingService = require("./services/loggingService");
const setupService = require("./services/setupService");
const channelMigrationService = require("./services/channelMigrationService");

if (!config.token) {
  console.error("BOT_TOKEN is not set.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User
  ]
});

commandHandler.loadCommands();

const eventsDir = path.join(__dirname, "events");

for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith(".js"))) {
  const event = require(path.join(eventsDir, file));

  if (!event?.name || typeof event.execute !== "function") continue;

  client.on(event.name, (...args) => {
    event.execute(...args).catch(err => {
      console.error(`[event:${event.name}]`, err);
    });
  });
}

client.on("messageDelete", message =>
  loggingService.messageDelete(message).catch(() => {})
);

client.on("messageUpdate", (oldMessage, newMessage) =>
  loggingService.messageUpdate(oldMessage, newMessage).catch(() => {})
);

client.on("guildMemberAdd", member =>
  loggingService.memberJoin(member).catch(() => {})
);

client.on("guildMemberRemove", member =>
  loggingService.memberLeave(member).catch(() => {})
);

client.on("guildMemberUpdate", (oldMember, newMember) =>
  loggingService.memberUpdate(oldMember, newMember).catch(() => {})
);

client.on("channelCreate", channel => {
  if (channel.guild) loggingService.channel(channel.guild, "created", channel).catch(() => {});
});

client.on("channelDelete", channel => {
  if (channel.guild) loggingService.channel(channel.guild, "deleted", channel).catch(() => {});
});

client.on("channelUpdate", (oldChannel, newChannel) => {
  if (newChannel.guild) loggingService.channel(newChannel.guild, "updated", newChannel).catch(() => {});
});

client.on("roleCreate", role =>
  loggingService.role(role.guild, "created", role).catch(() => {})
);

client.on("roleDelete", role =>
  loggingService.role(role.guild, "deleted", role).catch(() => {})
);

client.on("roleUpdate", (oldRole, newRole) =>
  loggingService.role(newRole.guild, "updated", newRole).catch(() => {})
);

client.on("guildBanAdd", ban =>
  loggingService.ban(ban.guild, ban, "Banned").catch(() => {})
);

client.on("guildBanRemove", ban =>
  loggingService.ban(ban.guild, ban, "Unbanned").catch(() => {})
);

client.on("voiceStateUpdate", (oldState, newState) =>
  loggingService.voice(oldState, newState).catch(() => {})
);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s) with prefix "${config.prefix}"`);

  await setupService.setupAllGuilds(client).catch(err => {
    console.error("[setup]", err);
  });

  for (const guild of client.guilds.cache.values()) {
    await channelMigrationService.runOnce(guild).catch(err => {
      console.error("[channel-migration]", err);
    });
  }


  for (const guild of client.guilds.cache.values()) {
    await loggingService.send(guild, {
      title: "🟢 Guardian Online",
      color: 0x57f287,
      description: "Guardian has successfully connected and is now monitoring the server.",
      fields: [
        { name: "Bot", value: `${client.user}\n\`${client.user.id}\``, inline: true },
        { name: "Guild", value: `${guild.name}\n\`${guild.id}\``, inline: true },
        { name: "Members", value: String(guild.memberCount), inline: true },
        { name: "Monitoring", value: "Security • Moderation • Members • Roles • Channels • Messages • Voice • Tickets" }
      ]
    });
  }
});

process.on("unhandledRejection", err =>
  console.error("[unhandledRejection]", err)
);

process.on("uncaughtException", err =>
  console.error("[uncaughtException]", err)
);

client.login(config.token);
