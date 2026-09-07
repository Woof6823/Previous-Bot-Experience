const {
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const db = require("../database");
const config = require("../config");
const configService = require("./configService");
const ticketHandler = require("../handlers/ticketHandler");

const CATEGORY_NAMES = {
  support: "Support Tickets",
  business: "Business Inquiries",
  roster: "Roster Applications",
  staff: "Staff Applications"
};

async function findOrCreateCategory(guild, name) {
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

async function findOrCreateChannel(guild, name, type) {
  let channel = guild.channels.cache.find(
    c => c.type === type && c.name.toLowerCase() === name.toLowerCase()
  );

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type
    });
  }

  return channel;
}

async function setupGuild(guild) {
  configService.ensureGuild(guild.id);

  for (const [type, name] of Object.entries(CATEGORY_NAMES)) {
    const existing = db
      .prepare("SELECT categoryId FROM ticket_categories WHERE guildId = ? AND type = ?")
      .get(guild.id, type);

    let category = existing
      ? guild.channels.cache.get(existing.categoryId)
      : null;

    if (!category) {
      category = await findOrCreateCategory(guild, name);

      db.prepare(
        "INSERT OR REPLACE INTO ticket_categories (guildId, type, categoryId) VALUES (?, ?, ?)"
      ).run(guild.id, type, category.id);
    }
  }

  const settings = configService.getSettings(guild.id);

  let levelChannel = settings.levelUpChannelId
    ? guild.channels.cache.get(settings.levelUpChannelId)
    : null;

  if (!levelChannel) {
    levelChannel = await findOrCreateChannel(
      guild,
      "level-ups",
      ChannelType.GuildText
    );

    configService.updateSetting(
      guild.id,
      "levelUpChannelId",
      levelChannel.id
    );
  }

  const panelChannel = guild.channels.cache.get(
    config.ticketPanelChannelId
  );

  if (panelChannel) {
    const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);

    const existingPanel = messages?.find(
      m =>
        m.author.id === guild.members.me?.id &&
        m.components.some(row =>
          row.components.some(component =>
            component.customId === "ticket_select"
          )
        )
    );

    if (!existingPanel) {
      await panelChannel.send({
        embeds: [ticketHandler.buildPanelEmbed(guild)],
        components: [ticketHandler.buildSelectMenu()]
      });
    }
  }

  await enforceRequiredRole(guild);

  console.log(`[setup] ${guild.name}: setup complete`);
}

async function setupAllGuilds(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await setupGuild(guild);
    } catch (error) {
      console.error(`[setup:${guild.id}]`, error);
    }
  }
}

module.exports = {
  setupGuild,
  setupAllGuilds
};

async function enforceRequiredRole(guild) {
  const ROLE_ID = "1540058434421006456";

  try {
    await guild.members.fetch();
  } catch (error) {
    console.error(`[required-role] Failed to fetch all members in ${guild.name}:`, error);
    return;
  }

  const role = guild.roles.cache.get(ROLE_ID);

  if (!role) {
    console.error(`[required-role] Role ${ROLE_ID} was not found in ${guild.name}.`);
    return;
  }

  let checked = 0;
  let added = 0;

  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;

    checked++;

    if (member.roles.cache.has(ROLE_ID)) continue;
    if (!role.editable) {
      console.error(`[required-role] Guardian cannot manage role ${ROLE_ID}.`);
      break;
    }

    try {
      await member.roles.add(
        role,
        "Guardian required member role enforcement"
      );

      added++;
      console.log(
        `[required-role] Added role to ${member.user.tag}`
      );
    } catch (error) {
      console.error(
        `[required-role] Failed to add role to ${member.user.tag}:`,
        error.message
      );
    }
  }

  console.log(
    `[required-role] Checked ${checked} human members, added role to ${added}.`
  );
}

module.exports.enforceRequiredRole = enforceRequiredRole;
