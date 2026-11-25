import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {cp,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {signSession,SESSION_SECONDS,verifySession} from '../src/lib/session.mjs';
import {reserveEntry,settleRound,balance} from '../src/lib/wallet.mjs';
import {acceptGameRewards} from '../src/lib/game-rewards.mjs';

const dir=await mkdtemp(join(tmpdir(),'balagan-challenges-'));
for(const name of ['game-auth','session','settlement-proof'])await cp(new URL('../src/lib/'+name+'.mjs',import.meta.url),join(dir,name+'.mjs'));
for(const name of ['challenges','challenge-rules'])await cp(new URL('../game-worker/'+name+'.mjs',import.meta.url),join(dir,name+'.mjs'));
const {challenges,maintainChallenges}=await import(pathToFileURL(join(dir,'challenges.mjs')));
process.on('exit',()=>{void rm(dir,{force:true,recursive:true});});
const secret='12'.repeat(32);
const hostFor={wemember:'wemember.balagan.live',barara:'bar.ara.balagan.live',sorriest:'sorriest.balagan.live'};
async function database(t,files){
 const sqlite=new DatabaseSync(':memory:');
 t.after(()=>sqlite.close());
 for(const file of files)sqlite.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const db={prepare(query){const prepareBound=(...args)=>({
  first:async()=>sqlite.prepare(query).get(...args),
  all:async()=>({results:sqlite.prepare(query).all(...args)}),
  run:async()=>({meta:{changes:Number(sqlite.prepare(query).run(...args).changes)}}),
 });return {...prepareBound(),bind:prepareBound};},async batch(statements){
  sqlite.exec('BEGIN');
  try{const res=[];for(const s of statements)res.push(await s.run());sqlite.exec('COMMIT');return res;}
  catch(e){sqlite.exec('ROLLBACK');throw e;}
 }};
 return {db,sqlite};
}
async function fixture(t,game){
 const {db,sqlite}=await database(t,['game-worker/decks/'+game+'.sql','game-worker/challenges.sql']);
 const ledger=await database(t,['migrations/0001_accounts_wallet.sql','migrations/0005_game_rewards.sql']);
 const people=[], media=new Map();
 let clock=Date.UTC(2027,0,18,11,0);
 t.mock.method(Date,'now',()=>clock);
 for(let i=0;i<7;i++){
  const id=crypto.randomUUID(),username='Player '+i;
  ledger.sqlite.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id,username,'fixture',Math.floor(clock/1000));
  ledger.sqlite.prepare('INSERT INTO token_grants VALUES (?,?,?,?,?)').run('pack:'+id,id,100,null,Math.floor(clock/1000));
  const token=await signSession(secret,{id:crypto.randomUUID(),user_id:id,expires_at:Math.floor(clock/1000)+SESSION_SECONDS},game);
  people.push({id,username,token});
 }
 const env={DB:db,BALAGAN_JWT_SECRET:secret,MEDIA:{
  async put(key,bytes){media.set(key,bytes);},
  async get(key){return media.has(key)?{body:new Response(media.get(key)).body}:null;},
  async delete(key){media.delete(key);}
 },BALAGAN:{async fetch(request){
  const route=new URL(request.url).pathname;
  if(route==='/api/game-rewards')return acceptGameRewards(request,{DB:ledger.db,BALAGAN_JWT_SECRET:secret});
  const claims=await verifySession(secret,request.headers.get('Authorization')?.slice(7),game);
  if(!claims)return new Response(null,{status:401});
  const user=people.find(person=>person.id===claims.sub);
  if(route==='/api/session')return Response.json({id:user.id,username:user.username});
  if(route==='/api/entry'){
   const roundId=request.headers.get('X-Balagan-Round');
   const result=await reserveEntry(ledger.db,{userId:user.id,game,roundId},Math.floor(clock/1000));
   if(!result)return new Response(null,{status:402});
   await settleRound(ledger.db,game,roundId,'spent',user.id);
   return Response.json({cost:result.cost});
  }
  throw Error(route);
 }}};
 const origin='https://'+hostFor[game];
 async function request(path,person,body,ctype){
  const headers={};
  if(person)headers.Cookie='__Host-balagan='+person.token;
  if(body!==undefined){headers.Origin=origin;headers['Content-Type']=ctype||'application/x-www-form-urlencoded';}
  const req=new Request(origin+path,{method:body===undefined?'GET':'POST',headers,body:body instanceof Uint8Array?body:body===undefined?undefined:new URLSearchParams(body).toString()});
  return challenges(req,env,game,(_title,html,status)=>new Response(html,{status}));
 }
 return {db,sqlite,people,media,env,ledger,request,skip:ms=>{clock+=ms;},now:()=>clock};
}
const act=(f,route,p,action,other)=>f.request(route,p,{action,...other});
const money=(f,p)=>balance(f.ledger.db,p.id,Math.floor(f.now()/1000));

