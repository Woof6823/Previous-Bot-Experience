const { EmbedBuilder } = require("discord.js");
const { db } = require("../database");
















db.exec(`
CREATE TABLE IF NOT EXISTS afk_status (
    user_id TEXT PRIMARY KEY,
    reason TEXT DEFAULT '',
    since INTEGER NOT NULL,
    prev_nickname TEXT
);
`);











try {
  db.exec("ALTER TABLE afk_status ADD COLUMN prev_nickname TEXT");
} catch {

}

const AFK_PREFIX = "[AFK] ";
const MAX_NICK_LENGTH = 32;







const DISALLOWED_AFK_PING_PATTERN = /@everyone|@here|<@!?\d+>/i;

function containsDisallowedPing(text) {
  return DISALLOWED_AFK_PING_PATTERN.test(String(text || ""));
}

function getAfkRow(userId) {
  const row = db.prepare("SELECT * FROM afk_status WHERE user_id = ?").get(userId);
  if (row) return row;



  try {
    const legacy = db.prepare("SELECT * FROM afk WHERE user_id = ?").get(userId);
    if (legacy) {
      return {
        user_id: userId,
        reason: legacy.reason || "",
        since: legacy.since || legacy.created_at || Date.now(),
        prev_nickname: null,
        legacy: true
      };
    }
  } catch {

  }
  return null;
}




async function applyAfkNickname(member) {
  try {
    const current = member.nickname || member.user.username;
    if (current.startsWith(AFK_PREFIX)) return;
    let name = current;
    if ((AFK_PREFIX + name).length > MAX_NICK_LENGTH) {
      name = name.slice(0, MAX_NICK_LENGTH - AFK_PREFIX.length);
    }
    await member.setNickname(AFK_PREFIX + name, "AFK set");
  } catch {



  }
}

async function restoreNickname(member, row) {
  try {
    const current = member.nickname;
    if (row && row.prev_nickname !== null && row.prev_nickname !== undefined) {

      const target = row.prev_nickname === "" ? null : row.prev_nickname;
      if (current !== target) await member.setNickname(target, "AFK removed");
    } else if (current && current.startsWith(AFK_PREFIX)) {

      const stripped = current.slice(AFK_PREFIX.length) || null;
      await member.setNickname(stripped, "AFK removed");
    }
  } catch {

  }
}




async function setAfk(userId, reason, member = null) {
  const cleanReason =
    String(reason || "AFK")
      .trim()
      .slice(0, 300) || "AFK";
  const now = Date.now();
  const existing = getAfkRow(userId);

  if (existing) {


    if (existing.legacy) {
      try {
        db.prepare("DELETE FROM afk WHERE user_id = ?").run(userId);
      } catch {}
      db.prepare(
        "INSERT INTO afk_status (user_id, reason, since, prev_nickname) VALUES (?, ?, ?, ?)"
      ).run(userId, cleanReason, now, member ? member.nickname || "" : null);
    } else {
      db.prepare("UPDATE afk_status SET reason = ?, since = ? WHERE user_id = ?").run(
        cleanReason,
        now,
        userId
      );
    }
  } else {

    db.prepare(
      "INSERT INTO afk_status (user_id, reason, since, prev_nickname) VALUES (?, ?, ?, ?)"
    ).run(userId, cleanReason, now, member ? member.nickname || "" : null);
  }

  if (!member) return;
  await applyAfkNickname(member);


  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("\ud83d\udca4 AFK Set")
    .setDescription(`You're now marked as AFK in **${member.guild.name}**.`)
    .addFields(
      { name: "\ud83d\udcdd Reason", value: cleanReason },
      { name: "\ud83d\udd52 Started", value: `<t:${Math.floor(now / 1000)}:R>` },
      {
        name: "\ud83d\udd01 How to clear it",
        value:
          "Send a message or react to any message — I'll remove your AFK and restore your nickname automatically."
      }
    )
    .setFooter({ text: "Surge Esports \u2022 AFK System" })
    .setTimestamp();
  await member.send({ embeds: [embed] }).catch(() => {});
}

async function removeAfk(userId, member = null, sendDm = true) {
  const row = getAfkRow(userId);
  if (!row) return false;

  db.prepare("DELETE FROM afk_status WHERE user_id = ?").run(userId);
  if (row.legacy) {
    try {
      db.prepare("DELETE FROM afk WHERE user_id = ?").run(userId);
    } catch {}
  }

  if (member) {
    await restoreNickname(member, row);
    if (sendDm) {
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\ud83d\udc4b Welcome Back!")
        .setDescription(
          `Your AFK status in **${member.guild.name}** has been removed.` +
            (row.prev_nickname !== null ? "\nYour nickname has been restored to what it was." : "")
        )
        .setFooter({ text: "Surge Esports \u2022 AFK System" })
        .setTimestamp();
      await member.send({ embeds: [embed] }).catch(() => {});
    }
  }
  return true;
}




async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;


  if (getAfkRow(message.author.id)) {
    await removeAfk(message.author.id, message.member).catch(() => {});
  }




  const mentionedIds = [...message.mentions.users.keys()]
    .filter((id) => id !== message.author.id)
    .filter((id) => getAfkRow(id));
  if (mentionedIds.length === 0) return;

  const lines = mentionedIds.slice(0, 3).map((id) => {
    const row = getAfkRow(id);
    const reasonText = row.reason && row.reason !== "AFK" ? ` \u2014 **${row.reason}**` : "";
    return `\ud83d\udca4 <@${id}> is currently AFK${reasonText} (since <t:${Math.floor(row.since / 1000)}:R>).`;
  });
  await message.channel.send(lines.join("\n")).catch(() => {});
}





async function handleReaction(userId, member) {
  if (!member || member.user.bot) return false;
  if (!getAfkRow(userId)) return false;
  return removeAfk(userId, member);
}

module.exports = { setAfk, removeAfk, getAfkRow, handleMessage, handleReaction, containsDisallowedPing };
