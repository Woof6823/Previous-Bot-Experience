const { db, getSetting, setSetting } = require("../database");

db.exec(`
CREATE TABLE IF NOT EXISTS channel_day_stats (
    channel_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, day)
);
CREATE TABLE IF NOT EXISTS channel_user_stats (
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, user_id, day)
);
`);

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}
function cutoffDay(days) {
  return dayKey(Date.now() - days * 86400000);
}
function dayFromCreatedAt(v) {
  if (typeof v === "number") return dayKey(v);
  if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  return dayKey(Date.now());
}


try {
  if (!getSetting("channel_stats_seeded_v1")) {
    const rows = db.prepare("SELECT channel_id, author_id, created_at FROM message_log").all();
    const dayAgg = new Map();
    const userAgg = new Map();
    for (const r of rows) {
      const day = dayFromCreatedAt(r.created_at);
      dayAgg.set(`${r.channel_id}|${day}`, (dayAgg.get(`${r.channel_id}|${day}`) || 0) + 1);
      userAgg.set(
        `${r.channel_id}|${r.author_id}|${day}`,
        (userAgg.get(`${r.channel_id}|${r.author_id}|${day}`) || 0) + 1
      );
    }
    const insDay = db.prepare(
      "INSERT INTO channel_day_stats (channel_id, day, count) VALUES (?,?,?) ON CONFLICT(channel_id, day) DO UPDATE SET count = count + excluded.count"
    );
    const insUser = db.prepare(
      "INSERT INTO channel_user_stats (channel_id, user_id, day, count) VALUES (?,?,?,?) ON CONFLICT(channel_id, user_id, day) DO UPDATE SET count = count + excluded.count"
    );
    db.transaction(() => {
      for (const [k, c] of dayAgg) {
        const [ch, day] = k.split("|");
        insDay.run(ch, day, c);
      }
      for (const [k, c] of userAgg) {
        const [ch, uid, day] = k.split("|");
        insUser.run(ch, uid, day, c);
      }
    })();
    setSetting("channel_stats_seeded_v1", "1");
  }
} catch (err) {
  console.error("[channelStats] seed failed:", err.message);
}


function recordChannelMessage(channelId, userId) {
  const day = dayKey(Date.now());
  try {
    db.prepare(
      "INSERT INTO channel_day_stats (channel_id, day, count) VALUES (?, ?, 1) ON CONFLICT(channel_id, day) DO UPDATE SET count = count + 1"
    ).run(channelId, day);
    db.prepare(
      "INSERT INTO channel_user_stats (channel_id, user_id, day, count) VALUES (?, ?, ?, 1) ON CONFLICT(channel_id, user_id, day) DO UPDATE SET count = count + 1"
    ).run(channelId, userId, day);
  } catch {}
}

function getChannelMessageCount(channelId, days) {
  try {
    if (!days)
      return db
        .prepare("SELECT COALESCE(SUM(count),0) t FROM channel_day_stats WHERE channel_id = ?")
        .get(channelId).t;
    return db
      .prepare(
        "SELECT COALESCE(SUM(count),0) t FROM channel_day_stats WHERE channel_id = ? AND day >= ?"
      )
      .get(channelId, cutoffDay(days)).t;
  } catch {
    return 0;
  }
}
function getTotalMessages(days) {
  try {
    if (!days) return db.prepare("SELECT COALESCE(SUM(count),0) t FROM channel_day_stats").get().t;
    return db
      .prepare("SELECT COALESCE(SUM(count),0) t FROM channel_day_stats WHERE day >= ?")
      .get(cutoffDay(days)).t;
  } catch {
    return 0;
  }
}
function getActiveChannelCount(days) {
  try {
    return db
      .prepare(
        "SELECT COUNT(DISTINCT channel_id) c FROM channel_day_stats" +
          (days ? " WHERE day >= ?" : "")
      )
      .get(...(days ? [cutoffDay(days)] : [])).c;
  } catch {
    return 0;
  }
}
function getChannelUniqueSenders(channelId, days) {
  try {
    return db
      .prepare(
        "SELECT COUNT(DISTINCT user_id) c FROM channel_user_stats WHERE channel_id = ?" +
          (days ? " AND day >= ?" : "")
      )
      .get(...(days ? [channelId, cutoffDay(days)] : [channelId])).c;
  } catch {
    return 0;
  }
}
function getTopSenders(channelId, days, limit = 5) {
  try {
    return db
      .prepare(
        "SELECT user_id, SUM(count) t FROM channel_user_stats WHERE channel_id = ?" +
          (days ? " AND day >= ?" : "") +
          " GROUP BY user_id ORDER BY t DESC LIMIT ?"
      )
      .all(...(days ? [channelId, cutoffDay(days), limit] : [channelId, limit]));
  } catch {
    return [];
  }
}
function getTopTextChannels(days, limit = 6) {
  try {
    return db
      .prepare(
        "SELECT channel_id, SUM(count) t FROM channel_day_stats" +
          (days ? " WHERE day >= ?" : "") +
          " GROUP BY channel_id ORDER BY t DESC LIMIT ?"
      )
      .all(...(days ? [cutoffDay(days), limit] : [limit]));
  } catch {
    return [];
  }
}


function tables() {
  try {
    return db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
  } catch {
    return [];
  }
}
function columns(t) {
  try {
    return db
      .prepare(`PRAGMA table_info("${t}")`)
      .all()
      .map((c) => c.name);
  } catch {
    return [];
  }
}
function getVoiceSchema() {
  for (const t of tables()) {
    if (!/voice/i.test(t)) continue;
    const cols = columns(t);
    if (!cols.includes("channel_id")) continue;
    const secCol = cols.find((c) => /second|duration/i.test(c));
    const startCol =
      cols.find((c) => /start|join/i.test(c)) || cols.find((c) => /created/i.test(c));
    const endCol = cols.find((c) => /end|leave/i.test(c));
    if (secCol) return { table: t, valueExpr: `SUM(${secCol})`, timeCol: startCol || null };
    if (startCol && endCol)
      return { table: t, valueExpr: `SUM((${endCol} - ${startCol}) / 1000)`, timeCol: startCol };
  }
  return null;
}
function getTopVoiceChannels(days, limit = 6) {
  const s = getVoiceSchema();
  if (!s) return [];
  let sql = `SELECT channel_id, ${s.valueExpr} AS s FROM ${s.table}`;
  const params = [];
  if (days && s.timeCol) {
    sql += ` WHERE ${s.timeCol} >= ?`;
    params.push(Date.now() - days * 86400000);
  }
  sql += " GROUP BY channel_id ORDER BY s DESC LIMIT ?";
  params.push(limit);
  try {
    return db
      .prepare(sql)
      .all(...params)
      .filter((r) => (r.s || 0) > 0);
  } catch {
    return [];
  }
}
function getChannelVoiceSeconds(channelId, days) {
  const s = getVoiceSchema();
  if (!s) return 0;
  let sql = `SELECT ${s.valueExpr} AS s FROM ${s.table} WHERE channel_id = ?`;
  const params = [channelId];
  if (days && s.timeCol) {
    sql += ` AND ${s.timeCol} >= ?`;
    params.push(Date.now() - days * 86400000);
  }
  try {
    const r = db.prepare(sql).get(...params);
    return r && r.s ? r.s : 0;
  } catch {
    return 0;
  }
}

module.exports = {
  recordChannelMessage,
  getChannelMessageCount,
  getTotalMessages,
  getActiveChannelCount,
  getChannelUniqueSenders,
  getTopSenders,
  getTopTextChannels,
  getTopVoiceChannels,
  getChannelVoiceSeconds
};
