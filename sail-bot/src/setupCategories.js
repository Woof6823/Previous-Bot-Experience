const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { TICKET_TYPES, STAFF_ROLE_ID } = require('./config');
const db = require('./database');


async function ensureCategories(guild) {
  for (const type of TICKET_TYPES) {
    let categoryId = db.getCategoryId(type.id);
    let category = categoryId ? guild.channels.cache.get(categoryId) : null;

    if (!category) {
      category = await guild.channels.create({
        name: type.categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
      db.setCategoryId(type.id, category.id);
      console.log(`[setup] Created category "${type.categoryName}" (${category.id})`);
    }
  }
}

module.exports = { ensureCategories };
