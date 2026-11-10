# Shady Notes — ops shortcuts for everything this repo deploys. Run from the repo root.
#
# This repo replaced `shadynotes-hostinger` on 2026-11-10, when the Hostinger VPS shut
# down. What lives where:
#
#   shadynotes.app            the Astro site (repo root)   GitHub Pages, deployed by Actions on push to main
#   subscribe.shadynotes.app  newsletter/                  Worker `subscribe`          (cd newsletter && npx wrangler deploy)
#   api.shadynotes.app        api/                         Worker `shadynotes-api`     make api-deploy
#   docs.shadynotes.app       docs-site/                   Worker `shadynotes-docs`    make docs-deploy
#   downloads.shadynotes.app  downloads/                   Worker `shadynotes-downloads` (the app repo's `make publish`)
#
# Expects the app repo and the brand media checked out NEXT TO this repo:
#   ../shadynotes   (github.com/johnoscott/shadynotes)  ../brand  (local only, not in git)
#
#   make verify          Check the apex serves the live site (GitHub Pages behind Cloudflare)
#   make verify-download Check the download button serves the current, universal release
#   make verify-api      Check api.shadynotes.app answers and rejects bad tokens
#   make api-test        Run the entitlement Worker's tests
#   make api-deploy      Test + deploy the entitlement Worker
#   make downloads-deploy  Re-stage + deploy downloads.shadynotes.app from ../shadynotes/dist
#   make docs-build      Build the Starlight docs site locally into docs-site/dist
#   make docs-deploy     Build origin/main + deploy the DOCS Worker
#   make verify-docs     Check docs.shadynotes.app serves correctly (and the site still does)
#   make docs-check      Run every docs check: build, links, budget, freshness
#   make docs-shots      Capture the documentation screenshots from the installed app
#   make film-encode     Encode the brand film renditions into ../brand/promo-videos/web
#   make film-publish    Deploy those renditions to downloads.shadynotes.app/media
#   make verify-film     Check the film renditions the site points at
#   make cask-release    Build + notarize the app DMG, upload to GitHub Releases, bump the tap cask

SHELL := /bin/bash
.DEFAULT_GOAL := help

SITE     := https://shadynotes.app
DOCS     := https://docs.shadynotes.app
API      := https://api.shadynotes.app
APP_REPO := ../shadynotes

.PHONY: help build verify verify-download verify-api api-test api-deploy downloads-deploy \
        docs-build docs-deploy verify-docs docs-shots docs-shots-budget docs-shots-wired docs-linkcheck \
        docs-freshness docs-check film-encode film-publish verify-film cask-release

help:
	@sed -n '/^#   make /s/^#   //p' $(MAKEFILE_LIST)

# Build the static site locally (sanity-check before pushing; Actions deploys main).
build:
	npm run build

