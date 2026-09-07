const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const config = require("../config");

const PERMISSION_LABELS = {
  warn: "Staff access role",
  mute: "Staff access role + \"Timeout Members\" permission ticked",
  kick: "\"Kick Members\" permission ticked on a role",
  ban: "\"Ban Members\" permission ticked on a role",
  unwarn: "Staff access role",
  unmute: "Staff access role + \"Timeout Members\" permission ticked",
  unban: "\"Ban Members\" permission ticked on a role",
  modlogs: "Staff access role",
  topstaff: "Staff access role or leaderboard role",
  staffstats: "Staff access role or leaderboard role",
  blacklist: "Specific roles only — blacklist channel only",
  removeblacklist: "Specific roles only — blacklist channel only",
  staffblacklist: "Specific roles only — blacklist channel only",
  removestaffblacklist: "Specific roles only — blacklist channel only",
  loa: "Staff access role — LOA channel only",
  close: "Everyone — inside a ticket only",
  afk: "Everyone",
  level: "Everyone — leaderboard channel only",
  leaderboard: "Everyone — leaderboard channel only",
  purge: "Staff access role",
  giverole: "Staff access role",
  removerole: "Staff access role",
  staffcommands: "Staff access role",
  lock: "Voice channel owner",
  unlock: "Voice channel owner",
  permit: "Voice channel owner",
  reject: "Voice channel owner",
  limit: "Voice channel owner",
  rename: "Voice channel owner",
  grinder: "Roster ticket support role — Roster tickets only",
  creator: "Roster ticket support role — Roster tickets only",
  juniorcreator: "Roster ticket support role — Roster tickets only",
  creativeacademy: "Roster ticket support role — Roster tickets only",
  maincreative: "Roster ticket support role — Roster tickets only",
  procreative: "Roster ticket support role — Roster tickets only",
  futureacademy: "Roster ticket support role — Roster tickets only",
  academy: "Roster ticket support role — Roster tickets only",
  future2: "Roster ticket support role — Roster tickets only",
  semipro: "Roster ticket support role — Roster tickets only",
  pro: "Roster ticket support role — Roster tickets only",
  streamer: "Roster ticket support role — Roster tickets only",
  vfxgfx: "Roster ticket support role — Roster tickets only",
  delay: "Ticket staff",
  undelay: "Ticket staff",
  unclaim: "Ticket staff",
  changetype: "Ticket staff",
  htstats: "Staff access role — tickets only",
  searchtracker: "Staff access role",
  epiclogin: "Staff access role",
  servertag: "Staff access role"
};

const CATEGORIES = [
  {
    id: "moderation",
    label: "🛡️ Moderation",
    plainLabel: "Moderation",
    description: "Warnings, mutes, kicks, bans, mod logs, purging, blacklist",
    commands: [
      "warn",
      "unwarn",
      "mute",
      "unmute",
      "kick",
      "ban",
      "unban",
      "modlogs",
      "purge",
      "blacklist",
      "removeblacklist",
      "staffblacklist",
      "removestaffblacklist"
    ]
  },
  {
    id: "tickets",
    label: "🎫 Tickets",
    plainLabel: "Tickets",
    description: "Commands used inside an open ticket",
    commands: ["close", "delay", "undelay", "changetype", "unclaim", "htstats", "searchtracker"]
  },
  {
    id: "roster",
    label: "📋 Roster Applications",
    plainLabel: "Roster Applications",
    description: "Roster-ticket requirement commands, one per role",
    commands: [
      "grinder",
      "creator",
      "juniorcreator",
      "creativeacademy",
      "maincreative",
      "procreative",
      "futureacademy",
      "academy",
      "future2",
      "semipro",
      "pro",
      "streamer",
      "vfxgfx"
    ]
  },
  {
    id: "staff_management",
    label: "🧑‍💼 Staff Management",
    plainLabel: "Staff Management",
    description: "LOA, staff stats, roles",
    commands: [
      "loa",
      "staffstats",
      "topstaff",
      "giverole",
      "removerole",
      "staffcommands"
    ]
  },
  {
    id: "voice",
    label: "🔊 Voice Channels",
    plainLabel: "Voice Channels",
    description: "Manage your own Join-to-Create voice channel",
    commands: ["lock", "unlock", "permit", "reject", "limit", "rename"]
  },
  {
    id: "events",
    label: "🎮 Events & Extras",
    plainLabel: "Events & Extras",
    description: "Staff extras and utilities",
    commands: ["epiclogin", "servertag"]
  },
  {
    id: "everyone",
    label: "🌐 Everyone",
    plainLabel: "Everyone",
    description: "Commands anyone in the server can use",
    commands: ["afk", "level", "leaderboard", "help"]
  }
];

function buildOverviewEmbed(categories = CATEGORIES) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("📖 Staff Commands Guide")
    .setDescription(
      "Pick a category from the dropdown below to see the commands in it — you'll get a private message only you can see.\n" +
        categories.map((c) => `${c.label} — ${c.description}`).join("\n")
    );
}

function buildCategorySelectRow(categories = CATEGORIES) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("staffcommands_category")
    .setPlaceholder("Choose a category...")
    .addOptions(
      categories.map((c) => ({
        label: c.plainLabel,
        description: c.description.slice(0, 100),
        value: c.id
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildCategoryEmbed(client, categoryId, categories = CATEGORIES) {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;

  const allNonOwner = new Map(
    [...client.commands.values()].filter((c) => !c.ownerOnly).map((c) => [c.name, c])
  );

  const fields = category.commands
    .map((name) => allNonOwner.get(name))
    .filter(Boolean)
    .map((c) => ({
      name: `\`${config.prefix}${c.name}\``,
      value: `${c.description}\n**Permission:** ${PERMISSION_LABELS[c.name] || "Everyone"}`
    }));

  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`${category.label}`)
    .setDescription(fields.length ? null : "No commands found in this category.")
    .addFields(fields);
}

function buildGuideEmbeds(client) {
  return CATEGORIES.map((c) => buildCategoryEmbed(client, c.id)).filter(Boolean);
}






const EXCLUDED_CATEGORY_IDS = new Set(["roster", "voice"]);
const EXCLUDED_COMMANDS = new Set([
  "mute",
  "kick",
  "ban",
  "unban",
  "purge",
  "giverole",
  "removerole",
  "blacklist",
  "removeblacklist",
  "staffblacklist",
  "removestaffblacklist"
]);

const ALL_STAFF_CATEGORIES = CATEGORIES.filter((c) => !EXCLUDED_CATEGORY_IDS.has(c.id))
  .map((c) => ({ ...c, commands: c.commands.filter((name) => !EXCLUDED_COMMANDS.has(name)) }))
  .filter((c) => c.commands.length > 0);

module.exports = {
  CATEGORIES,
  ALL_STAFF_CATEGORIES,
  PERMISSION_LABELS,
  buildOverviewEmbed,
  buildCategorySelectRow,
  buildCategoryEmbed,
  buildGuideEmbeds
};
