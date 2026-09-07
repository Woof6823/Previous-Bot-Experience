const {
  ActivityType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const db = require("../database");
const settings = require("../settings");

const PANEL_MESSAGE_ID_KEY = "status_role_panel_message_id";
const ROLE_RESET_DONE_KEY = "status_role_reset_v2_done";




const helpButtonCooldowns = new Map();




const panelLocks = new Map();

function getCustomStatusText(member) {
  const activity = member?.presence?.activities?.find((a) => a.type === ActivityType.Custom);
  return activity?.state || null;
}



function isVisible(member) {
  const status = member?.presence?.status;
  return !!status && status !== "offline";
}

function getSupporterCount(guild) {
  const role = guild.roles.cache.get(config.statusRole.roleId);
  return role ? role.members.size : 0;
}

function buildPanelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("💛 Become a Supporter")
    .setDescription(
      `Set your Discord custom status to **exactly** the text below (nothing else added — no emojis, no extra words) ` +
        `and you'll automatically receive the <@&${config.statusRole.roleId}> role.\n\n` +
        `\`\`\`${config.statusRole.requiredStatus}\`\`\`\n` +
        `Your status just needs to be visible to the bot (Online, Idle, or Do Not Disturb are all fine) — only Offline/Invisible doesn't count.\n\n` +
        `If you ever remove the status or change it to anything else, the role is removed automatically.\n\n` +
        `Not sure how to set a custom status? Click the button below and we'll DM you a quick how-to video.`
    )
    .addFields({ name: "Current Supporters", value: `${getSupporterCount(guild)}`, inline: true })
    .setFooter({ text: "Checked automatically, all the time." });
}

function buildPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("statusrole_help")
      .setLabel("Help")
      .setEmoji("❓")
      .setStyle(ButtonStyle.Secondary)
  );
}






async function ensurePanel(channel) {
  if (!channel) return;

  if (panelLocks.get(channel.id)) return;
  panelLocks.set(channel.id, true);

  try {
    const payload = { embeds: [buildPanelEmbed(channel.guild)], components: [buildPanelRow()] };
    const storedId = db.getSetting(PANEL_MESSAGE_ID_KEY);

    let panelMessage = storedId ? await channel.messages.fetch(storedId).catch(() => null) : null;

    if (panelMessage) {
      await panelMessage.edit(payload).catch(() => {});
    } else {
      panelMessage = await channel.send(payload).catch(() => null);
      if (panelMessage) db.setSetting(PANEL_MESSAGE_ID_KEY, panelMessage.id);
    }

    if (!panelMessage) return;



    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (!recent) return;
    for (const msg of recent.values()) {
      if (
        msg.id !== panelMessage.id &&
        msg.author?.id === channel.client.user.id &&
        msg.embeds[0]?.title === "💛 Become a Supporter"
      ) {
        await msg.delete().catch(() => {});
      }
    }
  } finally {
    panelLocks.delete(channel.id);
  }
}


async function postInitialPanel(channel) {
  await ensurePanel(channel);
}

async function getStatusChannel(guild) {
  const channelId = settings.get("statusRoleChannelId");
  if (!channelId) return null;
  return (
    guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null))
  );
}




async function checkMember(member) {
  if (!member || member.user?.bot) return;

  const channel = await getStatusChannel(member.guild);
  if (!channel) return;

  const roleId = config.statusRole.roleId;
  const hasRole = member.roles.cache.has(roleId);
  const statusText = getCustomStatusText(member);
  const matches = statusText === config.statusRole.requiredStatus && isVisible(member);

  if (matches && !hasRole) {
    await member.roles.add(roleId).catch((err) => {
      console.error(`Failed to add status-supporter role to ${member.id}:`, err.message);
    });
    await ensurePanel(channel);
    return;
  }

  if (!matches && hasRole) {
    await member.roles.remove(roleId).catch((err) => {
      console.error(`Failed to remove status-supporter role from ${member.id}:`, err.message);
    });
    await ensurePanel(channel);
  }
}





async function resetRoleIfNeeded(guild) {
  if (db.getSetting(ROLE_RESET_DONE_KEY)) return;

  const role = guild.roles.cache.get(config.statusRole.roleId);
  if (role) {
    const members = await guild.members.fetch().catch(() => null);
    const holders = members ? [...members.values()].filter((m) => m.roles.cache.has(role.id)) : [];
    for (const member of holders) {
      await member.roles.remove(role.id).catch((err) => {
        console.error(`Failed to strip status-supporter role from ${member.id}:`, err.message);
      });
    }
    console.log(`Status-role reset: removed the Supporter role from ${holders.length} member(s).`);
  }

  db.setSetting(ROLE_RESET_DONE_KEY, "1");
}

async function sweepGuild(guild) {
  const channel = await getStatusChannel(guild);
  if (!channel) return;

  for (const member of guild.members.cache.values()) {
    await checkMember(member).catch((err) => {
      console.error(`Status-role sweep failed for ${member.id}:`, err.message);
    });
  }



  await ensurePanel(channel);
}

function videoPath(filename) {
  return path.join(process.cwd(), config.statusRole.videosDir, filename);
}


async function handleHelpButtonClick(interaction) {
  const userId = interaction.user.id;
  const now = Date.now();
  const readyAt = helpButtonCooldowns.get(userId) || 0;

  if (now < readyAt) {
    const remaining = Math.ceil((readyAt - now) / 1000);
    await interaction.reply({
      content: `⏳ Please wait ${remaining}s before requesting the videos again.`,
      ephemeral: true
    });
    return;
  }




  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const mobilePath = videoPath("mobile.mp4");
  const pcPath = videoPath("pc.mp4");
  const files = [];
  if (fs.existsSync(mobilePath))
    files.push(new AttachmentBuilder(mobilePath, { name: "mobile-how-to.mp4" }));
  if (fs.existsSync(pcPath)) files.push(new AttachmentBuilder(pcPath, { name: "pc-how-to.mp4" }));

  if (files.length === 0) {
    await interaction
      .editReply({
        content: "⚠️ The how-to videos haven't been uploaded yet — let staff know."
      })
      .catch(() => {});
    return;
  }

  try {
    await interaction.user.send({
      content: "Here's how to set your custom status on mobile and on PC:",
      files
    });
    helpButtonCooldowns.set(userId, now + config.statusRole.helpButtonCooldownMs);
    await interaction.editReply({ content: "📨 Sent! Check your DMs." }).catch(() => {});
  } catch {
    await interaction
      .editReply({
        content: "❌ I couldn't DM you — please enable DMs from server members and try again."
      })
      .catch(() => {});
  }
}

module.exports = {
  checkMember,
  sweepGuild,
  postInitialPanel,
  ensurePanel,
  resetRoleIfNeeded,
  handleHelpButtonClick,
  getCustomStatusText
};
