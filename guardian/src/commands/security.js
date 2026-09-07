const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const configService = require("../services/configService");
const permissionService = require("../services/permissionService");
const whitelistService = require("../services/whitelistService");
const securityService = require("../services/securityService");
const moderationService = require("../services/moderationService");
const db = require("../database");

function flag(v) {
  return v ? "ENABLED" : "DISABLED";
}

async function status(message) {
  const settings = configService.getSettings(message.guild.id);
  const wl = whitelistService.listWhitelist(message.guild.id).length;
  const owners = whitelistService.listOwners(message.guild.id).length;
  const protRoles = permissionService.listProtectedRoles(message.guild.id).length;
  const protChannels = permissionService.listProtectedChannels(message.guild.id).length;

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🛡️ Server Security")
    .addFields(
      { name: "Anti-Nuke", value: flag(settings.securityEnabled), inline: true },
      { name: "Role Protection", value: flag(settings.roleProtectionEnabled), inline: true },
      { name: "Channel Protection", value: flag(settings.channelProtectionEnabled), inline: true },
      { name: "Bot Protection", value: flag(settings.botProtectionEnabled), inline: true },
      { name: "Mass Ban Detection", value: `${settings.banThreshold} / ${settings.banWindowMs / 60000}min`, inline: true },
      { name: "Mass Kick Detection", value: `${settings.kickThreshold} / ${settings.kickWindowMs / 60000}min`, inline: true },
      { name: "Mass Mention Detection", value: `>${settings.mentionThreshold} / ${settings.mentionWindowMs / 60000}min`, inline: true },
      { name: "Staff Role", value: settings.staffRoleId ? `<@&${settings.staffRoleId}>` : "Not configured", inline: true },
      { name: "Security Channel", value: settings.securityChannelId ? `<#${settings.securityChannelId}>` : "Not configured", inline: true },
      { name: "Owners", value: String(owners), inline: true },
      { name: "Whitelisted Users", value: String(wl), inline: true },
      { name: "Protected Roles", value: String(protRoles), inline: true },
      { name: "Protected Channels", value: String(protChannels), inline: true }
    );
  await message.channel.send({ embeds: [embed] });
}

async function test(message) {
  const settings = configService.getSettings(message.guild.id);
  const me = message.guild.members.me;
  const checks = [
    ["Security enabled", !!settings.securityEnabled],
    ["Security channel configured", !!settings.securityChannelId],
    ["Staff role configured", !!settings.staffRoleId],
    ["Owner IDs configured", whitelistService.listOwners(message.guild.id).length > 0],
    ["Database healthy", (() => {
      try { db.prepare("SELECT 1").get(); return true; } catch { return false; }
    })()],
    ["Whitelist loaded", whitelistService.listWhitelist(message.guild.id).length >= 0],
    ["Protected roles loaded", permissionService.listProtectedRoles(message.guild.id).length >= 0],
    ["Protected channels loaded", permissionService.listProtectedChannels(message.guild.id).length >= 0],
    ["Thresholds valid", settings.banThreshold > 0 && settings.kickThreshold > 0 && settings.mentionThreshold > 0],
    ["Bot has Moderate Members", me.permissions.has("ModerateMembers")],
    ["Bot has Kick Members", me.permissions.has("KickMembers")],
    ["Bot has Ban Members", me.permissions.has("BanMembers")],
    ["Bot has Manage Roles", me.permissions.has("ManageRoles")],
    ["Bot role high enough for remediation", me.roles.highest.position > 1],
    ["Audit log access", me.permissions.has("ViewAuditLog")]
  ];

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🛡️ Security Health Check")
    .setDescription(checks.map(([label, ok]) => `${ok ? "✅" : "❌"} ${label}`).join("\n"));
  await message.channel.send({ embeds: [embed] });
}

async function event(message, args) {
  const id = args[1];
  if (!id) throw new Error("Usage: `*security event <eventId>`");
  const ev = securityService.getEvent(message.guild.id, id);
  if (!ev) throw new Error("No security event found with that ID.");
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(ev.eventId)
    .addFields(
      { name: "Type", value: ev.type, inline: true },
      { name: "Actor", value: ev.actorId ? `<@${ev.actorId}>` : "Unknown", inline: true },
      { name: "Timeout Applied", value: ev.timeoutApplied ? "Yes" : "No", inline: true },
      { name: "Details", value: `\`\`\`json\n${ev.details}\n\`\`\``.slice(0, 1024), inline: false },
      { name: "Timestamp", value: `<t:${Math.floor(ev.createdAt / 1000)}:F>`, inline: false }
    );
  await message.channel.send({ embeds: [embed] });
}

