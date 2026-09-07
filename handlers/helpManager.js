const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");
const config = require("../config");

const CATEGORIES = [
  {
    id: "setup",
    label: "⚙️ Setup & Config",
    description: "Server setup, channels, roles, and panels"
  },
  {
    id: "moderation",
    label: "🛡️ Moderation & Roles",
    description: "Purge, give/remove roles, permission overrides"
  },
  {
    id: "automod",
    label: "🤖 Automod & Security",
    description: "Filters, triggers, auto-replies, and security toggles"
  },
  { id: "events", label: "🎮 Events & Games", description: "Races, guess the number" },
  {
    id: "system",
    label: "🔧 System & Testing",
    description: "Bot status, pings, tests, and guides"
  }
];

function categorizeCommand(name) {
  if (name.includes("setup") || name.startsWith("set") || name === "ticketembed") return "setup";
  if (["purge", "giverole", "removerole", "addcommandperms", "removecommandperms"].includes(name))
    return "moderation";
  if (
    name.includes("block") ||
    name.includes("whitelist") ||
    name.includes("trigger") ||
    name.includes("autoreply") ||
    name.startsWith("anti") ||
    name.startsWith("security")
  )
    return "automod";
  if (["claimrace", "guessgame"].includes(name)) return "events";
  return "system";
}

function buildOverviewEmbed() {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🛠️ Owner Commands Guide")
    .setDescription(
      "Select a category from the dropdown below to view the owner-only commands in it.\n\n" +
        CATEGORIES.map((c) => `**${c.label}** — ${c.description}`).join("\n")
    );
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_category")
    .setPlaceholder("Choose a category...")
    .addOptions(
      CATEGORIES.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.label)
          .setDescription(c.description.slice(0, 100))
          .setValue(c.id)
      )
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildCategoryEmbed(client, categoryId) {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;


  const uniqueCommands = new Map();
  for (const cmd of client.commands.values()) {
    if (cmd.ownerOnly) {
      uniqueCommands.set(cmd.name, cmd);
    }
  }

  const commandsInCategory = [...uniqueCommands.values()]
    .filter((cmd) => categorizeCommand(cmd.name) === categoryId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const fields = commandsInCategory.map((cmd) => ({
    name: `\`${config.prefix}${cmd.name}\``,
    value: (cmd.description || "No description.").slice(0, 1024)
  }));

  const embed = new EmbedBuilder().setColor(config.brandColor).setTitle(category.label);

  if (fields.length > 0) {
    embed.addFields(fields);
  } else {
    embed.setDescription("No commands found in this category.");
  }

  return embed;
}

module.exports = {
  CATEGORIES,
  buildOverviewEmbed,
  buildSelectRow,
  buildCategoryEmbed
};
