// Pure entitlement logic — no I/O, so it's exhaustively unit-testable.
//
// Given a Clerk BillingSubscription (from getUserBillingSubscription) and the set
// of plan slugs that grant premium, decide whether the account is premium and
// surface a little display metadata. The app only cares about `active` plus
// plan/status/renewsAt/email.

// Subscription-item statuses that still entitle the user. `past_due` keeps premium
// during a failed-card retry; `canceled`/`ended`/`incomplete`/`abandoned`/
// `upcoming` (scheduled, not yet started) do not.
const ACTIVE_STATUSES = new Set(['active', 'past_due']);

const FREE = { plan: null, status: 'none', active: false, renewsAt: null, email: null };

// Comp grants — premium without a subscription, for testers, contributors and
// anyone we simply want to hand it to.
//
// Clerk has no way to assign a plan to a user: the Backend API can read, cancel,
// discount or trial-extend a subscription item, but never create one, because
// subscriptions are Stripe-backed. Entitlement is *our* decision though — the app
// asks this service, not Clerk — so a comp lives in the Clerk user's PRIVATE
// metadata (server-only, never shipped to the browser):
//
//   { "comp_plan": "supporter", "comp_until": "2027-01-01" }
//
// `comp_until` is optional; omit it for an open-ended grant.
export function compGrant(privateMetadata, premiumPlans, now = Date.now()) {
  const plan = privateMetadata?.comp_plan;
  // Unknown slugs never grant. A typo should read as "no comp", not as premium.
  if (typeof plan !== 'string' || !premiumPlans.includes(plan)) return null;

  const until = privateMetadata?.comp_until;
  if (until === undefined || until === null || until === '') return { plan, until: null };

  const ms = Date.parse(until);
  // Unparseable dates fail CLOSED. A mistyped date must drop the comp, never
  // quietly promote it into a grant that never ends.
  if (Number.isNaN(ms) || ms <= now) return null;
  return { plan, until: ms };
}

export function deriveEntitlement(
  subscription,
  premiumPlans,
  email = null,
  privateMetadata = null,
  now = Date.now(),
) {
  const items = subscription?.subscriptionItems ?? [];

  // A premium-granting item that is currently active. Paid subscriptions win:
  // a comp is a fallback for people who are not paying, so real money always
  // decides the plan and the renewal date.
  const granting = items.find(
    (i) => ACTIVE_STATUSES.has(i.status) && premiumPlans.includes(i.plan?.slug),
  );
  if (granting) {
    return {
      plan: granting.plan.slug,
      status: granting.status,
      active: true,
      renewsAt: msToSeconds(granting.periodEnd),
      email,
    };
  }

  // No active paid item — a comp grant applies, and outranks a lapsed one.
  const comp = compGrant(privateMetadata, premiumPlans, now);
  if (comp) {
    return {
      plan: comp.plan,
      status: 'comp',
      active: true,
      // The app renders this as the renewal date. A comp does not renew, it
      // expires — but this is the moment the entitlement lapses, which is what
      // that field is used to show. Open-ended comps report no date at all.
      renewsAt: comp.until ? Math.floor(comp.until / 1000) : null,
      email,
    };
  }

  // No active premium item — but if they *have* a premium plan in some other
  // state (canceled/upcoming), report that status so the app can explain it.
  const lapsed = items.find((i) => premiumPlans.includes(i.plan?.slug));
  if (lapsed) {
    return { plan: lapsed.plan.slug, status: lapsed.status, active: false, renewsAt: null, email };
  }

  return { ...FREE, email };
}

export const NO_ENTITLEMENT = FREE;

function msToSeconds(ms) {
  return typeof ms === 'number' ? Math.floor(ms / 1000) : null;
}
