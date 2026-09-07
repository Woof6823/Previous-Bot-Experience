let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const fs = require("fs");
const path = require("path");

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_URLS = [
  {
    file: "Inter.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"
  },
  {
    file: "NotoColorEmoji.ttf",
    url: "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf"
  }
];
let FONT = "sans-serif";
let fontsPromise = null;

function ensureFonts() {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (!canvasLib) return;
    try {
      fs.mkdirSync(FONTS_DIR, { recursive: true });
    } catch {}
    for (const { file, url } of FONT_URLS) {
      const target = path.join(FONTS_DIR, file);
      const exists = fs.existsSync(target) && fs.statSync(target).size > 1024;
      if (exists) continue;
      try {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
      } catch (err) {
        console.error(`[levelCard] couldn't download ${file}: ${err.message}`);
      }
    }
    let regular = null;
    try {
      for (const f of fs.readdirSync(FONTS_DIR)) {
        if (!/\.(ttf|otf)$/i.test(f)) continue;
        const family = "LevelFont-" + f.replace(/\.(ttf|otf)$/i, "");
        canvasLib.GlobalFonts.registerFromPath(path.join(FONTS_DIR, f), family);
        if (!/emoji/i.test(f)) regular = family;
      }
    } catch {}
    if (regular) FONT = regular;
  })().catch((err) => console.error("[levelCard] font setup failed:", err.message));
  return fontsPromise;
}

function f(size, weight = 600) {
  return `${weight} ${size}px "${FONT}"`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function radial(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function truncate(text, max) {
  text = String(text);
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function loadImageSafe(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await canvasLib.loadImage(Buffer.from(await res.arrayBuffer()));
}
function paintBackground(ctx, W, H, accent) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#170a2e");
  bg.addColorStop(0.5, "#221355");
  bg.addColorStop(1, "#0c1b45");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  radial(ctx, W * 0.85, 60, 380, accent);
  radial(ctx, W * 0.1, H * 0.9, 320, "rgba(64,120,255,0.16)");
  const rnd = mulberry32(1337);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(255,255,255,${(0.05 + rnd() * 0.2).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
async function drawAvatar(ctx, avatarUrl, x, y, r, ring) {
  let img = null;
  if (avatarUrl) {
    try {
      img = await loadImageSafe(avatarUrl);
    } catch {}
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#3a2b70";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 6;
  ctx.stroke();
}


async function renderLevelUpCard({ username, avatarUrl, level, rank }) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const W = 1000,
      H = 420;
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBackground(ctx, W, H, "rgba(245,196,0,0.25)");
    roundRect(ctx, 20, 20, W - 40, H - 40, 28);
    ctx.strokeStyle = "rgba(245,196,0,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
    await drawAvatar(ctx, avatarUrl, 160, H / 2, 90, "#f5c400");
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f5c400";
    ctx.font = f(56, 800);
    ctx.fillText("🎉 LEVEL UP!", 300, 125);
    ctx.fillStyle = "#ffffff";
    ctx.font = f(44, 700);
    ctx.fillText(truncate(username, 22), 300, 210);
    ctx.fillStyle = "#cfc8ff";
    ctx.font = f(32, 600);
    ctx.fillText(`Reached Level ${level}   •   Rank #${rank}`, 300, 285);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[levelCard] level-up render failed:", err.message);
    return null;
  }
}


async function renderLevelCard({ username, avatarUrl, level, rank, xpIntoLevel, xpForNext }) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const W = 1000,
      H = 440;
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBackground(ctx, W, H, "rgba(87,242,135,0.20)");
    roundRect(ctx, 20, 20, W - 40, H - 40, 28);
    ctx.strokeStyle = "rgba(87,242,135,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    await drawAvatar(ctx, avatarUrl, 150, 160, 85, "#57f287");
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = f(46, 800);
    ctx.fillText(truncate(username, 22), 280, 110);
    ctx.fillStyle = "#57f287";
    ctx.font = f(36, 700);
    ctx.fillText(`Level ${level}`, 280, 175);
    ctx.fillStyle = "#cfc8ff";
    ctx.font = f(30, 600);
    ctx.fillText(`Rank #${rank}`, 480, 175);

    const bx = 280,
      by = 250,
      bw = W - 340,
      bh = 34;
    roundRect(ctx, bx, by, bw, bh, 17);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    const pct = xpForNext > 0 ? Math.min(1, xpIntoLevel / xpForNext) : 0;
    if (pct > 0.02) {
      roundRect(ctx, bx, by, Math.max(bh, bw * pct), bh, 17);
      const pg = ctx.createLinearGradient(bx, by, bx + bw, by);
      pg.addColorStop(0, "#57f287");
      pg.addColorStop(1, "#2ecc71");
      ctx.fillStyle = pg;
      ctx.fill();
    }
    ctx.fillStyle = "#e8e4ff";
    ctx.font = f(28, 600);
    ctx.fillText(`${xpIntoLevel} / ${xpForNext} XP to next level`, bx, by + bh + 40);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[levelCard] level render failed:", err.message);
    return null;
  }
}


async function renderLeaderboardCard(rows) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const W = 1000;
    const rowH = 56,
      gap = 8;
    const headerH = 130;
    const H = headerH + rows.length * (rowH + gap) + 40;
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBackground(ctx, W, H, "rgba(245,196,0,0.22)");
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5c400";
    ctx.font = f(52, 800);
    ctx.fillText("🏆 XP Leaderboard", W / 2, 75);
    ctx.textAlign = "left";
    let y = headerH;
    for (const r of rows) {
      const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}.`;
      roundRect(ctx, 40, y, W - 80, rowH, 14);
      ctx.fillStyle = r.rank <= 3 ? "rgba(245,196,0,0.14)" : "rgba(255,255,255,0.07)";
      ctx.fill();
      ctx.fillStyle = r.rank <= 3 ? "#f5c400" : "#cfc8ff";
      ctx.font = f(30, 800);
      ctx.fillText(medal, 62, y + rowH / 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = f(30, 700);
      ctx.fillText(truncate(r.username, 24), 140, y + rowH / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#57f287";
      ctx.font = f(28, 700);
      ctx.fillText(`Lv ${r.level}`, W - 60, y + rowH / 2);
      ctx.fillStyle = "#cfc8ff";
      ctx.font = f(26, 600);
      ctx.fillText(`${r.xp} xp`, W - 160, y + rowH / 2);
      ctx.textAlign = "left";
      y += rowH + gap;
    }
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[levelCard] leaderboard render failed:", err.message);
    return null;
  }
}

module.exports = { renderLevelUpCard, renderLevelCard, renderLeaderboardCard };
