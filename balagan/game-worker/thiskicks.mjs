import { brandAsset, brandCSS, brandLink, iconTag } from './brand.mjs';
import { gameAuth, gameUser } from './game-auth.mjs';
import { pitchPrice, pitchQuote, publishPitch } from './wallet.mjs';
import { refill } from './fulfill.mjs';

const game = 'thiskicks';
const art = 'https://balagan.live/media/thiskicks-wide.png';
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (text, href) => '<a class="button" href="' + esc(href) + '">' + esc(text) + '</a>';
const pitchId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const route = id => '/pitch/' + encodeURIComponent(id);
const redirect = path => new Response(null,{status:303,headers:{Location:path}});
const css = `*{box-sizing:border-box}body{background:#edf3d8;color:#263219;margin:0;font:17px/1.55 system-ui,sans-serif}a{color:inherit}nav,main{width:min(1120px,calc(100% - 32px));margin:auto}nav{display:flex;justify-content:space-between;gap:12px;padding:20px 0;border-bottom:1px solid #a9b690}main{padding:30px 0}h1,h2{letter-spacing:-.05em;line-height:1}h1{font-size:clamp(35px,6vw,68px)}h2{font-size:32px}.hero{display:grid;grid-template-columns:1fr 1fr;background:#f8fbe9;border:1px solid #a9b690;border-radius:8px;overflow:hidden}.hero div,.panel{padding:clamp(16px,4vw,39px)}.hero img{width:100%;height:100%;object-fit:cover}.panel{background:#f8fbe9;border:1px solid #a9b690;border-radius:8px;margin-bottom:14px}.columns{display:grid;grid-template-columns:2fr 1fr;gap:18px}.button,button{display:inline-block;color:inherit;background:#dcf16d;border:1px solid #263219;border-radius:4px;padding:10px 14px;font:inherit;font-weight:750;text-decoration:none;cursor:pointer}label{display:block;font-weight:700;margin-top:14px}input,textarea{display:block;width:100%;padding:10px;border:1px solid #a9b690;border-radius:4px;font:inherit;margin:4px 0 14px}textarea{min-height:130px}.attachments{display:block;width:100%;max-height:520px;object-fit:contain}.copy{white-space:pre-wrap;overflow-wrap:anywhere}:focus-visible{outline:3px solid #263219;outline-offset:4px}@media(max-width:700px){.hero,.columns{grid-template-columns:1fr}}`;
const guideCSS = `
.nav-links{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px}
.hero{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);background:#263219;color:#f8fbe9}
.hero .button{color:#263219}
.hero h1{margin:.25em 0 .35em}
main h1{overflow-wrap:anywhere}
.columns{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.hero p{max-width:42ch}
.guide{margin:48px 0;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:24px}
.guide h2{margin-top:0}
.guide li+li{margin-top:12px}
.guide ol{padding-left:24px}
.guide .panel{margin:0}
.check{display:flex;align-items:baseline;gap:10px;font-weight:500}
.check input{width:auto;margin:0}
#board article h3{margin-top:0;overflow-wrap:anywhere}
@media(max-width:720px){
 .hero,.guide,.columns{grid-template-columns:minmax(0,1fr)}
 .hero img{height:auto;aspect-ratio:16/9}
 .guide{margin:30px 0;gap:14px}
}
@media(max-width:440px){nav{flex-wrap:wrap;padding:12px 0}nav a{min-height:40px;display:inline-flex;align-items:center}}
`;
function page(title, content, status=200) {
  return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+' · Thiskicks</title>'+iconTag+'<style>'+brandCSS+css+guideCSS+'</style><body><nav>'+brandLink('Thiskicks')+'<div class="nav-links"><a href="/board">Pitch board</a><a href="https://balagan.live/wallet">Wallet</a><a href="https://balagan.live">Balagan</a></div></nav><main>'+content+'</main></body></html>',{
    status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'}
  });
}
const error = (message,status) => page(message,'<h1>'+esc(message)+'</h1>'+link('Return to pitch board','/board'),status);
const voteId = request => (request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-thiskicks-guest=([a-f0-9-]{36})(?=;|$)/)?.[1];
const form = (path, contents) => '<form method="post" action="'+path+'">'+contents+'</form>';
const fmt = text => '<p class="copy">'+esc(text)+'</p>';
async function actorKey(request,user) {
  if(user)return 'user:'+user.id;
  const bytes = new TextEncoder().encode(request.headers.get('CF-Connecting-IP') || 'local');
  const sum = await crypto.subtle.digest('SHA-256',bytes);
  return 'guest:'+Array.from(new Uint8Array(sum), n=>n.toString(16).padStart(2,'0')).join('');
}
async function requestForm(request, limit) {
  const reader=request.body?.getReader();
  if(!reader)return null;
  const chunks=[];
  let bytes=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    bytes+=value.length;
    if(bytes>limit){await reader.cancel();return null;}
    chunks.push(value);
  }
  return new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')||'application/x-www-form-urlencoded'}}).formData();
}
async function saveImage(file,env,id) {
  const bytes=new Uint8Array(await file.arrayBuffer());
  const starts=signature=>signature.every((byte,i)=>bytes[i]===byte);
  const type=starts([137,80,78,71,13,10,26,10])?'image/png':starts([255,216,255])?'image/jpeg':
    starts([71,73,70,56])&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97?'image/gif':null;
  if(!type || file.type!==type)return null;
  const key='pitches/'+id+'/'+crypto.randomUUID();
  await env.PITCH_MEDIA.put(key,bytes,{httpMetadata:{contentType:type}});
  return key;
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  const path=url.pathname;
  const brand=await brandAsset(request,env,game);
  if(brand)return brand;
  const auth=await gameAuth(request,env,game);
  if(auth)return auth;
  if(!['GET','HEAD','POST'].includes(request.method))return new Response(null,{status:405});
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return error('Invalid request origin',403);
  const db=env.DB;
  if(path==='/board'&&request.method==='GET'){
    const {results}=await db.prepare('SELECT id,title,body FROM thiskicks_pitches ORDER BY created_at DESC,id LIMIT 60').all();
    const rows=results.map(p=>'<article class="panel"><h3><a href="'+route(p.id)+'">'+esc(p.title)+'</a></h3>'+fmt(p.body.slice(0,180))+'</article>').join('');
    return page('Pitch board','<h1>Pitch board</h1><p>Browse ideas, vote, and give feedback.</p>'+link('Write a pitch','/new')+'<section id="board">'+(rows||'<p>The board is empty. Publish the first pitch.</p>')+'</section>');
  }
  if(path==='/'&&request.method==='GET'){
    return page('Thiskicks',`
      <section class="hero">
        <div>
          <h1>Would anyone buy this?</h1>
          <p>Pitch something you’re building, thinking of selling, or making up for fun. Hear what people would buy, question, or change.</p>
          ${link('Write a pitch','/new')} <a href="/board">Browse pitches</a>
        </div>
        <img src="${art}" alt="An inventor presents a tiny umbrella for a houseplant" width="1672" height="941">
      </section>
      <div class="guide">
        <section>
          <h2>From idea to feedback</h2>
          <ol>
            <li><strong>Write.</strong> Give your product a name and explain who it’s for and what it does. Add one PNG, JPG or GIF if it helps.</li>
            <li><strong>Publish and share.</strong> Sign in with Balagan and send people the link to your pitch. Check your text and image first. A published pitch can’t be edited or deleted.</li>
            <li><strong>Hear what people think.</strong> Anyone can browse, vote, and comment for free. Comments from signed-out visitors appear as <strong>anon</strong>.</li>
          </ol>
        </section>
        <section class="panel" id="publishing">
          <h2>Publishing cost</h2>
          <p><strong>First pitch free.</strong> Every later pitch costs <strong>${pitchPrice} Balagan tokens</strong> when you publish.</p>
          <p>Use the tokens you buy in Balagan or earn in Wemember, Sorriest and Barara. Publishing, votes and comments don’t earn tokens.</p>
          <a href="https://balagan.live/wallet">Open Balagan wallet</a>
        </section>
      </div>`);
  }
  if(path==='/plans'&&request.method==='GET'){
    return redirect('/#publishing');
  }
  if(path==='/new'){
    const user=await gameUser(request,env,game);
    if(!user)return redirect('/auth/start?next=%2Fnew');
    await refill(db,user.id);
    const renderForm = async (id, title='', body='', notice='', status=200) => {
      const quote=await pitchQuote(db,user.id);
      const hasFunds=quote.balance>=quote.cost;
      const price=quote.cost===0?'free':quote.cost+' tokens';
      return page('Create a pitch',`
        <h1>Create a pitch</h1>
        <div class="panel">
          <p><strong>Price: ${price}.</strong> Wallet balance: ${quote.balance} tokens.</p>
          ${notice?'<p role="alert">'+esc(notice)+'</p>':''}
          ${hasFunds?'':'<p>You need '+(quote.cost-quote.balance)+' more tokens. <a href="https://balagan.live/wallet" target="_blank" rel="noopener">Open your wallet</a> and submit after adding tokens.</p>'}
          <form method="post" enctype="multipart/form-data">
            <input type="hidden" name="pitchId" value="${id}">
            <input type="hidden" name="maxCost" value="${quote.cost}">
            <label for="title">Product name</label>
            <input id="title" name="title" maxlength="80" required value="${esc(title)}">
            <label for="body">Your pitch</label>
            <textarea id="body" name="body" maxlength="800" required>${esc(body)}</textarea>
            <label for="image">Optional image · PNG, JPG or GIF, up to 5 MB</label>
            <input id="image" name="image" type="file" accept="image/png,image/jpeg,image/gif">
            <label class="check"><input type="checkbox" name="confirmed" value="yes" required> I understand the pitch will be public and I can’t edit or delete it after publishing.</label>
            <button>Publish pitch · ${price}</button>
          </form>
        </div>`,status);
    };
    if(request.method==='GET')return renderForm(crypto.randomUUID());
    if(request.method!=='POST')return new Response(null,{status:405});
    let data;
    try { data=await requestForm(request,5_300_000); }
    catch { return error('Invalid pitch form',400); }
    if(!data)return error('Upload too large',413);
    const title=String(data.get('title')||'').trim(), body=String(data.get('body')||'').trim(), file=data.get('image');
    const id=String(data.get('pitchId')||''), quoted=data.get('maxCost');
    if(!pitchId.test(id)||!['0',String(pitchPrice)].includes(quoted))return error('Reload the pitch form and try again',400);
    const prior=await db.prepare('SELECT id FROM thiskicks_pitches WHERE id=? AND owner_id=?').bind(id,user.id).first();
    if(prior)return redirect(route(prior.id));
    if(!title||title.length>80||!body||body.length>800)return renderForm(id,title,body,'Enter a product name and a pitch of at most 800 characters.',400);
    if(data.get('confirmed')!=='yes')return renderForm(id,title,body,'Confirm that published pitches are permanent.',400);
    let image=null;
    if(file instanceof File&&file.size){
      if(file.size>5_242_880)return renderForm(id,title,body,'Choose an image no larger than 5 MB.',413);
      image=await saveImage(file,env,id);
      if(!image)return renderForm(id,title,body,'Choose a valid PNG, JPG or GIF.',415);
    }
    // A failed D1 response can be ambiguous. Keep the upload if its commit status is unknown.
    const saved=await publishPitch(db,{id,userId:user.id,title,body,image,maxCost:Number(quoted)});
    if(image&&saved?.image_key!==image)await env.PITCH_MEDIA.delete(image);
    if(saved)return redirect(route(id));
    const quote=await pitchQuote(db,user.id);
    const reattach=image?' Choose your image again before submitting.':'';
    if(quote.cost>Number(quoted))return renderForm(id,title,body,'Your first free pitch has already been published. Review the new price and confirm.'+reattach,409);
    return renderForm(id,title,body,'You don’t have enough tokens to publish. Add tokens and try again.'+reattach,402);
  }

  const match=/^\/pitch\/([a-z0-9-]+)(?:\/(image|comment|vote))?$/.exec(path);
  if(!match)return error('Page not found',404);
  const [,id,action]=match;
  const pitch=await db.prepare('SELECT * FROM thiskicks_pitches WHERE id=?').bind(id).first();
  if(!pitch)return error('Pitch not found',404);
  if(action==='image'&&pitch.image_key&&['GET','HEAD'].includes(request.method)){
    const object=await env.PITCH_MEDIA.get(pitch.image_key);
    if(!object)return new Response(null,{status:404});
    return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'}});
  }
  if(['comment','vote'].includes(action)&&request.method==='POST'){
    const user=await gameUser(request,env,game);
    if(action==='comment'){
      const data=await requestForm(request,4096);
      const comment=String(data?.get('comment')||'').trim();
      if(!comment||comment.length>400)return error('Write a comment under 400 characters',400);
      const actor=await actorKey(request,user), now=Date.now();
      const inserted=await db.prepare('INSERT INTO thiskicks_comments SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM thiskicks_comments WHERE actor=? AND created_at>?)<10')
        .bind(crypto.randomUUID(),id,user?.username??'anon',actor,comment,now,actor,now-900_000).run();
      if(!inserted.meta.changes)return error('Too many comments. Try again in a few minutes.',429);
      return redirect(route(id));
    }
    const guest=voteId(request)||crypto.randomUUID();
    await db.prepare('INSERT OR IGNORE INTO thiskicks_votes VALUES (?,?)').bind(id,user?'user:'+user.id:'guest:'+guest).run();
    const response=redirect(route(id));
    if(!user&&!voteId(request))response.headers.append('Set-Cookie','__Host-thiskicks-guest='+guest+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000');
    return response;
  }
  if(action||request.method!=='GET')return error('Page not found',404);
  const user=await gameUser(request,env,game);
  const comments=await db.prepare('SELECT author,body FROM thiskicks_comments WHERE pitch_id=? ORDER BY created_at DESC,id LIMIT 80').bind(id).all();
  const votes=await db.prepare('SELECT count(*) AS total FROM thiskicks_votes WHERE pitch_id=?').bind(id).first();
  return page(pitch.title,'<h1>'+esc(pitch.title)+'</h1><div class="columns"><section class="panel">'+(pitch.image_key?'<img class="attachments" src="'+route(id)+'/image" alt="Pitch illustration">':'')+fmt(pitch.body)+form(route(id)+'/vote','<button>Vote · '+votes.total+'</button>')+'</section><aside class="panel"><h2>Comments</h2>'+form(route(id)+'/comment','<label for="comment">Comment as '+esc(user?.username??'anon')+'</label><textarea id="comment" name="comment" maxlength="400" required></textarea><button>Post comment</button>')+comments.results.map(row=>'<div><strong>'+esc(row.author)+'</strong>'+fmt(row.body)+'</div>').join('')+'</aside></div>');
}};
