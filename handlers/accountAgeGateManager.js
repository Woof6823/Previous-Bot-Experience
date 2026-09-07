const securityManager = require("./securityManager");









const MIN_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const REJOIN_INVITE = "https://discord.gg/fearsrg";
const DM_COOLDOWN_MS = 60 * 1000;




const lastDmSentAt = new Map();

function isTooYoung(user) {
  return Date.now() - user.createdTimestamp < MIN_ACCOUNT_AGE_MS;
}

function isExempt(userId) {

  return securityManager.isHardcodedTrustedUser(userId);
}

function formatRemaining(user) {
  const unlockAt = user.createdTimestamp + MIN_ACCOUNT_AGE_MS;
  const remainingMs = Math.max(0, unlockAt - Date.now());
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return { text: parts.join(" "), unlockAt };
}

function buildKickMessage(user) {
  const { text, unlockAt } = formatRemaining(user);
  const unlockSeconds = Math.floor(unlockAt / 1000);
  return (
    `🚫 Your account is under 3 days old, so you can't stay in this server yet.\n` +
    `You can rejoin in **${text}**.\n\n` +
    `Rejoin here <t:${unlockSeconds}:R> (<t:${unlockSeconds}:f>): ${REJOIN_INVITE}`
  );
}

function shouldSendDm(userId) {
  const last = lastDmSentAt.get(userId);
  if (!last) return true;
  return Date.now() - last >= DM_COOLDOWN_MS;
}




async function dmIfAllowed(user) {
  if (!shouldSendDm(user.id)) return false;
  lastDmSentAt.set(user.id, Date.now());
  return user
    .send(buildKickMessage(user))
    .then(() => true)
    .catch(() => false);
}




async function enforceOnJoin(member) {
  if (!member?.guild || !member?.user) return false;
  if (member.user.bot) return false;
  if (isExempt(member.id)) return false;
  if (!isTooYoung(member.user)) return false;

  await dmIfAllowed(member.user);






  const kicked = await member
    .kick("Account under 3 days old")
    .then(() => true)
    .catch((err) => {
      console.error(`Failed to auto-kick underage account ${member.id}:`, err.message);
      return false;
    });
  return kicked;
}




function findUnderageMembers(guild) {
  return [...guild.members.cache.values()].filter(
    (m) => !m.user.bot && !isExempt(m.id) && isTooYoung(m.user)
  );
}








const pendingScans = new Map();
const SCAN_EXPIRY_MS = 10 * 60 * 1000;

function createScan(guildId, requestedBy, userIds) {
  const scanId = `${Date.now()}_${requestedBy}`;
  pendingScans.set(scanId, { guildId, requestedBy, userIds, createdAt: Date.now() });
  setTimeout(() => pendingScans.delete(scanId), SCAN_EXPIRY_MS);
  return scanId;
}

function getScan(scanId) {
  return pendingScans.get(scanId) || null;
}

function deleteScan(scanId) {
  pendingScans.delete(scanId);
}

module.exports = {
  MIN_ACCOUNT_AGE_MS,
  isTooYoung,
  isExempt,
  formatRemaining,
  buildKickMessage,
  dmIfAllowed,
  enforceOnJoin,
  findUnderageMembers,
  createScan,
  getScan,
  deleteScan
};
