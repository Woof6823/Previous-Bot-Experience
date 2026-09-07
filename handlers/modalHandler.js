const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const config = require("../config");
const db = require("../database");
const ticketManager = require("./ticketManager");
const settings = require("../settings");
const blacklistManager = require("./blacklistManager");
const accountAgeManager = require("./accountAgeManager");
const MIN_AGE = 14;

function buildModal(type, questions, modalId) {
  const def = config.ticketTypes[type];
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle(`${def.emoji} ${def.label} Ticket`);
  const rows = questions.map((q) => {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.style === "Paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required !== false);
    if (q.id === "age") input.setMinLength(1).setMaxLength(3).setPlaceholder("Numbers only");
    else if (q.helper) input.setPlaceholder(q.helper.slice(0, 100));
    return new ActionRowBuilder().addComponents(input);
  });
  modal.addComponents(...rows);
  return modal;
}

async function proceedWithNewTicket(interaction, type) {
  const def = config.ticketTypes[type];
  if (!def.questions || def.questions.length === 0) {
    if (!interaction.deferred) await interaction.deferReply({ flags: 64 });
    try {
      const channel = await ticketManager.createTicketChannel(
        interaction.guild,
        interaction.member,
        type,
        {}
      );
      await interaction.editReply(`✅ Your ticket has been created: <#${channel.id}>`);
    } catch (err) {
      await interaction
        .editReply(`❌ ${err.message || "Something went wrong creating that ticket."}`)
        .catch(() => {});
    }
    return;
  }
  const modal = buildModal(type, def.questions, `ticket_modal_${type}`);
  await interaction.showModal(modal);
}

async function handleTicketButtonClick(interaction, type) {
  const def = config.ticketTypes[type];
  const fullBlacklist = db.getBlacklist(interaction.user.id, "full");
  if (fullBlacklist) {
    await interaction.reply({ content: "🚫 You're blacklisted from opening tickets.", flags: 64 });
    return;
  }
  if (
    type === "staff" &&
    interaction.member.roles.cache.has(settings.get("staffBlacklistRoleId"))
  ) {
    await interaction.reply({ content: "🚫 You're not able to open Staff tickets.", flags: 64 });
    return;
  }
  const existing = ticketManager.getOpenTicketForUser(interaction.user.id);
  if (existing) {
    const existingChannel = interaction.guild.channels.cache.get(existing.channel_id);
    const channelMention = existingChannel
      ? `<#${existing.channel_id}>`
      : `#${existing.type}-ticket-${existing.number}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_replace_confirm_${type}`)
        .setLabel("Close It & Open New Ticket")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_replace_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({
      content: `⚠️ You already have an open ticket: ${channelMention}.
Would you like to **close it** and open a new **${def.label}** ticket instead?`,
      components: [row],
      flags: 64
    });
    return;
  }
  await proceedWithNewTicket(interaction, type);
}

async function handleReplaceConfirm(interaction, type) {
  const existing = ticketManager.getOpenTicketForUser(interaction.user.id);
  if (!existing) {
    await proceedWithNewTicket(interaction, type);
    return;
  }
  db.closeTicket(existing.channel_id);
  db.clearTimer(existing.channel_id);
  const oldChannel = interaction.guild.channels.cache.get(existing.channel_id);
  if (oldChannel) {
    oldChannel.send("🔒 This ticket was closed and replaced with a new one.").catch(() => {});
    oldChannel.delete("Replaced by new ticket").catch(() => {});
  }
  await proceedWithNewTicket(interaction, type);
}

async function handleReplaceCancel(interaction) {
  await interaction.update({
    content: "❌ Cancelled. Your existing ticket remains open.",
    components: []
  });
}

