const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { isAdmin } = require('./permissions');
const { buildTicketPanel } = require('./ticketPanel');
const { sendWelcome } = require('./welcome');
const { handleEmbedCommand } = require('./embedCommand');
const { OWNER_ID, PREFIX, BRAND_COLOR, BRAND_NAME, SETTINGS_KEYS } = require('./config');

const moderation = require('./moderation');
const serverConfig = require('./serverConfig');
const leveling = require('./leveling');
const giveaways = require('./giveaways');
const polls = require('./polls');
const customCommands = require('./customCommands');
const counting = require('./counting');
const reactionRoles = require('./reactionRoles');
const suggestions = require('./suggestions');
const reminders = require('./reminders');
const security = require('./security');

function ownerOnlyReply(message) {
  return message.reply('❌ You are not authorized to use this command.');
}

async function handleMessage(message) {
  if (message.author.bot) return;
  if (!message.guild) return;


  if (!message.content.startsWith(PREFIX)) {
    const filtered = await security.checkWordFilter(message).catch(() => false);
    if (filtered) return;
    const spammed = await security.checkAntiSpam(message).catch(() => false);
    if (spammed) return;
    await counting.handleCountingMessage(message).catch(() => {});
    await leveling.handleXpGain(message).catch(() => {});
    return;
  }

  const rawArgs = message.content.slice(PREFIX.length).trim();
  const [cmd, ...args] = rawArgs.split(/\s+/);
  const cmdLower = (cmd || '').toLowerCase();

  try {

    if (cmdLower === 'embed') {
      return handleEmbedCommand(message);
    }

    if (cmdLower === 'ticketembed') {
      if (message.author.id !== OWNER_ID) return ownerOnlyReply(message);
      await message.channel.send(buildTicketPanel(message.guild));
      return message.delete().catch(() => {});
    }

    if (cmdLower === 'setwelcome') {
      if (message.author.id !== OWNER_ID) return ownerOnlyReply(message);
      db.setSetting(SETTINGS_KEYS.WELCOME_CHANNEL, message.channel.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setDescription(`✅ Welcome messages will now be sent in ${message.channel}.`)
        .setFooter({ text: BRAND_NAME });
      await message.channel.send({ embeds: [embed] });
      return message.delete().catch(() => {});
    }

    if (cmdLower === 'settranscripts') {
      if (message.author.id !== OWNER_ID) return ownerOnlyReply(message);
      db.setSetting(SETTINGS_KEYS.TRANSCRIPT_CHANNEL, message.channel.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setDescription(`✅ Ticket transcripts will now be logged in ${message.channel}.`)
        .setFooter({ text: BRAND_NAME });
      await message.channel.send({ embeds: [embed] });
      return message.delete().catch(() => {});
    }

    if (cmdLower === 'testwelcome') {
      if (message.author.id !== OWNER_ID) return ownerOnlyReply(message);
      const welcomeChannelId = db.getSetting(SETTINGS_KEYS.WELCOME_CHANNEL);
      if (!welcomeChannelId) {
        return message.reply('❌ No welcome channel is set yet. Run `*setwelcome` in the desired channel first.');
      }
      await sendWelcome(message.member);
      return message.delete().catch(() => {});
    }


    if (cmdLower === 'warn') return moderation.warn(message, args);
    if (cmdLower === 'warnings') return moderation.warnings(message, args);
    if (cmdLower === 'clearwarnings') return moderation.clearWarnings(message);
    if (cmdLower === 'mute') return moderation.mute(message, args);
    if (cmdLower === 'unmute') return moderation.unmute(message);
    if (cmdLower === 'kick') return moderation.kick(message, args);
    if (cmdLower === 'ban') return moderation.ban(message, args);
    if (cmdLower === 'unban') return moderation.unban(message, args);
    if (cmdLower === 'purge') return moderation.purge(message, args);
    if (cmdLower === 'addmodrole') return moderation.addModRole(message, args);
    if (cmdLower === 'removemodrole') return moderation.removeModRole(message, args);
    if (cmdLower === 'modroles') return moderation.listModRoles(message);


    if (cmdLower === 'setmodlog') return serverConfig.setModLog(message);
    if (cmdLower === 'setgoodbye') return serverConfig.setGoodbye(message);
    if (cmdLower === 'setsuggestions') return serverConfig.setSuggestions(message);
    if (cmdLower === 'setautorole') return serverConfig.setAutoRole(message);
    if (cmdLower === 'filterword') return serverConfig.filterWord(message, args);
    if (cmdLower === 'toggle') return serverConfig.toggleFeature(message, args);
    if (cmdLower === 'setraid') return serverConfig.setRaidThreshold(message, args);
    if (cmdLower === 'setcounting') return counting.setCountingChannel(message);


    if (cmdLower === 'reactionrole') return reactionRoles.setupReactionRole(message, args);


    if (cmdLower === 'rank') return leveling.showRank(message);
    if (cmdLower === 'leaderboard' || cmdLower === 'top') return leveling.showLeaderboard(message);
    if (cmdLower === 'giveaway') return giveaways.startGiveaway(message, args);
    if (cmdLower === 'greroll') return giveaways.rerollGiveaway(message, args);
    if (cmdLower === 'poll') return polls.createPoll(message, rawArgs.slice(cmd.length).trim());
    if (cmdLower === 'yesno') return polls.createYesNoPoll(message, args.join(' '));
    if (cmdLower === 'suggest') return suggestions.suggest(message, args.join(' '));
    if (cmdLower === 'remind') return reminders.setReminder(message, args);


    if (cmdLower === 'addcmd') return customCommands.addCustomCommand(message, args);
    if (cmdLower === 'removecmd') return customCommands.removeCustomCommand(message, args);
    if (cmdLower === 'commands') return customCommands.listCustomCommands(message);

    if (cmdLower === 'help') return sendHelp(message);


    await customCommands.tryRunCustomCommand(message, cmdLower);
  } catch (err) {
    console.error(`[commands] Error running *${cmdLower}:`, err);
    message.reply(`❌ Something went wrong: ${err.message || 'unknown error'}`).catch(() => {});
  }
}

async function sendHelp(message) {
  const isAdminUser = isAdmin(message.member);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${BRAND_NAME} Bot Commands`)
    .addFields(
      {
        name: '🎫 Tickets',
        value: '`*ticketembed` `*setwelcome` `*settranscripts` `*testwelcome`',
      },
      {
        name: '🛡️ Moderation (warn/mute need a permission ticket or Admin)',
        value: '`*warn` `*warnings` `*mute` `*unmute`' + (isAdminUser ? ' `*kick` `*ban` `*unban` `*purge` `*clearwarnings` `*addmodrole` `*removemodrole` `*modroles`' : ''),
      },
      {
        name: '🎮 Community',
        value: '`*rank` `*leaderboard` `*poll` `*yesno` `*suggest` `*remind`' + (isAdminUser ? ' `*giveaway` `*greroll`' : ''),
      },
      {
        name: '🔑 Custom Commands',
        value: '`*commands`' + (isAdminUser ? ' `*addcmd` `*removecmd`' : ''),
      }
    )
    .setFooter({ text: BRAND_NAME });

  if (isAdminUser) {
    embed.addFields({
      name: '⚙️ Server Config (Admin only)',
      value: '`*setmodlog` `*setgoodbye` `*setsuggestions` `*setautorole` `*setcounting` `*setraid` `*filterword` `*toggle` `*reactionrole` `*embed`',
    });
  }

  await message.channel.send({ embeds: [embed] });
}

module.exports = { handleMessage };
