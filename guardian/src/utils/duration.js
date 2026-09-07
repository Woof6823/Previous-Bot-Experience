const UNIT_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };


function parseDuration(str) {
  if (!str) return null;
  const match = /^(\d+)(s|m|h|d)$/i.exec(str.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = value * UNIT_MS[unit];
  return ms > 0 ? ms : null;
}

function formatDuration(ms) {
  if (!ms) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : "< 1m";
}

module.exports = { parseDuration, formatDuration };
