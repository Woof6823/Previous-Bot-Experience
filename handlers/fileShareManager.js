const fs = require("fs");
const path = require("path");
const { AttachmentBuilder } = require("discord.js");

const MEDIA_DIR = path.join(__dirname, "..", "..", "data", "media");









async function sendFileWithProgress(channel, filename, caption) {
  const filePath = path.join(MEDIA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `The file \`${filename}\` hasn't been uploaded yet. Ask the owner to add it to the \`data/media/\` folder on the server.`
    );
  }

  const totalBytes = fs.statSync(filePath).size;



  const estimatedMs = Math.min(Math.max((totalBytes / (2 * 1024 * 1024)) * 1000, 1500), 15000);

  const progressMsg = await channel.send("⬇️ Downloading file... **0%**");

  const startedAt = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const currentPercent = Math.min(95, Math.round((elapsed / estimatedMs) * 95));
    progressMsg.edit(`⬇️ Downloading file... **${currentPercent}%**`).catch(() => {});
  }, 1200);

  try {
    const attachment = new AttachmentBuilder(fs.createReadStream(filePath), { name: filename });
    await channel.send({ content: caption, files: [attachment] });
  } finally {
    clearInterval(interval);
    await progressMsg.delete().catch(() => {});
  }
}

module.exports = { sendFileWithProgress, MEDIA_DIR };
