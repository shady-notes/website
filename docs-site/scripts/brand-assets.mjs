/*
  Regenerates the docs site's brand assets in the cyber/matrix palette:

      node scripts/brand-assets.mjs

  Deliberately its OWN script rather than an import from site/scripts/. docs-site
  and site are independent workspaces on different Astro majors with independent
  deploys — the same reason docs.css duplicates six hex values instead of sharing
  a package. Coupling two build pipelines to save a hundred lines is the wrong
  trade here, and the note in docs.css already establishes the convention:
  if the brand changes, change it in both places.

  The three marks are recoloured, not redrawn. logo.png and logo-hero.png are a
  single flat colour over an alpha channel, so painting new RGB and keeping the
  alpha reproduces the artwork exactly — including the stroke dilation that was
  tuned for the header size. Recolouring from the alpha also makes this
  idempotent: re-running on already-green files is a no-op, not a compounding
  tint.

  The favicon is NOT generated here. It is copied byte-for-byte from
  site/public/favicon.png, which astro.config.mjs relies on — one tab icon
  across both origins.
*/
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const siteRoot = join(here, "../../site");

const NEON = { r: 0x00, g: 0xff, b: 0x66 };
const BG = "#030f0a";
const AMBER = "#ffc107";
const FG = "#d6f5e3";
const MUTED = "#5f937a";
const LINE = "#2a4d3b";

/** Repaint every pixel's RGB, preserving alpha (and therefore antialiasing). */
async function recolour(relPath) {
  const file = join(root, relPath);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = NEON.r;
    data[i + 1] = NEON.g;
    data[i + 2] = NEON.b;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log("recoloured", relPath, `${info.width}x${info.height}`);
}

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/*
  The docs social card. Same construction as the marketing site's — see
  site/scripts/neonize.mjs for the font note: "Menlo" and "Avenir Next" resolve
  in this renderer, "SF Mono" silently falls back to a sans.
*/
async function ogCard() {
  const W = 1200;
  const H = 630;
  const rand = rng(31);

  let rain = "";
  for (let x = 560; x < W; x += 15) {
    const edge = Math.min(1, (x - 560) / 280);
    for (let y = 34; y < H; y += 19) {
      if (rand() < 0.22) continue;
      const o = (0.07 + rand() * 0.3) * edge;
      rain += `<text x="${x}" y="${y}" font-family="Menlo, monospace" font-size="13" fill="#00ff66" opacity="${o.toFixed(2)}">${rand() < 0.5 ? 0 : 1}</text>`;
    }
  }

  const VY = 470;
  const VX = 900;
  let floor = "";
  for (let i = -10; i <= 10; i++) {
    floor += `<line x1="${VX}" y1="${VY}" x2="${VX + i * 150}" y2="${H}" stroke="#00ff66" stroke-width="1" opacity="0.26"/>`;
  }
  for (let j = 1; j <= 9; j++) {
    const y = VY + (H - VY) / (1 + j * 0.55);
    floor += `<line x1="600" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#00ff66" stroke-width="1" opacity="0.2"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <clipPath id="fc"><rect x="600" y="${VY}" width="${W - 600}" height="${H - VY}"/></clipPath>
      <radialGradient id="glow" cx="0.8" cy="0.35" r="0.6">
        <stop offset="0%" stop-color="#00ff66" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#00ff66" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <g clip-path="url(#fc)">${floor}</g>
    ${rain}

    <rect x="0" y="0" width="${W}" height="7" fill="${AMBER}"/>
    <rect x="556" y="7" width="88" height="22" rx="9" fill="${AMBER}"/>

    <text x="176" y="158" font-family="Avenir Next, sans-serif" font-size="40" font-weight="700" fill="${FG}">Shady Notes</text>
    <rect x="176" y="182" width="86" height="32" rx="16" fill="#00ff66"/>
    <text x="219" y="204" text-anchor="middle" font-family="Menlo, monospace" font-size="16" font-weight="700" fill="${BG}">Docs</text>

    <text x="80" y="356" font-family="Menlo, monospace" font-size="60" font-weight="700" fill="${FG}">Documentation</text>
    <text x="80" y="412" font-family="Avenir Next, sans-serif" font-size="25" fill="${MUTED}">Everything Shady Notes does, and how to do it.</text>

    <line x1="80" y1="556" x2="1120" y2="556" stroke="${LINE}" stroke-width="1"/>
    <text x="80" y="594" font-family="Menlo, monospace" font-size="23" fill="#00ff66">docs.shadynotes.app</text>
  </svg>`;

  const mark = await sharp(join(root, "src/assets/logo-hero.png"))
    .resize(78, 78, { fit: "inside" })
    .png()
    .toBuffer();

  await sharp(Buffer.from(svg))
    .composite([{ input: mark, left: 80, top: 104 }])
    .png({ compressionLevel: 9 })
    .toFile(join(root, "public/og-cover.png"));
  console.log("wrote public/og-cover.png", `${W}x${H}`);
}

// Only src/assets — SiteTitle.astro now takes the header mark from the virtual
// images module, so astro.config.mjs's logo.src is the single definition and the
// duplicate that used to sit in public/ is gone.
await recolour("src/assets/logo.png");
await recolour("src/assets/logo-hero.png");

// astro.config.mjs asserts this is byte-identical to the marketing site's.
await copyFile(join(siteRoot, "public/favicon.png"), join(root, "public/favicon.png"));
console.log("copied favicon.png from site/public/favicon.png");

await ogCard();
