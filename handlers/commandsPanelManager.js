const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");


const COMMANDS_CHANNEL_ID = "1533983501941211196";
const PANEL_SETTING_KEY = "commands_panel_msg_id";



const BUMP_DELAY_MS = 6000;



function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription(
      "\ud83c\udfae **Commands**\n" +
        "`*level` \u2014 view a level card\n" +
        "`*leaderboard` \u2014 top 10 by XP\n" +
        "`*stats` \u2014 your activity stats card\n" +
        "`*topstats` \u2014 server activity leaderboard\n" +
        "`*channelstats` \u2014 top text & voice channels\n" +
        "`*channelstats #channel` \u2014 full breakdown of one channel"
    );
}

async function refreshPanel(guild) {
  const channel =
    guild.channels.cache.get(COMMANDS_CHANNEL_ID) ||
    (await guild.channels.fetch(COMMANDS_CHANNEL_ID).catch(() => null));
  if (!channel) return;
  const oldId = db.getSetting(PANEL_SETTING_KEY);
  if (oldId) {
    const old = await channel.messages.fetch(oldId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }
  const sent = await channel.send({ embeds: [buildPanelEmbed()] }).catch(() => null);
  if (sent) db.setSetting(PANEL_SETTING_KEY, sent.id);
}

let bumpTimer = null;
function bump(guild) {
  if (bumpTimer) clearTimeout(bumpTimer);
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    refreshPanel(guild).catch(() => {});
  }, BUMP_DELAY_MS);
}


let started = false;
function ensureStarted(client) {
  if (started) return;
  started = true;
  setTimeout(() => {
    const guild = client.guilds.cache.get(config.guildId);
    if (guild) refreshPanel(guild).catch(() => {});
  }, 4000);
}

module.exports = { COMMANDS_CHANNEL_ID, refreshPanel, bump, ensureStarted };
