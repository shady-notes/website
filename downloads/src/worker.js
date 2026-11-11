// Runs only for the paths in run_worker_first (wrangler.jsonc):
//
//   /media/*        byte ranges for the brand film (below)
//   /macos/*.dmg    a daily download count, then the file as-is
//
// Everything else (appcast, deltas, healthz) is served by the static asset
// layer directly and never reaches this code.

const DMG = /^\/macos\/(ShadyNotes(?:-[0-9][0-9.]*)?\.dmg)$/;

// Crawlers and link-preview fetchers. Plain curl/wget stay in ("other"):
// people do download DMGs with them.
const BOT = /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|headlesschrome|lighthouse/i;

/**
 * Who is downloading: the campaign cares about "site" (a person in a browser).
 * @param {string | null} ua
 * @returns {"site" | "update" | "homebrew" | "other" | null} null = don't count
 */
export function kindOf(ua) {
  if (!ua || BOT.test(ua)) return null;
  if (/Sparkle\//.test(ua)) return "update";
  if (/Homebrew\//.test(ua)) return "homebrew";
  if (/^Mozilla\//.test(ua)) return "site";
  return "other";
}

/**
 * Count a download once: a full GET, or a ranged GET that starts at byte 0.
 * Resumed and chunked downloads send later ranges; those are the same download.
 * @param {Request} request
 */
export function countable(request) {
  if (request.method !== "GET") return false;
  const range = request.headers.get("Range");
  return !range || /^bytes=0-/.test(range.trim());
}

/** @param {any} env @param {string} file @param {string} kind */
export async function count(env, file, kind) {
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO downloads (day, file, kind, n) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (day, file, kind) DO UPDATE SET n = n + 1`,
  )
    .bind(day, file, kind)
    .run();
}

// Workers static assets answer a Range request with the whole file (200), and
// Safari will not play <video> without 206 partial responses — so slice the
// asset here.
async function media(request, env) {
  const range = request.headers.get("Range");
  const plain = new Request(request.url, { method: request.method === "HEAD" ? "HEAD" : "GET" });
  const res = await env.ASSETS.fetch(plain);
  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  const m = range && res.status === 200 && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || request.method === "HEAD") return new Response(res.body, { status: res.status, headers });

  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    headers.set("Content-Range", `bytes */${size}`);
    headers.delete("Content-Length");
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}

export default {
  /** @param {Request} request @param {any} env @param {ExecutionContext} ctx */
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/media/")) return media(request, env);

    // The file is served exactly as the asset layer would serve it; the count
    // never delays or breaks the download.
    const res = await env.ASSETS.fetch(request);
    const m = DMG.exec(pathname);
    if (m && res.ok && env.DB && countable(request)) {
      const kind = kindOf(request.headers.get("user-agent"));
      if (kind) ctx.waitUntil(count(env, m[1], kind).catch(() => {}));
    }
    return res;
  },
};
