import { bindings } from '../../lib/hub.mjs';
import { digest, validUsername } from '../../lib/accounts.mjs';

export const prerender = false;

export async function GET({request, url}) {
  const headers = {'Cache-Control':'no-store'};
  const username = url.searchParams.get('username')?.trim();
  if (!validUsername(username)) return new Response(null,{status:400,headers});
  const now = Math.floor(Date.now()/1000);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await digest('username-check:' + ip + ':' + Math.floor(now/300));
  const attempt = await bindings.DB.prepare(
    'INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts'
  ).bind(bucket,now+600).first();
  if (attempt.attempts > 40) return new Response(null,{status:429,headers});
  const existing = await bindings.DB.prepare('SELECT 1 FROM users WHERE username=?').bind(username).first();
  return Response.json({available:!existing},{headers});
}
