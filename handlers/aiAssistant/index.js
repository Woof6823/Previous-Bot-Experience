const { EmbedBuilder } = require("discord.js");
const config = require("../../config");
const db = require("../../database");
const { isOwner } = require("../../utils/staffAccess");
const { classifyOffensive } = require("./offensiveClassifier");
const cooldownManager = require("./cooldownManager");
















const APPEALS_LINK = "https://discord.gg/xWb9d4yB4J";
const OFFENSE_COUNT_SETTING_KEY = "ai_moderation_offense_counts";

function getOffenseCounts() {
  try {
    const raw = db.getSetting(OFFENSE_COUNT_SETTING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordOffense(userId) {
  const counts = getOffenseCounts();
  counts[userId] = (counts[userId] || 0) + 1;
  db.setSetting(OFFENSE_COUNT_SETTING_KEY, JSON.stringify(counts));
  return counts[userId];
}

function isCommandMessage(content) {
  const prefix = config.prefix || "*";
  return typeof content === "string" && content.startsWith(prefix);
}

async function banForSlur(message) {
  await message.delete().catch(() => {});

  const dmEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`🔨 Banned from ${message.guild.name}`)
    .setDescription(
      `You have been banned from **${message.guild.name}**.\n\n` +
        `**Reason:** Compromised account (MrBeast scam) — automatically detected offensive language.\n\n` +
        `If you believe this is a mistake or your account was compromised, you can appeal in our appeals server:\n${APPEALS_LINK}`
    )
    .setTimestamp();
  await message.author.send({ embeds: [dmEmbed] }).catch(() => {});

  await message.guild.members
    .ban(message.author.id, {
      reason: "AI moderation: instant-ban slur detected",
      deleteMessageSeconds: 604800
    })
    .catch((err) => console.error("[AI Moderation] Failed to ban for slur:", err.message));

  db.addModLog(message.author.id, message.client.user.id, "ban", "AI moderation: instant-ban slur detected");
}

async function escalate(message) {
  await message.delete().catch(() => {});

  const offenseNumber = recordOffense(message.author.id);
  const tier = config.ai.escalation[offenseNumber] || config.ai.escalation.default;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);

  if (tier.action === "warn") {
    db.addWarning(message.author.id, message.client.user.id, "AI moderation: offensive language");
    db.addModLog(message.author.id, message.client.user.id, "warn", "AI moderation: offensive language");
    const dm = new EmbedBuilder()
      .setColor(0xf5c400)
      .setTitle(`⚠️ Warned in ${message.guild.name}`)
      .setDescription(`You were warned for offensive language.\n\nContinued violations will result in a mute.`)
      .setTimestamp();
    await message.author.send({ embeds: [dm] }).catch(() => {});
    return;
  }

  if (tier.action === "mute" && member) {
    await member.timeout(tier.durationMs, "AI moderation: repeated offensive language").catch(() => {});
    db.addModLog(
      message.author.id,
      message.client.user.id,
      "mute",
      "AI moderation: repeated offensive language",
      tier.durationMs
    );
    const dm = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`🔇 Muted in ${message.guild.name}`)
      .setDescription(`You were muted for repeated offensive language.`)
      .setTimestamp();
    await member.send({ embeds: [dm] }).catch(() => {});
  }
}



async function handleMessage(message) {
  if (!config.ai.enabled) return false;
  if (!message.guild || message.author.bot) return false;
  if (isOwner(message.author.id)) return false;
  if (isCommandMessage(message.content)) return false;
  if (!message.content || !message.content.trim()) return false;

  if (cooldownManager.claimMessage(message.id)) return false;

  try {
    const result = classifyOffensive(message.content);

    if (result.severity === "INSTANT_BAN") {
      await banForSlur(message);
      return true;
    }

    if (result.severity === "SAFE") return false;

    await escalate(message);
    return true;
  } catch (error) {
    console.error("[AI Moderation] handleMessage failed:", error.message);
    return false;
  }
}

function startCleanupInterval() {
  const interval = setInterval(() => {
    const removed = cooldownManager.cleanup();
    if (removed > 0) {
      console.log(`[AI] Dedupe cleanup: removed ${removed} expired entr${removed === 1 ? "y" : "ies"}.`);
    }
  }, config.ai.processedMessageTtlMs * 10);
  interval.unref?.();
  return interval;
}

module.exports = { handleMessage, startCleanupInterval };
