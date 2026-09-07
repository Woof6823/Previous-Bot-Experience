const ROLE_ID = "1540058434421006456";

module.exports = {
  name: "guildMemberUpdate",

  async execute(oldMember, newMember) {
    if (newMember.user.bot) return;

    const hadRole = oldMember.roles.cache.has(ROLE_ID);
    const hasRole = newMember.roles.cache.has(ROLE_ID);

    if (hadRole || hasRole) return;

    const role = newMember.guild.roles.cache.get(ROLE_ID);
    if (!role) return;

    if (!role.editable) {
      console.error(
        `[required-role] Cannot restore ${ROLE_ID} — role is not editable by Guardian.`
      );
      return;
    }

    await newMember.roles.add(
      role,
      "Guardian required member role enforcement"
    ).catch(err => {
      console.error(
        `[required-role] Failed to restore role for ${newMember.user.tag}: ${err.message}`
      );
    });
  }
};
