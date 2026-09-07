const db = require('./database');
const { isAdmin } = require('./permissions');


async function addCustomCommand(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can create custom commands.');
  }
  const name = args[0];
  const response = args.slice(1).join(' ');

  if (!name || !response) {
    return message.reply('❌ Usage: `*addcmd <name> <response text>`. You can use `{user}` as a placeholder for the caller.');
  }

  const reserved = ['embed', 'ticketembed', 'setwelcome', 'settranscripts', 'testwelcome', 'warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'purge', 'addcmd', 'removecmd', 'commands'];
  if (reserved.includes(name.toLowerCase())) {
    return message.reply('❌ That name is reserved by a built-in command.');
  }

  db.addCustomCommand(message.guild.id, name, response);
  await message.channel.send(`✅ Custom command \`*${name.toLowerCase()}\` created.`);
}


async function removeCustomCommand(message, args) {
  if (!isAdmin(message.member)) {
    return message.reply('❌ Only Administrators can remove custom commands.');
  }
  const name = args[0];
  if (!name) return message.reply('❌ Usage: `*removecmd <name>`');

  db.removeCustomCommand(message.guild.id, name);
  await message.channel.send(`✅ Removed custom command \`*${name.toLowerCase()}\` (if it existed).`);
}


async function listCustomCommands(message) {
  const names = db.listCustomCommands(message.guild.id);
  if (names.length === 0) {
    return message.channel.send('No custom commands have been created yet.');
  }
  await message.channel.send(`**Custom commands:** ${names.map((n) => `\`*${n}\``).join(', ')}`);
}

// Returns true if it handled the message as a custom command
async function tryRunCustomCommand(message, cmdName) {
  const row = db.getCustomCommand(message.guild.id, cmdName);
  if (!row) return false;

  const response = row.response
    .replaceAll('{user}', `${message.author}`)
    .replaceAll('{username}', message.author.username)
    .replaceAll('{server}', message.guild.name);

  await message.channel.send(response);
  return true;
}

module.exports = { addCustomCommand, removeCustomCommand, listCustomCommands, tryRunCustomCommand };
