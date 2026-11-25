import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('..',import.meta.url));
const mvp = process.argv[2] || fileURLToPath(new URL('../../..',import.meta.url));
const games = [
 { name:'wemember', directory:'we-member/wemember', host:'wemember.balagan.live', db:'d0102529-29ac-4be3-b3dc-586812cf9471', bucket:'wemember-media' },
 { name:'sorriest', directory:'apology-olympics/sorry-better', host:'sorriest.balagan.live', db:'571c2a5f-a2bb-456a-afc6-d2b08d4cd19e' },
 { name:'barara', directory:'defend-violation/barara', host:'bar.ara.balagan.live', db:'3b9eb45a-ec01-4725-b0c8-e0ce83bd1c37' },
];
for(const game of games){
 const folder=resolve(mvp,game.directory);
 const worker=resolve(folder,'balagan-worker');
 await mkdir(resolve(worker,'migrations'),{recursive:true});
 for(const file of ['game-auth.mjs','session.mjs','settlement-proof.mjs'])await copyFile(resolve(project,'src/lib',file),resolve(worker,file));
 for(const file of ['room.mjs','games.mjs','brand.mjs','challenges.mjs','challenge-rules.mjs','landing.mjs'])await copyFile(resolve(project,'game-worker',file),resolve(worker,file));
 await copyFile(resolve(project,'game-worker/rooms.sql'),resolve(worker,'migrations/0001_rooms.sql'));
 await copyFile(resolve(project,'game-worker/decks',game.name+'.sql'),resolve(worker,'migrations/0002_prompt_deck.sql'));
 await copyFile(resolve(project,'game-worker/challenges.sql'),resolve(worker,'migrations/0003_challenges.sql'));
 await writeFile(resolve(worker,'index.mjs'),'import { createRoomWorker } from "./room.mjs";\nexport default createRoomWorker('+JSON.stringify(game.name)+');\n');
 const config={
  name:game.name,main:'balagan-worker/index.mjs',compatibility_date:'2026-11-17',triggers:{crons:['* * * * *']},
  routes:[{pattern:game.host,custom_domain:true}],services:[{binding:'BALAGAN',service:'balagan'}],
  d1_databases:[{binding:'DB',database_name:game.name+'-db',database_id:game.db,migrations_dir:'balagan-worker/migrations'}],
 };
 if(game.bucket)config.r2_buckets=[{binding:'MEDIA',bucket_name:game.bucket}];
 await writeFile(resolve(folder,'wrangler.production.json'),JSON.stringify(config,null,2)+'\n');
}

const thiskicks = resolve(mvp,'gain-recreation/thiskicks');
const pitchWorker = resolve(thiskicks,'worker');
await mkdir(pitchWorker,{recursive:true});
for(const file of ['game-auth.mjs','session.mjs','wallet.mjs','fulfill.mjs','offers.mjs','stripe.mjs']){
 await copyFile(resolve(project,'src/lib',file),resolve(pitchWorker,file));
}
await copyFile(resolve(project,'game-worker/brand.mjs'),resolve(pitchWorker,'brand.mjs'));
await copyFile(resolve(project,'game-worker/thiskicks.mjs'),resolve(pitchWorker,'index.mjs'));
await writeFile(resolve(thiskicks,'wrangler.production.json'),JSON.stringify({
 name:'thiskicks',main:'worker/index.mjs',compatibility_date:'2026-11-17',
 routes:[{pattern:'thiskicks.balagan.live',custom_domain:true}],
 services:[{binding:'BALAGAN',service:'balagan'}],
 d1_databases:[{binding:'DB',database_name:'balagan-auth',database_id:'2136db13-de0b-4484-8cd8-d14c835b2401'}],
 r2_buckets:[{binding:'PITCH_MEDIA',bucket_name:'thiskicks-pitch-media'}],
},null,2)+'\n');
