import { offerFor } from './offers.mjs';
import { stripe } from './stripe.mjs';
const ref=value=>typeof value==='string'?value:value?.id;
function addMonth(epoch,offset){
 const date=new Date(epoch*1000), day=date.getUTCDate();
 date.setUTCDate(1);
 date.setUTCMonth(date.getUTCMonth()+offset);
 const end=new Date(date);
 end.setUTCMonth(end.getUTCMonth()+1,0);
 date.setUTCDate(Math.min(day,end.getUTCDate()));
 return Math.floor(date.getTime()/1000);
}

export async function refill(db,userId,now=Math.floor(Date.now()/1000)){
 const {results}=await db.prepare("SELECT * FROM billing_entitlements WHERE user_id=? AND status='active' AND period_start IS NOT NULL AND paid_until>?")
   .bind(userId,now).all();
 for(const item of results){
  const offer=offerFor(item.offer_id);
  if(!offer?.tokens)continue;
  const months=offer.interval==='year'?offer.count*12:1;
  for(let i=0;i<months;i++){
   const start=addMonth(item.period_start,i), end=Math.min(addMonth(item.period_start,i+1),item.paid_until);
   if(start>now||end<=now)continue;
   await db.prepare('INSERT OR IGNORE INTO token_grants VALUES (?,?,?,?,?)')
     .bind(item.id+':'+start,userId,offer.tokens,end,start).run();
  }
 }
}

export async function fulfillStripe(env,event){
 const data=event.data?.object, db=env.DB;
 if(!data)return;
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
  if(data.metadata?.app!=='balagan'||data.mode!=='payment'||data.payment_status!=='paid')return;
  const order=await db.prepare('SELECT * FROM checkout_orders WHERE id=? AND stripe_session_id=?').bind(data.metadata.order_id,data.id).first();
  if(!order)throw new Error('Checkout order has not finished saving.');
  if(data.currency!=='usd'||data.amount_total!==order.amount_cents)throw new Error('Checkout amount mismatch');
  const offer=offerFor(order.offer_id);
  if(!offer||offer.interval)return;
  const statements=[db.prepare("UPDATE checkout_orders SET state='paid',stripe_payment_intent=?,stripe_customer=? WHERE id=? AND state='pending'")
   .bind(ref(data.payment_intent)??null,ref(data.customer)??null,order.id)];
  if(offer.tokens){
   statements.push(db.prepare("INSERT OR IGNORE INTO token_grants SELECT id,user_id,?,NULL,unixepoch() FROM checkout_orders WHERE id=? AND state='paid'")
    .bind(offer.tokens,order.id));
  }else{
   statements.push(db.prepare("INSERT OR IGNORE INTO billing_entitlements(id,user_id,offer_id,paid_until,next_refill_at,status,stripe_order_id) SELECT id,user_id,offer_id,NULL,NULL,'active',id FROM checkout_orders WHERE id=? AND state='paid'").bind(order.id));
  }
  await db.batch(statements);
 } else if(event.type==='invoice.paid'){
  const subscriptionId=ref(data.parent?.subscription_details?.subscription)||ref(data.subscription);
  if(!subscriptionId)return;
  const subscription=await stripe(env.STRIPE_SECRET_KEY,'subscriptions/'+encodeURIComponent(subscriptionId));
  if(subscription.metadata?.app!=='balagan'||!['active','canceled'].includes(subscription.status))return;
  const order=await db.prepare('SELECT * FROM checkout_orders WHERE id=?').bind(subscription.metadata.order_id).first();
  const offer=order&&offerFor(order.offer_id);
  if(!offer?.interval||data.currency!=='usd'||(data.amount_paid||0)<order.amount_cents||data.paid===false)return;
  const line=(data.lines?.data||[]).find(line=>line.parent?.subscription_item_details?.subscription===subscriptionId)
    ||data.lines?.data?.find(line=>line.period?.start&&line.period?.end);
  const start=line?.period?.start,end=line?.period?.end;
  if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start)return;
  await db.batch([
   db.prepare("UPDATE checkout_orders SET state='paid',stripe_customer=? WHERE id=? AND state='pending'").bind(ref(data.customer)??null,order.id),
   db.prepare(`INSERT INTO billing_entitlements(id,user_id,offer_id,paid_until,status,stripe_order_id,period_start)
      VALUES(?,?,?,?,'active',?,?) ON CONFLICT(id) DO UPDATE SET paid_until=excluded.paid_until,status='active',period_start=excluded.period_start
      WHERE excluded.paid_until>billing_entitlements.paid_until`)
    .bind(subscriptionId,order.user_id,order.offer_id,end,order.id,start)
  ]);
  await refill(db,order.user_id);
 } else if(event.type==='charge.refunded'&&data.refunded&&data.payment_intent){
  const order=await db.prepare('SELECT id FROM checkout_orders WHERE stripe_payment_intent=?').bind(ref(data.payment_intent)).first();
  if(order)await db.batch([
   db.prepare("UPDATE checkout_orders SET state='refunded' WHERE id=?").bind(order.id),
   db.prepare("UPDATE billing_entitlements SET status='refunded' WHERE stripe_order_id=?").bind(order.id),
   db.prepare("UPDATE token_grants SET expires_at=unixepoch() WHERE id=?").bind(order.id)
  ]);
 }
}
