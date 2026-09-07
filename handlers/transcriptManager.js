const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const config = require("../config");
const settings = require("../settings");

async function buildTranscriptText(channel) {
  const allMessages = [];
  let lastId;
  let truncated = false;


  for (let i = 0; i < 20; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!batch || batch.size === 0) break;
    allMessages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
    if (i === 19) truncated = true;
  }

  allMessages.reverse();

  const lines = allMessages.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString().replace("T", " ").slice(0, 19);
    const content = m.content || (m.embeds.length ? "[embed]" : "[no content]");
    const author = m.member?.displayName ?? m.author.username;
    return `[${time}] ${author}: ${content}`;
  });

  if (truncated) {
    lines.unshift(
      "⚠️ TRANSCRIPT TRUNCATED — this ticket had more than 2,000 messages, only the most recent 2,000 are shown below."
    );
  }

  return lines.join("\n") || "No messages in this ticket.";
}

async function sendTranscript(guild, channel, ticket, closerId, reason) {
  const logChannel = guild.channels.cache.get(settings.get("ticketTranscriptChannelId"));
  if (!logChannel) return;

  const text = await buildTranscriptText(channel);
  const attachment = new AttachmentBuilder(Buffer.from(text, "utf-8"), {
    name: `transcript-${channel.name}-${Date.now()}.txt`
  });

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`#${ticket.number} ${ticket.type} Ticket Closed`)
    .setDescription(`Ticket **${ticket.type}** has been closed.`)
    .addFields(
      { name: "Opened", value: `<t:${Math.floor(ticket.created_at / 1000)}:F>`, inline: true },
      { name: "Opened by", value: `<@${ticket.user_id}>`, inline: true },
      { name: "Closed by", value: `<@${closerId}>`, inline: true },
      {
        name: "Claimed by",
        value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Nobody",
        inline: true
      }
    );

  if (reason) embed.addFields({ name: "Reason", value: reason });

  await logChannel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
}

module.exports = { sendTranscript };
