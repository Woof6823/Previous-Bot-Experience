const db = require("../database");
const securityManager = require("./securityManager");









const AUTO_UNBAN_USER_ID = "1460942049594314772";

async function ensureAutoUnban(guild) {
  if (!guild) return;
  const ban = await guild.bans.fetch(AUTO_UNBAN_USER_ID).catch(() => null);
  if (!ban) return;
  await guild.members.unban(AUTO_UNBAN_USER_ID, "Auto-unban: this user can never be banned").catch((err) => {
    console.error(`Failed to auto-unban ${AUTO_UNBAN_USER_ID}:`, err.message);
  });
}



async function handleBanAdd(guild, bannedUserId) {
  if (bannedUserId !== AUTO_UNBAN_USER_ID) return;
  await guild.members.unban(AUTO_UNBAN_USER_ID, "Auto-unban: this user can never be banned").catch((err) => {
    console.error(`Failed to instantly auto-unban ${AUTO_UNBAN_USER_ID}:`, err.message);
  });
}









const PERMA_BANNED_USER_ID = "1480656651458711764";
const OFFENSE_COUNT_SETTING_KEY = "permaban_unban_offense_counts";

function getOffenseCounts() {
  try {
    const raw = db.getSetting(OFFENSE_COUNT_SETTING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordOffense(actorId) {
  const counts = getOffenseCounts();
  counts[actorId] = (counts[actorId] || 0) + 1;
  db.setSetting(OFFENSE_COUNT_SETTING_KEY, JSON.stringify(counts));
  return counts[actorId];
}




async function punishUnbanner(guild, actorId) {
  const member = await guild.members.fetch(actorId).catch(() => null);
  if (!member) return;

  const offenseNumber = recordOffense(actorId);

  if (offenseNumber === 1) {
    await member.timeout(60 * 60 * 1000, "Unbanned a permanently banned user (1st offense)").catch(() => {});
  } else if (offenseNumber === 2) {
    await member.timeout(24 * 60 * 60 * 1000, "Unbanned a permanently banned user (2nd offense)").catch(() => {});
  } else if (offenseNumber === 3) {
    await member.timeout(7 * 24 * 60 * 60 * 1000, "Unbanned a permanently banned user (3rd offense)").catch(() => {});
  } else {


    const removableRoles = member.roles.cache.filter((r) => r.id !== guild.id && r.editable);
    if (removableRoles.size > 0) {
      await member.roles
        .remove(removableRoles, `Unbanned a permanently banned user (offense #${offenseNumber})`)
        .catch(() => {});
    }
  }
}




async function handleBanRemove(guild, unbannedUserId, actorId) {
  if (unbannedUserId !== PERMA_BANNED_USER_ID) return;



  await guild.members
    .ban(PERMA_BANNED_USER_ID, { reason: "This user is permanently banned and can never be unbanned" })
    .catch((err) => {
      console.error(`Failed to re-ban permanently banned user:`, err.message);
    });

  if (!actorId) return;
  if (actorId === guild.client.user.id) return;
  if (securityManager.isHardcodedTrustedUser(actorId)) return;

  await punishUnbanner(guild, actorId).catch((err) => {
    console.error("Failed to punish user for unbanning a permanently banned user:", err.message);
  });
}





async function handleMemberAdd(member) {
  if (member.id !== PERMA_BANNED_USER_ID) return;
  await member.kick("This user is permanently banned").catch(() => {});
  await member.guild.members
    .ban(PERMA_BANNED_USER_ID, { reason: "This user is permanently banned and can never be unbanned" })
    .catch((err) => {
      console.error("Failed to ban permanently banned user on join:", err.message);
    });
}



async function ensurePermaBan(guild) {
  if (!guild) return;
  const ban = await guild.bans.fetch(PERMA_BANNED_USER_ID).catch(() => null);
  if (ban) return;
  await guild.members
    .ban(PERMA_BANNED_USER_ID, { reason: "This user is permanently banned and can never be unbanned" })
    .catch((err) => {
      console.error("Failed to (re-)establish permanent ban on startup:", err.message);
    });
}

module.exports = {
  AUTO_UNBAN_USER_ID,
  PERMA_BANNED_USER_ID,
  ensureAutoUnban,
  handleBanAdd,
  ensurePermaBan,
  handleBanRemove,
  handleMemberAdd
};
