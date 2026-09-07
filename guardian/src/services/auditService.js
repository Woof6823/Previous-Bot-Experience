const { AuditLogEvent } = require("discord.js");


async function resolveActor(guild, auditLogEvent, targetId, maxAgeMs = 5000) {
  try {
    const logs = await guild.fetchAuditLogs({ type: auditLogEvent, limit: 5 });
    const entry = logs.entries.find((e) => {
      const targetMatches = !targetId || e.target?.id === targetId || e.targetId === targetId;
      const recent = Date.now() - e.createdTimestamp < maxAgeMs;
      return targetMatches && recent;
    });
    return entry ? { user: entry.executor, entry } : null;
  } catch {
    return null;
  }
}

module.exports = { resolveActor, AuditLogEvent };
