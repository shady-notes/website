import { test } from 'node:test';
import assert from 'node:assert/strict';

const { deriveEntitlement } = await import('../src/entitlement.js');
const { mintAppToken, verifyAppToken } = await import('../src/appToken.js');
const { createHandler } = await import('../src/worker.js');

const ENV = {
  CLERK_SECRET_KEY: 'sk_test_dummy',
  APP_TOKEN_SECRET: 'test-app-secret',
  PREMIUM_PLANS: 'personal,supporter',
};

// Drive the Worker's fetch handler directly — no server, no network.
function call(handler, path, init = {}, env = ENV) {
  return handler(new Request(`https://api.shadynotes.app${path}`, init), env);
}

const PLANS = ['personal', 'supporter'];

// Build a Clerk-shaped subscription with one item.
function sub(item) {
  return { subscriptionItems: item ? [item] : [] };
}
function item({ slug = 'personal', status = 'active', periodEnd = 1_900_000_000_000 } = {}) {
  return { status, planPeriod: 'month', periodEnd, plan: { slug } };
}

test('deriveEntitlement: active subscription to a premium plan grants access', () => {
  const e = deriveEntitlement(sub(item({ slug: 'personal', status: 'active' })), PLANS, 'a@b.co');
  assert.equal(e.active, true);
  assert.equal(e.plan, 'personal');
  assert.equal(e.email, 'a@b.co');
  assert.equal(e.renewsAt, Math.floor(1_900_000_000_000 / 1000));
});

test('deriveEntitlement: past_due stays premium (card retry grace)', () => {
  assert.equal(deriveEntitlement(sub(item({ status: 'past_due' })), PLANS).active, true);
});

test('deriveEntitlement: canceled / unknown plan / no items => not premium', () => {
  const canceled = deriveEntitlement(sub(item({ status: 'canceled' })), PLANS);
  assert.equal(canceled.active, false);
  assert.equal(canceled.status, 'canceled'); // reported so the app can explain it
  assert.equal(deriveEntitlement(sub(item({ slug: 'mystery' })), PLANS).active, false);
  const none = deriveEntitlement(sub(null), PLANS);
  assert.equal(none.active, false);
  assert.equal(none.status, 'none');
});

test('deriveEntitlement: null subscription => free', () => {
  const e = deriveEntitlement(null, PLANS, 'x@y.co');
  assert.equal(e.active, false);
  assert.equal(e.status, 'none');
  assert.equal(e.email, 'x@y.co');
});

test('appToken: mint → verify round-trips the userId; tampering is rejected', async () => {
  const token = await mintAppToken({ userId: 'user_42', secret: 's3cret', ttlDays: 90 });
  assert.equal(await verifyAppToken(token, 's3cret'), 'user_42');
  await assert.rejects(verifyAppToken(token, 'wrong-secret'));
  await assert.rejects(verifyAppToken(token + 'x', 's3cret'));
});

