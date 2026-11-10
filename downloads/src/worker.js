// Runs only for /media/* (see run_worker_first in wrangler.jsonc). Workers static
// assets answer a Range request with the whole file (200), and Safari will not
// play <video> without 206 partial responses — so slice the asset here.
// Everything else is served by the static asset layer directly.
export default {
  async fetch(request, env) {
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
  },
};
