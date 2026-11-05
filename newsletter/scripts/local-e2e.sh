#!/usr/bin/env bash
# End-to-end run on this Mac: the real Workers runtime (wrangler dev --local),
# a local D1, and the fake Resend. Never touches the live list or sends mail.
#   scripts/local-e2e.sh            (from newsletter/)
set -euo pipefail
cd "$(dirname "$0")/.."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/newsletter-e2e.XXXXXX")"
PERSIST="$WORK/state"
API="http://127.0.0.1:8787"
SITE_ORIGIN="https://shadynotes.app"
ADMIN_KEY="local-admin-key"
WEBHOOK_SECRET="whsec_$(printf 'local-webhook-secret-0123456789' | base64)"
pass() { printf '  \033[32mok\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
cleanup() { kill "${WRANGLER_PID:-}" "${RESEND_PID:-}" 2>/dev/null || true; rm -f .dev.vars.e2e; }
trap cleanup EXIT

# Local-only settings. --env-file keeps them out of the real .dev.vars.
cat > .dev.vars.e2e <<EOF
POLICY_VERSION=2026-11-06
RESEND_API_BASE=http://127.0.0.1:8788
RESEND_API_KEY=re_local
ADMIN_KEY=$ADMIN_KEY
RESEND_WEBHOOK_SECRET=$WEBHOOK_SECRET
LIMITER_SALT=local-salt
TOKEN_SECRET=local-token-secret
TEST_RECIPIENTS=test@example.com
EXTRA_ORIGINS=http://localhost:4321
EOF

echo "Work dir: $WORK"
node scripts/fake-resend.mjs "$WORK" 8788 > "$WORK/resend.log" 2>&1 & RESEND_PID=$!
wrangler d1 migrations apply signups --local --persist-to "$PERSIST" > "$WORK/migrate.log" 2>&1
wrangler dev --local --port 8787 --persist-to "$PERSIST" --env-file .dev.vars.e2e --test-scheduled > "$WORK/wrangler.log" 2>&1 & WRANGLER_PID=$!
for _ in $(seq 1 60); do curl -s -o /dev/null "$API/" && break; sleep 0.5; done
curl -s -o /dev/null "$API/" || { cat "$WORK/wrangler.log"; fail "wrangler dev did not start"; }
MAIL="$WORK/mail.jsonl"
mails() { [ -f "$MAIL" ] && wc -l < "$MAIL" | tr -d ' ' || echo 0; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "Sign-up"
[ "$(code -X OPTIONS -H "Origin: $SITE_ORIGIN" -H 'Access-Control-Request-Method: POST' "$API/v1/signup")" = 204 ] && pass "preflight 204" || fail "preflight"
[ "$(code -X OPTIONS -H 'Origin: https://evil.example' "$API/v1/signup")" = 403 ] && pass "other origin 403" || fail "other origin"
signup() { curl -s -w ' %{http_code}' -H "Origin: $SITE_ORIGIN" -H 'Content-Type: application/json' -d "$1" "$API/v1/signup"; }
out=$(signup '{"email":"reader@example.com","interests":["how-to"],"source":"blog-index"}')
[[ "$out" == *'"sent"'*' 202' ]] && pass "sign-up 202" || fail "sign-up: $out"
[ "$(mails)" = 1 ] && pass "one confirmation mail" || fail "mail count $(mails)"
out=$(signup '{"email":"reader@example.com","interests":["how-to"],"source":"blog-index","extra":1}')
[[ "$out" == *' 400' ]] && pass "unknown field 400" || fail "unknown field: $out"
TOKEN=$(tail -1 "$MAIL" | grep -o '/c/[A-Za-z0-9_-]\{43\}' | head -1 | cut -d/ -f3)
[ -n "$TOKEN" ] || fail "no token in mail"
[ "$(code "$API/c/$TOKEN")" = 200 ] && pass "confirm page 200" || fail "confirm page"
[ "$(code -X POST "$API/c/$TOKEN")" = 200 ] && pass "confirm 200" || fail "confirm"
out=$(signup '{"email":"reader@example.com","interests":["how-to"],"source":"blog-index"}')
[[ "$out" == *already-confirmed*' 200' ]] && pass "already-confirmed" || fail "repeat: $out"

echo "Rate limit (5 a minute per hashed IP)"
last=""; for i in 1 2 3 4 5 6; do last=$(signup "{\"email\":\"rl$i@example.com\",\"interests\":[\"how-to\"],\"source\":\"blog-index\"}"); done
[[ "$last" == *' 429' ]] && pass "6th request 429" || fail "rate limit: $last"

echo "Newsletter (themes post, rendered from the live site)"
export NEWSLETTER_ADMIN_KEY="$ADMIN_KEY"
node tools/post.mjs preview themes --out "$WORK/preview" > /dev/null && [ -s "$WORK/preview/email.html" ] && pass "preview" || fail "preview"
before=$(mails)
node tools/post.mjs send themes --api "$API" --yes > "$WORK/send0.log" 2>&1 && fail "send before test should fail" || pass "send refused before test"
node tools/post.mjs test themes --api "$API" > "$WORK/test.log" 2>&1 || { cat "$WORK/test.log"; fail "test send"; }
[ "$(( $(mails) - before ))" = 1 ] && pass "one test copy" || fail "test copies"
node tools/post.mjs send themes --api "$API" --yes > "$WORK/send.log" 2>&1 || { cat "$WORK/send.log"; fail "send"; }
grep -q "Done: 1 sent" "$WORK/send.log" && pass "sent to the 1 confirmed reader" || { cat "$WORK/send.log"; fail "send count"; }
node tools/post.mjs send themes --api "$API" --yes > "$WORK/send2.log" 2>&1
grep -q "Nothing to send" "$WORK/send2.log" && pass "second send sends nothing" || { cat "$WORK/send2.log"; fail "resend"; }
LAST=$(tail -1 "$MAIL")
UNSUB=$(printf '%s' "$LAST" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);console.log(m.headers["List-Unsubscribe"].slice(1,-1))})')
[[ "$UNSUB" == https://subscribe.shadynotes.app/u/* ]] && pass "List-Unsubscribe header" || fail "unsub header: $UNSUB"
node tools/post.mjs status themes --api "$API" | grep -q "Sent:      1" && pass "status counts" || fail "status"

echo "One-click unsubscribe (RFC 8058)"
UPATH="${UNSUB#https://subscribe.shadynotes.app}"
[ "$(code -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'List-Unsubscribe=One-Click' "$API$UPATH")" = 200 ] && pass "one-click 200" || fail "one-click"
stats=$(curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/v1/admin/stats")
[[ "$stats" == *'"unsubscribed":1'* ]] && pass "stats: $stats" || fail "stats: $stats"

echo "Webhook"
BODY='{"type":"email.bounced","data":{"to":["rl1@example.com"]}}'
TS=$(date +%s)
SIG=$(node --input-type=module -e "import {signWebhook} from './src/crypto.js'; console.log(await signWebhook(process.argv[1],'msg_e2e',process.argv[2],process.argv[3]))" "$WEBHOOK_SECRET" "$TS" "$BODY")
[ "$(code -X POST -H "svix-id: msg_e2e" -H "svix-timestamp: $TS" -H "svix-signature: $SIG" -d "$BODY" "$API/v1/resend/webhook")" = 200 ] && pass "signed webhook 200" || fail "webhook"
[ "$(code -X POST -H "svix-id: msg_e2e" -H "svix-timestamp: $TS" -H "svix-signature: v1,AAAA" -d "$BODY" "$API/v1/resend/webhook")" = 401 ] && pass "bad signature 401" || fail "webhook sig"
curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/v1/admin/stats" | grep -q '"suppressed":1' && pass "bounce suppressed" || fail "suppression"

echo "Retention cron"
[ "$(code "$API/__scheduled?cron=15+2+*+*+*")" = 200 ] && pass "scheduled handler ran" || fail "cron"

echo "All local end-to-end checks passed. Mail log: $MAIL"
