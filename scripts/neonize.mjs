/*
  Turns the hand-drawn brand art into the site's neon-green hero assets.

  The source art lives in the APP repo (../shadynotes/design/logo/app-icon/),
  which the site does not build against — so this is a one-shot generator whose
  OUTPUT is committed into src/assets/. Re-run it only when the source art
  changes:

      node scripts/neonize.mjs

  Emits two things: the hero illustration, and the browser-tab icon.

  The nav/footer mark is NOT here — Logo.astro uses the same source art as a CSS
  mask so it can inherit currentColor, which a pre-coloured PNG could not. The
  favicon cannot do that (no CSS reaches a tab icon), so it is baked.
*/
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../../shadynotes/design/logo/app-icon");
const OUT = join(here, "../src/assets");

// --color-brand-accent, and the cool end of the band the fills get mapped into.
const NEON = [0x00, 0xff, 0x66];
const SAT = 1.75; // how hard fills are pushed away from grey toward their own hue

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/*
  `scale` supersamples before the edge pass. The sources are 1024², and the beach
  scene's alpha box is only ~712 of that — displayed at 32rem that is 1.4x, which
  is visibly soft on a retina panel where the whole look is thin bright lines.
  Upscaling first (lanczos, so the drawn curves stay smooth) and running Sobel at
  2x yields a ~1424px asset. Gradients halve when you double the sampling, so
  edgeGain has to roughly double to match — see the call site.
*/
async function load(name, scale = 1) {
  let pipe = sharp(join(SRC, name)).ensureAlpha();
  if (scale !== 1) {
    const m = await sharp(join(SRC, name)).metadata();
    pipe = pipe.resize(Math.round(m.width * scale), Math.round(m.height * scale), {
      kernel: "lanczos3",
    });
  }
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/*
  Deterministic PRNG. The digit grid must be identical on every run, or each
  regeneration produces a different asset and the repo churns a 440KB binary for
  no reason.
*/
function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/*
  The binary-code fill texture: a grid of 0s and 1s rasterised through sharp's
  SVG renderer, returned as a 0..1 mask.

  `floor` is the level BETWEEN glyphs. It is not zero on purpose — at zero the
  panels read as isolated digits floating in holes rather than as a lit surface
  seen through code, which is the thing that makes the reference look like a
  screen and not a stencil.
*/
async function codeTexture(w, h, { cell = 24, rowH = 30, fontSize = 25, floor = 0.26, seed = 7 } = {}) {
  const rand = rng(seed);
  const cols = Math.ceil(w / cell);
  const rowsN = Math.ceil(h / rowH);
  const glyphs = [];
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < cols; c++) {
      // A scatter of blanks keeps the grid from reading as a regular dot screen.
      if (rand() < 0.08) continue;
      const o = (0.55 + rand() * 0.45).toFixed(2);
      glyphs.push(
        `<text x="${c * cell}" y="${r * rowH + fontSize}" opacity="${o}">${rand() < 0.5 ? 0 : 1}</text>`,
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <g font-family="monospace" font-size="${fontSize}" fill="#fff">${glyphs.join("")}</g>
  </svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Float32Array(w * h);
  for (let p = 0; p < mask.length; p++) {
    const i = p * info.channels;
    mask[p] = floor + (1 - floor) * (data[i + 3] / 255) * (data[i] / 255);
  }
  return mask;
}

// Separable [1,4,6,4,1]/16 blur, ~sigma 1. Run over the luminance field before
// the edge pass: the source art carries a fine paper texture that Sobel happily
// promotes to neon speckle, very visibly so once supersampled.
function blur(src, w, h) {
  const k = [1, 4, 6, 4, 1];
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, wt = 0;
      for (let d = -2; d <= 2; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= w) continue;
        sum += src[y * w + xx] * k[d + 2];
        wt += k[d + 2];
      }
      tmp[y * w + x] = sum / wt;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, wt = 0;
      for (let d = -2; d <= 2; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= h) continue;
        sum += tmp[yy * w + x] * k[d + 2];
        wt += k[d + 2];
      }
      dst[y * w + x] = sum / wt;
    }
  }
  return dst;
}