# Confirm the live shape: apex = the real site (NOT coming-soon, NOT noindex),
# served by GitHub Pages through Cloudflare. Inverted at the 2026-08-10 launch flip —
# before that the apex was expected to BE the coming-soon page. The preview alias
# was retired on 2026-10-19 along with the VPS copy of the site.
verify:
	@echo "── public apex ──"
	@fail=0; \
	code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $(SITE)/ 2>/dev/null); \
	echo "  $(SITE)/ → HTTP $$code"; \
	if [ "$$code" != "200" ]; then echo "  ✗ apex is not answering 200"; fail=1; fi; \
	if curl -s --max-time 10 $(SITE)/ 2>/dev/null | grep -qi 'coming soon'; then \
	  echo "  ✗ apex STILL shows coming-soon (deploy may still be building)"; fail=1; \
	else \
	  echo "  ✓ apex serves the real site"; \
	fi; \
	pcode=$$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 15 $(SITE)/pricing 2>/dev/null); \
	echo "  $(SITE)/pricing → HTTP $$pcode (after redirects)"; \
	if [ "$$pcode" != "200" ]; then echo "  ✗ inner pages are not being served"; fail=1; fi; \
	loc=$$(curl -sI --max-time 10 $(SITE)/pricing 2>/dev/null | grep -i '^location:' | tr -d '\r' | awk '{print $$2}'); \
	case "$$loc" in \
	  http://*) echo "  ✗ /pricing redirects to $$loc — nginx is downgrading https to http"; \
	            echo "    Fix: absolute_redirect off; in the apex server block."; fail=1;; \
	  *) echo "  ✓ no scheme downgrade on the trailing-slash redirect";; \
	esac; \
	if curl -sI --max-time 10 $(SITE)/ 2>/dev/null | grep -qi 'x-robots-tag.*noindex'; then \
	  echo "  ✗ apex still sends X-Robots-Tag: noindex — it will not be indexed"; fail=1; \
	else \
	  echo "  ✓ apex is indexable (no noindex header)"; \
	fi; \
	wcode=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://www.shadynotes.app/pricing 2>/dev/null); \
	wloc=$$(curl -sI --max-time 10 https://www.shadynotes.app/pricing 2>/dev/null | grep -i '^location:' | tr -d '\r' | awk '{print $$2}'); \
	echo "  www/pricing → HTTP $$wcode → $$wloc"; \
	if [ "$$wcode" != "301" ] || [ "$$wloc" != "$(SITE)/pricing" ]; then \
	  echo "  ✗ www is not 301ing to the apex (path-preserving) — two origins serve the same content"; fail=1; \
	else \
	  echo "  ✓ www redirects to the apex, path preserved"; \
	fi; \
	hsts=$$(curl -sI --max-time 10 $(SITE)/ 2>/dev/null | grep -i '^strict-transport-security:' | tr -d '\r' | cut -d' ' -f2-); \
	if [ -z "$$hsts" ]; then \
	  echo "  ✗ apex sends no Strict-Transport-Security header"; fail=1; \
	else \
	  echo "  ✓ HSTS on apex: $$hsts"; \
	fi; \
	asset=$$(curl -s --max-time 10 $(SITE)/ 2>/dev/null | grep -oE '/_astro/[A-Za-z0-9._-]+\.(css|js)' | head -1); \
	if [ -n "$$asset" ]; then \
	  ahsts=$$(curl -sI --max-time 10 "$(SITE)$$asset" 2>/dev/null | grep -ci '^strict-transport-security:'); \
	  if [ "$$ahsts" = "0" ]; then \
	    echo "  ✗ no HSTS on $$asset — a location-level add_header cancelled the inherited one"; fail=1; \
	  else \
	    echo "  ✓ HSTS survives into /_astro/ (add_header inheritance intact)"; \
	  fi; \
	fi; \
	echo "── origin (GitHub Pages behind Cloudflare since 2026-10-12) ──"; \
	hdrs=$$(curl -sI --max-time 10 $(SITE)/ 2>/dev/null); \
	if echo "$$hdrs" | grep -qi '^server: cloudflare' && echo "$$hdrs" | grep -qi '^x-github-request-id:'; then \
	  echo "  ✓ apex is proxied by Cloudflare and served by GitHub Pages"; \
	else \
	  echo "  ✗ apex is not coming from GitHub Pages through Cloudflare — check the @ record"; \
	  echo "    (expect CNAME @ → shady-notes.github.io, proxied; guide: docs/CLOUDFLARE-DNS-PROXY-SETUP.md in the private shadynotes-hostinger repo)"; fail=1; \
	fi; \
	if [ $$fail -eq 0 ]; then echo "✓ live shape is correct"; else exit 1; fi

# Confirm the site's download button actually serves the current release.
# The site pins a versioned DMG URL (src/config/site.ts -> DMG_VERSION), so
# it can drift behind a release. This compares it against the live Sparkle
# appcast — the authoritative "what is current" — and checks the file is really
# there. A stale pin here is how an obsolete build ends up on the download page.
#
# It also checks the current release is still a UNIVERSAL build. The download
# page promises Apple Silicon *and* Intel from one DMG, which only holds while
# the app repo builds with `--arch arm64 --arch x86_64`. Drop those flags and
# the release Mac (Apple Silicon) produces an arm64-only DMG; Sparkle detects
# that and writes <sparkle:hardwareRequirements>arm64</...> into the appcast
# item. That tag is the machine-readable proof that Intel users have been cut
# off — from the fresh download *and* from every future auto-update — so treat
# its presence on the current release as a release-blocking failure.
verify-download:
	@site_ver=$$(grep -E '^const DMG_VERSION' src/config/site.ts | sed -E 's/.*"([^"]+)".*/\1/'); \
	feed=$$(curl -s --max-time 15 https://downloads.shadynotes.app/macos/appcast.xml); \
	feed_ver=$$(printf '%s\n' "$$feed" \
	  | grep -oE '<sparkle:shortVersionString>[^<]+' | head -1 | sed 's/.*>//'); \
	current_item=$$(printf '%s\n' "$$feed" \
	  | awk '/<item>/{f=1} f{print} /<\/item>/{if (f) exit}'); \
	url="https://downloads.shadynotes.app/macos/ShadyNotes-$$site_ver.dmg"; \
	echo "── download link ──"; \
	echo "  site pins    : $$site_ver"; \
	echo "  appcast says : $$feed_ver"; \
	code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$$url"); \
	echo "  $$url → HTTP $$code"; \
	fail=0; \
	if [ -z "$$feed_ver" ]; then echo "  ✗ could not read the appcast"; fail=1; \
	elif [ "$$site_ver" != "$$feed_ver" ]; then \
	  echo "  ✗ STALE: the download page offers $$site_ver but $$feed_ver is current."; \
	  echo "    Fix: set DMG_VERSION=$$feed_ver in src/config/site.ts, then a push to main."; \
	  fail=1; \
	fi; \
	if [ "$$code" != "200" ]; then echo "  ✗ that DMG is not downloadable (HTTP $$code)"; fail=1; fi; \
	echo "── architecture ──"; \
	if [ -z "$$current_item" ]; then \
	  echo "  ✗ could not read the current appcast item — architecture unverified"; fail=1; \
	elif printf '%s\n' "$$current_item" | grep -q 'sparkle:hardwareRequirements'; then \
	  req=$$(printf '%s\n' "$$current_item" \
	    | grep -oE '<sparkle:hardwareRequirements>[^<]+' | head -1 | sed 's/.*>//'); \
	  echo "  ✗ $$feed_ver is restricted to '$$req' — it is NOT a universal build."; \
	  echo "    Intel Macs cannot install it and will never be offered an update,"; \
	  echo "    while the download page tells them it works. Fix in the app repo:"; \
	  echo "    'make build' must pass --arch arm64 --arch x86_64, then re-release."; \
	  fail=1; \
	else \
	  echo "  ✓ $$feed_ver is universal (no hardwareRequirements — Apple Silicon + Intel)"; \
	fi; \
	if [ $$fail -eq 0 ]; then echo "  ✓ download page serves the current release ($$site_ver)"; else exit 1; fi

# ---------------------------------------------------------------------------
# Entitlement API (api.shadynotes.app) — Worker `shadynotes-api`, source in api/.
# Secrets CLERK_SECRET_KEY + APP_TOKEN_SECRET are set with `wrangler secret put`.
# ---------------------------------------------------------------------------

api-test:
	cd api && npm ci --silent && npm test

api-deploy: api-test
	cd api && npx wrangler deploy

# Live shape only — no real user token is needed or used.
verify-api:
	@fail=0; echo "── api ──"; \
	h=$$(curl -s --max-time 15 $(API)/healthz); echo "  /healthz → $$h"; \
	[ "$$h" = '{"ok":true}' ] || { echo "  ✗ health check failed"; fail=1; }; \
	c=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H 'Authorization: Bearer garbage' $(API)/entitlement); \
	echo "  /entitlement with a bad token → HTTP $$c (expect 401)"; [ "$$c" = 401 ] || fail=1; \
	c=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST $(API)/app/token); \
	echo "  /app/token with no session → HTTP $$c (expect 401)"; [ "$$c" = 401 ] || fail=1; \
	o=$$(curl -s -D - -o /dev/null --max-time 15 -X OPTIONS -H 'Origin: $(SITE)' $(API)/app/token | tr -d '\r' | grep -i '^access-control-allow-origin:' | cut -d' ' -f2); \
	echo "  CORS for $(SITE) → $${o:-none}"; [ "$$o" = "$(SITE)" ] || fail=1; \
	if [ $$fail -eq 0 ]; then echo "✓ api is up"; else exit 1; fi

