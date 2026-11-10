import { createClerkClient, verifyToken } from '@clerk/backend';
import { deriveEntitlement } from './entitlement.js';

// Clerk calls for one request's config. Kept as a factory so tests can swap
// the whole thing out without network access.
export function clerkFor(config) {
  const clerk = createClerkClient({
    secretKey: config.clerkSecretKey,
    publishableKey: config.clerkPublishableKey || undefined,
  });

  // Verify a Clerk **session token** (from `Clerk.session.getToken()` on the
  // /app/connect page) and return the userId. Throws if missing, expired, or
  // not Clerk-issued.
  async function userIdFromSessionToken(token) {
    const claims = await verifyToken(token, { secretKey: config.clerkSecretKey });
    if (!claims?.sub) throw new Error('session token has no subject');
    return claims.sub;
  }

  // Read the user's live billing subscription and derive entitlement. No
  // subscription — or billing switched off — is free, not an error. Any other
  // failure propagates so the caller answers 503 (the app keeps its cached
  // entitlement through its grace window).
  async function entitlementForUser(userId) {
    let email = null;
    let avatarUrl = null;
    let privateMetadata = null;
    try {
      const user = await clerk.users.getUser(userId);
      email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
      avatarUrl = user?.imageUrl ?? null;
      privateMetadata = user?.privateMetadata ?? null;
    } catch {
      // Non-fatal. Email and avatar are display-only; a comp grant is not, so a
      // failed user read costs a comped account its premium until the next
      // check — a lookup failure must not invent access.
    }

    // A missing subscription falls through with null rather than returning
    // early, so a comp grant is still honoured (comped users have none).
    let subscription = null;
    try {
      subscription = await clerk.billing.getUserBillingSubscription(userId);
    } catch (err) {
      if (!meansNoSubscription(err)) throw err;
    }
    return {
      ...deriveEntitlement(subscription, config.premiumPlans, email, privateMetadata),
      avatarUrl,
    };
  }

  return { userIdFromSessionToken, entitlementForUser };
}

// Clerk billing errors that really mean "nothing to bill", not "lookup failed".
// `billing_not_enabled` is instance-level: treating it as an error would 503
// every check, and the app would sit on a cached entitlement it does not have.
export function meansNoSubscription(err) {
  return isNotFound(err) || isBillingDisabled(err);
}

function isNotFound(err) {
  return err?.status === 404 || err?.statusCode === 404 || err?.errors?.[0]?.code === 'resource_not_found';
}

function isBillingDisabled(err) {
  return err?.errors?.[0]?.code === 'billing_not_enabled';
}
