function sanitizeText(input, maxLength = 500) {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}



const buckets = new Map();

function isRateLimited(key, maxEvents, windowMs) {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  buckets.set(key, timestamps);
  return timestamps.length > maxEvents;
}

module.exports = { sanitizeText, isRateLimited };
