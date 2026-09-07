require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set yourself as AFK")
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Why you're AFK").setRequired(false)
    )
    .toJSON()
];

const rest = new REST().setToken(config.token);

(async () => {
  try {
    if (!config.guildId) {
      console.error("❌ GUILD_ID is not set in .env — cannot register guild slash commands.");
      process.exit(1);
    }
    if (!process.env.CLIENT_ID) {
      console.error(
        "❌ CLIENT_ID is not set in .env. Add CLIENT_ID=<your bot's Application ID> (Developer Portal → General Information) and rerun."
      );
      process.exit(1);
    }
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, config.guildId), {
      body: commands
    });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
})();
