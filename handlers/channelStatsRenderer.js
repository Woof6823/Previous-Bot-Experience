let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const fs = require("fs");
const path = require("path");
const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
let FONT = "sans-serif";
let fontsPromise = null;
function ensureFonts() {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (!canvasLib) return;
    let regular = null;
    try {
      for (const f of fs.readdirSync(FONTS_DIR)) {
        if (!/\.(ttf|otf)$/i.test(f)) continue;
        const family = "CSFont-" + f.replace(/\.(ttf|otf)$/i, "");
        canvasLib.GlobalFonts.registerFromPath(path.join(FONTS_DIR, f), family);
        if (!/emoji/i.test(f)) regular = family;
      }
    } catch {}
    if (regular) FONT = regular;
  })().catch(() => {});
  return fontsPromise;
}
if (canvasLib) ensureFonts();
const W = 1200,
  H = 675;
const C = {
  text: "#f2f5fa",
  sub: "#8f9bb0",
  chip: "rgba(255,255,255,0.07)",
  gold: "#f0b232",
  silver: "#c9d4e4",
  bronze: "#d08a4e",
  green: "#23a55a",
  pink: "#e0447c",
  cyan: "#38bdf8",
  blurple: "#5865f2"
};
function f(s, w = 600) {
  return `${w} ${s}px "${FONT}"`;
}
function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}
function fmtK(n) {
  return n >= 1000 ? (n / 1000).toFixed(2).replace(/\.?0+$/, "") + "k" : String(n);
}
function clean(t) {
  return String(t)
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{2500}-\u{25FF}\u{2000}-\u{206F}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9]+/, "")
    .trim();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function truncate(ctx, text, maxW) {
  text = String(text);
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text + "…";
}
function paintBase(ctx) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0d13");
  bg.addColorStop(1, "#12151f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.16, -40, 420, "rgba(56,189,248,0.14)");
  glow(ctx, W * 0.9, 90, 420, "rgba(88,101,242,0.16)");
  glow(ctx, W * 0.5, H + 60, 460, "rgba(35,165,90,0.08)");
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let gx = 20; gx < W; gx += 28)
    for (let gy = 20; gy < H; gy += 28) ctx.fillRect(gx, gy, 1.5, 1.5);
}
function banner(ctx, text) {
  const bw = 900,
    bx = (W - bw) / 2,
    by = 40,
    bh = 84;
  const g = ctx.createLinearGradient(bx, by, bx + bw, by);
  g.addColorStop(0, "#0e7490");
  g.addColorStop(1, "#4338ca");
  rr(ctx, bx, by, bw, bh, 16);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,200,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.font = f(38, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncate(ctx, text, bw - 80), W / 2, by + bh / 2 + 2);
  ctx.textAlign = "left";
}
function panel(ctx, x, y, w, h, accent) {
  rr(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, accent + "55");
  g.addColorStop(0.4, "rgba(255,255,255,0.09)");
  g.addColorStop(1, "rgba(255,255,255,0.09)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function panelTitle(ctx, x, y, w, title, accent) {
  ctx.fillStyle = C.text;
  ctx.font = f(26, 800);
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + 20, y + 30);
  ctx.fillStyle = accent;
  rr(ctx, x + 20, y + 48, 40, 3, 2);
  ctx.fill();
}
function medal(ctx, rank, x, y) {
  ctx.font = f(26, 800);
  if (rank === 1) {
    ctx.fillStyle = C.gold;
    ctx.fillText("🥇", x, y);
  } else if (rank === 2) {
    ctx.fillStyle = C.silver;
    ctx.fillText("🥈", x, y);
  } else if (rank === 3) {
    ctx.fillStyle = C.bronze;
    ctx.fillText("🥉", x, y);
  } else {
    ctx.fillStyle = C.sub;
    ctx.fillText(String(rank).padStart(2, "0"), x, y);
  }
}
function statRow(ctx, x, y, w, rank, name, pct, valueText, accent) {
  medal(ctx, rank, x, y);
  ctx.fillStyle = C.text;
  ctx.font = f(25, 700);
  ctx.fillText(truncate(ctx, clean(name), w * 0.4), x + 48, y);
  const bx = x + 48 + w * 0.44,
    bw = w * 0.3,
    bh = 14;
  rr(ctx, bx, y - bh / 2, bw, bh, 7);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  if (pct > 0.02) {
    rr(ctx, bx, y - bh / 2, Math.max(bh, bw * pct), bh, 7);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.fillStyle = C.sub;
  ctx.font = f(23, 700);
  ctx.textAlign = "right";
  ctx.fillText(valueText, x + w, y);
  ctx.textAlign = "left";
}
function kvRow(ctx, x, y, w, label, valueText, accent) {
  rr(ctx, x, y - 22, 110, 44, 9);
  ctx.fillStyle = C.chip;
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.font = f(21, 800);
  ctx.fillText(label, x + 14, y);
  ctx.fillStyle = C.text;
  ctx.font = f(26, 800);
  ctx.fillText(valueText, x + 130, y);
  const vw = ctx.measureText(valueText).width;
  ctx.fillStyle = C.sub;
  ctx.font = f(19, 500);
  ctx.fillText("  " + (accent || ""), x + 130 + vw, y + 1);
}
function footer(ctx, text) {
  ctx.fillStyle = C.sub;
  ctx.font = f(18, 600);
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H - 24);
  ctx.textAlign = "left";
}