/*
  Outlines come from the artist's OWN pen strokes, not from a synthesised edge
  band.

  The first version of this ran Sobel over luminance. That looks right on the
  canopy but wrong on the chair: a Sobel skirt is about as wide as the feature
  that produced it, so a 20px wooden strut lights up across its whole width and
  renders as a solid bar no matter how hard the response curve is tuned. Three
  rounds of gain/gamma tweaking moved it barely at all, because width was never
  the parameter being adjusted.

  This drawing already contains its line work: the strokes are near-black
  (L ≈ 0.1-0.25) while every fill — wood at 0.38, fabric above 0.5 — is lighter.
  Thresholding luminance recovers those strokes at their true drawn width, which
  is what makes the result read as line art with a glow rather than as tubing.

  The inkLo/inkHi window is the one knob that matters. Too tight (0.10-0.34) and
  the canopy ribs and frame detail drop out, since they are drawn in a mid tone
  rather than black; too loose (0.16-0.52) and the wooden struts fill in solid
  again. 0.14-0.44 keeps the structure and stays off the fills.

  Sobel survives for one job only: `rim`, run over the ALPHA channel, gives the
  outer contour against the transparent background, where there is no pen stroke
  to find.
*/
function scene(
  { data, w, h },
  {
    inkLo = 0.14,
    inkHi = 0.44,
    rimGain = 5,
    rimGamma = 2.2,
    edgeGamma = 1,
    fillGain = 1.4,
    preBlur = 0,
    code,
  } = {},
) {
  let L = new Float32Array(w * h);
  let A = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    L[p] = lum(data[i], data[i + 1], data[i + 2]);
    A[p] = data[i + 3] / 255;
  }
  // Knocks back the source's paper texture before it can be mistaken for ink.
  for (let i = 0; i < preBlur; i++) L = blur(L, w, h);
  const Ab = blur(A, w, h);

  const out = Buffer.alloc(w * h * 4);
  const at = (f, x, y) => f[y * w + x];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;

      // Pen strokes: dark pixels inside the artwork.
      const ink = A[p] > 0.4 ? clamp01((inkHi - L[p]) / (inkHi - inkLo)) : 0;

      // Outer contour: the alpha silhouette.
      let rim = 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const gx =
          at(Ab, x - 1, y - 1) + 2 * at(Ab, x - 1, y) + at(Ab, x - 1, y + 1) -
          (at(Ab, x + 1, y - 1) + 2 * at(Ab, x + 1, y) + at(Ab, x + 1, y + 1));
        const gy =
          at(Ab, x - 1, y - 1) + 2 * at(Ab, x, y - 1) + at(Ab, x + 1, y - 1) -
          (at(Ab, x - 1, y + 1) + 2 * at(Ab, x, y + 1) + at(Ab, x + 1, y + 1));
        rim = clamp01(Math.hypot(gx, gy) * rimGain) ** rimGamma;
      }

      const edge = clamp01(Math.max(ink, rim)) ** edgeGamma;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const a = A[p];

      /*
        The art's soft ground shadow is OPAQUE near-neutral grey (~165,169,181),
        not alpha. Tinting it green leaves a murky quad under the chair, and
        merely blacking out its colour would be worse still — it would stay
        opaque and punch a hole in the rain behind it. So key on chroma and drop
        the pixel's alpha too, keeping only whatever edge runs through it.
        Chroma, not blue-minus-red: the magenta canopy panel is neutral by
        (b - r) and would be suppressed along with the shadow.
      */
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const shadow = chroma < 30 && L[p] > 0.5 ? 0 : 1;

      /*
        Fills are the artwork seen THROUGH falling code, so the surface keeps its
        own hue instead of being collapsed into one flat green: normalise the
        pixel to its brightest channel to recover the hue, push saturation, then
        lift green so the whole picture still reads matrix. Crushing every panel
        to a green duotone here is what made the canopy's rainbow disappear.
      */
      const mx = Math.max(r, g, b) || 1;
      let hr = r / mx, hg = g / mx, hb = b / mx;
      const avg = (hr + hg + hb) / 3;
      hr = clamp01(avg + (hr - avg) * SAT);
      hg = clamp01(avg + (hg - avg) * SAT);
      hb = clamp01(avg + (hb - avg) * SAT);
      hg = clamp01(hg * 1.12 + 0.1);

      /*
        Weight fill by chroma. The reference reads light because its luminous
        code surfaces are the FABRIC — canopy panels, chair sling — while the
        wooden frame is dark and defined by its outline alone. Filling both
        equally turns every strut into a solid glowing bar and the drawing gets
        heavy, whatever the outlines are doing.
      */
      const sat = clamp01(chroma / 80);
      const fill = L[p] ** 0.9 * fillGain * (0.25 + 0.75 * sat) * a * shadow * code[p];

      out[i] = Math.min(255, hr * 255 * fill + NEON[0] * edge);
      out[i + 1] = Math.min(255, hg * 255 * fill + NEON[1] * edge);
      out[i + 2] = Math.min(255, hb * 255 * fill + NEON[2] * edge);
      out[i + 3] = Math.min(255, Math.max(data[i + 3] * shadow, edge * 255));
    }
  }
  return { out, w, h };
}

