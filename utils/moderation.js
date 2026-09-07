const { EmbedBuilder } = require("discord.js");
const config = require("../config");


function resolveTargetId(rawArg) {
  if (!rawArg) return null;
  const mentionMatch = rawArg.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  if (/^\d{15,25}$/.test(rawArg)) return rawArg;
  return null;
}

async function sendModerationDM(client, userId, { action, reason, guildName, duration }) {
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(config.errorColor)
      .setTitle(`You have been ${action} in ${guildName}`)
      .addFields({ name: "Reason", value: reason || "No reason provided." });

    if (duration) {
      embed.addFields({ name: "Duration", value: duration });
    }

    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {

    return false;
  }
}


async function announceModAction(channel, targetId, actionText) {
  const msg = await channel
    .send({ content: `<@${targetId}> was ${actionText}`, allowedMentions: { parse: ["users"] } })
    .catch(() => null);
  if (msg) setTimeout(() => msg.delete().catch(() => {}), 2000);
}

module.exports = { resolveTargetId, sendModerationDM, announceModAction };
