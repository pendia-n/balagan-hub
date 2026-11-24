import { env } from 'cloudflare:workers';
import { SESSION_COOKIE, findLiveSession, verifySession } from './session.mjs';
import { gameHost } from './accounts.mjs';

export const bindings = env;
export const hub = 'balagan';
export function handoff(query) {
  const game = query.get('game');
  const challenge = query.get('challenge');
  const state = query.get('state');
  if (!gameHost(game) || !/^[0-9a-f]{64}$/.test(challenge ?? '') || !/^[0-9a-f]{32}$/.test(state ?? '')) return null;
  return { game, challenge, state };
}
export function handoffPath(info) {
  return info ? '/api/authorize?' + new URLSearchParams(info) : '/account';
}
export async function signedIn(cookies) {
  const claims = await verifySession(bindings.BALAGAN_JWT_SECRET, cookies.get(SESSION_COOKIE)?.value, hub);
  const user = await findLiveSession(bindings.DB, claims);
  return user && { user, claims };
}
