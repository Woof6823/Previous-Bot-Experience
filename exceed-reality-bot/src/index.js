require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  Collection,
} = require("discord.js");
const path = require("path");
const fs = require("fs");

const { getWelcomeChannel } = require("./database");
const { buildFullWelcome } = require("./utils/welcomeEmbed");


if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === "YOUR_BOT_TOKEN_HERE") {
  console.error("[FATAL] DISCORD_TOKEN is not set in .env");
  process.exit(1);
}
if (!process.env.OWNER_ID) {
  console.error("[FATAL] OWNER_ID is not set in .env");
  process.exit(1);
}


const bannerPath = path.join(__dirname, "..", "assets", "banner.png");
if (!fs.existsSync(bannerPath)) {
  console.error(
    `[FATAL] Banner image not found at: ${bannerPath}\n` +
    `Please place your Exceed Reality banner as assets/banner.png`
  );
  process.exit(1);
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});


client.commands = new Collection();

const commandFiles = fs
  .readdirSync(path.join(__dirname, "commands"))
  .filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const name = file.replace(".js", "");
  client.commands.set(name, require(`./commands/${file}`));
}

console.log(`[INIT] Loaded ${client.commands.size} command(s): ${[...client.commands.keys()].join(", ")}`);


client.once(Events.ClientReady, async (c) => {
  console.log(`[READY] Logged in as ${c.user.tag} (${c.user.id})`);
  console.log(`[READY] Serving ${c.guilds.cache.size} guild(s)`);
  await c.user.setActivity("Exceed Reality™", { type: 3 });
});


client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("*")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`[ERROR] Command "${commandName}" threw:`, err);
    try {
      await message.reply({
        content: `❌ An error occurred while running \`${commandName}\`.`,
        allowedMentions: { repliedUser: false },
      });
    } catch (_) {}
  }
});


client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const channelId = getWelcomeChannel(member.guild.id);
    if (!channelId) return;

    const welcomeChannel = member.guild.channels.cache.get(channelId);
    if (!welcomeChannel) return;


    const allChannels = member.guild.channels.cache;
    const playerReq =
      allChannels.find((c) => c.name === "player-requirements") || null;
    const staffReq =
      allChannels.find((c) => c.name === "staff-requirements") || null;
    const contactUs =
      allChannels.find((c) => c.name === "contact-us") || null;


    const user = await member.user.fetch();

    const { embeds, files } = buildFullWelcome(user, {
      playerReq,
      staffReq,
      contactUs,
    });

    await welcomeChannel.send({ embeds, files });
    console.log(
      `[WELCOME] Sent welcome to ${user.tag} in ${member.guild.name} → #${welcomeChannel.name}`
    );
  } catch (err) {
    console.error(`[WELCOME ERROR] Guild ${member.guild.id}:`, err);
  }
});


process.on("unhandledRejection", (err) => {
  console.error("[UNHANDLED REJECTION]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
});


client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[FATAL] Failed to login:", err);
  process.exit(1);
});
