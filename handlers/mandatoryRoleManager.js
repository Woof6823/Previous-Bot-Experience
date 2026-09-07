const config = require("../config");





async function enforce(member) {
  if (!member || member.user?.bot) return;

  const roleId = config.mandatoryRoleId;
  if (!roleId) return;

  if (!member.roles.cache.has(roleId)) {
    await member.roles.add(roleId).catch((err) => {
      console.error(`Failed to apply mandatory role to ${member.id}:`, err.message);
    });
  }
}

async function sweepGuild(guild) {
  try {




    for (const member of guild.members.cache.values()) {
      await enforce(member);
    }
  } catch (err) {
    console.error("Mandatory role sweep failed:", err.message);
  }
}

module.exports = { enforce, sweepGuild };
