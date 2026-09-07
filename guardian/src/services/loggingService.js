const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const configService = require("./configService");

function truncate(value, max = 1000) {
  if (value === null || value === undefined) return "None";
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function userText(user) {
  if (!user) return "Unknown";
  return `${user.tag || user.username || "Unknown"}\n\`${user.id}\``;
}

async function send(guild, {
  title,
  description,
  color = config.brandColor,
  fields = [],
  channelId,
  thumbnailUser,
  footer = "Guardian • Server Audit Log"
}) {
  if (!guild) return;

  const settings = configService.getSettings(guild.id);
  const targetId = channelId || settings.modLogChannelId || config.modLogChannelId;
  if (!targetId) return;

  const channel = guild.channels.cache.get(targetId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: guild.name,
      iconURL: guild.iconURL({ extension: "png", size: 128 }) || undefined
    })
    .setTitle(title)
    .setDescription(description ? truncate(description, 4000) : null)
    .addFields(fields.slice(0, 25).map(f => ({
      name: truncate(f.name, 256),
      value: truncate(f.value, 1024),
      inline: Boolean(f.inline)
    })))
    .setFooter({ text: footer })
    .setTimestamp();

  if (thumbnailUser) {
    embed.setThumbnail(
      thumbnailUser.displayAvatarURL?.({ extension: "png", size: 256 }) ||
      thumbnailUser.user?.displayAvatarURL?.({ extension: "png", size: 256 }) ||
      undefined
    );
  }

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function security(guild, options) {
  return send(guild, {
    ...options,
    channelId: config.securityChannelId,
    footer: "Guardian • Security / Anti-Nuke"
  });
}

async function memberJoin(member) {
  return send(member.guild, {
    title: "📥 Member Joined",
    color: 0x57f287,
    description: `${member} joined the server.`,
    fields: [
      { name: "User", value: userText(member.user), inline: true },
      { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
      { name: "Member Count", value: String(member.guild.memberCount), inline: true }
    ],
    thumbnailUser: member
  });
}

async function memberLeave(member) {
  return send(member.guild, {
    title: "📤 Member Left",
    color: 0xed4245,
    description: `${member.user?.tag || "A member"} left the server.`,
    fields: [
      { name: "User", value: userText(member.user), inline: true },
      { name: "Joined", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Unknown", inline: true }
    ],
    thumbnailUser: member
  });
}

async function memberUpdate(oldMember, newMember) {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push({
      name: "Nickname",
      value: `**Before:** ${oldMember.nickname || "None"}\n**After:** ${newMember.nickname || "None"}`
    });
  }

  const oldRoles = new Set(oldMember.roles.cache.keys());
  const newRoles = new Set(newMember.roles.cache.keys());

  const added = [...newRoles]
    .filter(id => !oldRoles.has(id))
    .map(id => newMember.guild.roles.cache.get(id))
    .filter(Boolean)
    .filter(r => r.id !== newMember.guild.id)
    .map(r => `${r} (\`${r.id}\`)`);

  const removed = [...oldRoles]
    .filter(id => !newRoles.has(id))
    .map(id => oldMember.guild.roles.cache.get(id))
    .filter(Boolean)
    .filter(r => r.id !== newMember.guild.id)
    .map(r => `${r} (\`${r.id}\`)`);

  if (added.length) changes.push({ name: "Roles Added", value: truncate(added.join("\n")) });
  if (removed.length) changes.push({ name: "Roles Removed", value: truncate(removed.join("\n")) });

  if (!changes.length) return;

  return send(newMember.guild, {
    title: "👤 Member Updated",
    color: 0x5865f2,
    description: `${newMember} was updated.`,
    fields: [
      { name: "User", value: userText(newMember.user), inline: true },
      ...changes
    ],
    thumbnailUser: newMember
  });
}

async function messageDelete(message) {
  if (!message.guild || message.author?.bot) return;

  return send(message.guild, {
    title: "🗑️ Message Deleted",
    color: 0xed4245,
    description: `A message was deleted in ${message.channel}.`,
    fields: [
      { name: "Author", value: userText(message.author), inline: true },
      { name: "Channel", value: `${message.channel} (\`${message.channel.id}\`)`, inline: true },
      { name: "Content", value: truncate(message.content || "No text content.", 900) }
    ],
    thumbnailUser: message.author
  });
}

async function messageUpdate(oldMessage, newMessage) {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  return send(oldMessage.guild, {
    title: "✏️ Message Edited",
    color: 0xfee75c,
    description: `A message was edited in ${oldMessage.channel}.`,
    fields: [
      { name: "Author", value: userText(oldMessage.author), inline: true },
      { name: "Channel", value: `${oldMessage.channel}`, inline: true },
      { name: "Before", value: truncate(oldMessage.content || "Empty", 900) },
      { name: "After", value: truncate(newMessage.content || "Empty", 900) }
    ],
    thumbnailUser: oldMessage.author
  });
}

async function command(message, commandName, args) {
  return send(message.guild, {
    title: "⚡ Command Executed",
    color: config.brandColor,
    description: `${message.author} executed a Guardian command.`,
    fields: [
      { name: "Command", value: `\`${config.prefix}${commandName}\``, inline: true },
      { name: "User", value: userText(message.author), inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      { name: "Arguments", value: args.length ? `\`${truncate(args.join(" "), 900)}\`` : "None" }
    ],
    thumbnailUser: message.member
  });
}

async function channel(guild, action, channel) {
  return send(guild, {
    title: `${action === "created" ? "📁" : action === "deleted" ? "🗑️" : "📝"} Channel ${action}`,
    color: action === "deleted" ? 0xed4245 : config.brandColor,
    fields: [
      { name: "Channel", value: `#${channel.name}\n\`${channel.id}\``, inline: true },
      { name: "Type", value: String(channel.type), inline: true },
      { name: "Category", value: channel.parent ? `${channel.parent.name}\n\`${channel.parent.id}\`` : "None", inline: true }
    ]
  });
}

async function role(guild, action, role) {
  return send(guild, {
    title: `${action === "created" ? "🏷️" : action === "deleted" ? "🗑️" : "📝"} Role ${action}`,
    color: action === "deleted" ? 0xed4245 : role.color || config.brandColor,
    fields: [
      { name: "Role", value: `${role.name}\n\`${role.id}\``, inline: true },
      { name: "Position", value: String(role.position), inline: true },
      { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
      { name: "Permissions", value: truncate(role.permissions?.toArray?.().join(", ") || "None", 900) }
    ]
  });
}

async function ban(guild, ban, action = "Banned") {
  return send(guild, {
    title: action === "Banned" ? "🔨 Member Banned" : "♻️ Member Unbanned",
    color: action === "Banned" ? 0xed4245 : 0x57f287,
    fields: [
      { name: "User", value: userText(ban.user), inline: true },
      { name: "Reason", value: truncate(ban.reason || "No reason provided"), inline: true }
    ],
    thumbnailUser: ban.user
  });
}

async function voice(oldState, newState) {
  if (!oldState.guild) return;

  let action = "Voice State Updated";
  let color = config.brandColor;

  if (!oldState.channel && newState.channel) {
    action = "🎙️ Joined Voice";
    color = 0x57f287;
  } else if (oldState.channel && !newState.channel) {
    action = "🚪 Left Voice";
    color = 0xed4245;
  } else if (oldState.channelId !== newState.channelId) {
    action = "🔀 Moved Voice";
  } else if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
    action = "🔊 Voice Permissions Changed";
  } else {
    return;
  }

  return send(oldState.guild, {
    title: action,
    color,
    fields: [
      { name: "User", value: userText(newState.member?.user), inline: true },
      { name: "Before", value: oldState.channel ? `${oldState.channel.name}\n\`${oldState.channel.id}\`` : "None", inline: true },
      { name: "After", value: newState.channel ? `${newState.channel.name}\n\`${newState.channel.id}\`` : "None", inline: true }
    ],
    thumbnailUser: newState.member
  });
}

module.exports = {
  send,
  security,
  memberJoin,
  memberLeave,
  memberUpdate,
  messageDelete,
  messageUpdate,
  command,
  channel,
  role,
  ban,
  voice
};
