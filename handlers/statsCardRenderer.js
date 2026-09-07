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
    try {
      fs.mkdirSync(FONTS_DIR, { recursive: true });
    } catch {}
    let regular = null;
    try {
      for (const f of fs.readdirSync(FONTS_DIR)) {
        if (!/\.(ttf|otf)$/i.test(f)) continue;
        const family = "StatsFont-" + f.replace(/\.(ttf|otf)$/i, "");
        canvasLib.GlobalFonts.registerFromPath(path.join(FONTS_DIR, f), family);
        if (!/emoji/i.test(f)) regular = family;
      }
    } catch {}
    if (regular) FONT = regular;
    else {
      const families = (canvasLib.GlobalFonts.families || []).map((x) => x.family);
      const preferred = families.find((f) =>
        /DejaVu Sans|Noto Sans|Liberation Sans|Arial|Inter/i.test(f)
      );
      if (preferred) FONT = preferred;
    }
  })().catch(() => {});
  return fontsPromise;
}
if (canvasLib) ensureFonts();

const W = 1200,
  H = 675;
const C = {
  bgTop: "#0b0d13",
  bgBot: "#12151f",
  panel: "rgba(255,255,255,0.04)",
  panelStroke: "rgba(255,255,255,0.09)",
  text: "#f2f5fa",
  sub: "#8f9bb0",
  chip: "rgba(255,255,255,0.07)",
  gold: "#f0b232",
  silver: "#c9d4e4",
  bronze: "#d08a4e",
  green: "#23a55a",
  pink: "#e0447c",
  blurple: "#5865f2",
  cyan: "#38bdf8",
  orange: "#ff7a29"
};
function f(size, weight = 600) {
  return `${weight} ${size}px "${FONT}"`;
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
function truncate(ctx, text, maxW) {
  text = String(text);
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text + "…";
}
async function loadImg(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await canvasLib.loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
async function drawAvatar(ctx, url, x, y, r, ringColors) {
  const img = await loadImg(url);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#2a3040";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  if (ringColors) {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, ringColors[0]);
    g.addColorStop(1, ringColors[1]);
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function icon(ctx, type, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (type === "trophy") {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.32, y - s * 0.45);
    ctx.lineTo(x + s * 0.32, y - s * 0.45);
    ctx.lineTo(x + s * 0.26, y - 0.02 * s);
    ctx.quadraticCurveTo(x, y + s * 0.22, x - s * 0.26, y - 0.02 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - s * 0.42, y - s * 0.28, s * 0.16, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.42, y - s * 0.28, s * 0.16, Math.PI * 1.4, Math.PI * 0.6, true);
    ctx.stroke();
    ctx.fillRect(x - s * 0.06, y + s * 0.16, s * 0.12, s * 0.16);
    rr(ctx, x - s * 0.22, y + s * 0.32, s * 0.44, s * 0.1, s * 0.04);
    ctx.fill();
  } else if (type === "hash") {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.14, y - s * 0.4);
    ctx.lineTo(x - s * 0.22, y + s * 0.4);
    ctx.moveTo(x + s * 0.22, y - s * 0.4);
    ctx.lineTo(x + s * 0.14, y + s * 0.4);
    ctx.moveTo(x - s * 0.4, y - s * 0.14);
    ctx.lineTo(x + s * 0.4, y - s * 0.14);
    ctx.moveTo(x - s * 0.4, y + s * 0.14);
    ctx.lineTo(x + s * 0.4, y + s * 0.14);
    ctx.stroke();
  } else if (type === "speaker") {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y - s * 0.12);
    ctx.lineTo(x - s * 0.16, y - s * 0.12);
    ctx.lineTo(x + s * 0.08, y - s * 0.36);
    ctx.lineTo(x + s * 0.08, y + s * 0.36);
    ctx.lineTo(x - s * 0.16, y + s * 0.12);
    ctx.lineTo(x - s * 0.38, y + s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.14, y, s * 0.2, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.14, y, s * 0.34, -0.6, 0.6);
    ctx.stroke();
  } else if (type === "chart") {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y - s * 0.38);
    ctx.lineTo(x - s * 0.38, y + s * 0.38);
    ctx.lineTo(x + s * 0.4, y + s * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.26, y + s * 0.2);
    ctx.lineTo(x - s * 0.06, y - 0.05 * s);
    ctx.lineTo(x + s * 0.08, y + s * 0.08);
    ctx.lineTo(x + s * 0.3, y - s * 0.24);
    ctx.stroke();
  } else if (type === "calendar") {
    rr(ctx, x - s * 0.36, y - s * 0.28, s * 0.72, s * 0.62, s * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.36, y - s * 0.08);
    ctx.lineTo(x + s * 0.36, y - s * 0.08);
    ctx.moveTo(x - s * 0.16, y - s * 0.42);
    ctx.lineTo(x - s * 0.16, y - s * 0.24);
    ctx.moveTo(x + s * 0.16, y - s * 0.42);
    ctx.lineTo(x + s * 0.16, y - s * 0.24);
    ctx.stroke();
  } else if (type === "bolt") {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y - s * 0.45);
    ctx.lineTo(x - s * 0.24, y + s * 0.06);
    ctx.lineTo(x - s * 0.02, y + s * 0.06);
    ctx.lineTo(x - s * 0.1, y + s * 0.45);
    ctx.lineTo(x + s * 0.24, y - s * 0.06);
    ctx.lineTo(x + s * 0.02, y - s * 0.06);
    ctx.closePath();
    ctx.fill();
  } else if (type === "flame") {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.45);
    ctx.bezierCurveTo(
      x + s * 0.3,
      y - s * 0.1,
      x + s * 0.3,
      y + s * 0.15,
      x + s * 0.16,
      y + s * 0.32
    );
    ctx.quadraticCurveTo(x, y + s * 0.48, x - s * 0.16, y + s * 0.32);
    ctx.bezierCurveTo(x - s * 0.3, y + s * 0.15, x - s * 0.22, y - s * 0.05, x, y - s * 0.45);
    ctx.fill();
  } else if (type === "crown") {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.36, y + s * 0.24);
    ctx.lineTo(x - s * 0.36, y - s * 0.12);
    ctx.lineTo(x - s * 0.14, y + s * 0.04);
    ctx.lineTo(x, y - s * 0.32);
    ctx.lineTo(x + s * 0.14, y + s * 0.04);
    ctx.lineTo(x + s * 0.36, y - s * 0.12);
    ctx.lineTo(x + s * 0.36, y + s * 0.24);
    ctx.closePath();
    ctx.fill();
  } else if (type === "ticket") {
    rr(ctx, x - s * 0.4, y - s * 0.26, s * 0.8, s * 0.52, s * 0.08);
    ctx.stroke();
    ctx.setLineDash([s * 0.08, s * 0.08]);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.12, y - s * 0.26);
    ctx.lineTo(x + s * 0.12, y + s * 0.26);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
