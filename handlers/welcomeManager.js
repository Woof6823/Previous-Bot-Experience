const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const settings = require("../settings");




const SERVER_NEWS_CHANNEL_ID = "1540228744478720101";

function ordinal(n) {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildWelcomeEmbed(member) {
	const links = settings.getObject("welcomeLinks");
	return new EmbedBuilder()
		.setColor(config.brandColor)
		.setAuthor({
			name: `${member.guild.name}`,
			iconURL: member.guild.iconURL({ extension: "png", size: 128 }) || undefined
		})
		.setTitle(`👋 Welcome, ${member.user.username}!`)
		.setDescription(
			`<@${member.id}> just joined — you're our **${ordinal(member.guild.memberCount)} member**! 🎉`
		)
		.addFields(
			{
				name: "📢 Stay in the loop",
				value: `Follow our <#${links.socials}> for updates.`,
				inline: false
			},
			{
				name: "🎮 Join Roster or Staff",
				value: `<#${links.roster}>
<#${links.staff}>`,
				inline: false
			},
			{
				name: "📰 Server News",
				value: `Keep an eye on <#${SERVER_NEWS_CHANNEL_ID}> for everything important.`,
				inline: false
			}
		)
		.setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 256 }))
		.setFooter({ text: `Glad to have you here, ${member.user.username}!` })
		.setTimestamp();
}

async function sendWelcomeMessage(member) {
	const channel = member.guild.channels.cache.get(settings.get("welcomeChannelId"));
	if (!channel) return;
	const sent = await channel.send({ embeds: [buildWelcomeEmbed(member)] }).catch(() => null);
	if (sent) {
		sent.react("👋").catch(() => {});
	}
}




async function sendWelcomeDM(member) {
	await member.send({ embeds: [buildWelcomeEmbed(member)] }).catch(() => {});
	await member
		.send(
			"discord.gg/vurge — join here for money prizes daily! Invite 5 friends for extra chances at money and Vbucks rewards!"
		)
		.catch(() => {});
}

module.exports = { buildWelcomeEmbed, sendWelcomeMessage, sendWelcomeDM };
