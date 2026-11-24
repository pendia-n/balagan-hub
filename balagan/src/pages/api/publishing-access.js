import { bindings } from '../../lib/hub.mjs';
import { offerFor } from '../../lib/offers.mjs';
import { findLiveSession, verifySession } from '../../lib/session.mjs';
export const prerender=false;

export async function GET({request}){
 const bearer=request.headers.get('Authorization');
 if(!bearer?.startsWith('Bearer '))return new Response(null,{status:401});
 const claims=await verifySession(bindings.BALAGAN_JWT_SECRET,bearer.slice(7),'thiskicks');
 const user=await findLiveSession(bindings.DB,claims);
 if(!user)return new Response(null,{status:401});
 const {results}=await bindings.DB.prepare("SELECT offer_id FROM billing_entitlements WHERE user_id=? AND status='active' AND (paid_until IS NULL OR paid_until>unixepoch())").bind(user.id).all();
 const quota=Math.max(0,...results.map(row=>offerFor(row.offer_id)?.quota||0));
 return Response.json({quota},{headers:{'Cache-Control':'no-store'}});
}
