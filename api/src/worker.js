import { loadConfig } from './config.js';
import { mintAppToken, verifyAppToken } from './appToken.js';
import { clerkFor } from './clerk.js';

// Same three routes and responses as the old Express issuer:
//   GET  /healthz       → {ok: true}
//   POST /app/token     Clerk session token (Bearer) → {token}
//   GET  /entitlement   app token (Bearer) → {plan, status, active, renewsAt, email, avatarUrl}
// `deps` lets tests replace the Clerk calls.
export function createHandler(deps = {}) {
  return async function fetch(request, env) {
    const url = new URL(request.url);
    let config;
    try {
      config = loadConfig(env);
    } catch {
      return json({ error: 'server misconfigured' }, 500);
    }
    const cors = corsHeaders(request, config);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const clerk = deps.clerk ?? clerkFor(config);
    const route = `${request.method} ${url.pathname}`;

    if (route === 'GET /healthz') return json({ ok: true }, 200, cors);

    // Called by /app/connect on shadynotes.app once the user is signed in.
    if (route === 'POST /app/token') {
      const sessionToken = bearer(request);
      if (!sessionToken) return json({ error: 'missing session token' }, 401, cors);
      let userId;
      try {
        userId = await clerk.userIdFromSessionToken(sessionToken);
      } catch {
        return json({ error: 'invalid session token' }, 401, cors);
      }
      const token = await mintAppToken({
        userId,
        secret: config.appTokenSecret,
        ttlDays: config.appTokenTtlDays,
      });
      return json({ token }, 200, cors);
    }

    // The macOS app's check. 503 when Clerk is unreachable, so the app keeps
    // its cached entitlement instead of dropping the user to free on a blip.
    if (route === 'GET /entitlement') {
      const token = bearer(request);
      if (!token) return json({ error: 'missing app token' }, 401, cors);
      let userId;
      try {
        userId = await verifyAppToken(token, config.appTokenSecret);
      } catch {
        return json({ error: 'invalid app token' }, 401, cors);
      }
      try {
        return json(await clerk.entitlementForUser(userId), 200, cors);
      } catch {
        return json({ error: 'entitlement lookup failed' }, 503, cors);
      }
    }

    return json({ error: 'not found' }, 404, cors);
  };
}

function corsHeaders(request, config) {
  const origin = request.headers.get('origin');
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function bearer(request) {
  const h = request.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export default { fetch: createHandler() };
