const root='https://api.stripe.com/v1/';
const text=new TextEncoder();
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
export async function stripe(key,path,params,idempotency){
 if(!key)throw new Error('Stripe credentials unavailable');
 const headers={Authorization:'Bearer '+key,'Stripe-Version':'2026-09-30.endive'};
 if(params)headers['Content-Type']='application/x-www-form-urlencoded';
 if(idempotency)headers['Idempotency-Key']=idempotency;
 const response=await fetch(root+path,{method:params?'POST':'GET',headers,body:params,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Stripe API request failed: '+response.status);
 return response.json();
}

export async function verifyWebhook(secret,body,header,now=Math.floor(Date.now()/1000)){
 if(!secret || typeof header!=='string')return false;
 const values=header.split(',');
 const timestamp=values.find(s=>s.startsWith('t='))?.slice(2);
 if(!/^\d+$/.test(timestamp||'')||Math.abs(now-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',text.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,text.encode(timestamp+'.'+body))));
 return values.some(v=>{
  if(!/^v1=[a-f0-9]{64}$/.test(v))return false;
  let difference=0;
  for(let i=0;i<64;i++)difference|=signature.charCodeAt(i)^v.charCodeAt(i+3);
  return difference===0;
 });
}
