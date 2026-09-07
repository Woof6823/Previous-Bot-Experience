const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const whitelistService = require("../services/whitelistService");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "help",
  async execute(message) {
    const isOwner = whitelistService.isOwner(message.guild.id, message.author.id);
    const isStaff = permissionService.isStaff(message.member) || permissionService.hasFullAccess(message.guild.id, message.author.id);

    const embed = new EmbedBuilder().setColor(config.brandColor).setTitle("📖 Commands").addFields(
      {
        name: "Everyone",
        value: "`level` `leaderboard` `help`",
        inline: false
      },
      ...(isStaff
        ? [
            {
              name: "Staff",
              value:
                "`warn` `warnings` `clearwarnings` `mute` `unmute` `kick` `ban` `unban` `purge` `modhistory` `case` `role add/remove` `status`",
              inline: false
            }
          ]
        : []),
      ...(isOwner
        ? [
            {
              name: "Owner",
              value:
                "`security status/test/enable/disable/thresholds/staffrole/channel/owner/protectedroles/protectedchannels/event` `whitelist add/remove/list` `blockword add/remove/list` `ticketpanel`",
              inline: false
            }
          ]
        : [])
    );
    await message.channel.send({ embeds: [embed] });
  }
};
