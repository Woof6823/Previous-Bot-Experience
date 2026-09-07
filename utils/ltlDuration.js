function parseLtlDuration(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();

  if (/^\d+(\.\d+)?$/.test(str)) {
    return Math.round(parseFloat(str) * 60 * 1000);
  }

  const regex =
    /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g;
  let match;
  let totalMs = 0;
  let matchedAny = false;

  while ((match = regex.exec(str)) !== null) {
    matchedAny = true;
    const value = parseFloat(match[1]);
    const unit = match[2];

    if (unit.startsWith("h")) totalMs += value * 60 * 60 * 1000;
    else if (unit.startsWith("m")) totalMs += value * 60 * 1000;
    else if (unit.startsWith("s")) totalMs += value * 1000;
  }

  return matchedAny ? Math.round(totalMs) : null;
}


function formatHoursMinutes(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

module.exports = { parseLtlDuration, formatHoursMinutes };
