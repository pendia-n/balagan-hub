import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;
const images = /^(balagan|thiskicks|wemember|sorriest|barara|xmincing)-(wide|portrait)\.png$/;

const brands = /^(balagan|thiskicks|wemember|sorriest|barara)-(logo\.svg|favicon\.ico)$/;

export async function serveImage(request: Request, asset: string | undefined) {
  if (!asset || (!images.test(asset) && !brands.test(asset))) return new Response(null, { status: 404 });
  const brand = brands.test(asset);
  const { PROMOS } = env as unknown as { PROMOS: R2Bucket };
  const key = (brand ? 'brands/' : 'promo/') + asset;
  const file = request.method === 'HEAD' ? await PROMOS.head(key) : await PROMOS.get(key);
  if (!file) return new Response(null, { status: 404 });
  const headers = new Headers({
    'Content-Type': asset.endsWith('.svg') ? 'image/svg+xml' : asset.endsWith('.ico') ? 'image/x-icon' : 'image/png',
    'Content-Length': String(file.size),
    'Cache-Control': brand ? 'public, max-age=3600' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    ETag: file.httpEtag,
  });
  if (asset.endsWith('.svg')) headers.set('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  if (request.headers.get('If-None-Match') === file.httpEtag) {
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  return new Response('body' in file ? file.body : null, { headers });
}
const respond: APIRoute = ({ request, params }) => serveImage(request, params.asset);
export const GET = respond;
export const HEAD = respond;
