const { ChannelType } = require('discord.js');
const { TICKET_TYPES } = require('./config');
const { getCategoryId, setCategoryId } = require('./database');


async function ensureCategoriesExist(guild) {
  for (const [type, def] of Object.entries(TICKET_TYPES)) {
    let categoryId = getCategoryId(type);


    if (categoryId) {
      const existing = guild.channels.cache.get(categoryId);
      if (existing && existing.type === ChannelType.GuildCategory) {
        continue;
      }
      categoryId = null;
    }


    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === def.categoryName
    );

    if (!category) {
      category = await guild.channels.create({
        name: def.categoryName,
        type: ChannelType.GuildCategory,
      });
      console.log(`[setup] Created category "${def.categoryName}" (${category.id})`);
    }

    setCategoryId(type, category.id);
  }
}

module.exports = { ensureCategoriesExist };
