import { gameHost } from '../../lib/accounts.mjs';
import { bindings } from '../../lib/hub.mjs';
import { findLiveSession, verifySession } from '../../lib/session.mjs';
export const prerender = false;

export async function GET({ request }) {
  const game = request.headers.get('X-Balagan-Game');
  const bearer = request.headers.get('Authorization');
  if (!gameHost(game) || !bearer?.startsWith('Bearer ')) return new Response(null, { status: 401 });
  const claims = await verifySession(bindings.BALAGAN_JWT_SECRET, bearer.slice(7), game);
  const user = await findLiveSession(bindings.DB, claims);
  return user
    ? Response.json(user, { headers: { 'Cache-Control': 'no-store' } })
    : new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
