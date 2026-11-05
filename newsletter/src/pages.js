// The small HTML pages behind the links in emails. Every state change is a
// POST from a button on one of these pages: mail scanners prefetch GET links,
// so a GET must never confirm, unsubscribe or resubscribe anyone.
import { SITE, CONTACT } from "./config.js";

/** @param {unknown} s */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const CSS = `
:root{color-scheme:light dark;--paper:#fff;--ink:#000;--muted:#555;--accent:#ffd60a;--line:rgb(0 0 0/22%)}
@media (prefers-color-scheme:dark){:root{--paper:#111;--ink:#f5f5f5;--muted:#b5b5b5;--line:rgb(255 255 255/25%)}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif}
main{max-width:34rem;margin:0 auto;padding:4rem 1rem}
.brand{font-weight:700;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
h1{font-size:28px;line-height:1.15;letter-spacing:-.025em;margin:2rem 0 1rem}
p{margin:0 0 1rem}
.muted{color:var(--muted);font-size:15px}
button{font:inherit;font-weight:600;min-height:44px;padding:.6rem 1.4rem;border-radius:999px;border:1px solid var(--ink);background:var(--accent);color:#000;cursor:pointer}
button.secondary{background:transparent;color:var(--ink)}
a{color:inherit}
form{margin:1.5rem 0}
`;

/**
 * @param {string} title
 * @param {string} bodyHtml already-escaped HTML
 * @param {number} [status]
 */
export function page(title, bodyHtml, status = 200) {
  const html = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — Shady Notes</title>
<style>${CSS}</style>
</head>
<body>
<main>
<a class="brand" href="${SITE}/">Shady Notes</a>
<h1>${esc(title)}</h1>
${bodyHtml}
<p class="muted">Questions? Write to <a href="mailto:${CONTACT}">${CONTACT}</a>. See the <a href="${SITE}/privacy#newsletter">privacy policy</a>.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

/** A page whose only action is one POST button back to the same URL. */
export function buttonPage(title, introHtml, buttonLabel, action, secondary = false) {
  return page(
    title,
    `${introHtml}
<form method="post" action="${esc(action)}"><button type="submit"${secondary ? ' class="secondary"' : ""}>${esc(buttonLabel)}</button></form>`,
  );
}
