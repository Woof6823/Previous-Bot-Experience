const db = require("../database");
const settings = require("../settings");
const wordWhitelistManager = require("./wordWhitelistManager");

function getWords(content) {
return content
.toLowerCase()
.split(/\s+/)
.map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
.filter(Boolean);
}

function matchesAny(words, triggers) {
return triggers.some((t) => words.includes(t));
}


async function checkAndHandle(message) {
if (message.channel.id !== settings.get("generalChatChannelId")) return false;


if (wordWhitelistManager.isWhitelisted(message.author.id)) return false;

const words = getWords(message.content);
if (words.length === 0) return false;

const lfpTriggers = db.getTriggerWords("lfp");
if (matchesAny(words, lfpTriggers)) {
await message.delete().catch(() => {});
const sent = await message.channel
.send(
`<@${message.author.id}> This is the general chat! Please use <#${settings.get("lfpChannelId")}> when looking for players`
)
.catch(() => null);
if (sent) setTimeout(() => sent.delete().catch(() => {}), 15000);
return true;
}

const joinTriggers = db.getTriggerWords("join");
if (matchesAny(words, joinTriggers)) {
const sent = await message.channel
.send(
`<@${message.author.id}> , Check out the requirements to join our team here <#${settings.get("teamRequirementsChannelId")}> and apply to join here <#${settings.get("teamApplyChannelId")}>`
)
.catch(() => null);
if (sent) setTimeout(() => sent.delete().catch(() => {}), 15000);
return false;
}

return false;
}

module.exports = { checkAndHandle };
