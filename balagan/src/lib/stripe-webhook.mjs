import { verifyWebhook } from './stripe.mjs';
import { fulfillStripe } from './fulfill.mjs';
export async function handleStripeWebhook(request,bindings){
 if(!bindings.STRIPE_WEBHOOK_SECRET)return new Response(null,{status:503});
 const reader=request.body?.getReader();
 if(!reader)return new Response(null,{status:400});
 const decoder=new TextDecoder();
 let raw='',len=0;
 while(true){
  const next=await reader.read();
  if(next.done)break;
  len+=next.value.length;
  if(len>1_048_576){await reader.cancel();return new Response(null,{status:413});}
  raw+=decoder.decode(next.value,{stream:true});
 }
 raw+=decoder.decode();
 if(!await verifyWebhook(bindings.STRIPE_WEBHOOK_SECRET,raw,request.headers.get('Stripe-Signature')))return new Response(null,{status:400});
 let event;
 try{event=JSON.parse(raw);}catch{return new Response(null,{status:400});}
 try{await fulfillStripe(bindings,event);}catch{return new Response(null,{status:502});}
 return Response.json({received:true});
}
