const db = require("../database");
const permissionService = require("../services/permissionService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");

async function handleBlockedWords(message) {
  const words = db.prepare(`SELECT word FROM blocked_words WHERE guildId = ?`).all(message.guild.id).map((r) => r.word);
  if (!words.length) return false;
  const content = message.content.toLowerCase();
  const hit = words.find((w) => content.includes(w));
  if (!hit) return false;
  if (permissionService.hasFullAccess(message.guild.id, message.author.id)) return false;
  await message.delete().catch(() => {});
  const warn = await message.channel
    .send({ content: `${message.author}, that message contained a blocked word and was removed.` })
    .catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);
  return true;
}


async function handleMassMention(message) {
  if (!message.mentions.everyone) return;
  if (permissionService.hasFullAccess(message.guild.id, message.author.id)) return;

  const settings = configService.getSettings(message.guild.id);
  if (!settings.securityEnabled) return;

  securityService.recordMention(message.guild.id, message.author.id);
  const recent = securityService.countRecentMentions(message.guild.id, message.author.id, settings.mentionWindowMs);

  if (recent > settings.mentionThreshold) {
    await securityService.triggerIncident(message.guild, {
      actorId: message.author.id,
      actorMember: message.member,
      type: "mass_mention",
      details: { target: message.channel.id, count: recent },
      threshold: `>${settings.mentionThreshold} mentions / ${settings.mentionWindowMs / 60000}min`,
      reason: `@everyone/@here used ${recent} times within the rolling window.`
    });
  }
}

module.exports = { handleBlockedWords, handleMassMention };
