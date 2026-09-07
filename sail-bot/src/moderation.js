const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const { isAdmin, hasModPerm } = require('./permissions');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');

function parseTargetAndReason(message, args) {
  const target = message.mentions.members.first();
  const reason = args.slice(1).join(' ') || 'No reason provided';
  return { target, reason };
}

async function logModAction(guild, embed) {
  const channelId = db.getSetting(SETTINGS_KEYS.MODLOG_CHANNEL);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

function baseEmbed(title, color = BRAND_COLOR) {
  return new EmbedBuilder().setColor(color).setTitle(title).setFooter({ text: BRAND_NAME }).setTimestamp();
}


async function warn(message, args) {
  if (!hasModPerm(message.member, 'warn')) {
    return message.reply('❌ You need the **warn** permission ticket (or Administrator) to use this.');
  }
  const { target, reason } = parseTargetAndReason(message, args);
  if (!target) return message.reply('❌ Please mention a user to warn.');

  db.addWarning(message.guild.id, target.id, message.author.id, reason);

  const embed = baseEmbed('⚠️ Member Warned', 0xf2c230)
    .addFields(
      { name: 'User', value: `${target}`, inline: true },
      { name: 'Moderator', value: `${message.author}`, inline: true },
      { name: 'Reason', value: reason }
    );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
  await target.send(`⚠️ You were warned in **${message.guild.name}**: ${reason}`).catch(() => {});
}


async function warnings(message, args) {
  const target = message.mentions.members.first() || message.member;
  const rows = db.getWarnings(message.guild.id, target.id);

  if (rows.length === 0) {
    return message.channel.send(`✅ ${target} has no warnings.`);
  }

  const embed = baseEmbed(`Warnings for ${target.user.tag}`).setDescription(
    rows
      .slice(0, 15)
      .map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.moderator_id}> · <t:${Math.floor(w.created_at / 1000)}:R>`)
      .join('\n')
  );

  await message.channel.send({ embeds: [embed] });
}


async function clearWarnings(message) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can use this command.');
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply('❌ Please mention a user.');

  db.clearWarnings(message.guild.id, target.id);
  await message.channel.send(`✅ Cleared all warnings for ${target}.`);
}


async function mute(message, args) {
  if (!hasModPerm(message.member, 'mute')) {
    return message.reply('❌ You need the **mute** permission ticket (or Administrator) to use this.');
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply('❌ Please mention a user to mute.');

  if (!target.moderatable) {
    return message.reply('❌ I cannot mute that user (role hierarchy or missing permission).');
  }

  const minutesArg = parseInt(args[1], 10);
  const minutes = Number.isFinite(minutesArg) && minutesArg > 0 ? minutesArg : 10;
  const reason = args.slice(2).join(' ') || 'No reason provided';

  await target.timeout(minutes * 60 * 1000, reason);

  const embed = baseEmbed('🔇 Member Muted', 0xed8f22)
    .addFields(
      { name: 'User', value: `${target}`, inline: true },
      { name: 'Duration', value: `${minutes} minute(s)`, inline: true },
      { name: 'Moderator', value: `${message.author}`, inline: true },
      { name: 'Reason', value: reason }
    );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
}


async function unmute(message) {
  if (!hasModPerm(message.member, 'mute')) {
    return message.reply('❌ You need the **mute** permission ticket (or Administrator) to use this.');
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply('❌ Please mention a user.');

  await target.timeout(null).catch(() => {});

  const embed = baseEmbed('🔊 Member Unmuted', 0x57f287).addFields(
    { name: 'User', value: `${target}`, inline: true },
    { name: 'Moderator', value: `${message.author}`, inline: true }
  );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
}


async function kick(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can use the kick command.');
  }
  const { target, reason } = parseTargetAndReason(message, args);
  if (!target) return message.reply('❌ Please mention a user to kick.');
  if (!target.kickable) return message.reply('❌ I cannot kick that user (role hierarchy).');

  await target.send(`You were kicked from **${message.guild.name}**: ${reason}`).catch(() => {});
  await target.kick(reason);

  const embed = baseEmbed('👢 Member Kicked', 0xed4245).addFields(
    { name: 'User', value: `${target.user.tag}`, inline: true },
    { name: 'Moderator', value: `${message.author}`, inline: true },
    { name: 'Reason', value: reason }
  );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
}


async function ban(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can use the ban command.');
  }
  const { target, reason } = parseTargetAndReason(message, args);
  if (!target) return message.reply('❌ Please mention a user to ban.');
  if (!target.bannable) return message.reply('❌ I cannot ban that user (role hierarchy).');

  await target.send(`You were banned from **${message.guild.name}**: ${reason}`).catch(() => {});
  await target.ban({ reason });

  const embed = baseEmbed('🔨 Member Banned', 0xed4245).addFields(
    { name: 'User', value: `${target.user.tag}`, inline: true },
    { name: 'Moderator', value: `${message.author}`, inline: true },
    { name: 'Reason', value: reason }
  );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
}


async function unban(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can use the unban command.');
  }
  const userId = args[0];
  if (!userId) return message.reply('❌ Please provide a user ID to unban.');

  await message.guild.members.unban(userId).catch(() => {
    throw new Error('Could not unban that user ID (are they actually banned?).');
  });

  const embed = baseEmbed('✅ Member Unbanned', 0x57f287).addFields(
    { name: 'User ID', value: userId, inline: true },
    { name: 'Moderator', value: `${message.author}`, inline: true }
  );

  await message.channel.send({ embeds: [embed] });
  await logModAction(message.guild, embed);
}


async function purge(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can use the purge command.');
  }
  const count = parseInt(args[0], 10);
  if (!Number.isFinite(count) || count < 1 || count > 100) {
    return message.reply('❌ Please provide a number between 1 and 100.');
  }

  const deleted = await message.channel.bulkDelete(count + 1, true).catch(() => null);
  const notice = await message.channel.send(
    `🧹 Deleted ${deleted ? deleted.size - 1 : 0} message(s).`
  );
  setTimeout(() => notice.delete().catch(() => {}), 4000);
}


async function addModRole(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can grant moderation permission tickets.');
  }
  const role = message.mentions.roles.first();
  const perm = (args[1] || '').toLowerCase();

  if (!role) return message.reply('❌ Please mention a role.');
  if (!['warn', 'mute'].includes(perm)) {
    return message.reply('❌ Permission must be exactly `warn` or `mute` (kick/ban can never be granted this way).');
  }

  db.grantRolePerm(role.id, perm);
  await message.channel.send(`✅ ${role} can now use **${perm}** across any of their roles.`);
}


async function removeModRole(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can revoke moderation permission tickets.');
  }
  const role = message.mentions.roles.first();
  const perm = (args[1] || '').toLowerCase();

  if (!role) return message.reply('❌ Please mention a role.');
  if (!['warn', 'mute'].includes(perm)) {
    return message.reply('❌ Permission must be exactly `warn` or `mute`.');
  }

  db.revokeRolePerm(role.id, perm);
  await message.channel.send(`✅ Revoked **${perm}** from ${role}.`);
}


async function listModRoles(message) {
  const role = message.mentions.roles.first();
  if (!role) return message.reply('❌ Please mention a role.');

  const perms = db.listRolePerms(role.id);
  await message.channel.send(
    perms.length
      ? `${role} has: **${perms.join(', ')}**`
      : `${role} has no moderation permission tickets.`
  );
}

module.exports = {
  warn,
  warnings,
  clearWarnings,
  mute,
  unmute,
  kick,
  ban,
  unban,
  purge,
  addModRole,
  removeModRole,
  listModRoles,
  logModAction,
  baseEmbed,
};
