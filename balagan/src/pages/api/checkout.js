import { bindings, signedIn } from '../../lib/hub.mjs';
import { offers } from '../../lib/offers.mjs';
import { checkoutParams, stripe } from '../../lib/stripe.mjs';
export const prerender=false;
export async function POST({request,url,cookies}){
 if(request.headers.get('Origin')!==url.origin)return new Response(null,{status:403});
 const user=await signedIn(cookies);
 if(!user)return Response.redirect(url.origin+'/signin',303);
 if(!bindings.STRIPE_SECRET_KEY||!bindings.STRIPE_WEBHOOK_SECRET)return new Response('Checkout is temporarily unavailable.',{status:503});
 const offerId=url.searchParams.get('offer'), offer=Object.hasOwn(offers,offerId)?offers[offerId]:null;
 if(!offer)return new Response('Unknown offer.',{status:400});
 const id=crypto.randomUUID(), db=bindings.DB;
 await db.prepare("INSERT INTO checkout_orders(id,user_id,offer_id,amount_cents,state,created_at) VALUES(?,?,?,?,'pending',unixepoch())")
   .bind(id,user.user.id,offerId,offer.cents).run();
 const params=checkoutParams({id,offer,origin:url.origin});
 try {
  const session=await stripe(bindings.STRIPE_SECRET_KEY,'checkout/sessions',params,'balagan-order-'+id);
  await db.prepare('UPDATE checkout_orders SET stripe_session_id=? WHERE id=?').bind(session.id,id).run();
  return Response.redirect(session.url,303);
 } catch {
  return new Response('Could not open checkout. Please try again.',{status:502});
 }
}
