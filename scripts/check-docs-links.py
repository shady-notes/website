"""Validate links in the built docs site.

Internal links are checked against the actual build output, so a page that
renames a route breaks the check rather than shipping a 404. Outbound links to
shadynotes.app are listed but only network-checked with --external, because the
common case (a local build, or CI with no egress) should not depend on the
network.

Usage:
    python3 scripts/check-docs-links.py docs-site/dist [--external]
"""
import pathlib
import re
import sys

dist = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "docs-site/dist")
check_external = "--external" in sys.argv

if not dist.exists():
    sys.exit(f"✗ {dist} not found — run `make docs-build` first")


def route(p: pathlib.Path) -> str:
    rel = str(p.parent.relative_to(dist)).replace(".", "")
    return ("/" + rel + "/").replace("//", "/")


pages = {route(p) for p in dist.rglob("index.html")}
broken, external = [], set()

for f in sorted(dist.rglob("index.html")):
    src = route(f)
    html = f.read_text(encoding="utf-8")
    # Anchors only. A bare href= regex also picks up <link rel="canonical">,
    # which is a self-reference on every page and not a navigable link.
    for href in re.findall(r'<a\b[^>]*?href="([^"]+)"', html):
        if href.startswith(("/_astro", "/pagefind", "mailto:", "#", "javascript:")):
            continue
        if href.startswith("http"):
            external.add(href.split("#")[0])
            continue
        if not href.startswith("/"):
            continue
        clean = href.split("#")[0].split("?")[0]
        if not clean or clean in pages:
            continue
        # Non-directory assets (og-image.png, favicon.svg) are files on disk.
        if (dist / clean.lstrip("/")).exists():
            continue
        broken.append((src, href))

print(f"── internal ──\n  {len(pages)} pages")
if broken:
    print(f"  ✗ {len(broken)} broken:")
    for s, h in broken:
        print(f"      {s}  ->  {h}")
else:
    print("  ✓ no broken internal links")

print(f"── outbound ──\n  {len(external)} distinct external URLs")
fail = bool(broken)

if check_external:
    import urllib.error
    import urllib.request
    for url in sorted(external):
        try:
            req = urllib.request.Request(url, method="HEAD",
                                         headers={"User-Agent": "shadynotes-docs-linkcheck"})
            code = urllib.request.urlopen(req, timeout=15).status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # noqa: BLE001 - report and continue
            print(f"  ✗ {url} — {type(e).__name__}")
            fail = True
            continue
        mark = "✓" if code < 400 else "✗"
        if code >= 400:
            fail = True
        print(f"  {mark} {code} {url}")
else:
    for url in sorted(external):
        print(f"    {url}")
    print("  (pass --external to check these over the network)")

sys.exit(1 if fail else 0)
