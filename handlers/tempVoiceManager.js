const { ChannelType, PermissionsBitField, EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");

async function ensureJoinToCreate(guild) {
  let categoryId = db.getSetting("temp_vc_category_id");
  let category = categoryId ? guild.channels.cache.get(categoryId) : null;

  if (!category) {
    throw new Error(
      "The temporary voice category is not configured. Run *setup and select an existing category."
    );
  }

  let joinChannelId = db.getSetting("temp_vc_join_channel_id");
  let joinChannel = joinChannelId ? guild.channels.cache.get(joinChannelId) : null;

  if (!joinChannel) {
    throw new Error(
      "The join-to-create voice channel is not configured. Run *setup and select an existing voice channel."
    );
  }

  return { category, joinChannel };
}

function checkCooldown(userId) {
  const last = db.getVCCooldown(userId);
  if (!last) return 0;
  const elapsed = Date.now() - last;
  const remaining = config.tempVoice.createCooldownSeconds * 1000 - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function buildInstructionsEmbed(owner) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("🔊 Your Voice Channel")
    .setDescription(
      `This is your private channel, <@${owner.id}>. You're in charge of it — commands only work for you (or admins), typed right here in this chat.`
    )
    .addFields(
      { name: "`*lock`", value: "Stop new people from joining." },
      { name: "`*unlock`", value: "Let anyone join again." },
      { name: "`*permit @user`", value: "Let a specific person in, even while locked." },
      { name: "`*reject @user`", value: "Kick someone out and block them from rejoining." },
      { name: "`*limit <number>`", value: "Cap how many people can join (0 = no limit)." },
      { name: "`*rename <name>`", value: "Rename the channel." }
    )
    .setFooter({ text: "Leaving this channel as the owner deletes it instantly for everyone." });
}

async function createUserChannel(guild, category, joinChannel, member) {
  const channel = await guild.channels.create({
    name: config.tempVoice.newChannelName(member.user.username).slice(0, 100),
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
      },
      {
        id: member,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.SendMessages
        ]
      }
    ]
  });

  db.createTempVC(channel.id, member.id, guild.id);
  db.setVCCooldown(member.id);

  await member.voice.setChannel(channel).catch(() => {});
  await channel.send({ embeds: [buildInstructionsEmbed(member)] }).catch(() => {});

  return channel;
}

async function deleteChannelAndKickAll(guild, channel) {
  try {
    const members = [...channel.members.values()];
    for (const m of members) {
      await m.voice.disconnect().catch(() => {});
    }
    await channel.delete().catch(() => {});
  } finally {
    db.deleteTempVC(channel.id);
  }
}

function requireOwnedVC(message) {
  const tempVC = db.getTempVC(message.channel.id);
  if (!tempVC) {
    throw new Error("This command only works inside your own voice channel's chat.");
  }
  const isOwner = message.author.id === tempVC.owner_id;
  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
  if (!isOwner && !isAdmin) {
    throw new Error("🚫 Only the channel owner can run that.");
  }
  return tempVC;
}

module.exports = {
  ensureJoinToCreate,
  checkCooldown,
  createUserChannel,
  deleteChannelAndKickAll,
  requireOwnedVC
};
