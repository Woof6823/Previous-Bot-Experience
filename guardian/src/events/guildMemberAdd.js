const { AuditLogEvent } = require("discord.js");
const welcomeHandler = require("../handlers/welcomeHandler");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");
const securityService = require("../services/securityService");
const auditService = require("../services/auditService");

const REQUIRED_ROLE_ID = "1540058434421006456";

module.exports = {
  name: "guildMemberAdd",

  async execute(member) {
    if (member.user.bot) {
      await handleBotJoin(member).catch(() => {});
      return;
    }

    const role = member.guild.roles.cache.get(REQUIRED_ROLE_ID);

    if (role && role.editable) {
      await member.roles.add(
        role,
        "Guardian required member role enforcement"
      ).catch(err => {
        console.error(
          `[required-role] Failed to add role to ${member.user.tag}: ${err.message}`
        );
      });
    }

    await welcomeHandler.handleMemberJoin(member).catch(() => {});
  }
};

async function handleBotJoin(member) {
  const guild = member.guild;
  const settings = configService.getSettings(guild.id);

  if (!settings.botProtectionEnabled) return;
  if (whitelistService.isApprovedBot(guild.id, member.id)) return;

  const resolved = await auditService.resolveActor(
    guild,
    AuditLogEvent.BotAdd,
    member.id
  );

  const actorId = resolved?.user?.id || null;

  if (actorId && whitelistService.isWhitelisted(guild.id, actorId)) {
    return;
  }

  const actorMember = actorId
    ? await guild.members.fetch(actorId).catch(() => null)
    : null;

  await securityService.triggerIncident(guild, {
    actorId,
    actorMember,
    type: "unapproved_bot_added",
    details: {
      target: member.id,
      botName: member.user.tag
    },
    threshold: "any unapproved bot addition",
    reason: `Bot "${member.user.tag}" was added and is not on the approved bot list.`
  });
}
