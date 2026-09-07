const { AuditLogEvent } = require("discord.js");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const configService = require("../services/configService");
const whitelistService = require("../services/whitelistService");

module.exports = {
  name: "channelDelete",
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return;
    const settings = configService.getSettings(guild.id);
    if (!settings.securityEnabled || !settings.channelProtectionEnabled) return;

    const resolved = await auditService.resolveActor(guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!resolved?.user) return;
    const actorId = resolved.user.id;
    if (whitelistService.isWhitelisted(guild.id, actorId)) return;

    const actorMember = await guild.members.fetch(actorId).catch(() => null);
    await securityService.triggerIncident(guild, {
      actorId,
      actorMember,
      type: "unauthorized_channel_delete",
      details: { target: channel.id, channelName: channel.name },
      threshold: "any non-whitelisted channel deletion",
      reason: `Channel "${channel.name}" was deleted by a non-whitelisted user.`
    });
  }
};
