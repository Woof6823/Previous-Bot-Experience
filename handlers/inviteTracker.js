const cache = new Map();

async function primeGuild(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return;

  const map = new Map();
  for (const invite of invites.values()) {
    map.set(invite.code, invite.uses || 0);
  }
  cache.set(guild.id, map);
}

async function primeAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await primeGuild(guild).catch((err) =>
      console.error(`Invite tracker: failed to prime ${guild.id}:`, err.message)
    );
  }
}

function setInvite(code, guildId, uses) {
  if (!cache.has(guildId)) cache.set(guildId, new Map());
  cache.get(guildId).set(code, uses || 0);
}

function removeInvite(code, guildId) {
  cache.get(guildId)?.delete(code);
}





async function resolveUsedInvite(guild) {
  const before = cache.get(guild.id) || new Map();
  const current = await guild.invites.fetch().catch(() => null);
  if (!current) return null;

  let used = null;
  const newMap = new Map();
  for (const invite of current.values()) {
    newMap.set(invite.code, invite.uses || 0);
    const previousUses = before.get(invite.code) || 0;
    if ((invite.uses || 0) > previousUses) {
      used = invite;
    }
  }
  cache.set(guild.id, newMap);

  return used;
}

module.exports = { primeGuild, primeAll, setInvite, removeInvite, resolveUsedInvite };
