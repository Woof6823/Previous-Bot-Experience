const PURGE_CHANNEL_IDS = [
  "1540221054725652530",
  "1532917943170498750",
  "1540221455541735474"
];

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;




async function purgeChannelCompletely(channel) {
  for (;;) {
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) break;

    const now = Date.now();
    const bulkable = messages.filter((m) => now - m.createdTimestamp < FOURTEEN_DAYS_MS);
    const tooOld = messages.filter((m) => now - m.createdTimestamp >= FOURTEEN_DAYS_MS);

    if (bulkable.size >= 2) {
      await channel.bulkDelete(bulkable, true).catch(() => {});
    } else if (bulkable.size === 1) {
      await bulkable.first().delete().catch(() => {});
    }

    for (const msg of tooOld.values()) {
      await msg.delete().catch(() => {});
    }

    if (messages.size < 100) break;
  }
}

async function runDailyPurge(client) {
  for (const channelId of PURGE_CHANNEL_IDS) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error(`Daily purge: channel ${channelId} not found or not accessible.`);
      continue;
    }

    await purgeChannelCompletely(channel).catch((err) =>
      console.error(`Daily purge failed for channel ${channelId}:`, err.message)
    );
  }
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
    runDailyPurge(client).finally(() => {
      setInterval(() => runDailyPurge(client), 24 * 60 * 60 * 1000);
    });
  }, msUntilNextUtcMidnight());
}

module.exports = { start, runDailyPurge, PURGE_CHANNEL_IDS };
