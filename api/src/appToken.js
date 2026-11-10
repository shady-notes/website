import { SignJWT, jwtVerify } from 'jose';

// The app token is the credential the macOS app stores in the Keychain and sends
// on every /entitlement call. It only asserts *identity* (which Clerk user);
// entitlement is always looked up fresh, so a long TTL is safe — a cancelled
// subscription drops the user to free on the next check however long it lives.
//
// WIRE-COMPATIBLE with the old Node issuer, which used `jsonwebtoken`: HS256,
// the secret's UTF-8 bytes as the key, header {alg, typ: JWT}, claims
// {typ: 'app', sub, iat, exp, iss, aud}. Installed apps hold tokens minted by
// that code; test/appToken.test.js checks both directions against jsonwebtoken.
const ISSUER = 'shadynotes-entitlement';
const AUDIENCE = 'shadynotes-app';
const key = (secret) => new TextEncoder().encode(secret);

export async function mintAppToken({ userId, secret, ttlDays }) {
  return new SignJWT({ typ: 'app' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(key(secret));
}

export async function verifyAppToken(token, secret) {
  const { payload } = await jwtVerify(token, key(secret), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload.typ !== 'app' || !payload.sub) throw new Error('not an app token');
  return payload.sub; // userId
}
