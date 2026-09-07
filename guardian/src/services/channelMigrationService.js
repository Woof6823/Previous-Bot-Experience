const { ChannelType } = require("discord.js");

function isTicket(channel) {
  const name = (channel.name || "").toLowerCase();

  return (
    name.startsWith("support-") ||
    name.startsWith("business-") ||
    name.startsWith("roster-") ||
    name.startsWith("staff-") ||
    name.startsWith("ticket-") ||
    name.includes("ticket")
  );
}

function renameOnly(oldName) {
  let name = oldName.trim();


  name = name.replace(/^》🗨️・/u, "");


  name = name.replace(/^💬\s*[┃|│¦・]\s*/u, "");



  name = name.replace(/^(.+?)\s*┃\s*(.+)$/u, "$1・$2");

  if (!name) return null;


  if (name.includes("・")) {
    return `》${name}`;
  }


  return `》🗨️・${name}`;
}

async function runOnce(guild) {
  console.log(`[channel-migration] Fixing channel names in ${guild.name}...`);

  const channels = await guild.channels.fetch();

  let renamed = 0;
  let skipped = 0;
  let failed = 0;

  for (const channel of channels.values()) {
    if (!channel) continue;


    if (isTicket(channel)) {
      skipped++;
      continue;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement &&
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice &&
      channel.type !== ChannelType.GuildForum &&
      channel.type !== ChannelType.GuildCategory
    ) {
      skipped++;
      continue;
    }

    const newName = renameOnly(channel.name);

    if (!newName || newName === channel.name) {
      skipped++;
      continue;
    }

    try {
      const oldName = channel.name;

      await channel.setName(
        newName,
        "Guardian channel name format correction"
      );

      renamed++;

      console.log(
        `[channel-migration] Renamed "${oldName}" -> "${newName}"`
      );
    } catch (error) {
      failed++;

      console.error(
        `[channel-migration] Failed "${channel.name}": ${error.message}`
      );
    }
  }

  console.log(
    `[channel-migration] ${guild.name}: ${renamed} renamed, ${skipped} skipped, ${failed} failed.`
  );
}

module.exports = { runOnce };
