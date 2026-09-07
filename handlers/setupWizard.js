const { ChannelType, PermissionsBitField } = require("discord.js");
const config = require("../config");
const db = require("../database");
const settings = require("../settings");
const ticketManager = require("../handlers/ticketManager");
const loaManager = require("../handlers/loaManager");
const suggestionsManager = require("../handlers/suggestionsManager");
const blacklistManager = require("../handlers/blacklistManager");
const statsManager = require("../handlers/statsManager");
const tempVoiceManager = require("../handlers/tempVoiceManager");
const { buildGuideEmbeds } = require("../handlers/commandsGuideBuilder");
const { buildPermsPanel } = require("../commands/setupperms");








class SetupTimeoutError extends Error {
  constructor() {
    super("Setup timed out");
    this.name = "SetupTimeoutError";
  }
}

const ROLE_DEFINITIONS = {
  staffAccessRoleId: { label: "Staff access role" },
  staffRoleId: { label: "Ticket staff role" },
  rosterSupportRoleId: { label: "Roster support role" },
  staffBlacklistRoleId: { label: "Staff blacklist role" },
  ticketPingRoleId: { label: "Ticket ping role" }
};

const LEVEL_ROLE_NAMES = {
  5: "Level 5",
  10: "Level 10",
  15: "Level 15",
  25: "Level 25",
  50: "Level 50",
  100: "Level 100"
};

const CHANNEL_DEFINITIONS = {
  welcomeChannelId: { label: "Welcome messages", type: "text" },
  ticketTranscriptChannelId: { label: "Ticket transcripts", type: "text" },
  blacklistChannelId: { label: "Blacklist system", type: "text" },
  loaChannelId: { label: "Leave of absence (LOA)", type: "text" },
  mediaOnlyChannelId: { label: "Media-only", type: "text" },
  suggestionsChannelId: { label: "Suggestions", type: "text" },
  filteredChannelId: { label: "Filtered chat", type: "text" },
  generalChatChannelId: { label: "General chat", type: "text" },
  lfpChannelId: { label: "Looking for players", type: "text" },
  teamRequirementsChannelId: { label: "Team requirements", type: "text" },
  teamApplyChannelId: { label: "Team applications / ticket panel", type: "text" },
  staffCommandsGuideChannelId: { label: "Staff commands guide", type: "text" },
  ticketFarmingAlertChannelId: { label: "Ticket farming alerts", type: "text" },
  levelLeaderboardChannelId: { label: "Level leaderboard", type: "text" },
  levelUpChannelId: { label: "Level-up announcements", type: "text" },
  ticketStatsChannelId: { label: "Ticket statistics", type: "text" }
};

const TICKET_TYPES = Object.entries(config.ticketTypes).map(([type, definition]) => ({
  key: `category_${type}`,
  label: `${definition.label} ticket category`,
  type: "category"
}));

const EXTRA_CHANNELS = [
  { key: "stats_category_id", label: "Member statistics category", type: "category" },
  { key: "stats_members_channel_id", label: "Member-count voice channel", type: "voice" },
  { key: "stats_goal_channel_id", label: "Member-goal voice channel", type: "voice" },
  { key: "temp_vc_category_id", label: "Temporary voice category", type: "category" },
  { key: "temp_vc_join_channel_id", label: "Join-to-create voice channel", type: "voice" }
];

function getConfiguredChannelId(key) {
  return key === "ticketStatsChannelId"
    ? db.getSetting("ticket_stats_channel_id")
    : settings.get(key);
}

function setConfiguredChannelId(key, id) {
  if (key === "ticketStatsChannelId") {
    db.setSetting("ticket_stats_channel_id", id || "");
  } else {
    settings.set(key, id || "");
  }
}

function findRole(guild, id) {
  return (id && guild.roles.cache.get(id)) || null;
}

function findChannel(guild, id) {
  return (id && guild.channels.cache.get(id)) || null;
}

function mentionChannel(guild, id) {
  const channel = findChannel(guild, id);
  return channel ? `${channel} (${channel.name})` : "`not configured`";
}