// Separable max filter — grows the ink mask by `r` pixels each way.
function dilate(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w && src[y * w + xx] > m) m = src[y * w + xx];
      }
      tmp[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < h && tmp[yy * w + x] > m) m = tmp[yy * w + x];
      }
      dst[y * w + x] = m;
    }
  return dst;
}

/*
  The browser-tab icon: the neon mark on the brand tile.

  Its own generator rather than a resize of the nav mark, because a favicon is
  read at 16px. The source strokes are ~7px in a 1024² frame, which is a tenth
  of a pixel once the whole drawing fits in 16 — they average away to nothing.
  `grow` dilates the ink at source resolution so something survives, and the
  gamma lifts what is left. Values are deliberately far heavier than Logo.astro
  uses at 26px.
*/
async function faviconMark({ data, w, h }, { grow = 14, gamma = 0.6 } = {}) {
  let ink = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    ink[p] = clamp01(1 - lum(data[i], data[i + 1], data[i + 2])) * (data[i + 3] / 255);
  }
  ink = dilate(ink, w, h, grow);

  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < ink.length; p++) {
    const i = p * 4;
    out[i] = NEON[0];
    out[i + 1] = NEON[1];
    out[i + 2] = NEON[2];
    out[i + 3] = Math.round(clamp01(ink[p] ** gamma) * 255);
  }
  return { out, w, h };
}