# ---------------------------------------------------------------------------
# Downloads (downloads.shadynotes.app) — Worker `shadynotes-downloads`, source in
# downloads/. A normal release goes through the app repo's `make publish`, which
# runs the same two steps plus its own checks. This is for re-deploying as-is.
# ---------------------------------------------------------------------------

downloads-deploy:
	cd downloads && ./sync.sh && npx wrangler deploy

# ---------------------------------------------------------------------------
# Docs site (docs.shadynotes.app) — served by the Cloudflare Worker
# `shadynotes-docs` (static assets) since 2026-10. The site deploy (Actions) does NOT touch it
# and `make docs-deploy` does NOT touch the site.
# History: changes/009-CLOUDFLARE-HOSTING/ in the private shadynotes-hostinger repo (archived).
# ---------------------------------------------------------------------------

docs-build:
	npm run build --prefix docs-site

# Build origin/main and `wrangler deploy` it. See scripts/deploy-docs.sh.
docs-deploy:
	@./scripts/deploy-docs.sh

# Confirm the docs host is correct AND that standing it up did not regress the
# site. The apex check at the end is deliberate: the cheapest way to notice a
# misrouted host rule is to assert the other hosts still answer.
verify-docs:
	@echo "── docs root ──"
	@fail=0; \
	code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $(DOCS)/ 2>/dev/null); \
	echo "  $(DOCS)/ → HTTP $$code"; \
	if [ "$$code" != "200" ]; then echo "  ✗ docs root is not answering 200"; fail=1; fi; \
	if curl -sI --max-time 10 $(DOCS)/ 2>/dev/null | grep -qi 'x-robots-tag.*noindex'; then \
	  echo "  ✗ docs sends X-Robots-Tag: noindex — it will not be indexed"; fail=1; \
	else \
	  echo "  ✓ docs is indexable"; \
	fi; \
	echo "── deep page (trailing-slash redirect) ──"; \
	dcode=$$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 15 $(DOCS)/install 2>/dev/null); \
	echo "  $(DOCS)/install → HTTP $$dcode (after redirects)"; \
	if [ "$$dcode" != "200" ]; then echo "  ✗ inner pages are not being served"; fail=1; fi; \
	loc=$$(curl -sI --max-time 10 $(DOCS)/install 2>/dev/null | grep -i '^location:' | tr -d '\r' | awk '{print $$2}'); \
	case "$$loc" in \
	  http://*) echo "  ✗ /install redirects to $$loc — nginx is downgrading https to http"; \
	            echo "    Fix: absolute_redirect off; in the docs server block."; fail=1;; \
	  *) echo "  ✓ no scheme downgrade on the trailing-slash redirect";; \
	esac; \
	echo "── HSTS ──"; \
	hsts=$$(curl -sI --max-time 10 $(DOCS)/ 2>/dev/null | grep -i '^strict-transport-security:' | tr -d '\r' | cut -d' ' -f2-); \
	if [ -z "$$hsts" ]; then echo "  ✗ docs sends no Strict-Transport-Security header"; fail=1; \
	else echo "  ✓ HSTS on docs: $$hsts"; fi; \
	asset=$$(curl -s --max-time 10 $(DOCS)/ 2>/dev/null | grep -oE '/_astro/[A-Za-z0-9._-]+\.(css|js)' | head -1); \
	if [ -n "$$asset" ]; then \
	  ahsts=$$(curl -sI --max-time 10 "$(DOCS)$$asset" 2>/dev/null | grep -ci '^strict-transport-security:'); \
	  if [ "$$ahsts" = "0" ]; then \
	    echo "  ✗ no HSTS on $$asset — a location-level add_header cancelled the inherited one"; fail=1; \
	  else echo "  ✓ HSTS survives into /_astro/"; fi; \
	fi; \
	phsts=$$(curl -sI --max-time 10 $(DOCS)/pagefind/pagefind.js 2>/dev/null | grep -ci '^strict-transport-security:'); \
	if [ "$$phsts" = "0" ]; then \
	  echo "  ✗ no HSTS on /pagefind/ — the location-level add_header cancelled the inherited one"; fail=1; \
	else echo "  ✓ HSTS survives into /pagefind/"; fi; \
	echo "── search + sitemap ──"; \
	pcode=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $(DOCS)/pagefind/pagefind.js 2>/dev/null); \
	echo "  /pagefind/pagefind.js → HTTP $$pcode"; \
	if [ "$$pcode" != "200" ]; then echo "  ✗ search index is missing — Pagefind did not ship"; fail=1; fi; \
	pcache=$$(curl -sI --max-time 10 $(DOCS)/pagefind/pagefind.js 2>/dev/null | grep -i '^cache-control:' | tr -d '\r' | cut -d' ' -f2-); \
	case "$$pcache" in \
	  *immutable*) echo "  ✗ /pagefind/ is cached immutable — the index is rewritten every build"; \
	               echo "    Returning readers will search a stale index that 404s on lookup."; fail=1;; \
	  *) echo "  ✓ /pagefind/ cache policy is revalidating ($$pcache)";; \
	esac; \
	scode=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $(DOCS)/sitemap-index.xml 2>/dev/null); \
	echo "  /sitemap-index.xml → HTTP $$scode"; \
	if [ "$$scode" != "200" ]; then echo "  ✗ sitemap is missing"; fail=1; fi; \
	echo "── no regression on the existing hosts ──"; \
	acode=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $(SITE)/ 2>/dev/null); \
	echo "  $(SITE)/ → HTTP $$acode  (expect 200)"; \
	if [ "$$acode" != "200" ]; then echo "  ✗ the apex broke while standing up docs"; fail=1; fi; \
	if [ $$fail -eq 0 ]; then echo "✓ docs site is correct and nothing regressed"; else exit 1; fi

