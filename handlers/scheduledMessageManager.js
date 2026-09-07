const db = require("../database");

const activeTimers = new Map();
const MAX_TIMEOUT_MS = 2147483647;

async function sendScheduledMessage(client, scheduled) {
  try {
    const channel = await client.channels.fetch(scheduled.channel_id).catch(() => null);
    if (!channel) {
      console.error(
        `Scheduled message ${scheduled.id}: channel ${scheduled.channel_id} not found.`
      );
      db.markScheduledMessageSent(scheduled.id);
      return;
    }

    const sent = await channel.send({ content: scheduled.content });
    for (const emoji of scheduled.reactions || []) {
      await sent.react(emoji).catch(() => {});
    }
    db.markScheduledMessageSent(scheduled.id);
  } catch (err) {
    console.error(`Failed to send scheduled message ${scheduled.id}:`, err.message);
    db.markScheduledMessageSent(scheduled.id);
  } finally {
    activeTimers.delete(scheduled.id);
  }
}




function scheduleOne(client, scheduled) {
  const delay = scheduled.send_at - Date.now();

  if (delay <= 0) {
    sendScheduledMessage(client, scheduled);
    return;
  }

  if (delay > MAX_TIMEOUT_MS) {
    const timer = setTimeout(() => scheduleOne(client, scheduled), MAX_TIMEOUT_MS);
    activeTimers.set(scheduled.id, timer);
    return;
  }

  const timer = setTimeout(() => sendScheduledMessage(client, scheduled), delay);
  activeTimers.set(scheduled.id, timer);
}

function scheduleMessage(client, scheduled) {
  scheduleOne(client, scheduled);
}

function cancelScheduledMessage(id) {
  const timer = activeTimers.get(id);
  if (timer) clearTimeout(timer);
  activeTimers.delete(id);
  return db.deleteScheduledMessage(id);
}


function restorePending(client) {
  const pending = db.getPendingScheduledMessages();
  for (const scheduled of pending) {
    scheduleOne(client, scheduled);
  }
  if (pending.length > 0) {
    console.log(`Restored ${pending.length} scheduled message(s) from database.`);
  }
}

module.exports = { scheduleMessage, cancelScheduledMessage, restorePending };