function paintBase(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.16, -40, 420, "rgba(240,178,50,0.12)");
  glow(ctx, w * 0.9, 90, 420, "rgba(88,101,242,0.16)");
  glow(ctx, w * 0.5, h + 60, 460, "rgba(35,165,90,0.08)");
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let gx = 20; gx < w; gx += 28)
    for (let gy = 20; gy < h; gy += 28) ctx.fillRect(gx, gy, 1.5, 1.5);
}
function panel(ctx, x, y, w, h, accent) {
  rr(ctx, x, y, w, h, 16);
  ctx.fillStyle = C.panel;
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, accent + "55");
  g.addColorStop(0.4, C.panelStroke);
  g.addColorStop(1, C.panelStroke);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function panelHeader(ctx, x, y, w, title, iconType, accent) {
  icon(ctx, iconType, x + 26, y + 26, 18, accent);
  ctx.fillStyle = C.text;
  ctx.font = f(21, 800);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(title, x + 48, y + 27);
  ctx.fillStyle = accent;
  rr(ctx, x + 48, y + 42, 34, 3, 2);
  ctx.fill();
}
function rankColor(rank) {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.text;
}
function formatK(n) {
  if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
  return String(n);
}
function smoothLine(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2,
      yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}
function drawChart(ctx, x, y, w, h, series, detailed) {
  const msgs = series.messages,
    voice = series.voiceHours;
  const max = Math.max(1, ...msgs, ...voice);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.fillStyle = C.sub;
  ctx.font = f(13, 600);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
    if (detailed) ctx.fillText(formatK(Math.round((max * i) / 4)), x - 8, gy);
  }
  ctx.textAlign = "left";
  const n = msgs.length;
  if (n < 2) return;
  const px = (i) => x + (w * i) / (n - 1);
  const py = (v) => y + h - h * 0.9 * (v / max) - 2;
  const draw = (arr, color) => {
    const pts = arr.map((v, i) => ({ x: px(i), y: py(v) }));
    smoothLine(ctx, pts);
    ctx.lineTo(px(n - 1), y + h);
    ctx.lineTo(px(0), y + h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, color + "44");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = detailed ? 14 : 8;
    smoothLine(ctx, pts);
    ctx.strokeStyle = color;
    ctx.lineWidth = detailed ? 3.5 : 3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(pts[n - 1].x, pts[n - 1].y, detailed ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  draw(msgs, C.green);
  draw(voice, C.pink);
  if (detailed && series.labels) {
    ctx.fillStyle = C.sub;
    ctx.font = f(14, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.ceil(n / 10);
    for (let i = 0; i < n; i += step) ctx.fillText(series.labels[i], px(i), y + h + 8);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
  }
}
function legend(ctx, x, y) {
  ctx.textBaseline = "middle";
  ctx.font = f(16, 700);
  ctx.save();
  ctx.shadowColor = C.green;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = C.green;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.text;
  ctx.fillText("Messages", x + 12, y + 1);
  const w1 = ctx.measureText("Messages").width;
  ctx.save();
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x + 12 + w1 + 26, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = C.pink;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.text;
  ctx.fillText("Voice", x + 12 + w1 + 40, y + 1);
}


async function renderStatsCard(d) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBase(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";


    await drawAvatar(ctx, d.avatarUrl, 66, 62, 40, [C.gold, C.pink]);
    ctx.fillStyle = C.text;
    ctx.font = f(33, 800);
    ctx.fillText(truncate(ctx, clean(d.displayName), 430), 126, 46);
    const nw = ctx.measureText(truncate(ctx, clean(d.displayName), 430)).width;
    ctx.fillStyle = C.sub;
    ctx.font = f(19, 500);
    ctx.fillText(clean(d.username), 126 + nw + 14, 50);

    const sIcon = await loadImg(d.serverIconUrl);
    rr(ctx, 126, 74, 210, 30, 8);
    ctx.fillStyle = C.chip;
    ctx.fill();
    if (sIcon) {
      ctx.save();
      rr(ctx, 130, 78, 22, 22, 5);
      ctx.clip();
      ctx.drawImage(sIcon, 130, 78, 22, 22);
      ctx.restore();
    }
    ctx.fillStyle = C.text;
    ctx.font = f(15, 700);
    ctx.fillText(truncate(ctx, clean(d.serverName), 160), 158, 90);
    rr(ctx, 344, 74, 96, 30, 8);
    ctx.fillStyle = C.chip;
    ctx.fill();
    icon(ctx, "crown", 360, 89, 13, C.gold);
    ctx.fillStyle = C.gold;
    ctx.font = f(15, 800);
    ctx.fillText(`Level ${d.level}`, 374, 90);

    const chipW = 178;
    const jx = W - 24 - 108 - chipW - 12 - chipW;
    const chips = [
      ["CREATED", d.createdLabel],
      ["JOINED", d.joinedLabel]
    ];
    for (let i = 0; i < 2; i++) {
      const cx2 = jx + i * (chipW + 12);
      rr(ctx, cx2, 40, chipW, 46, 10);
      ctx.fillStyle = C.chip;
      ctx.fill();
      ctx.strokeStyle = C.panelStroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      icon(ctx, "calendar", cx2 + 22, 63, 14, C.cyan);
      ctx.fillStyle = C.sub;
      ctx.font = f(10, 800);
      ctx.fillText(chips[i][0], cx2 + 40, 54);
      ctx.fillStyle = C.text;
      ctx.font = f(15, 700);
      ctx.fillText(chips[i][1], cx2 + 40, 72);
    }

    const sx = W - 70,
      sy = 63,
      sr = 34;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 7;
    ctx.stroke();
    const pct = Math.max(0.02, Math.min(1, (d.score || 0) / 100));
    const rg = ctx.createLinearGradient(sx - sr, sy - sr, sx + sr, sy + sr);
    rg.addColorStop(0, C.gold);
    rg.addColorStop(1, C.pink);
    ctx.save();
    ctx.shadowColor = C.gold;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = rg;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.text;
    ctx.font = f(22, 800);
    ctx.textAlign = "center";
    ctx.fillText(String(d.score || 0), sx, sy + 1);
    ctx.fillStyle = C.sub;
    ctx.font = f(9, 800);
    ctx.fillText("ACTIVITY", sx, sy + sr + 12);
    ctx.textAlign = "left";


    const y0 = 128,
      ph = 236,
      pad = 24,
      gap = 16;
    const rw = 300,
      mw = (W - pad * 2 - gap * 2 - rw) / 2;

    panel(ctx, pad, y0, rw, ph, C.gold);
    panelHeader(ctx, pad, y0, rw, "Server Ranks", "trophy", C.gold);
    const rankRow = (ry, label, rank, ic) => {
      rr(ctx, pad + 18, ry, rw - 36, 62, 10);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      rr(ctx, pad + 26, ry + 14, 108, 34, 8);
      ctx.fillStyle = C.chip;
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = f(16, 700);
      ctx.fillText(label, pad + 40, ry + 32);
      const rc = rankColor(rank);
      if (rank === 1) icon(ctx, "crown", pad + rw - 118, ry + 31, 15, C.gold);
      ctx.fillStyle = rc;
      ctx.font = f(30, 800);
      ctx.textAlign = "right";
      ctx.fillText(`#${rank}`, pad + rw - 30, ry + 32);
      ctx.textAlign = "left";
    };
    rankRow(y0 + 62, "Message", d.msgRank, "hash");
    rankRow(y0 + 138, "Voice", d.voiceRank, "speaker");

    const mx = pad + rw + gap;
    panel(ctx, mx, y0, mw, ph, C.green);
    panelHeader(ctx, mx, y0, mw, "Messages", "hash", C.green);
    if (d.streak > 1) {
      icon(ctx, "flame", mx + mw - 96, y0 + 26, 14, C.orange);
      ctx.fillStyle = C.orange;
      ctx.font = f(15, 800);
      ctx.textAlign = "right";
      ctx.fillText(`${d.streak}d streak`, mx + mw - 20, y0 + 27);
      ctx.textAlign = "left";
    }

    const vx = mx + mw + gap;
    panel(ctx, vx, y0, mw, ph, C.pink);
    panelHeader(ctx, vx, y0, mw, "Voice Activity", "speaker", C.pink);
    const statRow = (bx, ry, label, valueText, unit, accent, trend) => {
      rr(ctx, bx + 18, ry, mw - 36, 44, 10);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      rr(ctx, bx + 26, ry + 9, 52, 26, 7);
      ctx.fillStyle = C.chip;
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = f(14, 800);
      ctx.fillText(label, bx + 40, ry + 23);
      ctx.fillStyle = C.text;
      ctx.font = f(21, 800);
      ctx.fillText(valueText, bx + 92, ry + 23);
      const vw = ctx.measureText(valueText).width;
      ctx.fillStyle = C.sub;
      ctx.font = f(14, 500);
      ctx.fillText(" " + unit, bx + 92 + vw + 4, ry + 24);
      if (trend !== undefined && trend !== null) {
        const up = trend >= 0;
        ctx.fillStyle = up ? C.green : "#ef4444";
        ctx.font = f(13, 800);
        ctx.textAlign = "right";
        ctx.fillText(`${up ? "▲" : "▼"} ${Math.abs(trend)}%`, bx + mw - 26, ry + 23);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = accent + "33";
      rr(ctx, bx + 18, ry + 44, mw - 36, 3, 2);
      ctx.fill();
    };
    d.messageRows.forEach((r, i) => {
      statRow(
        mx,
        y0 + 62 + i * 56,
        r.label,
        formatK(r.value),
        r.value === 1 ? "message" : "messages",
        C.green,
        i === 0 ? d.trendPct : undefined
      );
    });
    d.voiceRows.forEach((r, i) => {
      statRow(vx, y0 + 62 + i * 56, r.label, r.hours.toFixed(2), "hours", C.pink, undefined);
    });


    const by = y0 + ph + gap,
      bh = 240;
    const lw = 560,
      chw = W - pad * 2 - gap - lw;
    panel(ctx, pad, by, lw, bh, C.cyan);
    panelHeader(ctx, pad, by, lw, "Top Channels", "chart", C.cyan);
    const rows = d.topChannels || [];
    rows.slice(0, 3).forEach((row, i) => {
      const ry = by + 58 + i * 58;
      icon(ctx, row.icon || "hash", pad + 34, ry + 25, 14, C.sub);
      rr(ctx, pad + 56, ry, lw * 0.52, 50, 10);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = f(17, 700);
      ctx.fillText(truncate(ctx, clean(row.name) || "—", lw * 0.52 - 24), pad + 70, ry + 26);
      if (row.value !== null && row.value !== undefined) {
        ctx.fillStyle = C.text;
        ctx.font = f(20, 800);
        ctx.textAlign = "right";
        ctx.fillText(String(row.value), pad + lw - 88, ry + 26);
        ctx.fillStyle = C.sub;
        ctx.font = f(13, 500);
        ctx.textAlign = "left";
        ctx.fillText(row.unit || "", pad + lw - 78, ry + 26);
      } else {
        ctx.fillStyle = C.sub;
        ctx.font = f(17, 600);
        ctx.textAlign = "right";
        ctx.fillText("—", pad + lw - 40, ry + 26);
        ctx.textAlign = "left";
      }
    });

    const chx = pad + lw + gap;
    panel(ctx, chx, by, chw, bh, C.blurple);
    panelHeader(ctx, chx, by, chw, "Charts", "chart", C.blurple);
    legend(ctx, chx + chw - 210, by + 26);
    drawChart(ctx, chx + 18, by + 58, chw - 36, bh - 82, d.series, false);


    ctx.fillStyle = C.sub;
    ctx.font = f(15, 600);
    ctx.fillText(`Server Lookback: ${d.lookbackLabel}  •  Timezone: EST`, pad, H - 22);
    icon(ctx, "bolt", W - 190, H - 22, 15, C.gold);
    ctx.fillStyle = C.text;
    ctx.font = f(15, 800);
    ctx.fillText("Powered by Surge Bot", W - 176, H - 22);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[statsCard] render failed:", err.message);
    return null;
  }
}


async function renderStatsGraph(d) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    paintBase(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    icon(ctx, "chart", 44, 52, 22, C.blurple);
    ctx.fillStyle = C.text;
    ctx.font = f(34, 800);
    ctx.fillText(`Activity Graph — ${d.lookbackLabel}`, 78, 52);
    ctx.fillStyle = C.sub;
    ctx.font = f(18, 600);
    ctx.fillText(`${clean(d.displayName)}  •  messages vs voice hours per day`, 78, 86);
    legend(ctx, W - 240, 52);
    panel(ctx, 24, 116, W - 48, H - 176, C.blurple);
    drawChart(ctx, 92, 150, W - 160, H - 300, d.series, true);
    ctx.fillStyle = C.sub;
    ctx.font = f(15, 600);
    ctx.fillText(`Server Lookback: ${d.lookbackLabel}  •  Timezone: EST`, 24, H - 22);
    icon(ctx, "bolt", W - 190, H - 22, 15, C.gold);
    ctx.fillStyle = C.text;
    ctx.font = f(15, 800);
    ctx.fillText("Powered by Surge Bot", W - 176, H - 22);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[statsCard] graph failed:", err.message);
    return null;
  }
}




async function renderTopStatsCard(d) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const headerH = 128,
      rowH = 66,
      gapR = 10,
      footH = 56;
    const HH = headerH + d.rows.length * (rowH + gapR) + footH;
    const canvas = canvasLib.createCanvas(W, HH);
    const ctx = canvas.getContext("2d");
    paintBase(ctx, W, HH);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    icon(ctx, "trophy", 52, 64, 26, C.gold);
    ctx.fillStyle = C.text;
    ctx.font = f(34, 800);
    ctx.fillText("Server Leaderboard", 88, 56);
    ctx.fillStyle = d.accent;
    ctx.font = f(18, 700);
    ctx.fillText(`${d.metricLabel}  •  ${d.lookbackLabel}`, 88, 90);
    const sIcon = await loadImg(d.serverIconUrl);
    rr(ctx, W - 250, 44, 210, 44, 10);
    ctx.fillStyle = C.chip;
    ctx.fill();
    if (sIcon) {
      ctx.save();
      rr(ctx, W - 244, 50, 32, 32, 7);
      ctx.clip();
      ctx.drawImage(sIcon, W - 244, 50, 32, 32);
      ctx.restore();
    }
    ctx.fillStyle = C.text;
    ctx.font = f(16, 700);
    ctx.fillText(truncate(ctx, clean(d.serverName), 150), W - 204, 66);

    let y = headerH;
    for (const r of d.rows) {
      const top3 = r.rank <= 3;
      rr(ctx, 28, y, W - 56, rowH, 14);
      ctx.fillStyle = top3 ? d.accent + "14" : "rgba(255,255,255,0.04)";
      ctx.fill();
      if (top3) {
        ctx.strokeStyle = d.accent + "66";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (top3) {
        icon(ctx, "crown", 66, y + rowH / 2, 16, rankColor(r.rank));
        ctx.fillStyle = rankColor(r.rank);
        ctx.font = f(22, 800);
        ctx.fillText(String(r.rank), 88, y + rowH / 2);
      } else {
        ctx.fillStyle = C.sub;
        ctx.font = f(22, 800);
        ctx.fillText(String(r.rank).padStart(2, "0"), 62, y + rowH / 2);
      }
      await drawAvatar(ctx, r.avatarUrl, 148, y + rowH / 2, 24, top3 ? [d.accent, C.pink] : null);
      ctx.fillStyle = C.text;
      ctx.font = f(22, 700);
      ctx.fillText(truncate(ctx, clean(r.name), 300), 186, y + rowH / 2);

      const barX = 520,
        barW = 420,
        barH = 16;
      rr(ctx, barX, y + rowH / 2 - barH / 2, barW, barH, 8);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      const pct2 = d.rows[0].total > 0 ? Math.min(1, r.total / d.rows[0].total) : 0;
      if (pct2 > 0.02) {
        const g2 = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        g2.addColorStop(0, d.accent);
        g2.addColorStop(1, C.pink);
        ctx.save();
        ctx.shadowColor = d.accent;
        ctx.shadowBlur = 10;
        rr(ctx, barX, y + rowH / 2 - barH / 2, Math.max(barH, barW * pct2), barH, 8);
        ctx.fillStyle = g2;
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = d.accent;
      ctx.font = f(24, 800);
      ctx.textAlign = "right";
      ctx.fillText(d.format(r.total), W - 52, y + rowH / 2);
      ctx.textAlign = "left";
      y += rowH + gapR;
    }

    ctx.fillStyle = C.sub;
    ctx.font = f(15, 600);
    ctx.fillText(
      `Page ${d.page + 1} of ${d.totalPages}  •  ${d.totalUsers} active member(s)  •  Timezone: EST`,
      28,
      HH - 26
    );
    icon(ctx, "bolt", W - 190, HH - 26, 15, C.gold);
    ctx.fillStyle = C.text;
    ctx.font = f(15, 800);
    ctx.fillText("Powered by Surge Bot", W - 176, HH - 26);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[statsCard] topstats failed:", err.message);
    return null;
  }
}
module.exports = {
  renderStatsCard,
  renderStatsGraph,
  renderTopStatsCard,
  isAvailable: () => !!canvasLib
};
