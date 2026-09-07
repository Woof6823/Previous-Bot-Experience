let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const fs = require("fs");
const path = require("path");

const W = 1920;
const H = 1080;
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
    } catch {

    }
    for (const { file, url } of FONT_URLS) {
      const target = path.join(FONTS_DIR, file);
      const exists = fs.existsSync(target) && fs.statSync(target).size > 1024;
      if (exists) continue;
      try {
        console.log(`[ticketCard] Downloading ${file} (one-time)...`);
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(target, buf);
        console.log(`[ticketCard] Saved ${file} (${Math.round(buf.length / 1024)} KB).`);
      } catch (err) {
        console.error(`[ticketCard] Couldn't download ${file}: ${err.message}`);
      }
    }


    let regular = null;
    try {
      for (const f of fs.readdirSync(FONTS_DIR)) {
        if (!/\.(ttf|otf)$/i.test(f)) continue;
        const family = "TicketFont-" + f.replace(/\.(ttf|otf)$/i, "");
        canvasLib.GlobalFonts.registerFromPath(path.join(FONTS_DIR, f), family);
        if (!/emoji/i.test(f)) regular = family;
      }
    } catch (err) {
      console.error("[ticketCard] Font registration failed:", err.message);
    }
    if (regular) {
      FONT = regular;
    } else {

      const families = (canvasLib.GlobalFonts.families || []).map((x) => x.family);
      const preferred = families.find((f) =>
        /DejaVu Sans|Noto Sans|Liberation Sans|Arial|Inter/i.test(f)
      );
      if (preferred) FONT = preferred;
    }
  })().catch((err) => {
    console.error("[ticketCard] Font setup failed:", err.message);
  });
  return fontsPromise;
}



if (canvasLib) ensureFonts();

function isAvailable() {
  return !!canvasLib;
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

function roundRectPath(ctx, x, y, w, h, r) {
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

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function font(size, weight = 600) {
  return `${weight} ${size}px "${FONT}"`;
}



function drawSection(ctx, x, y, w, opts, maxY) {
  const headerH = 56;
  const rowH = 56;
  const rowH2 = 84;
  const pad = 14;

  ctx.font = font(30, 600);
  const measured = opts.rows.map((row) => {
    const all = wrapText(ctx, `${row.label}: ${row.value}`, w - 150);
    const lines = all.slice(0, 2);
    let text = lines.join(" ");
    if (all.length > 2) text += "…";
    return { ...row, lineCount: lines.length, text };
  });

  let bodyH = pad;
  for (const m of measured) bodyH += (m.lineCount > 1 ? rowH2 : rowH) + 8;
  const panelH = headerH + bodyH;
  if (y + panelH > maxY) return null;


  roundRectPath(ctx, x, y, w, panelH, 20);
  ctx.fillStyle = "rgba(10, 8, 30, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 100, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();


  const hg = ctx.createLinearGradient(x, y, x + w, y);
  hg.addColorStop(0, opts.color1);
  hg.addColorStop(1, opts.color2);
  roundRectPath(ctx, x + 10, y + 10, w - 20, headerH - 6, 12);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.font = font(32, 700);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(`${opts.icon}  ${opts.title}`, x + 34, y + 10 + (headerH - 6) / 2 + 2);


  let ry = y + headerH + pad;
  for (const m of measured) {
    const h = m.lineCount > 1 ? rowH2 : rowH;
    ctx.font = font(31, 700);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(m.icon || "•", x + 40, ry + h / 2);
    ctx.font = font(30, 600);
    ctx.fillStyle = "#e8e4ff";
    const lines = wrapText(ctx, m.text, w - 150);
    if (lines.length === 1) {
      ctx.fillText(lines[0], x + 96, ry + rowH / 2);
    } else {
      ctx.fillText(lines[0], x + 96, ry + 26);
      ctx.fillText(lines[1] || "", x + 96, ry + 62);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 40, ry + h);
    ctx.lineTo(x + w - 40, ry + h);
    ctx.stroke();
    ry += h + 8;
  }
  return y + panelH;
}


async function renderTicketCard(data) {
  if (!canvasLib) return null;
  await ensureFonts();
  try {
    const canvas = canvasLib.createCanvas(W, H);
    const ctx = canvas.getContext("2d");


    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#170a2e");
    bg.addColorStop(0.5, "#1d1440");
    bg.addColorStop(1, "#0c1b45");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    radial(ctx, W * 0.5, 80, 520, "rgba(124,77,255,0.35)");
    radial(ctx, W * 0.12, H * 0.92, 420, "rgba(64,120,255,0.16)");
    radial(ctx, W * 0.92, H * 0.7, 420, "rgba(255,64,160,0.10)");
    const rnd = mulberry32(1337);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 1 + rnd() * 2.5;
      ctx.fillStyle = `rgba(255,255,255,${(0.05 + rnd() * 0.22).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }


    const bannerW = 1200;
    const bx = (W - bannerW) / 2;
    const by = 56;
    const bh = 104;
    const tg = ctx.createLinearGradient(bx, by, bx + bannerW, by);
    tg.addColorStop(0, "#6a2bd9");
    tg.addColorStop(1, "#2f6bdd");
    roundRectPath(ctx, bx, by, bannerW, bh, 18);
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = "rgba(180,140,255,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = font(52, 800);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${data.emoji}  ${data.title}`, W / 2, by + bh / 2 + 3);
    ctx.textAlign = "left";


    const x = 140;
    const w = W - 280;
    const maxY = 920;
    let y = 208;

    const applicantRows = [{ icon: "👤", label: "User", value: data.userLabel }];
    if (data.ageLabel) applicantRows.push({ icon: "🔢", label: "Age", value: data.ageLabel });
    const y1 = drawSection(
      ctx,
      x,
      y,
      w,
      {
        icon: "📋",
        title: "Applicant Info",
        color1: "#2f6bdd",
        color2: "#7a3be0",
        rows: applicantRows
      },
      maxY
    );
    if (y1) y = y1 + 24;

    const positionRows = [{ icon: "🎯", label: "Position Applied", value: data.positionLabel }];
    for (const extra of data.extraRows || []) {
      positionRows.push({ icon: "📝", label: extra.label, value: extra.value });
    }
    const y2 = drawSection(
      ctx,
      x,
      y,
      w,
      {
        icon: "💼",
        title: "Position Details",
        color1: "#149a3f",
        color2: "#3fd06b",
        rows: positionRows
      },
      maxY
    );
    if (y2) y = y2 + 24;

    drawSection(
      ctx,
      x,
      y,
      w,
      {
        icon: "📊",
        title: "Ticket Status",
        color1: "#c62828",
        color2: "#ef5350",
        rows: [
          { icon: "✅", label: "Status", value: data.statusLabel },
          { icon: "🧑‍💻", label: "Claimed By", value: data.claimedLabel },
          { icon: "⏰", label: "Opened", value: data.openedLabel }
        ]
      },
      maxY
    );


    ctx.textAlign = "center";
    ctx.font = font(30, 600);
    ctx.fillStyle = "#d9d4f2";
    ctx.fillText("⏱️  This ticket will auto-close in 12 hours if there is no reply.", W / 2, 972);
    ctx.font = font(34, 800);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("🎧  Tickets Support Team", W / 2, 1022);
    ctx.font = font(26, 500);
    ctx.fillStyle = "rgba(233,228,255,0.75)";
    ctx.fillText("We're here to help you!", W / 2, 1056);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[ticketCard] render failed:", err.message);
    return null;
  }
}

module.exports = { isAvailable, renderTicketCard };
