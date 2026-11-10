// Built from the Worker's env on each request (bindings are per-invocation).
// Fails loud on the secrets we cannot operate without, so a misconfigured deploy
// answers 500 rather than silently handing out (or refusing) entitlements.
function list(v, fallback) {
  return String(v ?? fallback).split(',').map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(env) {
  for (const name of ['CLERK_SECRET_KEY', 'APP_TOKEN_SECRET']) {
    if (!env[name]) throw new Error(`Missing required secret: ${name}`);
  }
  return {
    // Clerk backend API secret (sk_...). Verifies session tokens and reads the
    // user's billing subscription. Never leaves the Worker.
    clerkSecretKey: env.CLERK_SECRET_KEY,
    clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY ?? '',
    // HMAC secret for the app tokens minted for the macOS app. Rotating it
    // invalidates every issued app token (forces re-sign-in).
    appTokenSecret: env.APP_TOKEN_SECRET,
    appTokenTtlDays: Number(env.APP_TOKEN_TTL_DAYS ?? 90),
    // Clerk plan slugs that grant premium; config so a new plan needs no code change.
    premiumPlans: list(env.PREMIUM_PLANS, 'personal,supporter'),
    allowedOrigins: list(
      env.ALLOWED_ORIGINS,
      'https://shadynotes.app,https://www.shadynotes.app,http://localhost:4321',
    ),
  };
}
