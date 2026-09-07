const db = require("../database");

const SETTING_KEY = "command_perm_overrides";















const PROTECTED_COMMANDS = new Set([
  "addcommandperms",
  "removecommandperms",
  "setupperms",
  "securitywhitelist",
  "securitywhitelistadd",
  "accountagekick"
]);

function isProtectedCommand(commandName) {
  return PROTECTED_COMMANDS.has(String(commandName || "").toLowerCase());
}

function getOverrides() {
  const raw = db.getSetting(SETTING_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  db.setSetting(SETTING_KEY, JSON.stringify(overrides));
}

function hasOverride(commandName, userId) {



  if (isProtectedCommand(commandName)) return false;

  const overrides = getOverrides();
  return (overrides[commandName] || []).includes(userId);
}

function addOverride(commandName, userId) {
  if (isProtectedCommand(commandName)) {
    return { ok: false, reason: "protected" };
  }

  const overrides = getOverrides();
  const list = overrides[commandName] || [];
  if (!list.includes(userId)) list.push(userId);
  overrides[commandName] = list;
  saveOverrides(overrides);
  return { ok: true };
}

function removeOverride(commandName, userId) {
  const overrides = getOverrides();
  overrides[commandName] = (overrides[commandName] || []).filter((id) => id !== userId);
  saveOverrides(overrides);
  return { ok: true };
}

function getOverridesForUser(userId) {
  const overrides = getOverrides();
  return Object.keys(overrides).filter(
    (cmd) => !isProtectedCommand(cmd) && overrides[cmd].includes(userId)
  );
}

module.exports = {
  hasOverride,
  addOverride,
  removeOverride,
  getOverrides,
  getOverridesForUser,
  isProtectedCommand,
  PROTECTED_COMMANDS
};
