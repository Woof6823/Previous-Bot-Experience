const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const settings = require("../settings");


const fastClaimHistory = new Map();



const activeAlerts = new Map();





function pruneOld(entries, now) {
  return entries.filter((t) => now - t < config.ticketFarmingWindowMs);
}

async function recordClaim(guild, staffId, ticket) {
  return;
}

function buildAlertEmbed(staffId, count, deletedBy) {
  const embed = new EmbedBuilder()
    .setColor(config.errorColor)
    .setTitle("🚨 Possible Ticket Farming Detected")
    .setDescription(
      `<@${staffId}> has claimed **${count}** tickets almost immediately after they were opened, ` +
        `within the last ${Math.round(config.ticketFarmingWindowMs / 60000)} minutes.\n\n` +
        `This doesn't prove alt-account abuse — Discord doesn't expose that — but it's an unusual ` +
        `pattern worth a human look.`
    )
    .setTimestamp();

  if (deletedBy) {
    embed.addFields({
      name: "⚠️ This alert was deleted",
      value: `By <@${deletedBy}> — reposted automatically.`
    });
  }

  return embed;
}

async function sendAlert(guild, staffId, count, deletedBy) {
  return;
}



async function handlePossibleAlertDeletion(client, message) {
  return;
}

module.exports = { recordClaim, handlePossibleAlertDeletion };
