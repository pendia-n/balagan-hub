import { bindings,signedIn } from '../../lib/hub.mjs';
import { stripe } from '../../lib/stripe.mjs';
export const prerender=false;
export async function POST({request,url,cookies}){
 if(request.headers.get('Origin')!==url.origin)return new Response(null,{status:403});
 const current=await signedIn(cookies);
 if(!current)return Response.redirect(url.origin+'/signin',303);
 const id=url.searchParams.get('subscription');
 if(!/^sub_[A-Za-z0-9]+$/.test(id||''))return new Response(null,{status:400});
 const db=bindings.DB;
 const row=await db.prepare("SELECT id FROM billing_entitlements WHERE id=? AND user_id=? AND status='active' AND paid_until>unixepoch()")
   .bind(id,current.user.id).first();
 if(!row)return new Response(null,{status:404});
 try{
  const result=await stripe(bindings.STRIPE_SECRET_KEY,'subscriptions/'+encodeURIComponent(id),new URLSearchParams({cancel_at_period_end:'true'}));
  if(!result.cancel_at_period_end)throw new Error('Cancel confirmation was not returned');
  await db.prepare('UPDATE billing_entitlements SET cancel_at_period_end=1 WHERE id=?').bind(id).run();
  return Response.redirect(url.origin+'/account',303);
 }catch{return new Response('Could not stop renewal. Please try again.',{status:502});}
}
