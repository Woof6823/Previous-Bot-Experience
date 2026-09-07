const db = require("../database");
const settings = require("../settings");
const MIN_STAFF_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647;


const pendingUnlockTimers = new Map();




async function notifyOwnerAboutExistingYoungStaff(guild, ownerId, staffRoleId) {
  if (db.getSetting("staff_age_initial_check_done")) return;
  const role = guild.roles.cache.get(staffRoleId);
  if (!role) return;
  await guild.members.fetch().catch(() => {});
  const young = [...role.members.values()].filter(
    (m) => Date.now() - m.user.createdTimestamp < MIN_STAFF_ACCOUNT_AGE_MS
  );
  if (young.length > 0) {
    const owner = await guild.client.users.fetch(ownerId).catch(() => null);
    if (owner) {
      const lines = young
        .map(
          (m) =>
            `• ${m.user.tag} (${m.id}) — account created <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`
        )
        .join("\n");
      await owner
        .send(
          `⚠️ **Existing staff with accounts under 30 days old** (one-time check on update):\n${lines}`
        )
        .catch(() => {});
    }
  }
  db.setSetting("staff_age_initial_check_done", "1");
}




function isTooYoungForStaff(member) {
  return Date.now() - member.user.createdTimestamp < MIN_STAFF_ACCOUNT_AGE_MS;
}

async function handleUnderageStaffApplicant(guild, client, ticket, member) {
  const unlockAt = member.user.createdTimestamp + MIN_STAFF_ACCOUNT_AGE_MS;
  const staffBlacklistRoleId = settings.get("staffBlacklistRoleId");
  db.addBlacklist(
    member.id,
    "staff",
    `Account under 30 days old — auto-blacklisted from staff, lifts <t:${Math.floor(unlockAt / 1000)}:F>.`,
    client.user.id
  );
  if (staffBlacklistRoleId) {
    await member.roles.add(staffBlacklistRoleId).catch(() => {});
  }
  db.setAgeBlacklistPending(member.id, guild.id, unlockAt);
  scheduleUnlock(client, guild.id, member.id, unlockAt);
  await member
    .send(
      `🚫 Your staff application was closed because your Discord account is under 30 days old.\n` +
        `You've been temporarily blacklisted from applying for staff — this lifts automatically ` +
        `<t:${Math.floor(unlockAt / 1000)}:F> (<t:${Math.floor(unlockAt / 1000)}:R>), once your account turns 30 days old. ` +
        `You don't need to do anything — just reapply after that date.`
    )
    .catch(() => {});
  const ticketManager = require("./ticketManager");
  await ticketManager
    .closeTicket(guild, ticket.channel_id, "Account under 30 days old (auto-blacklisted)", client.user.id)
    .catch((err) => console.error("Failed to close under-age staff ticket:", err.message));
}

function scheduleUnlock(client, guildId, userId, unlockAt) {
  const existing = pendingUnlockTimers.get(userId);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, unlockAt - Date.now());

  if (delay > MAX_TIMEOUT_MS) {

    const timeout = setTimeout(() => {
      scheduleUnlock(client, guildId, userId, unlockAt);
    }, MAX_TIMEOUT_MS);
    pendingUnlockTimers.set(userId, timeout);
    return;
  }

  const timeout = setTimeout(() => {
    liftAgeBlacklist(client, guildId, userId).catch((err) =>
      console.error("Failed to auto-lift staff age blacklist:", err.message)
    );
  }, delay);
  pendingUnlockTimers.set(userId, timeout);
}

async function liftAgeBlacklist(client, guildId, userId) {
  db.removeAgeBlacklistPending(userId);
  pendingUnlockTimers.delete(userId);
  const current = db.getBlacklist(userId, "staff");



  if (!current || !current.reason || !current.reason.startsWith("Account under 30 days old")) {
    return;
  }
  db.removeBlacklist(userId, "staff");
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  const staffBlacklistRoleId = settings.get("staffBlacklistRoleId");
  if (guild && staffBlacklistRoleId) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) await member.roles.remove(staffBlacklistRoleId).catch(() => {});
  }
  const user = await client.users.fetch(userId).catch(() => null);
  if (user) {
    await user
      .send("✅ Your account has now turned 30 days old — you're free to apply for staff again!")
      .catch(() => {});
  }
}

function restorePendingUnlocks(client) {
  for (const row of db.getAllAgeBlacklistPending()) {
    scheduleUnlock(client, row.guild_id, row.user_id, row.unlock_at);
  }
}

module.exports = {
  notifyOwnerAboutExistingYoungStaff,
  isTooYoungForStaff,
  handleUnderageStaffApplicant,
  restorePendingUnlocks
};
