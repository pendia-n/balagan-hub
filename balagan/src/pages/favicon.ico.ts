import type { APIRoute } from 'astro';
import { serveImage } from './media/[asset]';

export const prerender = false;
const respond: APIRoute = ({ request }) => serveImage(request, 'balagan-favicon.ico');
export const GET = respond;
export const HEAD = respond;