async function autoBlacklistForAge(interaction, ageValue) {
  const userId = interaction.user.id;
  const blacklistChannelId = settings.get("blacklistChannelId");
  await interaction.member.roles.add(settings.get("staffBlacklistRoleId")).catch((err) => {
    console.error(`Failed to add staff-blacklist role to ${userId} (underage):`, err.message);
  });
  db.addBlacklist(
    userId,
    "staff",
    `Underage — stated age ${ageValue} (under ${MIN_AGE}). Done by AutoMod.`,
    interaction.client.user.id
  );


  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("⚠️ Staff Application Paused - Age Verification Required")
      .setDescription(
        `Your staff application has been paused because the stated age is under the minimum requirement.\n\n` +
        `You will be unable to apply for staff positions until you can prove your age (you will need to provide a valid form of ID, such as a government-issued ID with sensitive information redacted).\n\n` +
        `**Please note:** You can still apply for our Roster!\n\n` +
        `To appeal this and provide your proof of age, please open a ticket in our appeals server: https://discord.gg/xWb9d4yB4J`
      )
      .setTimestamp();
    await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {});
  } catch (err) {
    console.error(`Failed to send underage blacklist DM to ${userId}:`, err.message);
  }

  if (!blacklistChannelId) return;
  const blacklistChannel = await interaction.guild.channels
    .fetch(blacklistChannelId)
    .catch(() => null);
  if (!blacklistChannel) return;
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔞 Automatic Staff Blacklist — Underage")
    .addFields(
      { name: "User", value: `<@${userId}> (${userId})`, inline: true },
      { name: "Stated Age", value: `${ageValue}`, inline: true },
      { name: "Minimum Required", value: `${MIN_AGE}`, inline: true },
      {
        name: "Reason",
        value: "Underage — automatically blacklisted from Staff/Roster applications."
      },
      { name: "Action performed by", value: "🤖 AutoMod (automatic)", inline: true },
      { name: "Blacklisted at", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    );
  const sent = await blacklistChannel.send({ embeds: [embed] }).catch(() => null);
  if (sent) db.setBlacklistApprovalMessage(userId, "staff", blacklistChannel.id, sent.id);
  await blacklistManager.refreshPanel(blacklistChannel).catch(() => {});
}

async function handleModalSubmit(interaction) {
  const [, , type] = interaction.customId.split("_");
  const def = config.ticketTypes[type];
  const answers = {};
  for (const q of def.questions) answers[q.id] = interaction.fields.getTextInputValue(q.id);
  if (
    (type === "staff" || type === "roster") &&
    Object.prototype.hasOwnProperty.call(answers, "age")
  ) {
    const raw = (answers.age || "").trim();
    if (!/^\d+$/.test(raw)) {
      await interaction.reply({
        content:
          "🚫 Age must be a number and nothing else. Please click the button again and try once more.",
        flags: 64
      });
      return;
    }
    const age = parseInt(raw, 10);
    if (age < MIN_AGE) {
      await interaction.deferReply({ flags: 64 });
      await autoBlacklistForAge(interaction, age).catch((err) =>
        console.error("Auto age-blacklist failed:", err.message)
      );





      if (type === "staff") {
        await interaction.editReply(
          "🚫 Your staff application has been closed — you must be at least " +
            `${MIN_AGE} to apply. Check your DMs for details on how to appeal.`
        );
        return;
      }
    }
  }
  if (!interaction.deferred) await interaction.deferReply({ flags: 64 });
  try {
    const channel = await ticketManager.createTicketChannel(
      interaction.guild,
      interaction.member,
      type,
      answers
    );




    if (type === "staff" && accountAgeManager.isTooYoungForStaff(interaction.member)) {
      const ticket = db.getTicketByChannel(channel.id);
      await accountAgeManager
        .handleUnderageStaffApplicant(interaction.guild, interaction.client, ticket, interaction.member)
        .catch((err) => console.error("Under-age staff applicant handling failed:", err.message));

      await interaction.editReply(
        "🚫 Your staff application was closed — your Discord account must be at least 30 days old. Check your DMs for details."
      );
      return;
    }

    await interaction.editReply(`✅ Your ticket has been created: <#${channel.id}>`);
  } catch (err) {
    await interaction
      .editReply(`❌ ${err.message || "Something went wrong creating that ticket."}`)
      .catch(() => {});
  }
}

module.exports = {
  handleTicketButtonClick,
  handleModalSubmit,
  handleReplaceConfirm,
  handleReplaceCancel
};