function mentionRole(guild, id) {
  const role = findRole(guild, id);
  return role ? `${role} (${role.name})` : "`not configured`";
}

function currentConfiguration(guild) {
  const roleLines = Object.keys(ROLE_DEFINITIONS).map(
    (key) => `**${ROLE_DEFINITIONS[key].label}:** ${mentionRole(guild, settings.get(key))}`
  );

  const channelLines = Object.entries(CHANNEL_DEFINITIONS).map(
    ([key, definition]) =>
      `**${definition.label}:** ${mentionChannel(guild, getConfiguredChannelId(key))}`
  );

  const extraLines = [...TICKET_TYPES, ...EXTRA_CHANNELS].map(
    (definition) =>
      `**${definition.label}:** ${mentionChannel(guild, db.getSetting(definition.key))}`
  );

  const levelLines = Object.entries(settings.getObject("levelRoles"))
    .map(([level, id]) => `Level ${level}: ${mentionRole(guild, id)}`)
    .join(", ");

  return [
    "**Roles**",
    ...roleLines,
    "",
    "**Channels**",
    ...channelLines,
    "",
    "**Categories and voice systems**",
    ...extraLines,
    "",
    `**Level rewards:** ${levelLines || "`not configured`"}`,
    `**Log channel:** ${mentionChannel(guild, db.getSetting("log_channel_id"))}`
  ].join("\n");
}

async function sendLong(channel, content) {
  const lines = String(content).split("\n");
  let chunk = "";

  for (const line of lines) {
    if (chunk && chunk.length + line.length + 1 > 1900) {
      await channel.send(chunk);
      chunk = "";
    }

    chunk += `${line}\n`;
  }

  if (chunk.trim()) await channel.send(chunk.trim());
}

function typeMatches(channel, type) {
  if (type === "category") return channel.type === ChannelType.GuildCategory;

  if (type === "voice") {
    return (
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildStageVoice
    );
  }

  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum
  );
}

function channelTypeHint(type) {
  if (type === "category") return "an existing category";
  if (type === "voice") return "an existing voice channel";
  return "an existing text channel";
}

