const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const db = require("../database");

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function buildRaceEmbed(race, claimCount, role) {
  const full = race.filled_at !== null;
  const embed = new EmbedBuilder().setColor(full ? config.successColor : config.brandColor);

  if (full) {
    const duration = formatDuration(race.filled_at - race.started_at);
    embed
      .setTitle("🎉 All claimed!")
      .setDescription(
        `**${role}** — all ${race.amount} spot(s) claimed.\nFilled in **${duration}** (at <t:${Math.floor(race.filled_at / 1000)}:T>).`
      );
  } else {
    embed
      .setTitle("🏁 Limited-time role — first come, first served!")
      .setDescription(
        `First **${race.amount}** people to click below get **${role}**!\n\nClaimed so far: **${claimCount}/${race.amount}**`
      );
  }

  return embed;
}

function buildRaceRow(raceId, disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`race_claim_${raceId}`)
      .setLabel(disabled ? "All claimed" : "Claim Role")
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

async function startRace(channel, roleId, amount) {
  const raceId = db.createRoleRace({
    guildId: channel.guild.id,
    channelId: channel.id,
    roleId,
    amount
  });
  const race = db.getRoleRace(raceId);
  const role = `<@&${roleId}>`;

  const sent = await channel.send({
    content: `@everyone`,
    embeds: [buildRaceEmbed(race, 0, role)],
    components: [buildRaceRow(raceId, false)]
  });
  db.setRoleRaceMessageId(raceId, sent.id);
  return raceId;
}

async function handleClaimClick(interaction) {
  const raceId = parseInt(interaction.customId.replace("race_claim_", ""), 10);
  const race = db.getRoleRace(raceId);
  if (!race) {
    await interaction.reply({ content: "❌ This race no longer exists.", ephemeral: true });
    return;
  }

  const result = db.claimRoleRace(raceId, interaction.user.id, race.amount);

  if (!result.ok) {
    const message =
      result.reason === "already_claimed"
        ? "You've already claimed this role."
        : "❌ All spots are already claimed — better luck next time!";
    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  const role = interaction.guild.roles.cache.get(race.role_id);
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (member && role) {
    await member.roles.add(role).catch((err) => {
      console.error("Failed to grant race role:", err.message);
    });
  }

  await interaction.reply({
    content: `✅ You claimed **${role || "the role"}**!`,
    ephemeral: true
  });

  const updatedRace = db.getRoleRace(raceId);
  const roleText = `<@&${race.role_id}>`;
  await interaction.message
    .edit({
      embeds: [buildRaceEmbed(updatedRace, result.newCount, roleText)],
      components: [buildRaceRow(raceId, result.nowFull)]
    })
    .catch(() => {});
}

module.exports = { startRace, handleClaimClick, buildRaceEmbed, buildRaceRow };
