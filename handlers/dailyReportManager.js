const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const db = require("../database");

const LAST_SENT_KEY = "daily_report_last_sent_at";
const INTERVAL_MS = config.dailyReport.intervalHours * 60 * 60 * 1000;

function buildReportEmbed() {
  const since = Date.now() - INTERVAL_MS;
  const { joins, leaves } = db.getMemberEventCounts(since);
  const net = joins - leaves;

  return new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle("Daily Server Report")
    .setDescription(
      `Growth summary for **${config.dailyReport.serverName}** over the last 24 hours.`
    )
    .addFields(
      { name: "Joins", value: `+${joins}`, inline: true },
      { name: "Leaves", value: `-${leaves}`, inline: true },
      { name: "Net Growth", value: `${net >= 0 ? "+" : ""}${net}`, inline: true }
    )
    .setTimestamp();
}

async function sendReport(client) {
  const channel = await client.channels.fetch(config.dailyReport.channelId).catch(() => null);
  if (!channel) {
    console.error(`Daily report channel ${config.dailyReport.channelId} not found.`);
    return;
  }
  await channel.send({ embeds: [buildReportEmbed()] }).catch((err) => {
    console.error("Failed to send daily report:", err.message);
  });
  db.setSetting(LAST_SENT_KEY, String(Date.now()));
}





function msUntilNextUtcMidnight() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.getTime() - now.getTime();
}

function start(client) {
  setTimeout(function run() {
    sendReport(client).finally(() => {
      setInterval(() => sendReport(client), INTERVAL_MS);
    });
  }, msUntilNextUtcMidnight());
}

module.exports = { start, sendReport, buildReportEmbed };
