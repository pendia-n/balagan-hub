import { bindings, signedIn } from '../../lib/hub.mjs';
import { offerFor } from '../../lib/offers.mjs';
import { stripe } from '../../lib/stripe.mjs';
export const prerender=false;
export async function POST({request,url,cookies}){
 if(request.headers.get('Origin')!==url.origin)return new Response(null,{status:403});
 const user=await signedIn(cookies);
 if(!user)return Response.redirect(url.origin+'/signin',303);
 if(!bindings.STRIPE_SECRET_KEY||!bindings.STRIPE_WEBHOOK_SECRET)return new Response('Checkout is temporarily unavailable.',{status:503});
 const offerId=url.searchParams.get('offer'), offer=offerFor(offerId);
 if(!offer)return new Response('Unknown offer.',{status:400});
 const id=crypto.randomUUID(), db=bindings.DB;
 await db.prepare("INSERT INTO checkout_orders(id,user_id,offer_id,amount_cents,state,created_at) VALUES(?,?,?,?,'pending',unixepoch())")
   .bind(id,user.user.id,offerId,offer.cents).run();
 const params=new URLSearchParams({
  mode:offer.interval?'subscription':'payment','metadata[app]':'balagan','metadata[order_id]':id,
  'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(offer.cents),
  'line_items[0][price_data][product_data][name]':offer.name,'line_items[0][quantity]':'1',
  success_url:url.origin+(offer.group==='wallet'?'/wallet':'/publishing')+'?checkout=complete',
  cancel_url:url.origin+(offer.group==='wallet'?'/wallet':'/publishing')
 });
 if(offer.interval){
  params.set('line_items[0][price_data][recurring][interval]',offer.interval);
  params.set('line_items[0][price_data][recurring][interval_count]',String(offer.count));
  params.set('subscription_data[metadata][app]','balagan');
  params.set('subscription_data[metadata][order_id]',id);
 } else {
  params.set('payment_intent_data[metadata][app]','balagan');
  params.set('payment_intent_data[metadata][order_id]',id);
 }
 try {
  const session=await stripe(bindings.STRIPE_SECRET_KEY,'checkout/sessions',params,'balagan-order-'+id);
  await db.prepare('UPDATE checkout_orders SET stripe_session_id=? WHERE id=?').bind(session.id,id).run();
  return Response.redirect(session.url,303);
 } catch {
  return new Response('Could not open checkout. Please try again.',{status:502});
 }
}
