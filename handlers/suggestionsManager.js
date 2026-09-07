const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const config = require("../config");
const db = require("../database");
const settings = require("../settings");

const CATEGORIES = {
  game: { label: "🎮 Game Suggestion", style: ButtonStyle.Primary },
  server: { label: "🖥️ Server Suggestion", style: ButtonStyle.Secondary },
  bot: { label: "🤖 Bot Suggestion", style: ButtonStyle.Success }
};



const PANEL_SETTING_KEY = "suggestions_panel_msg_id";
const CHANNEL_SETTING = "suggestionsChannelId";

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("💡 Staff Suggestions")
    .setDescription("Got an idea? Pick a category below and tell us about it.");

  const row = new ActionRowBuilder().addComponents(
    Object.entries(CATEGORIES).map(([key, def]) =>
      new ButtonBuilder().setCustomId(`suggest_open_${key}`).setLabel(def.label).setStyle(def.style)
    )
  );

  return { embeds: [embed], components: [row] };
}






async function refreshPanel(channel) {
  if (!channel) {
    const channelId = settings.get(CHANNEL_SETTING);
    if (!channelId) return null;
    channel = await channel.guild?.channels.fetch(channelId).catch(() => null);
    if (!channel) return null;
  }

  const oldId = db.getSetting(PANEL_SETTING_KEY);
  if (oldId) {
    const old = await channel.messages.fetch(oldId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }

  const sent = await channel.send(buildPanel());
  db.setSetting(PANEL_SETTING_KEY, sent.id);
  return sent;
}

async function openModal(interaction, category) {
  const modal = new ModalBuilder()
    .setCustomId(`suggest_modal_${category}`)
    .setTitle(CATEGORIES[category].label);

  const input = new TextInputBuilder()
    .setCustomId("suggestion")
    .setLabel("Your suggestion")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleSubmit(interaction, category) {
  const text = interaction.fields.getTextInputValue("suggestion");

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(CATEGORIES[category].label)
    .setDescription(text)
    .addFields({ name: "Submitted by", value: `<@${interaction.user.id}>` })
    .setTimestamp();


  const content = category === "bot" ? `<@${config.ownerId}>` : undefined;

  await interaction.channel.send({ content, embeds: [embed] });
  await interaction.reply({ content: "✅ Suggestion submitted, thanks!", ephemeral: true });
}

module.exports = { buildPanel, refreshPanel, openModal, handleSubmit, CATEGORIES };
