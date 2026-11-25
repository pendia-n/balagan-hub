import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {refill,fulfillStripe,reconcileCheckout} from '../src/lib/fulfill.mjs';
import {checkoutParams,verifyWebhook} from '../src/lib/stripe.mjs';
import {offers} from '../src/lib/offers.mjs';
import {balance,pitchQuote,publishPitch,reserveEntry,settleRound} from '../src/lib/wallet.mjs';

function fixture(t){
 const sql=new DatabaseSync(':memory:');
 t.after(()=>sql.close());
 for(const file of ['0001_accounts_wallet','0003_stripe_lifecycle','0004_billing_cancellation','0006_thiskicks_wallet']){
  sql.exec(readFileSync(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
 }
 sql.exec("INSERT INTO users VALUES('u','fixture','fixture',0)");
 const db={prepare(query){return {bind(...p){return {
  first:async()=>sql.prepare(query).get(...p),run:async()=>sql.prepare(query).run(...p),
  all:async()=>({results:sql.prepare(query).all(...p)})
 };}};},async batch(statements){
  sql.exec('BEGIN');
  try{for(const s of statements)await s.run();sql.exec('COMMIT');}catch(error){sql.exec('ROLLBACK');throw error;}
 }};
 return {db,sql};
}
const wrap=(type,object)=>({type,data:{object}});
test('one-time purchases are isolated, amount checked, fulfilled once and revoked on refund',async t=>{
 const {db,sql}=fixture(t);
 sql.exec("INSERT INTO checkout_orders(id,user_id,offer_id,amount_cents,stripe_session_id,state,created_at) VALUES('order','u','tokens-50',500,'cs_fixture','pending',0)");
 const session={id:'cs_fixture',mode:'payment',payment_status:'paid',payment_intent:'pi_fixture',currency:'usd',metadata:{app:'balagan',order_id:'order'},amount_total:500};
 const event='checkout.session.completed';
 await fulfillStripe({DB:db},wrap(event,{...session,metadata:{app:'other'}}));
 assert.equal(await balance(db,'u'),0);
 await assert.rejects(fulfillStripe({DB:db},wrap(event,{...session,amount_total:499})));
 await fulfillStripe({DB:db},wrap(event,session));
 await fulfillStripe({DB:db},wrap(event,session));
 assert.equal(await balance(db,'u'),50);
 await fulfillStripe({DB:db},wrap('charge.refunded',{refunded:true,payment_intent:'pi_fixture'}));
 await fulfillStripe({DB:db},wrap(event,session));
 assert.equal(await balance(db,'u'),0);
});
test('annual plans refill on a clamped monthly anniversary without rollover or duplicates',async t=>{
 const {db,sql}=fixture(t);
 const start=Date.UTC(2027,0,31)/1000,end=Date.UTC(2028,0,31)/1000;
 sql.prepare("INSERT INTO billing_entitlements(id,user_id,offer_id,paid_until,status,period_start) VALUES('sub_fixture','u','wallet-annual',?,'active',?)").run(end,start);
 const feb=Date.UTC(2027,1,28)/1000, march=Date.UTC(2027,2,31)/1000;
 await refill(db,'u',feb);await refill(db,'u',feb);
 assert.equal(await balance(db,'u',feb),600);
 await refill(db,'u',march);
 assert.equal(await balance(db,'u',march),600);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM token_grants').get().n,2);
});
test('verified tokens can be held, released and charged once with one free challenge per day',async t=>{
 const {db,sql}=fixture(t);
 sql.exec("INSERT INTO token_grants VALUES('pack','u',50,NULL,0)");
 const entry=game=>({userId:'u',game,roundId:crypto.randomUUID()});
 const now=1700000000;
 assert.equal((await reserveEntry(db,entry('wemember'),now)).cost,0);
 const bar=entry('barara');
 await reserveEntry(db,bar,now);await reserveEntry(db,bar,now);
 assert.equal(await balance(db,'u',now),20);
 assert.equal((await reserveEntry(db,entry('sorriest'),now)).cost,20);
 assert.equal(await reserveEntry(db,entry('wemember'),now),undefined);
 await settleRound(db,'barara',bar.roundId,'released','u');
 assert.equal(await balance(db,'u',now),30);
});
test('a Stripe signature covers the exact body and rejects stale timestamps',async()=>{
 const t=1700000000,body='{"fixture":true}',secret='whsec_fixture';
 const sig='t='+t+',v1='+createHmac('sha256',secret).update(t+'.'+body).digest('hex');
 assert.equal(await verifyWebhook(secret,body,sig,t),true);
 assert.equal(await verifyWebhook(secret,body+' ',sig,t),false);
 assert.equal(await verifyWebhook(secret,body,sig,t+301),false);
});

test('every offer creates Checkout with inline USD pricing and the intended recurrence',()=>{
 const terms={
  'tokens-50':[500,null], 'tokens-150':[700,null], 'tokens-500':[1500,null],
  'wallet-monthly':[1200,'month',1], 'wallet-annual':[13400,'year',1], 'wallet-two-year':[32600,'year',2],
 };
 assert.deepEqual(Object.keys(offers).sort(),Object.keys(terms).sort());
 for(const [id,[amount,interval,count]] of Object.entries(terms)){
  const form=checkoutParams({id:'fixture',offer:offers[id],origin:'https://balagan.live'});
  const base='line_items[0][price_data]';
  assert.equal(form.get(base+'[currency]'),'usd');
  assert.equal(form.get(base+'[product_data][tax_code]'),'txcd_10000000');
  assert.equal(form.get(base+'[tax_behavior]'),'inclusive');
  assert.equal(form.get(base+'[unit_amount]'),String(amount));
  assert.equal(form.get('mode'),interval?'subscription':'payment');
  assert.equal(form.get(base+'[recurring][interval]'),interval);
  assert.equal(form.get(base+'[recurring][interval_count]'),count?String(count):null);
  assert.equal(form.has('line_items[0][price]'),false);
  assert.equal(form.has('payment_method_types[0]'),false);
 }
});

test('Thiskicks publishes the first pitch free and later pitches for 30 tokens atomically',async t=>{
 const {db,sql}=fixture(t);
 const now=1700000000;
 const pitch={id:crypto.randomUUID(),userId:'u',title:'An idea',body:'The original pitch',image:null,maxCost:0};
 const later={...pitch,id:crypto.randomUUID()};
 assert.deepEqual(await pitchQuote(db,'u',now),{cost:0,balance:0});
 assert.equal((await publishPitch(db,pitch,now)).id,pitch.id);
 assert.equal(await publishPitch(db,later,now),undefined);
 assert.equal(await publishPitch(db,{...later,maxCost:30},now),undefined);
 sql.exec("INSERT INTO token_grants VALUES('pack','u',50,NULL,0)");
 assert.deepEqual(await pitchQuote(db,'u',now),{cost:30,balance:50});
 assert.equal(await publishPitch(db,later,now),undefined);
 assert.equal((await publishPitch(db,{...later,maxCost:30},now)).id,later.id);
 assert.equal((await publishPitch(db,{...later,title:'Retry tries to replace the title',maxCost:30},now)).id,later.id);
 assert.equal(sql.prepare('SELECT title FROM thiskicks_pitches WHERE id=?').get(later.id).title,pitch.title);
 assert.equal(await balance(db,'u',now),20);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM game_entries WHERE game='thiskicks' AND state='spent'").get().n,2);
});

test('wallet return checks ownership and confirmed Stripe payment before crediting once',async t=>{
 const {db,sql}=fixture(t);
 const id=crypto.randomUUID();
 sql.prepare("INSERT INTO checkout_orders(id,user_id,offer_id,amount_cents,stripe_session_id,state,created_at) VALUES(?,'u','tokens-50',500,'cs_return','pending',0)").run(id);
 let requests=0, payment='unpaid';
 t.mock.method(globalThis,'fetch',async url=>{
  requests++;
  assert.match(String(url),/checkout\/sessions\/cs_return$/);
  return Response.json({id:'cs_return',mode:'payment',status:'complete',payment_status:payment,
   amount_total:500,currency:'usd',metadata:{app:'balagan',order_id:id}});
 });
 const env={DB:db,STRIPE_SECRET_KEY:'fixture'};
 assert.equal(await reconcileCheckout(env,'other-user',id),null);
 assert.equal(requests,0);
 assert.equal(await reconcileCheckout(env,'u',id),'pending');
 assert.equal(await balance(db,'u'),0);
 payment='paid';
 assert.equal(await reconcileCheckout(env,'u',id),'paid');
 assert.equal(await reconcileCheckout(env,'u',id),'paid');
 assert.equal(await balance(db,'u'),50);
 assert.equal(requests,2);
});

test('a confirmed subscription return and repeated invoice cannot double-credit a refill',async t=>{
 const {db,sql}=fixture(t);
 const id=crypto.randomUUID(), start=Math.floor(Date.now()/1000)-60, end=start+86400*28;
 sql.prepare("INSERT INTO checkout_orders(id,user_id,offer_id,amount_cents,stripe_session_id,state,created_at) VALUES(?,'u','wallet-monthly',1200,'cs_monthly','pending',0)").run(id);
 const invoice={id:'in_monthly',status:'paid',currency:'usd',amount_paid:1200,parent:{subscription_details:{subscription:'sub_monthly'}},
  lines:{data:[{period:{start,end},parent:{subscription_item_details:{subscription:'sub_monthly'}}}]}};
 const session={id:'cs_monthly',mode:'subscription',status:'complete',payment_status:'paid',invoice:invoice.id,subscription:'sub_monthly',
  metadata:{app:'balagan',order_id:id}};
 const subscription={id:'sub_monthly',status:'active',metadata:session.metadata};
 t.mock.method(globalThis,'fetch',async url=>Response.json(
  String(url).includes('/checkout/sessions/')?session:String(url).includes('/invoices/')?invoice:subscription
 ));
 const env={DB:db,STRIPE_SECRET_KEY:'fixture'};
 assert.equal(await reconcileCheckout(env,'u',id),'paid');
 assert.equal(await balance(db,'u'),600);
 await fulfillStripe(env,wrap('invoice.paid',invoice));
 assert.equal(await balance(db,'u'),600);
});
