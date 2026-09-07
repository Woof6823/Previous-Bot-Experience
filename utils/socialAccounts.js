const PLATFORMS = [
  {
    key: "youtube",
    label: "YouTube",
    pattern: /^https?:\/\/(www\.)?(youtube\.com\/|youtu\.be\/)/i,
    example: "https://youtube.com/@example"
  },
  {
    key: "twitch",
    label: "Twitch",
    pattern: /^https?:\/\/(www\.)?twitch\.tv\
    example: "https://twitch.tv/example"
  },
  {
    key: "tiktok",
    label: "TikTok",
    pattern: /^https?:\/\/(www\.)?tiktok\.com\
    example: "https://tiktok.com/@example"
  },
  {
    key: "x",
    label: "X",
    pattern: /^https?:\/\/(www\.)?(x\.com|twitter\.com)\
    example: "https://x.com/example"
  },
  {
    key: "instagram",
    label: "Instagram",
    pattern: /^https?:\/\/(www\.)?instagram\.com\
    example: "https://instagram.com/example"
  },
  {
    key: "facebook",
    label: "Facebook",
    pattern: /^https?:\/\/(www\.)?facebook\.com\
    example: "https://facebook.com/example"
  },
  {
    key: "kick",
    label: "Kick",
    pattern: /^https?:\/\/(www\.)?kick\.com\
    example: "https://kick.com/example"
  },
  {
    key: "discord",
    label: "Discord",
    pattern: /^https?:\/\/(www\.)?discord\.com\/users\
    example: "https://discord.com/users/123456789"
  }
];

const LABEL_TO_KEY = new Map(PLATFORMS.map((p) => [p.label.toLowerCase(), p.key]));
const KEY_TO_PLATFORM = new Map(PLATFORMS.map((p) => [p.key, p]));


function buildTemplate(existing = {}) {
  return PLATFORMS.map((p) => `${p.label}: ${existing[p.key] || ""}`).join("\n");
}


function parseSubmission(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const label = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    const key = LABEL_TO_KEY.get(label);
    if (!key) continue;
    result[key] = value;
  }
  return result;
}


function validate(accounts) {
  const errors = [];
  const cleaned = {};
  for (const [key, rawValue] of Object.entries(accounts)) {
    const platform = KEY_TO_PLATFORM.get(key);
    if (!platform) continue;
    const value = (rawValue || "").trim();
    if (!value) {
      cleaned[key] = "";
      continue;
    }
    if (!platform.pattern.test(value)) {
      errors.push({
        key,
        label: platform.label,
        value,
        reason: `Doesn't look like a valid ${platform.label} link. Example: ${platform.example}`
      });
      continue;
    }
    cleaned[key] = value;
  }
  return { valid: errors.length === 0, errors, cleaned };
}

module.exports = {
  PLATFORMS,
  buildTemplate,
  parseSubmission,
  validate
};
