import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { mintAppToken, verifyAppToken } from '../src/appToken.js';

// Installed copies of the app hold tokens minted by the old Node issuer with
// `jsonwebtoken`. These pin the Worker to that exact wire format, both ways.
const SECRET = 'a'.repeat(64);
const OLD = { issuer: 'shadynotes-entitlement', audience: 'shadynotes-app' };

test('compat: a token minted by the old issuer verifies in the Worker', async () => {
  const old = jwt.sign({ typ: 'app' }, SECRET, { subject: 'user_old', expiresIn: '90d', ...OLD });
  assert.equal(await verifyAppToken(old, SECRET), 'user_old');
});

test('compat: a token minted by the Worker verifies with the old issuer code', async () => {
  const token = await mintAppToken({ userId: 'user_new', secret: SECRET, ttlDays: 90 });
  const decoded = jwt.verify(token, SECRET, OLD);
  assert.equal(decoded.sub, 'user_new');
  assert.equal(decoded.typ, 'app');
  assert.equal(decoded.exp - decoded.iat, 90 * 86400);
  assert.deepEqual(jwt.decode(token, { complete: true }).header, { alg: 'HS256', typ: 'JWT' });
});

test('compat: expired, wrong-audience, wrong-issuer and non-app tokens are rejected', async () => {
  const expired = jwt.sign({ typ: 'app', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, { subject: 'u', ...OLD });
  await assert.rejects(verifyAppToken(expired, SECRET));
  const aud = jwt.sign({ typ: 'app' }, SECRET, { subject: 'u', expiresIn: '1d', issuer: OLD.issuer, audience: 'x' });
  await assert.rejects(verifyAppToken(aud, SECRET));
  const iss = jwt.sign({ typ: 'app' }, SECRET, { subject: 'u', expiresIn: '1d', issuer: 'x', audience: OLD.audience });
  await assert.rejects(verifyAppToken(iss, SECRET));
  const notApp = jwt.sign({ typ: 'session' }, SECRET, { subject: 'u', expiresIn: '1d', ...OLD });
  await assert.rejects(verifyAppToken(notApp, SECRET));
  const none = jwt.sign({ typ: 'app' }, '', { subject: 'u', expiresIn: '1d', algorithm: 'none', ...OLD });
  await assert.rejects(verifyAppToken(none, SECRET));
});