docs-shots:
	@./scripts/capture-docs-shots.sh

# Validate links in the BUILT docs. Internal links are checked against the actual
# build output, so renaming a route breaks this instead of shipping a 404.
# Outbound links are only fetched with EXTERNAL=1, so an offline build still works.
docs-linkcheck: docs-build
	@python3 scripts/check-docs-links.py docs-site/dist $(if $(EXTERNAL),--external,)

# Catch documentation drift: the docs state a version in their footer, and that
# claim goes stale silently the moment the app ships a release. This makes it
# loud instead. Run it as part of the release habit, next to verify-download.
docs-freshness:
	@documented=$$(grep -oE 'DOCUMENTED_VERSION = "[^"]+"' docs-site/src/config/docs.ts \
	  | sed -E 's/.*"([^"]+)".*/\1/'); \
	echo "── docs freshness ──"; \
	echo "  docs say      : $$documented"; \
	fail=0; \
	if [ -f $(APP_REPO)/VERSION ]; then \
	  src=$$(tr -d '[:space:]' < $(APP_REPO)/VERSION); \
	  echo "  app source is : $$src"; \
	  if [ "$$documented" != "$$src" ]; then \
	    echo "  ✗ the docs were written against $$documented but the app is $$src."; \
	    echo "    Re-verify the affected pages, then bump DOCUMENTED_VERSION in"; \
	    echo "    docs-site/src/config/docs.ts. Do NOT bump it with stale prose —"; \
	    echo "    an honest old number beats a wrong new one."; \
	    fail=1; \
	  fi; \
	else \
	  echo "  ($(APP_REPO) not checked out — skipping the source comparison)"; \
	fi; \
	feed_ver=$$(curl -s --max-time 15 https://downloads.shadynotes.app/macos/appcast.xml 2>/dev/null \
	  | grep -oE '<sparkle:shortVersionString>[^<]+' | head -1 | sed 's/.*>//'); \
	if [ -n "$$feed_ver" ]; then \
	  echo "  released      : $$feed_ver"; \
	  if [ "$$documented" != "$$feed_ver" ]; then \
	    echo "  ⚠ the current public release is $$feed_ver — the docs may describe an older build"; \
	  fi; \
	fi; \
	if [ $$fail -eq 0 ]; then echo "  ✓ docs version claim is consistent"; else exit 1; fi

