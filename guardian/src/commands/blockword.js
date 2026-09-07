const db = require("../database");
const moderationService = require("../services/moderationService");

module.exports = {
  name: "blockword",
  requiresStaff: true,
  capability: "warn",
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    const word = args[1]?.toLowerCase();

    if (sub === "add") {
      if (!word) throw new Error("Usage: `*blockword add <word>`");
      db.prepare(`INSERT OR IGNORE INTO blocked_words (guildId, word) VALUES (?, ?)`).run(message.guild.id, word);
      return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Blocked word added.`)] });
    }
    if (sub === "remove") {
      if (!word) throw new Error("Usage: `*blockword remove <word>`");
      db.prepare(`DELETE FROM blocked_words WHERE guildId = ? AND word = ?`).run(message.guild.id, word);
      return message.channel.send({ embeds: [moderationService.publicSuccessEmbed(`Blocked word removed.`)] });
    }
    if (sub === "list") {
      const words = db.prepare(`SELECT word FROM blocked_words WHERE guildId = ?`).all(message.guild.id).map((r) => r.word);
      return message.channel.send({
        embeds: [moderationService.publicSuccessEmbed(words.length ? `Blocked words: ${words.join(", ")}` : "No blocked words configured.")]
      });
    }
    throw new Error("Usage: `*blockword <add|remove|list> [word]`");
  }
};
