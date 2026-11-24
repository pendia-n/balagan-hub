import { bindings, handoff, handoffPath, hub, signedIn } from '../../lib/hub.mjs';
import { digest, hashPassword, matchesPassword, newSession, validUsername, validPassword } from '../../lib/accounts.mjs';
import { signSession, sessionCookie } from '../../lib/session.mjs';
export const prerender = false;

export async function POST({ request, cookies, url }) {
  if (request.headers.get('origin') !== url.origin) return new Response('Invalid request origin', { status: 403 });
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type') || '')) return new Response('Invalid form encoding', { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing form', { status: 400 });
  const decoder = new TextDecoder();
  let body = '', bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 4096) {
      await reader.cancel();
      return new Response('Form too large', { status: 413 });
    }
    body += decoder.decode(value, {stream:true});
  }
  const form = new URLSearchParams(body + decoder.decode());
  const db = bindings.DB;
  const mode = form.get('mode');
  const info = handoff(form);
  const redirect = (path, cookie) => new Response(null, {
    status: 303, headers: { Location: path, 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) }
  });
  if (mode === 'logout') {
    const current = await signedIn(cookies);
    if (current) await db.prepare('DELETE FROM sessions WHERE id=?').bind(current.claims.sid).run();
    return redirect('/', sessionCookie('', 0));
  }
  if (mode !== 'register' && mode !== 'signin') return new Response('Unknown action', { status: 400 });
  const error = code => redirect('/' + mode + '?' + new URLSearchParams({ ...info, error: code }));
  const username = form.get('username')?.trim();
  const password = form.get('password');
  if (!validUsername(username) || !validPassword(password)) return error('format');
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const bucket = await digest(ip + ':' + Math.floor(now / 900));
  const limit = await db.prepare(
    'INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts'
  ).bind(bucket, now + 1800).first();
  if (limit.attempts > 18) return error('rate');
  let user;
  if (mode === 'register') {
    user = { id: crypto.randomUUID() };
    const result = await db.prepare('INSERT INTO users VALUES (?,?,?,?) ON CONFLICT(username) DO NOTHING')
      .bind(user.id, username, await hashPassword(password), now).run();
    if (result.meta.changes !== 1) return error('username');
  } else {
    user = await db.prepare('SELECT id,password_hash FROM users WHERE username=?').bind(username).first();
    if (!await matchesPassword(password, user?.password_hash)) return error('credentials');
  }
  const session = await newSession(db, user.id, now);
  const token = await signSession(bindings.BALAGAN_JWT_SECRET, session, hub, now);
  return redirect(handoffPath(info), sessionCookie(token,session.expires_at,now));
}
