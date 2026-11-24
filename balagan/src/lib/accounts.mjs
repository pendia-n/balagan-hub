import { SESSION_SECONDS } from './session.mjs';

const encoder = new TextEncoder();
const nowSeconds = () => Math.floor(Date.now() / 1000);
const iterations = 100_000;
const randomHex = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const hosts = Object.freeze({
  thiskicks: 'thiskicks.balagan.live',
  wemember: 'wemember.balagan.live',
  sorriest: 'sorriest.balagan.live',
  barara: 'bar.ara.balagan.live'
});

function hex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function unhex(value) {
  return Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16));
}
async function derive(password, salt, pepper) {
  if (!/^[0-9a-f]{64}$/i.test(pepper || '')) throw new Error('Invalid password pepper configuration');
  const pepperKey = await crypto.subtle.importKey('raw', unhex(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prepared = await crypto.subtle.sign('HMAC', pepperKey, encoder.encode(password));
  const key = await crypto.subtle.importKey('raw', prepared, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
export async function digest(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export function gameHost(audience) {
  return Object.hasOwn(hosts, audience) ? hosts[audience] : undefined;
}
export function validUsername(username) {
  return typeof username === 'string' && /^[a-z0-9][a-z0-9_-]{2,23}$/i.test(username);
}
export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

export async function hashPassword(password, pepper) {
  if (!validPassword(password)) throw new Error('Password must contain 12 to 128 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, pepper);
  return 'pbkdf2-v2:' + hex(salt) + ':' + hex(hash);
}

export async function matchesPassword(password, saved = '', pepper) {
  if (!validPassword(password)) return false;
  const parts = /^pbkdf2-v2:([0-9a-f]{32}):([0-9a-f]{64})$/.exec(saved);
  const candidate = await derive(password, parts ? unhex(parts[1]) : new Uint8Array(16), pepper);
  const expected = parts ? unhex(parts[2]) : new Uint8Array(32);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ candidate[i];
  return Boolean(parts && difference === 0);
}

export async function newSession(db, userId, now = nowSeconds()) {
  const session = { id: randomHex(32), user_id: userId, expires_at: now + SESSION_SECONDS };
  await db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)')
    .bind(session.id, session.user_id, session.expires_at).run();
  return session;
}

export async function newGameCode(db, sessionId, audience, challenge, now = nowSeconds()) {
  if (!gameHost(audience) || !/^[0-9a-f]{64}$/.test(challenge)) throw new Error('Invalid game sign-in request');
  const code = randomHex(32);
  const result = await db.prepare(
    'INSERT INTO signin_codes (digest,session_id,audience,expires_at,challenge) SELECT ?,id,?,?,? FROM sessions WHERE id=? AND expires_at>?'
  ).bind(await digest(code), audience, now + 60, challenge, sessionId, now).run();
  return result.meta.changes === 1 ? code : null;
}

export async function exchangeGameCode(db, code, audience, verifier, now = nowSeconds()) {
  if (typeof code !== 'string' || !/^[0-9a-f]{64}$/.test(code) || !gameHost(audience) || typeof verifier !== 'string' || !/^[0-9a-f]{64}$/.test(verifier)) return null;
  const redeemed = await db.prepare(
    'DELETE FROM signin_codes WHERE digest=? AND audience=? AND challenge=? AND expires_at>? RETURNING session_id'
  ).bind(await digest(code), audience, await digest(verifier), now).first();
  if (!redeemed) return null;
  return db.prepare('SELECT id,user_id,expires_at FROM sessions WHERE id=? AND expires_at>?')
    .bind(redeemed.session_id, now).first();
}
