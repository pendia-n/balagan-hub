import { bindings } from '../../lib/hub.mjs';
import { findLiveSession, verifySession } from '../../lib/session.mjs';
import { reserveEntry, settleRound } from '../../lib/wallet.mjs';
export const prerender = false;

export async function POST({ request }) {
  const game = request.headers.get('X-Balagan-Game');
  const roundId = request.headers.get('X-Balagan-Round');
  const authorization = request.headers.get('Authorization') || '';
  if (!['wemember','sorriest','barara'].includes(game) || !/^[a-f0-9-]{36}$/.test(roundId || '')
    || !authorization.startsWith('Bearer ')) return new Response(null,{status:401});
  const claims = await verifySession(bindings.BALAGAN_JWT_SECRET,authorization.slice(7),game);
  const user = await findLiveSession(bindings.DB,claims);
  if (!user) return new Response(null,{status:401});
  const result = await reserveEntry(bindings.DB,{userId:user.id,game,roundId});
  if (!result || result.state==='released') return new Response(null,{status:402});
  // This endpoint grants a seat in a round that already started.
  await settleRound(bindings.DB,game,roundId,'spent',user.id);
  return Response.json({ cost:result.cost },{headers:{'Cache-Control':'no-store'}});
}
