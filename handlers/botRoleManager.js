const BOT_ROLE_IDS = ["1533300197474570373", "1533010753664061712"];

async function enforce(member) {
  if (!member || !member.user?.bot) return;

  const missing = BOT_ROLE_IDS.filter((roleId) => !member.roles.cache.has(roleId));
  if (missing.length === 0) return;

  await member.roles.add(missing).catch((err) => {
    console.error(`Failed to apply bot role(s) to ${member.id}:`, err.message);
  });
}

async function sweepGuild(guild) {
  try {



    for (const member of guild.members.cache.values()) {
      if (member.user?.bot) {
        await enforce(member);
      }
    }
  } catch (err) {
    console.error("Bot role sweep failed:", err.message);
  }
}

module.exports = { BOT_ROLE_IDS, enforce, sweepGuild };
