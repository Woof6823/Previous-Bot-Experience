const db = require("../database");
const { EmbedBuilder } = require("discord.js");
const whitelistService = require("./whitelistService");
const configService = require("./configService");

function makeEventId(guildId) {
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM security_events WHERE guildId = ? AND eventId LIKE ?`
    )
    .get(guildId, `SEC-${stamp}-%`);

  const n = String((countRow?.c || 0) + 1).padStart(4, "0");
  return `SEC-${stamp}-${n}`;
}

const recentBotKicks = new Set();

function markBotKick(guildId, targetId) {
  const key = `${guildId}:${targetId}`;
  recentBotKicks.add(key);
  setTimeout(() => recentBotKicks.delete(key), 8000);
}

function wasBotKick(guildId, targetId) {
  return recentBotKicks.has(`${guildId}:${targetId}`);
}

function recordModAction(guildId, actorId, actionType, targetId) {
  db.prepare(
    `INSERT INTO mod_action_log (guildId, actorId, actionType, targetId, createdAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(guildId, actorId, actionType, targetId || null, Date.now());
}

function countRecentActions(guildId, actorId, actionType, windowMs) {
  const since = Date.now() - windowMs;

  const row = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM mod_action_log
       WHERE guildId = ?
       AND actorId = ?
       AND actionType = ?
       AND createdAt >= ?`
    )
    .get(guildId, actorId, actionType, since);

  return row?.c || 0;
}

function recordMention(guildId, userId) {
  db.prepare(
    `INSERT INTO mention_log (guildId, userId, createdAt)
     VALUES (?, ?, ?)`
  ).run(guildId, userId, Date.now());
}

function countRecentMentions(guildId, userId, windowMs) {
  const since = Date.now() - windowMs;

  const row = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM mention_log
       WHERE guildId = ?
       AND userId = ?
       AND createdAt >= ?`
    )
    .get(guildId, userId, since);

  return row?.c || 0;
}

async function getSecurityChannel(guild) {
  const settings = configService.getSettings(guild.id);

  if (!settings.securityChannelId) return null;

  return guild.channels.cache.get(settings.securityChannelId) || null;
}

async function remediate(member, timeoutMs) {
  const result = {
    rolesStripped: [],
    timeoutApplied: false,
    errors: []
  };

  if (!member) return result;

  if (member.user?.bot) {
    return result;
  }

  try {
    const guild = member.guild;
    const me = guild.members.me;

    const removable = member.roles.cache.filter(
      (r) =>
        r.id !== guild.id &&
        r.id !== me.roles.highest.id &&
        r.position < me.roles.highest.position &&
        r.editable
    );

    for (const role of removable.values()) {
      try {
        await member.roles.remove(
          role,
          "Automated security remediation"
        );

        result.rolesStripped.push(role.id);
      } catch (e) {
        result.errors.push(`role ${role.id}: ${e.message}`);
      }
    }
  } catch (e) {
    result.errors.push(`strip roles: ${e.message}`);
  }

  try {
    if (member.moderatable) {
      await member.timeout(
        timeoutMs,
        "Automated security remediation"
      );

      result.timeoutApplied = true;
    } else {
      result.errors.push(
        "member not moderatable by bot (role hierarchy / missing permission)"
      );
    }
  } catch (e) {
    result.errors.push(`timeout: ${e.message}`);
  }

  return result;
}

async function sendSecurityAlert(guild, payload) {
  const channel = await getSecurityChannel(guild);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🛡️ SECURITY ALERT")
    .addFields(
      {
        name: "User",
        value: payload.actorTag || "Unknown",
        inline: true
      },
      {
        name: "User ID",
        value: payload.actorId || "Unknown",
        inline: true
      },
      {
        name: "Action",
        value: payload.type,
        inline: true
      },
      {
        name: "Target",
        value: payload.target || "N/A",
        inline: true
      },
      {
        name: "Reason",
        value: payload.reason || "Automated threshold trigger",
        inline: false
      },
      {
        name: "Threshold",
        value: payload.threshold || "N/A",
        inline: true
      },
      {
        name: "Roles Removed",
        value: String(payload.rolesStripped?.length ?? 0),
        inline: true
      },
      {
        name: "Timeout Applied",
        value: payload.timeoutApplied ? "Yes (24h)" : "No",
        inline: true
      },
      {
        name: "Remediation Errors",
        value: payload.errors?.length
          ? payload.errors.join("\n").slice(0, 900)
          : "None",
        inline: false
      },
      {
        name: "Case ID",
        value: payload.eventId,
        inline: false
      }
    )
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function triggerIncident(
  guild,
  {
    actorId,
    actorMember,
    type,
    details,
    threshold,
    reason
  }
) {

  if (actorMember?.user?.bot) {
    console.log(
      `[security] Ignored ${type}: actor ${actorId} is a bot. No security action taken.`
    );

    return {
      eventId: null,
      exempt: true,
      ignoredBot: true,
      remediation: {
        rolesStripped: [],
        timeoutApplied: false,
        errors: []
      }
    };
  }

  const eventId = makeEventId(guild.id);

  const exempt = actorId
    ? whitelistService.isWhitelisted(guild.id, actorId)
    : false;

  let remediation = {
    rolesStripped: [],
    timeoutApplied: false,
    errors: []
  };

  if (!exempt && actorMember) {
    const settings = configService.getSettings(guild.id);

    remediation = await remediate(
      actorMember,
      settings.securityTimeoutMs
    );
  }

  db.prepare(
    `INSERT INTO security_events
     (eventId, guildId, actorId, type, details, rolesStripped, timeoutApplied, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    guild.id,
    actorId || null,
    type,
    JSON.stringify(details || {}),
    JSON.stringify(remediation.rolesStripped),
    remediation.timeoutApplied ? 1 : 0,
    Date.now()
  );

  await sendSecurityAlert(guild, {
    actorTag: actorMember?.user?.tag,
    actorId,
    type,
    target: details?.target,
    reason: exempt
      ? `${reason || type} (whitelisted — no punishment applied)`
      : reason || type,
    threshold,
    rolesStripped: remediation.rolesStripped,
    timeoutApplied: remediation.timeoutApplied,
    errors: remediation.errors,
    eventId
  });

  return {
    eventId,
    exempt,
    ignoredBot: false,
    remediation
  };
}

function getEvent(guildId, eventId) {
  return db
    .prepare(
      `SELECT * FROM security_events
       WHERE guildId = ?
       AND eventId = ?`
    )
    .get(guildId, eventId);
}

module.exports = {
  recordModAction,
  countRecentActions,
  recordMention,
  countRecentMentions,
  triggerIncident,
  getEvent,
  remediate,
  sendSecurityAlert,
  markBotKick,
  wasBotKick
};
