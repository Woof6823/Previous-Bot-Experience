const transcripts = require('discord-html-transcripts');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./database');
const { BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS, TICKET_TYPES } = require('./config');

function typeById(id) {
  return TICKET_TYPES.find((t) => t.id === id);
}


async function sendTranscript(channel, ticket, closedByUserId) {
  const logChannelId = db.getSetting(SETTINGS_KEYS.TRANSCRIPT_CHANNEL);
  if (!logChannelId) return;

  const logChannel = channel.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const type = typeById(ticket.type);

  let attachment;
  try {
    attachment = await transcripts.createTranscript(channel, {
      limit: -1,
      returnType: 'attachment',
      filename: `${channel.name}-transcript.html`,
      saveImages: false,
      poweredBy: false,
    });
  } catch (err) {
    console.error('[transcript] Failed to generate transcript:', err);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: BRAND_NAME })
    .setTitle(`${type ? type.emoji + ' ' : ''}Ticket Transcript · ${channel.name}`)
    .addFields(
      { name: 'Type', value: type ? type.label : ticket.type, inline: true },
      { name: 'Opened by', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Closed by', value: `<@${closedByUserId}>`, inline: true },
      {
        name: 'Claimed by',
        value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Never claimed',
        inline: true,
      },
      { name: 'Ticket #', value: `${channel.name}`, inline: true }
    )
    .setFooter({ text: `${BRAND_NAME} · Ticket Transcripts` })
    .setTimestamp();

  await logChannel.send({ embeds: [embed], files: [attachment] }).catch((err) => {
    console.error('[transcript] Failed to send transcript:', err);
  });
}

module.exports = { sendTranscript };
