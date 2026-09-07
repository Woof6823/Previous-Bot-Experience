const config = require("../../config");







const processedMessages = new Map();
const MAX_PROCESSED_ENTRIES = 2000;




function claimMessage(messageId) {
  const now = Date.now();
  const existing = processedMessages.get(messageId);
  if (existing && existing > now) {
    return true;
  }
  if (processedMessages.size >= MAX_PROCESSED_ENTRIES) {
    const keys = [...processedMessages.keys()].slice(0, MAX_PROCESSED_ENTRIES / 2);
    for (const key of keys) processedMessages.delete(key);
  }
  processedMessages.set(messageId, now + config.ai.processedMessageTtlMs);
  return false;
}

function cleanup() {
  const now = Date.now();
  let removed = 0;
  for (const [id, expiresAt] of processedMessages.entries()) {
    if (now > expiresAt) {
      processedMessages.delete(id);
      removed++;
    }
  }
  return removed;
}

module.exports = { claimMessage, cleanup };
