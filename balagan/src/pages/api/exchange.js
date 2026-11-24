import { exchangeGameCode, gameHost } from '../../lib/accounts.mjs';
import { bindings } from '../../lib/hub.mjs';
import { signSession } from '../../lib/session.mjs';
export const prerender = false;

export async function POST({ request }) {
  const game = request.headers.get('X-Balagan-Game');
  const code = request.headers.get('X-Balagan-Code');
  const verifier = request.headers.get('X-Balagan-Proof');
  if (!gameHost(game)) return new Response('Invalid game', { status: 400 });
  const session = await exchangeGameCode(bindings.DB, code, game, verifier);
  if (!session) return new Response('Sign-in expired', { status: 401 });
  return Response.json({
    token: await signSession(bindings.BALAGAN_JWT_SECRET, session, game), expiresAt: session.expires_at
  }, { headers: { 'Cache-Control': 'no-store' } });
}
