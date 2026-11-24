import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;
const images = /^(balagan|thiskicks|wemember|sorriest|barara|xmincing)-(wide|portrait)\.png$/;

const respond: APIRoute = async ({ request, params }) => {
  const asset = params.asset;
  if (!asset || !images.test(asset)) return new Response(null, { status: 404 });
  const { PROMOS } = env as unknown as { PROMOS: R2Bucket };
  const key = 'promo/' + asset;
  const file = request.method === 'HEAD' ? await PROMOS.head(key) : await PROMOS.get(key);
  if (!file) return new Response(null, { status: 404 });
  const headers = new Headers({
    'Content-Type': 'image/png',
    'Content-Length': String(file.size),
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    ETag: file.httpEtag,
  });
  if (request.headers.get('If-None-Match') === file.httpEtag) {
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  return new Response('body' in file ? file.body : null, { headers });
};
export const GET = respond;
export const HEAD = respond;