# Everything that can be checked without deploying. Run before shipping docs.
docs-check: docs-linkcheck docs-shots-wired docs-shots-budget docs-freshness
	@echo "✓ docs checks passed"

# A <Shot> is a PLACEHOLDER, not an image. Capturing the png fills half the slot;
# the page keeps rendering a dashed box until the component is swapped for
# Starlight's <Image>. That half-done state is invisible to every other check —
# the file is on disk, the build succeeds, the link checker is happy — and it
# shipped that way for seven slots. So: a slot whose png already exists is a bug.
docs-shots-wired:
	@echo "── screenshot slots ──"; \
	fail=0; \
	for name in $$(grep -rho '<Shot name="[a-z0-9-]*"' docs-site/src/content 2>/dev/null \
	               | sed 's/.*name="//; s/"//' | sort -u); do \
	  if [ -f "docs-site/src/assets/screenshots/$$name.png" ]; then \
	    echo "  ✗ $$name.png is captured but its page still shows a <Shot> placeholder"; \
	    grep -rln "<Shot name=\"$$name\"" docs-site/src/content | sed 's/^/      /'; \
	    fail=1; \
	  else \
	    echo "  ~ $$name — slot declared, not captured yet"; \
	  fi; \
	done; \
	if [ $$fail -eq 0 ]; then echo "  ✓ no captured shot is left unwired"; else \
	  echo "  swap <Shot .../> for <Image src={...} /> — see components/Shot.astro"; exit 1; fi

