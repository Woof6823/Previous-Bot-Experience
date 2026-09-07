const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

const config = require("../config");
const settings = require("../settings");
const db = require("../database");
const ticketManager = require("./ticketManager");

const {
  hasStaffAccess,
  isOwner
} = require("../utils/staffAccess");

const CLAIM_ROLE_ID = "1483971273917726803";

function isTicketStaff(member) {
  if (!member) return false;


  if (isOwner(member.id)) return true;

  if (hasStaffAccess(member)) return true;

  const staffRoleId = settings.get("staffRoleId");

  if (
    staffRoleId &&
    member.roles.cache.has(staffRoleId)
  ) {
    return true;
  }

  return false;
}

async function handleCloseButtonClick(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(
      `ticket_close_modal_${interaction.channel.id}`
    )
    .setTitle("Close Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId("close_reason")
    .setLabel("Reason for closing (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

async function handleCloseModalSubmit(interaction) {
  const reason =
    interaction.fields.getTextInputValue("close_reason") ||
    "No reason provided.";

  await interaction.deferUpdate();

  await ticketManager.closeTicket(
    interaction.guild,
    interaction.channel.id,
    reason,
    interaction.user.id
  );
}

async function handleTicketAction(interaction, client) {
  const customId = interaction.customId;
  const channelId = customId.split("_").pop();




  if (customId.startsWith("ticket_claim_")) {
    const ticket = db.getTicketByChannel(channelId);


    if (
      ticket &&
      ticket.user_id === interaction.user.id
    ) {
      await interaction.reply({
        content: "🚫 You can't claim your own ticket.",
        flags: 64
      });
      return;
    }

    const hasClaimRole =
      interaction.member &&
      interaction.member.roles.cache.has(CLAIM_ROLE_ID);


    if (
      !hasClaimRole &&
      !isOwner(interaction.user.id)
    ) {
      await interaction.reply({
        content:
          "🚫 Only members with the ticket claim role can claim tickets.",
        flags: 64
      });
      return;
    }

    try {
      await ticketManager.claimTicket(
        interaction.guild,
        channelId,
        interaction.user.id
      );

      await interaction.reply({
        content:
          "✅ You have claimed this ticket.",
        flags: 64,
        allowedMentions: { parse: [] }
      });
    } catch (err) {
      await interaction.reply({
        content: `❌ ${err.message}`,
        flags: 64
      });
    }

    return;
  }




  if (customId.startsWith("ticket_timer_")) {
    const ticket = db.getTicketByChannel(channelId);


    if (
      ticket &&
      ticket.user_id === interaction.user.id
    ) {
      await interaction.reply({
        content:
          "🚫 You can't start the timer on your own ticket.",
        flags: 64
      });
      return;
    }

    const started =
      await ticketManager.startTicketTimer(
        client,
        interaction.guild,
        channelId,
        interaction.user.id
      );

    if (started) {
      await interaction.reply({
        content:
          `⏳ ${config.timerHours}h timer started.`,
        flags: 64
      });
    } else {
      await interaction.reply({
        content:
          "❌ Could not start timer (already running, delayed, or pro-waiting).",
        flags: 64
      });
    }

    return;
  }
}

module.exports = {
  isTicketStaff,
  handleCloseButtonClick,
  handleCloseModalSubmit,
  handleTicketAction
};
