import {bindings} from '../../lib/hub.mjs';
import {validSettlement} from '../../lib/settlement-proof.mjs';
export const prerender=false;
const payouts={wemember:[15,8,5],sorriest:[20,20,20,10,10,10,10,8,8,5]};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
async function read(request){
 const reader=request.body?.getReader();
 if(!reader)return '';
 const text=new TextDecoder();
 let body='',count=0;
 while(true){
  const chunk=await reader.read();
  if(chunk.done)return body+text.decode();
  count+=chunk.value.byteLength;
  if(count>4000){await reader.cancel();return '';}
  body+=text.decode(chunk.value,{stream:true});
 }
}
export async function POST({request}){
 const body=await read(request);
 if(!body||!await validSettlement(bindings.BALAGAN_JWT_SECRET,request.headers.get('X-Balagan-Time'),body,request.headers.get('X-Balagan-Signature')))return new Response(null,{status:401});
 let input;
 try{input=JSON.parse(body);}catch{return new Response(null,{status:400});}
 const {game,round,winners}=input||{};
 if(!['wemember','sorriest','barara'].includes(game)||typeof round!=='string'||!uuid.test(round)||!Array.isArray(winners)||
    winners.length>(game==='barara'?6:payouts[game].length)||winners.some(id=>typeof id!=='string'||!uuid.test(id))||
    new Set(winners).size!==winners.length)return new Response(null,{status:400});
 const db=bindings.DB;
 const cutoff=Math.floor(Date.now()/1000);
 // Every rewarded participant must have a valid spent entry, including a free Wemember seat.
 // The settlement ID also prevents a retry from changing the recipients after a final result.
 const count=await Promise.all(winners.map(user=>db.prepare("SELECT 1 FROM game_entries WHERE game=? AND round_id=? AND user_id=? AND state='spent'").bind(game,round,user).first()));
 if(count.some(row=>!row))return new Response(null,{status:409});
 const key='game-reward:'+game+':'+round;
 const insert=db.prepare('INSERT INTO game_reward_rounds(id,results_json,created_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(key,JSON.stringify(winners),cutoff);
 const grants=winners.map((user,i)=>db.prepare(`INSERT OR IGNORE INTO token_grants(id,user_id,amount,expires_at,created_at)
   SELECT ?,?,?,NULL,? FROM game_reward_rounds WHERE id=? AND results_json=?`)
    .bind(key+':'+user,user,game==='barara'?(i===0?20:15):payouts[game][i],cutoff,key,JSON.stringify(winners)));
 await db.batch([insert,...grants]);
 return Response.json({received:true});
}