test('Wemember records a remix, prevents replay, awards typed recall and deletes audio after 15 minutes',async t=>{
 const f=await fixture(t,'wemember'),[host,player]=f.people;
 const created=await act(f,'/challenge/new',host,'create',{name:'Test recall'});
 const route=created.headers.get('Location');
 const id=route.split('/').pop();
 const row=f.sqlite.prepare('SELECT * FROM challenges WHERE id=?').get(id);
 assert.match(row.prompt_id,/^W\d{3}$/);
 const lobby=await (await f.request(route,player)).text();
 assert.ok(!lobby.includes(row.prompt));
 assert.ok(lobby.includes('value="https://wemember.balagan.live'+route+'" readonly'));
 assert.match(lobby,/<button type="button" id="copy-invite">Copy link<\/button>/);
 assert.match(lobby,/aria-current="step">Invite/);
 const frame=Buffer.alloc(313);
 frame.set([255,251,112,196]); // MPEG1 layer III, 96 kbps at 44.1 kHz.
 const sound=Buffer.concat(Array.from({length:100},()=>frame));
 const saved=await f.request(route+'/recording',host,sound,'audio/mpeg');
 assert.equal(saved.status,200,await saved.clone().text());
 await act(f,route,player,'join');
 await act(f,route,host,'start');
 await act(f,route,player,'enter');
 assert.equal(await money(f,player),100);
 assert.equal((await act(f,route,player,'submit',{reply:row.prompt})).status,409);
 assert.equal((await f.request(route+'/audio',player,{})).status,200);
 assert.equal((await f.request(route+'/audio',player,{})).status,410);
 f.skip(4000);
 await act(f,route,player,'submit',{reply:row.prompt});
 await act(f,route,host,'finish');
 assert.equal(await money(f,player),115);
 assert.match(await (await f.request(route,player)).text(),/3 \/ 3/);
 assert.equal(f.media.size,1);
 f.skip(15*60000+1);
 await maintainChallenges(f.env,'wemember',f.now());
 assert.equal(f.media.size,0);
 assert.equal(await money(f,player),115);
});

test('Barara enforces seats, seven pairs of arguments, sealed votes and one payout per winner',async t=>{
 const f=await fixture(t,'barara'),[host,opponent,...jury]=f.people;
 const created=await act(f,'/challenge/new',host,'create',{name:'Test court',case:'B001'});
 const route=created.headers.get('Location'),id=route.split('/').at(-1);
 for(const person of [opponent,...jury])await act(f,route,person,'join');
 await act(f,route,host,'start');
 for(const person of [host,opponent,...jury])await act(f,route,person,'enter');
 assert.equal((await act(f,route,opponent,'argument',{turn:0,reply:'Bad replay'})).status,409);
 for(let n=0;n<14;n++)await act(f,route,n%2?opponent:host,'argument',{turn:n,reply:'Turn '+n});
 assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM challenge_turns').get().n,14);
 for(const juror of jury)await act(f,route,juror,'vote',{choice:'host'});
 assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM challenge_votes WHERE choice=?').get('host').n,5);
 await act(f,route,host,'finish');
 assert.equal(await money(f,host),90);
 assert.equal(await money(f,opponent),70);
 assert.equal(await money(f,jury[0]),85);
 const result=f.sqlite.prepare('SELECT * FROM challenges WHERE id=?').get(id);
 assert.equal(result.reward_sent,1);
 await maintainChallenges(f.env,'barara',f.now());
 assert.equal(await money(f,jury[0]),85);
});

test('Sorriest schedules 19 contests, charges 20, caps replies and pays human-voted winners',async t=>{
 const f=await fixture(t,'sorriest'),[one,two,three]=f.people;
 await f.request('/daily');
 const monday=Math.floor(f.now()/86400000);
 assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM challenges WHERE code LIKE ?').get('S:'+monday+':%').n,19);
 const game=f.sqlite.prepare('SELECT * FROM challenges WHERE code=?').get('S:'+monday+':0');
 const route='/daily/'+game.id;
 for(const p of [one,two,three])await act(f,route,p,'enter');
 assert.equal(await money(f,one),80);
 assert.equal((await act(f,route,one,'submit',{reply:'X'.repeat(501)})).status,400);
 for(const p of [one,two,three])await act(f,route,p,'submit',{reply:'Apology by '+p.username});
 await act(f,route,one,'submit',{reply:'Should not replace'});
 assert.match(f.sqlite.prepare('SELECT reply FROM challenge_players WHERE user_id=?').get(one.id).reply,/^Apology by/);
 f.skip(game.submit_until-f.now()+1000);
 await act(f,route,one,'vote',{choice:one.id});
 assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM challenge_votes').get().n,0);
 await act(f,route,one,'vote',{choice:two.id});
 await act(f,route,three,'vote',{choice:two.id});
 await act(f,route,two,'vote',{choice:one.id});
 f.skip(game.vote_until-f.now()+1000);
 assert.match(await(await f.request(route,one)).text(),/2 votes/);
 assert.equal(await money(f,two),100);
 assert.equal(await money(f,one),100);
 assert.equal(await money(f,three),80);
});
