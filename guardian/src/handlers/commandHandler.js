const fs = require("fs");
const path = require("path");
const config = require("../config");
const permissionService = require("../services/permissionService");
const whitelistService = require("../services/whitelistService");
const loggingService = require("../services/loggingService");

const commands = new Map();

function loadCommands() {
  const dir = path.join(__dirname, "..", "commands");

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
    const cmd = require(path.join(dir, file));

    if (!cmd?.name || typeof cmd.execute !== "function") continue;

    commands.set(cmd.name.toLowerCase(), cmd);

    for (const alias of cmd.aliases || []) {
      commands.set(alias.toLowerCase(), cmd);
    }
  }

  return commands;
}

async function handleMessage(message) {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const withoutPrefix = message.content.slice(config.prefix.length).trim();
  if (!withoutPrefix) return;

  const args = withoutPrefix.split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (!command) return;

  const member = message.member;
  if (!member) return;

  if (
    command.ownerOnly &&
    !whitelistService.isOwner(message.guild.id, member.id)
  ) {
    return safeReply(
      message,
      "🚫 This command is restricted to configured server owners."
    );
  }

  if (command.requiresStaff) {
    const check = permissionService.canModerate(
      member,
      command.capability || commandName
    );

    if (!check.allowed) {
      return safeReply(message, `🚫 ${check.reason}`);
    }
  }

  try {
    await loggingService.command(message, commandName, args).catch(() => {});
    await command.execute(message, args);
  } catch (err) {
    console.error(`[command:${commandName}]`, err);
    return safeReply(
      message,
      `⚠️ ${err.message || "Something went wrong running that command."}`
    );
  } finally {
    if (message.deletable) {
      message.delete().catch(() => {});
    }
  }
}

async function safeReply(message, content) {
  const sent = await message.channel.send({ content }).catch(() => null);

  if (sent) {
    setTimeout(() => sent.delete().catch(() => {}), 8000);
  }

  if (message.deletable) {
    message.delete().catch(() => {});
  }
}

module.exports = {
  loadCommands,
  handleMessage,
  commands
};
