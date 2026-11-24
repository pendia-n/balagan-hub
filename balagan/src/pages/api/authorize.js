import { newGameCode, gameHost } from '../../lib/accounts.mjs';
import { bindings, handoff, signedIn } from '../../lib/hub.mjs';
export const prerender = false;

export async function GET({ url, cookies }) {
  const info = handoff(url.searchParams);
  if (!info) return new Response('Invalid game sign-in request', { status: 400 });
  const session = await signedIn(cookies);
  const redirect = location => new Response(null, { status: 303, headers: {
    Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'
  }});
  if (!session) return redirect('/signin?' + new URLSearchParams(info));
  const code = await newGameCode(bindings.DB, session.claims.sid, info.game, info.challenge);
  if (!code) return redirect('/signin?' + new URLSearchParams(info));
  return redirect('https://' + gameHost(info.game) + '/auth/callback?' + new URLSearchParams({code,state:info.state}));
}