test('routes: /app/token then /entitlement round-trip', async () => {
  // Stub Clerk session verification + entitlement lookup.
  const handler = createHandler({
    clerk: {
      userIdFromSessionToken: async (t) => {
        if (t !== 'good') throw new Error('bad');
        return 'user_1';
      },
      entitlementForUser: async (userId) => {
        assert.equal(userId, 'user_1');
        return { plan: 'personal', status: 'active', active: true, renewsAt: 999, email: 'a@b.co' };
      },
    },
  });

  // Missing / bad session token.
  assert.equal((await call(handler, '/app/token', { method: 'POST' })).status, 401);
  assert.equal(
    (await call(handler, '/app/token', { method: 'POST', headers: { authorization: 'Bearer nope' } })).status,
    401,
  );

  // Good session token → app token.
  const mintRes = await call(handler, '/app/token', { method: 'POST', headers: { authorization: 'Bearer good' } });
  assert.equal(mintRes.status, 200);
  const { token } = await mintRes.json();
  assert.ok(token);

  // Entitlement with the minted app token.
  const entRes = await call(handler, '/entitlement', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(entRes.status, 200);
  const ent = await entRes.json();
  assert.equal(ent.active, true);
  assert.equal(ent.plan, 'personal');

  // Missing / garbage app token.
  assert.equal((await call(handler, '/entitlement')).status, 401);
  assert.equal((await call(handler, '/entitlement', { headers: { authorization: 'Bearer garbage' } })).status, 401);
});

test('routes: /entitlement returns 503 when the Clerk lookup fails', async () => {
  const handler = createHandler({
    clerk: {
      userIdFromSessionToken: async () => 'user_1',
      entitlementForUser: async () => {
        throw new Error('clerk down');
      },
    },
  });
  const token = await mintAppToken({ userId: 'user_1', secret: ENV.APP_TOKEN_SECRET, ttlDays: 90 });
  const res = await call(handler, '/entitlement', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.status, 503);
});

test('routes: healthz, CORS for the site, 404, and a missing secret', async () => {
  const handler = createHandler({ clerk: {} });
  const h = await call(handler, '/healthz');
  assert.equal(h.status, 200);
  assert.deepEqual(await h.json(), { ok: true });

  const pre = await call(handler, '/app/token', { method: 'OPTIONS', headers: { origin: 'https://shadynotes.app' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://shadynotes.app');
  const foreign = await call(handler, '/app/token', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);

  assert.equal((await call(handler, '/nope')).status, 404);
  assert.equal((await call(handler, '/healthz', {}, { CLERK_SECRET_KEY: 'x' })).status, 500);
});

// --- billing switched off on the instance ---------------------------------
// Regression guard for the Clerk dev→production migration: the production
// instance runs with Billing disabled until it is set up, and Clerk answers the
// billing endpoint with `billing_not_enabled` rather than a 404. Classifying
// that as a failure would 503 every entitlement check, and the app maps 5xx to
// LicenseError.network — so a newly signed-in user would fall back to a cached
// entitlement that does not exist. Billing being off means nobody has a
// subscription, i.e. free.

const { meansNoSubscription } = await import('../src/clerk.js');

test('meansNoSubscription: billing disabled on the instance counts as free', () => {
  const err = {
    status: 403,
    errors: [{ code: 'billing_not_enabled', message: 'access denied' }],
  };
  assert.equal(meansNoSubscription(err), true);
});

test('meansNoSubscription: a user with no subscription (404) counts as free', () => {
  assert.equal(meansNoSubscription({ status: 404 }), true);
  assert.equal(meansNoSubscription({ errors: [{ code: 'resource_not_found' }] }), true);
});

test('meansNoSubscription: a genuine failure still propagates', () => {
  assert.equal(meansNoSubscription(new Error('socket hang up')), false);
  assert.equal(meansNoSubscription({ status: 500 }), false);
  assert.equal(meansNoSubscription({ status: 403, errors: [{ code: 'authentication_invalid' }] }), false);
});

// --- Comp grants (private_metadata) -----------------------------------------
// Clerk cannot assign a plan to a user, so premium-without-payment is decided
// here instead. See compGrant() in entitlement.js.

const { compGrant } = await import('../src/entitlement.js');
const NOW = Date.parse('2026-08-31T00:00:00Z');
const FUTURE = '2027-01-01T00:00:00Z';
const PAST = '2026-01-01T00:00:00Z';

test('compGrant: valid plan with a future expiry grants', () => {
  const g = compGrant({ comp_plan: 'supporter', comp_until: FUTURE }, PLANS, NOW);
  assert.equal(g.plan, 'supporter');
  assert.equal(g.until, Date.parse(FUTURE));
});

test('compGrant: no expiry means open-ended', () => {
  assert.deepEqual(compGrant({ comp_plan: 'personal' }, PLANS, NOW), { plan: 'personal', until: null });
  assert.deepEqual(compGrant({ comp_plan: 'personal', comp_until: '' }, PLANS, NOW), { plan: 'personal', until: null });
});

test('compGrant: an elapsed expiry stops granting on its own', () => {
  assert.equal(compGrant({ comp_plan: 'supporter', comp_until: PAST }, PLANS, NOW), null);
});

test('compGrant: an unparseable date fails closed, not open', () => {
  assert.equal(compGrant({ comp_plan: 'supporter', comp_until: 'next tuesday' }, PLANS, NOW), null);
});

test('compGrant: unknown or missing plan slugs never grant', () => {
  assert.equal(compGrant({ comp_plan: 'mystery', comp_until: FUTURE }, PLANS, NOW), null);
  assert.equal(compGrant({ comp_until: FUTURE }, PLANS, NOW), null);
  assert.equal(compGrant(null, PLANS, NOW), null);
  assert.equal(compGrant({ comp_plan: 123 }, PLANS, NOW), null);
});

test('deriveEntitlement: a comp grants premium with no subscription at all', () => {
  const e = deriveEntitlement(null, PLANS, 'a@b.co', { comp_plan: 'supporter', comp_until: FUTURE }, NOW);
  assert.equal(e.active, true);
  assert.equal(e.plan, 'supporter');
  assert.equal(e.status, 'comp');
  assert.equal(e.email, 'a@b.co');
  assert.equal(e.renewsAt, Math.floor(Date.parse(FUTURE) / 1000)); // when it lapses
});

test('deriveEntitlement: an open-ended comp reports no end date', () => {
  assert.equal(deriveEntitlement(sub(null), PLANS, null, { comp_plan: 'personal' }, NOW).renewsAt, null);
});

test('deriveEntitlement: a paid subscription outranks a comp', () => {
  const e = deriveEntitlement(
    sub(item({ slug: 'personal', status: 'active' })),
    PLANS, null, { comp_plan: 'supporter', comp_until: FUTURE }, NOW,
  );
  assert.equal(e.plan, 'personal');   // real money decides the plan
  assert.equal(e.status, 'active');
});

test('deriveEntitlement: a comp outranks a lapsed subscription', () => {
  const e = deriveEntitlement(
    sub(item({ slug: 'personal', status: 'canceled' })),
    PLANS, null, { comp_plan: 'supporter', comp_until: FUTURE }, NOW,
  );
  assert.equal(e.active, true);
  assert.equal(e.plan, 'supporter');
});

test('deriveEntitlement: an expired comp falls back to free', () => {
  const e = deriveEntitlement(null, PLANS, null, { comp_plan: 'supporter', comp_until: PAST }, NOW);
  assert.equal(e.active, false);
  assert.equal(e.plan, null);
  assert.equal(e.status, 'none');
});

test('deriveEntitlement: unchanged when no metadata is passed (back-compat)', () => {
  assert.equal(deriveEntitlement(sub(item({ status: 'active' })), PLANS).active, true);
  assert.equal(deriveEntitlement(sub(null), PLANS).active, false);
});
