const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "database.json");

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { welcomeChannels: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function getWelcomeChannel(guildId) {
  const db = readDB();
  return db.welcomeChannels[guildId] || null;
}

function setWelcomeChannel(guildId, channelId) {
  const db = readDB();
  db.welcomeChannels[guildId] = channelId;
  writeDB(db);
}

module.exports = { getWelcomeChannel, setWelcomeChannel };
