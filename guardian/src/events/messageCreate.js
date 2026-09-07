const commandHandler = require("../handlers/commandHandler");
const chatModerationHandler = require("../handlers/chatModerationHandler");
const levelHandler = require("../handlers/levelHandler");
const config = require("../config");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith(config.prefix)) {
      return commandHandler.handleMessage(message);
    }

    const removed = await chatModerationHandler.handleBlockedWords(message).catch(() => false);
    if (removed) return;

    await chatModerationHandler.handleMassMention(message).catch(() => {});
    await levelHandler.handleMessageXp(message).catch(() => {});
  }
};