# Screenshots live in plain git (NOT lfs — a clone without lfs would silently
# ship broken images). That only stays
# sane with a budget someone actually enforces.
docs-shots-budget:
	@dir=docs-site/src/assets/screenshots; \
	if [ ! -d "$$dir" ]; then echo "  (no screenshots yet)"; exit 0; fi; \
	fail=0; \
	total=$$(find "$$dir" -type f \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) -exec du -k {} + 2>/dev/null | awk '{s+=$$1} END {print s+0}'); \
	echo "── screenshot budget ──"; \
	echo "  total: $$total KB / 20480 KB"; \
	if [ "$$total" -gt 20480 ]; then echo "  ✗ over the 20 MB total budget"; fail=1; fi; \
	over=$$(find "$$dir" -type f -size +300k 2>/dev/null); \
	if [ -n "$$over" ]; then \
	  echo "  ✗ these exceed the 300 KB per-file budget:"; \
	  printf '%s\n' "$$over" | sed 's/^/      /'; fail=1; \
	else echo "  ✓ every file is within 300 KB"; fi; \
	if [ $$fail -eq 0 ]; then echo "  ✓ within budget"; else exit 1; fi

# Homebrew release loop: make release in $(APP_REPO) → upload DMG to GitHub Releases
# → bump version/sha256 in the johnoscott/homebrew-tap cask. Must run on the machine
# holding the Developer ID cert + notary profile. SKIP_BUILD=1 reuses an existing DMG.
cask-release:
	./scripts/release-cask.sh

# ── Brand film (feature 008) ────────────────────────────────────────────────
# The landing page plays two renditions of brand/promo-videos/shadynotes-brand-
# film-2min.mp4 (../brand, outside git), hosted on downloads.shadynotes.app/media/
# by the downloads Worker. Filenames carry a content hash and are served
# immutable, so a re-render means: film-encode -> film-publish -> update the two
# names in src/config/site.ts -> deploy. Publish BEFORE merging the site
# change: main auto-deploys, and a page pointing at a missing file shows only
# the poster and "The film is unavailable right now."
FILM_WEB := ../brand/promo-videos/web

film-encode:
	@./scripts/encode-film.sh

film-publish:
	@ls $(FILM_WEB)/brand-film-2min.*.mp4 >/dev/null 2>&1 || { echo "✗ no renditions in $(FILM_WEB) — run 'make film-encode'"; exit 1; }
	@echo "▶ Deploying downloads.shadynotes.app with the renditions in $(FILM_WEB) …"
	cd downloads && ./sync.sh && npx wrangler deploy
	@echo "✓ Published. Run 'make verify-film'."

# Checks the two renditions the site config points at: reachable, video/mp4,
# byte ranges (Safari needs them), and immutable caching.
verify-film:
	@base=$$(grep -E 'base: "https://downloads' src/config/site.ts | sed -E 's/.*"([^"]+)".*/\1/'); \
	fail=0; echo "── brand film ──"; \
	for key in src1080 src720; do \
	  name=$$(grep -E "$$key: \"" src/config/site.ts | sed -E 's/.*"([^"]+)".*/\1/'); \
	  url="$$base/$$name"; hdr=$$(curl -sI --max-time 15 "$$url" | tr -d '\r'); \
	  code=$$(printf '%s\n' "$$hdr" | head -1 | awk '{print $$2}'); \
	  range=$$(curl -s -r 0-1 -o /dev/null -w '%{http_code}' --max-time 15 "$$url"); \
	  echo "  $$url → HTTP $$code, range → $$range"; \
	  [ "$$code" = "200" ] || { echo "  ✗ not reachable"; fail=1; }; \
	  printf '%s\n' "$$hdr" | grep -qi '^content-type: video/mp4' || { echo "  ✗ content-type is not video/mp4"; fail=1; }; \
	  [ "$$range" = "206" ] || { echo "  ✗ byte ranges not honoured"; fail=1; }; \
	  printf '%s\n' "$$hdr" | grep -qi '^cache-control:.*immutable' || { echo "  ✗ not cached as immutable"; fail=1; }; \
	done; \
	if [ $$fail = 0 ]; then echo "✓ film renditions are served correctly"; else exit 1; fi
