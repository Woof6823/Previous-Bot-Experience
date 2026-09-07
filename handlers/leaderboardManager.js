const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const db = require("../database");





const DISPLAY_ROLE_ID = "1454916770912534706";

const PAGES = {
  claimed: { label: "🎫 Claimed Tickets - last 30 days", unit: "tickets" },
  messages: { label: "💬 Messages - last 30 days", unit: "messages" },
  voice: { label: "🔊 Voice Hours - last 30 days", unit: "hours" }
};
const PAGE_SIZE = 10;
const WINDOW_DAYS = 30;




function getDisplayIds(guild) {
  const ids = new Set();
  const role = guild.roles.cache.get(DISPLAY_ROLE_ID);
  if (role) {
    for (const member of role.members.values()) ids.add(member.id);
  }
  return [...ids];
}

function getStatFor(page, userId) {
  if (page === "claimed") return db.getClaimedCount(userId, WINDOW_DAYS);
  if (page === "messages") return db.getMessageCount(userId, WINDOW_DAYS);
  return db.getVoiceSeconds(userId, WINDOW_DAYS);
}

function getSortedRows(guild, page) {
  const rows = getDisplayIds(guild).map((userId) => ({
    userId,
    total: getStatFor(page, userId)
  }));
  rows.sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
  return rows;
}

function formatValue(page, total) {
  if (page === "voice") return `${(total / 3600).toFixed(1)}h`;
  return `${total} ${PAGES[page].unit}`;
}



async function resolveName(guild, userId) {
  const cached = guild.members.cache.get(userId);
  if (cached) return cached.displayName;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) return member.displayName;
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user ? user.username : `User ${userId}`;
}




function buildComponents(page, current, totalPages) {
  const typeRow = new ActionRowBuilder().addComponents(
    Object.keys(PAGES).map((p) =>
      new ButtonBuilder()
        .setCustomId(`topstaff_page_${p}`)
        .setLabel(
          p === "claimed"
            ? "🎫 Claimed Tickets"
            : p === "messages"
              ? "💬 Messages"
              : "🔊 Voice Hours"
        )
        .setStyle(p === page ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(p === page)
    )
  );
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`topstaff_nav_${page}_${current - 1}`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current <= 0),
    new ButtonBuilder()
      .setCustomId("topstaff_info")
      .setLabel(`${current + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`topstaff_nav_${page}_${current + 1}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current >= totalPages - 1)
  );
  return [typeRow, navRow];
}




async function buildLeaderboardPayload(guild, page, pageIndex = 0) {
  if (!PAGES[page]) page = "claimed";
  const all = getSortedRows(guild, page);
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(Math.max(pageIndex, 0), totalPages - 1);
  const slice = all.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`🏆 Staff Leaderboard — ${PAGES[page].label}`);
  if (slice.length === 0) {
    embed.setDescription("No members with that role found.");
  } else {
    const lines = [];
    for (let i = 0; i < slice.length; i++) {
      lines.push(
        `**${current * PAGE_SIZE + i + 1}.** <@${slice[i].userId}> — ${formatValue(page, slice[i].total)}`
      );
    }
    embed.setDescription(lines.join("\n"));
  }
  embed.setFooter({
    text: `Page ${current + 1} of ${totalPages} • Showing ${slice.length ? current * PAGE_SIZE + 1 : 0}-${current * PAGE_SIZE + slice.length} of ${all.length}`
  });
  embed.setTimestamp();
  return { embeds: [embed], components: buildComponents(page, current, totalPages) };
}




function getAllRows(page) {
  if (page === "claimed") return db.getTopClaimedTickets(30, 100);
  if (page === "messages") return db.getTopMessages(30, 100);
  return db.getTopVoiceSeconds(30, 100);
}
function buildLeaderboardEmbed(page) {
  if (!PAGES[page]) page = "claimed";
  const rows = getAllRows(page).slice(0, 10);
  const embed = new EmbedBuilder().setColor(config.brandColor).setTitle(PAGES[page].label);
  if (rows.length === 0) {
    embed.setDescription("No data yet.");
  } else {
    embed.setDescription(
      rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${formatValue(page, r.total)}`).join("\n")
    );
  }
  return embed;
}
function buildLeaderboardRow(activePage) {
  return new ActionRowBuilder().addComponents(
    Object.keys(PAGES).map((p) =>
      new ButtonBuilder()
        .setCustomId(`topstaff_page_${p}`)
        .setLabel(PAGES[p].label.replace(/^\S+\s/, ""))
        .setStyle(p === activePage ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(p === activePage)
    )
  );
}

module.exports = { buildLeaderboardPayload, buildLeaderboardEmbed, buildLeaderboardRow, PAGES };
