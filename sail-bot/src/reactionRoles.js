const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { BRAND_COLOR, BRAND_NAME } = require('./config');


async function setupReactionRole(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can set up reaction roles.');
  }

  const [messageId, emoji] = args;
  const role = message.mentions.roles.first();

  if (!messageId || !emoji || !role) {
    return message.reply('❌ Usage: `*reactionrole <messageId> <emoji> @role` (run this in the channel the message is in).');
  }

  const target = await message.channel.messages.fetch(messageId).catch(() => null);
  if (!target) {
    return message.reply('❌ Could not find that message in this channel.');
  }

  db.addReactionRole(messageId, emoji, role.id);
  await target.react(emoji).catch(() => {});

  await message.channel.send(`✅ Reacting with ${emoji} on that message now grants ${role}.`);
  await message.delete().catch(() => {});
}

async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
  const mapping = db.getReactionRole(reaction.message.id, emojiKey);
  if (!mapping) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  const role = guild.roles.cache.get(mapping.role_id);
  if (!member || !role) return;

  await member.roles.add(role).catch(() => {});
}

async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
  const mapping = db.getReactionRole(reaction.message.id, emojiKey);
  if (!mapping) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  const role = guild.roles.cache.get(mapping.role_id);
  if (!member || !role) return;

  await member.roles.remove(role).catch(() => {});
}

module.exports = { setupReactionRole, handleReactionAdd, handleReactionRemove };
