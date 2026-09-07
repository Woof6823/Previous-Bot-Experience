const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};


function parseDuration(input) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "0" || trimmed === "permanent" || trimmed === "forever") {
    return { ms: 0, permanent: true };
  }

  const match = trimmed.match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const ms = amount * UNITS[unit];
  if (!ms || ms <= 0) return null;

  return { ms, permanent: false };
}

function formatDuration(ms) {
  const days = Math.floor(ms / UNITS.d);
  const hours = Math.floor((ms % UNITS.d) / UNITS.h);
  const minutes = Math.floor((ms % UNITS.h) / UNITS.m);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : "< 1m";
}

module.exports = { parseDuration, formatDuration };
