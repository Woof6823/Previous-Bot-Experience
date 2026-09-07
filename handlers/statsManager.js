const config = require("../config");
const db = require("../database");

function nextFlatHundred(memberCount) {
  return Math.ceil((memberCount + 1) / 100) * 100;
}

async function ensureStatsChannels(guild) {
  let categoryId = db.getSetting("stats_category_id");
  let category = categoryId ? guild.channels.cache.get(categoryId) : null;

  if (!category) {
    throw new Error(
      "The member statistics category is not configured. Run *setup and select an existing category."
    );
  }

  let membersChannelId = db.getSetting("stats_members_channel_id");
  let membersChannel = membersChannelId ? guild.channels.cache.get(membersChannelId) : null;
  if (!membersChannel) {
    throw new Error(
      "The member-count voice channel is not configured. Run *setup and select an existing voice channel."
    );
  }

  let goalChannelId = db.getSetting("stats_goal_channel_id");
  let goalChannel = goalChannelId ? guild.channels.cache.get(goalChannelId) : null;
  if (!goalChannel) {
    throw new Error(
      "The member-goal voice channel is not configured. Run *setup and select an existing voice channel."
    );
  }

  return { category, membersChannel, goalChannel };
}

async function updateStatsChannels(guild) {
  const membersChannelId = db.getSetting("stats_members_channel_id");
  const goalChannelId = db.getSetting("stats_goal_channel_id");
  if (!membersChannelId || !goalChannelId) return;

  const membersChannel = guild.channels.cache.get(membersChannelId);
  const goalChannel = guild.channels.cache.get(goalChannelId);
  if (!membersChannel || !goalChannel) return;

  const memberCount = guild.memberCount;
  const goal = nextFlatHundred(memberCount);

  const membersName = `${config.stats.membersPrefix}${memberCount}`;
  const goalName = `${config.stats.goalPrefix}${goal}`;

  if (membersChannel.name !== membersName) {
    await membersChannel.setName(membersName).catch((err) => {
      console.error("Failed to update members stat channel:", err.message);
    });
  }
  if (goalChannel.name !== goalName) {
    await goalChannel.setName(goalName).catch((err) => {
      console.error("Failed to update goal stat channel:", err.message);
    });
  }
}

module.exports = { ensureStatsChannels, updateStatsChannels, nextFlatHundred };
