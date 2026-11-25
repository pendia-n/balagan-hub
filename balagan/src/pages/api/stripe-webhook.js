import { bindings } from '../../lib/hub.mjs';
import { handleStripeWebhook } from '../../lib/stripe-webhook.mjs';
export const prerender=false;
export const POST=({request})=>handleStripeWebhook(request,bindings);