function resolveChannelAnswer(message, guild, type) {
  const mentioned = message.mentions.channels.first();
  const raw = message.content.trim().replace(/^<#!?(\d+)>$/, "$1");

  const channel =
    mentioned ||
    guild.channels.cache.get(raw) ||
    guild.channels.cache.find(
      (candidate) => candidate.name.toLowerCase() === raw.replace(/^#/, "").toLowerCase()
    );

  if (!channel) {
    throw new Error(
      `I couldn't find that channel. Please mention ${channelTypeHint(type)}.`
    );
  }

  if (!typeMatches(channel, type)) {
    throw new Error(
      `That is not ${channelTypeHint(type)}. Please choose the correct channel type.`
    );
  }

  return channel;
}

async function askChannel(message, guild, label, type, existingId) {
  const existing = findChannel(guild, existingId);
  const current = existing ? ` Current: ${existing}.` : "";

  await message.channel.send(
    `**${label}** — mention ${channelTypeHint(type)} or paste its channel ID.${current}\n` +
      "Type `skip` to leave this feature disabled."
  );

  while (true) {
    const collected = await message.channel.awaitMessages({
      filter: (reply) => reply.author.id === message.author.id,
      max: 1,
      time: 120000
    });

    const reply = collected.first();

    if (!reply) throw new SetupTimeoutError();

    const answer = reply.content.trim().toLowerCase();

    if (answer === "skip" || answer === "none" || answer === "disable") {
      return null;
    }

    try {
      const channel = resolveChannelAnswer(reply, guild, type);
      await reply.react("✅").catch(() => {});
      return channel;
    } catch (err) {
      await message.channel.send(`❌ ${err.message} Try that question again.`);
    }
  }
}

async function askRole(message, guild, label, existingId) {
  const existing = findRole(guild, existingId);
  const current = existing ? ` Current: ${existing}.` : "";

  await message.channel.send(
    `**${label}** — mention an existing role or paste its role ID.${current}\n` +
      "Type `skip` to leave this role unconfigured."
  );

  while (true) {
    const collected = await message.channel.awaitMessages({
      filter: (reply) => reply.author.id === message.author.id,
      max: 1,
      time: 120000
    });

    const reply = collected.first();

    if (!reply) throw new SetupTimeoutError();

    const answer = reply.content.trim().toLowerCase();

    if (answer === "skip" || answer === "none" || answer === "disable") {
      return null;
    }

    const raw = reply.content.trim().replace(/^<@&(\d+)>$/, "$1");
    const role = guild.roles.cache.get(raw);

    if (role && role.id !== guild.id) {
      await reply.react("✅").catch(() => {});
      return role;
    }

    await message.channel.send(
      "❌ I couldn't find that existing role. Please try again."
    );
  }
}

async function configureRoles(message, guild) {
  const roles = {};

  for (const [key, definition] of Object.entries(ROLE_DEFINITIONS)) {
    roles[key] = await askRole(
      message,
      guild,
      definition.label,
      settings.get(key)
    );

    settings.set(key, roles[key]?.id || null);
  }

  const levelRoles = {};
  const oldLevelRoles = settings.getObject("levelRoles");

  for (const [level, name] of Object.entries(LEVEL_ROLE_NAMES)) {
    const role = await askRole(
      message,
      guild,
      `${name} reward role`,
      oldLevelRoles[level]
    );

    if (role) levelRoles[level] = role.id;
  }

  settings.set("levelRoles", levelRoles);

  settings.set(
    "leaderboardRoleIds",
    roles.staffAccessRoleId ? [roles.staffAccessRoleId.id] : []
  );

  return roles;
}

async function configureChannels(message, guild) {
  const channels = {};

  for (const [key, definition] of Object.entries(CHANNEL_DEFINITIONS)) {
    const channel = await askChannel(
      message,
      guild,
      definition.label,
      definition.type,
      getConfiguredChannelId(key)
    );

    channels[key] = channel;
    setConfiguredChannelId(key, channel?.id || null);
  }

  for (const definition of [...TICKET_TYPES, ...EXTRA_CHANNELS]) {
    const channel = await askChannel(
      message,
      guild,
      definition.label,
      definition.type,
      db.getSetting(definition.key)
    );

    db.setSetting(definition.key, channel?.id || "");
  }

  settings.set("welcomeLinks", {
    socials: channels.generalChatChannelId?.id || null,
    roster: channels.teamRequirementsChannelId?.id || null,
    staff: channels.teamApplyChannelId?.id || null,
    news: channels.staffCommandsGuideChannelId?.id || null
  });

  db.setSetting(
    "roster_ping_role_ids",
    JSON.stringify(
      settings.get("rosterSupportRoleId")
        ? [settings.get("rosterSupportRoleId")]
        : []
    )
  );

  db.setSetting(
    "log_channel_id",
    channels.ticketTranscriptChannelId?.id || ""
  );

  return channels;
}

async function configurePanels(guild, client, channels) {
  const result = [];

  const report = async (label, fn) => {
    try {
      await fn();
      result.push(`✅ ${label}`);
    } catch (err) {
      result.push(`⚠️ ${label}: ${err.message}`);
    }
  };

  if (channels.teamApplyChannelId) {
    await report("Ticket panel refreshed", async () => {
      const oldId = db.getSetting("ticket_panel_message_id");

      if (oldId) {
        const old = await channels.teamApplyChannelId.messages
          .fetch(oldId)
          .catch(() => null);

        if (old) await old.delete().catch(() => {});
      }

      const panel = await channels.teamApplyChannelId.send(
        ticketManager.buildTicketPanelEmbed(client)
      );

      db.setSetting(
        "ticket_panel_channel_id",
        channels.teamApplyChannelId.id
      );

      db.setSetting("ticket_panel_message_id", panel.id);
    });
  }

  if (channels.loaChannelId) {
    await report("LOA panel refreshed", () =>
      loaManager.refreshPanel(channels.loaChannelId)
    );
  }

  if (channels.blacklistChannelId) {
    await report("Blacklist panel refreshed", () =>
      blacklistManager.refreshPanel(channels.blacklistChannelId)
    );
  }

  if (channels.suggestionsChannelId) {
    await report("Suggestions panel refreshed", () =>
      suggestionsManager.refreshPanel(channels.suggestionsChannelId)
    );
  }

  if (channels.staffCommandsGuideChannelId) {
    await report("Staff guide refreshed", async () => {
      const oldGuideIds = db.getSetting("staff_guide_message_ids");

      if (oldGuideIds) {



        let ids = [];

        try {
          ids = JSON.parse(oldGuideIds);
        } catch {
          ids = oldGuideIds.split(",").filter(Boolean);
        }

        for (const id of ids) {
          const old = await channels.staffCommandsGuideChannelId.messages
            .fetch(id)
            .catch(() => null);

          if (old) await old.delete().catch(() => {});
        }
      }

      const guideMessages = [];

      for (const embed of buildGuideEmbeds(client)) {
        const sent = await channels.staffCommandsGuideChannelId.send({
          embeds: [embed]
        });

        guideMessages.push(sent.id);
      }



      db.setSetting(
        "staff_guide_message_ids",
        JSON.stringify(guideMessages)
      );

      const oldPermsId = db.getSetting("permissions_panel_message_id");

      if (oldPermsId) {
        const old = await channels.staffCommandsGuideChannelId.messages
          .fetch(oldPermsId)
          .catch(() => null);

        if (old) await old.delete().catch(() => {});
      }

      const perms = await channels.staffCommandsGuideChannelId.send(
        buildPermsPanel()
      );

      db.setSetting("permissions_panel_message_id", perms.id);
    });
  }

  if (
    db.getSetting("stats_members_channel_id") &&
    db.getSetting("stats_goal_channel_id")
  ) {
    await report("Member statistics updated", () =>
      statsManager.updateStatsChannels(guild)
    );
  }

  if (channels.ticketStatsChannelId) {
    await report("Ticket statistics panel refreshed", async () => {
      const ticketStatsManager = require("../handlers/ticketStatsManager");
      await ticketStatsManager.refreshPanel(channels.ticketStatsChannelId);
    });
  }

  if (
    db.getSetting("temp_vc_join_channel_id") &&
    db.getSetting("temp_vc_category_id")
  ) {
    await report("Temporary voice system configured", () =>
      tempVoiceManager.ensureJoinToCreate(guild)
    );
  }

  return result;
}

async function runWizard(message, client) {
  const guild = message.guild;

  if (!guild) {
    throw new Error("This command must be used inside the Discord server.");
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    throw new Error("You need Administrator permission to run this setup.");
  }

  await message.channel.send(
    "⚙️ **Surge Bot setup**\n" +
      "This guided setup only saves the existing roles, channels, and categories you choose. " +
      "It will not create or delete any roles, channels, or categories.\n" +
      "You can type `skip` for anything you do not want to configure. Each question expires after 2 minutes."
  );

  try {
    const roles = await configureRoles(message, guild);
    const channels = await configureChannels(message, guild);
    const panelResults = await configurePanels(guild, client, channels);

    db.setSetting("setup_completed_at", Date.now());

    const summary = [
      "✅ **Setup complete.** No roles, channels, or categories were created.",
      `Saved **${Object.values(roles).filter(Boolean).length} roles** and **${Object.values(channels).filter(Boolean).length} main channels**.`,
      "",
      ...panelResults,
      "",
      currentConfiguration(guild)
    ].join("\n");

    await sendLong(message.channel, summary);
  } catch (err) {
    if (err instanceof SetupTimeoutError) {


      await message.channel
        .send(
          "⏱️ **Setup timed out.** Everything you answered so far has been saved. " +
            "Run `*setup` again to pick up where you left off."
        )
        .catch(() => {});

      return;
    }

    throw err;
  }
}

module.exports = { runWizard, currentConfiguration };