module.exports = {
  name: "security",
  ownerOnly: true,
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "status") return status(message);
    if (sub === "test") return test(message);
    if (sub === "event") return event(message, args);

    if (sub === "enable" || sub === "disable") {
      const system = args[1]?.toLowerCase();
      const map = {
        antinuke: "securityEnabled",
        roles: "roleProtectionEnabled",
        channels: "channelProtectionEnabled",
        bots: "botProtectionEnabled"
      };
      const field = map[system];
      if (!field) throw new Error("Usage: `*security <enable|disable> <antinuke|roles|channels|bots>`");
      configService.updateSetting(message.guild.id, field, sub === "enable" ? 1 : 0);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`Security configuration updated.`)]
      });
    }

    if (sub === "thresholds") {
      const type = args[1]?.toLowerCase();
      const value = parseInt(args[2], 10);
      const fieldMap = {
        ban: "banThreshold",
        bantime: "banWindowMs",
        kick: "kickThreshold",
        kicktime: "kickWindowMs",
        mention: "mentionThreshold",
        mentiontime: "mentionWindowMs",
        modrate: "modActionRateLimit"
      };
      const field = fieldMap[type];
      if (!field || !value) {
        throw new Error(
          "Usage: `*security thresholds <ban|bantime|kick|kicktime|mention|mentiontime|modrate> <number>` (time fields are minutes)"
        );
      }
      const isTime = field.endsWith("WindowMs");
      configService.updateSetting(message.guild.id, field, isTime ? value * 60000 : value);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`Security configuration updated.`)]
      });
    }

    if (sub === "staffrole") {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (!role) throw new Error("Usage: `*security staffrole <@role|roleId>`");
      configService.updateSetting(message.guild.id, "staffRoleId", role.id);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`Staff Access Role set to ${role.name}.`)]
      });
    }

    if (sub === "channel") {
      const type = args[1]?.toLowerCase();
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[2]);
      const fieldMap = {
        security: "securityChannelId",
        modlog: "modLogChannelId",
        welcome: "welcomeChannelId",
        levelup: "levelUpChannelId",
        ticketlog: "ticketLogChannelId",
        ticketpanel: "ticketPanelChannelId"
      };
      const field = fieldMap[type];
      if (!field || !channel) {
        throw new Error("Usage: `*security channel <security|modlog|welcome|levelup|ticketlog|ticketpanel> <#channel>`");
      }
      configService.updateSetting(message.guild.id, field, channel.id);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(`Channel configuration updated.`)]
      });
    }

    if (sub === "owner") {
      const action = args[1]?.toLowerCase();
      const rawId = args[2]?.replace(/[<@!>]/g, "");
      if (action === "add" && rawId) {
        whitelistService.addOwner(message.guild.id, rawId);
        return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`<@${rawId}> added as an owner.`)] });
      }
      throw new Error("Usage: `*security owner add <userId>`");
    }

    if (sub === "protectedroles") {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
      if (action === "add" && role) {
        permissionService.addProtectedRole(message.guild.id, role.id);
        return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Protected role added.`)] });
      }
      if (action === "remove" && role) {
        permissionService.removeProtectedRole(message.guild.id, role.id);
        return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Protected role removed.`)] });
      }
      const list = permissionService.listProtectedRoles(message.guild.id);
      return message.channel.send({
        embeds: [
          moderationService.publicSuccessEmbed(
            list.length ? `Protected roles: ${list.map((r) => `<@&${r}>`).join(", ")}` : "No protected roles."
          )
        ]
      });
    }

    if (sub === "protectedchannels") {
      const action = args[1]?.toLowerCase();
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[2]);
      if (action === "add" && channel) {
        permissionService.addProtectedChannel(message.guild.id, channel.id);
        return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Protected channel added.`)] });
      }
      if (action === "remove" && channel) {
        permissionService.removeProtectedChannel(message.guild.id, channel.id);
        return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Protected channel removed.`)] });
      }
      const list = permissionService.listProtectedChannels(message.guild.id);
      return message.channel.send({
        embeds: [
          moderationService.publicSuccessEmbed(
            list.length ? `Protected channels: ${list.map((c) => `<#${c}>`).join(", ")}` : "No protected channels."
          )
        ]
      });
    }

    throw new Error(
      "Usage: `*security <status|test|enable|disable|thresholds|staffrole|channel|owner|protectedroles|protectedchannels|event>`"
    );
  }
};