async function renderChannelOverviewCard(d) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBase(ctx);
    banner(ctx, `📊  Channel Stats — ${d.lookbackLabel}`);
    const pw = (W - 140) / 2,
      py = 170,
      ph = 400;
    panel(ctx, 50, py, pw, ph, C.cyan);
    panelTitle(ctx, 50, py, pw, "💬 Top Text Channels", C.cyan);
    const maxT = d.textRows.length ? d.textRows[0].value : 1;
    d.textRows.slice(0, 6).forEach((r, i) => {
      statRow(
        ctx,
        74,
        py + 96 + i * 52,
        pw - 48,
        i + 1,
        r.name,
        r.value / maxT,
        `${fmtK(r.value)} msgs`,
        C.cyan
      );
    });
    if (!d.textRows.length) {
      ctx.fillStyle = C.sub;
      ctx.font = f(22, 600);
      ctx.fillText("No message data yet.", 74, py + 110);
    }
    panel(ctx, 90 + pw, py, pw, ph, C.pink);
    panelTitle(ctx, 90 + pw, py, pw, "🔊 Top Voice Channels", C.pink);
    const maxV = d.voiceRows.length ? d.voiceRows[0].value : 1;
    d.voiceRows.slice(0, 6).forEach((r, i) => {
      statRow(
        ctx,
        114 + pw,
        py + 96 + i * 52,
        pw - 48,
        i + 1,
        r.name,
        r.value / maxV,
        `${(r.value / 3600).toFixed(1)}h`,
        C.pink
      );
    });
    if (!d.voiceRows.length) {
      ctx.fillStyle = C.sub;
      ctx.font = f(22, 600);
      ctx.fillText("No voice data tracked.", 114 + pw, py + 110);
    }
    footer(
      ctx,
      `💬 ${fmt(d.totalMessages)} messages across ${d.activeChannels} active channel(s) • Surge Esports`
    );
    return canvas.toBuffer("image/png");
  } catch {
    return null;
  }
}


async function renderChannelDetailCard(d) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBase(ctx);
    banner(ctx, `#  ${clean(d.channelName)}`);
    const pw = (W - 140) / 2,
      py = 170,
      ph = 330;
    panel(ctx, 50, py, pw, ph, C.green);
    panelTitle(ctx, 50, py, pw, "💬 Messages", C.green);
    d.msgRows.forEach((r, i) => {
      kvRow(ctx, 74, py + 100 + i * 62, pw - 48, r.label, fmt(r.value), "messages");
    });
    panel(ctx, 90 + pw, py, pw, ph + 90, C.gold);
    panelTitle(ctx, 90 + pw, py, pw, "🏆 Top Senders (30d)", C.gold);
    const maxS = d.topSenders.length ? d.topSenders[0].value : 1;
    d.topSenders.slice(0, 5).forEach((r, i) => {
      statRow(
        ctx,
        114 + pw,
        py + 96 + i * 56,
        pw - 48,
        i + 1,
        r.name,
        r.value / maxS,
        fmt(r.value),
        C.gold
      );
    });
    if (!d.topSenders.length) {
      ctx.fillStyle = C.sub;
      ctx.font = f(22, 600);
      ctx.fillText("No sender data yet.", 114 + pw, py + 110);
    }
    footer(
      ctx,
      `👥 ${fmt(d.unique)} unique sender(s) all time  •  🔊 ${d.voiceText}  •  Surge Esports`
    );
    return canvas.toBuffer("image/png");
  } catch {
    return null;
  }
}
module.exports = {
  renderChannelOverviewCard,
  renderChannelDetailCard,
  isAvailable: () => !!canvasLib
};
