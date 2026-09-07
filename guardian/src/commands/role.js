const permissionService = require("../services/permissionService");
const moderationService = require("../services/moderationService");

module.exports = {
  name: "role",
  requiresStaff: true,
  capability: "role",
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    if (!["add", "remove"].includes(sub)) throw new Error("Usage: `*role <add|remove> <@user|userId> <@role|roleId>`");

    const target = message.mentions.members.first() || (await message.guild.members.fetch(args[1]).catch(() => null));
    const roleArg = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
    if (!target || !roleArg) throw new Error("Usage: `*role <add|remove> <@user|userId> <@role|roleId>`");

    const hierarchy = permissionService.canActOnTarget(message.member, target);
    if (!hierarchy.allowed) throw new Error(hierarchy.reason);

    const roleCheck = permissionService.canManageRole(message.member, roleArg, message.guild);
    if (!roleCheck.allowed) throw new Error(roleCheck.reason);


    if (roleArg.position >= message.member.roles.highest.position) {
      const isWl = permissionService.hasFullAccess(message.guild.id, message.author.id);
      if (!isWl) throw new Error("You cannot grant a role equal to or higher than your own.");
    }

    if (sub === "add") {
      if (target.roles.cache.has(roleArg.id)) throw new Error("User already has that role.");
      await target.roles.add(roleArg, `Added by ${message.author.tag}`);
    } else {
      if (!target.roles.cache.has(roleArg.id)) throw new Error("User does not have that role.");
      await target.roles.remove(roleArg, `Removed by ${message.author.tag}`);
    }

    await message.channel.send({
      embeds: [moderationService.publicSuccessEmbed(`Role updated successfully.`)]
    });
  }
};