/*
  Both sources are 1024² with the drawing floating in a lot of empty space — the
  beach scene only really occupies the middle ~66% x 63%. Shipped untrimmed, a
  CSS width of 32rem renders a ~340px drawing inside 512px of nothing, so the
  art looks small and the layout cannot be reasoned about. Crop to the alpha
  bounding box (plus a hair of margin so the outer glow is not clipped) and the
  asset's box IS the drawing.
*/
function trim({ out, w, h }, margin = 0.015) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { out, w, h };
  const pad = Math.round(Math.max(w, h) * margin);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return { out, w, h, box: { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}

/*
  Code raining off the canopy hem.

  For each column, walk down until the artwork starts, then until it stops: that
  first opaque run is the canopy (it is the topmost thing in the frame across
  almost the whole width), and its lower edge is the hem. Streaks are hung from
  there, sampling the same digit grid as the fills so the falling code lines up
  with the code on the panels.

  Guards matter here. Without the yTop/length tests, columns that miss the canopy
  entirely — past its left and right tips — start their streak at the deck chair,
  the side table or a shell, and the scene ends up dripping from the furniture.
*/
function addDrips(out, { data, w, h }, code, { every = 20, chance = 0.86, gain = 1.0, seed = 11 } = {}) {
  const rand = rng(seed);
  const opaqueAt = (x, y) => data[(y * w + x) * 4 + 3] > 128;

  for (let x = 0; x < w; x += every) {
    if (rand() > chance) continue;

    let yTop = -1;
    for (let y = 0; y < h; y++) {
      if (opaqueAt(x, y)) { yTop = y; break; }
    }
    // No canopy in this column, or the first thing we hit is too far down the
    // frame to be it.
    if (yTop < 0 || yTop > h * 0.55) continue;

    let yBot = yTop;
    while (yBot < h && opaqueAt(x, yBot)) yBot++;
    if (yBot - yTop < 20 || yBot > h * 0.75) continue;

    const len = Math.round(h * (0.08 + rand() * 0.34));
    const width = Math.max(1, Math.round(every * 0.55));

    for (let d = 0; d < len; d++) {
      const y = yBot + d;
      if (y >= h) break;
      const fade = (1 - d / len) ** 1.35;
      for (let dx = 0; dx < width; dx++) {
        const xx = x + dx;
        if (xx >= w) break;
        const p = y * w + xx;
        const i = p * 4;
        const v = clamp01(code[p] * fade * gain);
        if (v <= 0.02) continue;
        out[i] = Math.min(255, out[i] + NEON[0] * v);
        out[i + 1] = Math.min(255, out[i + 1] + NEON[1] * v);
        out[i + 2] = Math.min(255, out[i + 2] + NEON[2] * v);
        out[i + 3] = Math.min(255, Math.max(out[i + 3], v * 255));
      }
    }
  }
  return out;
}

async function write(img, size, name) {
  const { out, w, h, box } = trim(img);
  let pipe = sharp(out, { raw: { width: w, height: h, channels: 4 } });
  if (box) pipe = pipe.extract(box);
  pipe = pipe.resize(size, size, { fit: "inside", withoutEnlargement: true });
  // The beach scene is a 1431px alpha image; as PNG that is ~2MB of repo for an
  // asset the build immediately re-encodes anyway. WebP keeps the alpha and
  // costs about a tenth of it. The 256px mark stays PNG — at that size the
  // difference is a few KB and PNG stays exactly lossless.
  pipe = name.endsWith(".webp")
    ? pipe.webp({ quality: 90, alphaQuality: 100, effort: 6 })
    : pipe.png({ compressionLevel: 9 });
  const info = await pipe.toFile(join(OUT, name));
  console.log("wrote", name, `${info.width}x${info.height}`, `${(info.size / 1024) | 0}KB`);
}

/*
  NOTE the _cutout suffixes. shadynotes_logo.png and shadynotes_menu_bar_icon.png
  are 100% opaque: their "transparent" background is a checkerboard PATTERN baked
  in as real pixels. Running the Sobel pass over those lights every checker seam
  up as neon and buries the artwork in a green grid. The _cutout siblings are the
  same drawings with the alpha actually cut.
*/
const heroSrc = await load("shadynotes_logo_cutout.png", 2);
const heroCode = await codeTexture(heroSrc.w, heroSrc.h);
const heroImg = scene(heroSrc, { preBlur: 2, code: heroCode });
addDrips(heroImg.out, heroSrc, heroCode);
await write(heroImg, 1440, "hero-beach-neon.webp");

// --- social card (og:image) ----------------------------------------------
/*
  The card that renders in Slack, iMessage, Twitter and Google's preview.

  Composed here rather than hand-drawn so it cannot drift from the palette
  again: every colour is the same literal the @theme block uses.

  Font families are the ones the SITE's stacks name AND that this renderer can
  actually resolve — checked, not assumed. "SF Mono" and "DejaVu Sans Mono"
  silently fall back to a sans here, which would have set the headline in the
  wrong face; "Menlo" and "Avenir Next" resolve properly.
*/
async function ogImage() {
  const W = 1200;
  const H = 630;
  const rand = rng(23);

  // Matrix rain, right side only, faded in so it never crowds the copy.
  let rain = "";
  for (let x = 580; x < W; x += 15) {
    const edge = Math.min(1, (x - 580) / 280);
    for (let y = 34; y < H; y += 19) {
      if (rand() < 0.22) continue;
      const o = (0.07 + rand() * 0.3) * edge;
      rain += `<text x="${x}" y="${y}" font-family="Menlo, monospace" font-size="13" fill="#00ff66" opacity="${o.toFixed(2)}">${rand() < 0.5 ? 0 : 1}</text>`;
    }
  }

  // Perspective floor, clipped to the right so it stays off the footer text.
  const VY = 500;
  const VX = 950;
  let floor = "";
  for (let i = -10; i <= 10; i++) {
    floor += `<line x1="${VX}" y1="${VY}" x2="${VX + i * 150}" y2="${H}" stroke="#00ff66" stroke-width="1" opacity="0.28"/>`;
  }
  for (let j = 1; j <= 9; j++) {
    const y = VY + (H - VY) / (1 + j * 0.55) ;
    floor += `<line x1="620" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#00ff66" stroke-width="1" opacity="0.22"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <clipPath id="floorClip"><rect x="620" y="${VY}" width="${W - 620}" height="${H - VY}"/></clipPath>
      <radialGradient id="glow" cx="0.78" cy="0.35" r="0.6">
        <stop offset="0%" stop-color="#00ff66" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#00ff66" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="${W}" height="${H}" fill="#030f0a"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <g clip-path="url(#floorClip)">${floor}</g>
    ${rain}

    <!-- The shade pulled down from the top, and its amber tab. Amber survives
         here for the same reason it survives on the buttons: it is the one
         colour that reads instantly against the green-black. -->
    <rect x="0" y="0" width="${W}" height="7" fill="#ffc107"/>
    <rect x="556" y="7" width="88" height="22" rx="9" fill="#ffc107"/>

    <text x="156" y="158" font-family="Avenir Next, sans-serif" font-size="40" font-weight="700" fill="#d6f5e3">Shady Notes</text>

    <text x="80" y="336" font-family="Menlo, monospace" font-size="56" font-weight="700" fill="#d6f5e3">Notes, a <tspan fill="#ffc107">scroll</tspan></text>
    <text x="80" y="404" font-family="Menlo, monospace" font-size="56" font-weight="700" fill="#d6f5e3">away.</text>

    <text x="80" y="456" font-family="Avenir Next, sans-serif" font-size="24" fill="#5f937a">A macOS markdown notepad that lives in the menu bar.</text>

    <line x1="80" y1="556" x2="1120" y2="556" stroke="#2a4d3b" stroke-width="1"/>
    <text x="80" y="594" font-family="Menlo, monospace" font-size="23" fill="#00ff66">shadynotes.app</text>
  </svg>`;

  // The umbrella mark, and the hero illustration on the right.
  const markImg = await faviconMark(await load("shadynotes_menu_bar_icon_cutout.png"), { grow: 7, gamma: 0.75 });
  const mt = trim(markImg, 0.01);
  let mp = sharp(mt.out, { raw: { width: mt.w, height: mt.h, channels: 4 } });
  if (mt.box) mp = mp.extract(mt.box);
  const mark = await mp.resize(58, 58, { fit: "inside" }).png().toBuffer();

  const art = await sharp(join(OUT, "hero-beach-neon.webp"))
    .resize(430, 380, { fit: "inside" })
    .png()
    .toBuffer();
  const artMeta = await sharp(art).metadata();

  await sharp(Buffer.from(svg))
    .composite([
      { input: mark, left: 80, top: 112 },
      { input: art, left: 1150 - artMeta.width, top: Math.round((H - artMeta.height) / 2) - 10 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(here, "../public/og-cover.png"));
  console.log("wrote og-cover.png", `${W}x${H}`);
}

// --- browser tab icon -------------------------------------------------------
{
  const SIZE = 128;
  const img = await faviconMark(await load("shadynotes_menu_bar_icon_cutout.png"));
  const { out, w, h, box } = trim(img, 0.005);
  let pipe = sharp(out, { raw: { width: w, height: h, channels: 4 } });
  if (box) pipe = pipe.extract(box);
  // Inset so the mark is not flush against the tile's rounded corners.
  const mark = await pipe.resize(92, 92, { fit: "inside" }).png().toBuffer();
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
      `<rect width="${SIZE}" height="${SIZE}" rx="28" fill="#030f0a"/></svg>`,
  );
  await sharp(tile)
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(join(here, "../public/favicon.png"));
  console.log("wrote favicon.png", `${SIZE}x${SIZE}`);
}

await ogImage();
