export function monthWindow(now=Date.now()){
 const local=new Date(now+3*3600000);
 let end=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1,2)-3*3600000;
 if(now<end)end=Date.UTC(local.getUTCFullYear(),local.getUTCMonth()-1,1,2)-3*3600000;
 const e=new Date(end+3*3600000);
 const start=Date.UTC(e.getUTCFullYear(),e.getUTCMonth()-1,1,2)-3*3600000;
 return {start:Math.floor(start/1000),end:Math.floor(end/1000),key:e.toISOString().slice(0,7)};
}
export function activeMonth(now=Date.now()){
 const previous=monthWindow(now), date=new Date(previous.end*1000+3*3600000);
 return {start:previous.end,end:Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1,2)-3*3600000)/1000)};
}
export const prize=rank=>rank===1?350:rank<=3?280:rank<=10?230:rank<=25?100:rank<=50?30:0;
export function rankPitches(rows){
 const seen=new Set();
 const eligible=rows.filter(row=>row.votes>0&&!seen.has(row.owner_id)&&seen.add(row.owner_id));
 const winners=[];
 for(let index=0;index<eligible.length&&index<50;){
  let end=index+1;
  while(end<eligible.length&&eligible[end].votes===eligible[index].votes)end++;
  let pool=0;
  for(let i=index;i<Math.min(end,50);i++)pool+=prize(i+1);
  const amount=Math.floor(pool/(end-index));
  for(let i=index;i<end;i++)winners.push({...eligible[i],rank:index+1,amount});
  index=end;
 }
 return winners;
}
export async function monthlyPitches(db,window){
 // Select one highest-voted pitch per creator before taking the winning positions.
 const {results}=await db.prepare(`
  WITH totals AS (
   SELECT p.id,p.owner_id,p.title,p.created_at,count(v.voter) AS votes
   FROM thiskicks_pitches p LEFT JOIN thiskicks_monthly_votes v ON v.pitch_id=p.id AND v.created_at>=? AND v.created_at<?
   WHERE p.created_at>=? AND p.created_at<? GROUP BY p.id
  ), ranked AS (
   SELECT *,row_number() OVER(PARTITION BY owner_id ORDER BY votes DESC,created_at,id) AS creator_rank FROM totals
  ) SELECT * FROM ranked WHERE creator_rank=1 AND votes>0 ORDER BY votes DESC,created_at,id
 `).bind(window.start,window.end,window.start,window.end).all();
 return rankPitches(results);
}
export async function settlePitchMonth(db,now=Date.now()){
 const window=monthWindow(now);
 if(await db.prepare('SELECT 1 FROM thiskicks_reward_months WHERE month=?').bind(window.key).first())return;
 const winners=await monthlyPitches(db,window);
 const snapshot=JSON.stringify(winners);
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO thiskicks_reward_months VALUES(?,?,?)').bind(window.key,snapshot,window.end),
  ...winners.filter(w=>w.amount>0).map(w=>db.prepare(`
   INSERT OR IGNORE INTO token_grants(id,user_id,amount,expires_at,created_at)
   SELECT ?,?,?,NULL,? FROM thiskicks_reward_months WHERE month=? AND results_json=?
  `).bind('pitch-month:'+window.key+':'+w.owner_id,w.owner_id,w.amount,window.end,window.key,snapshot))
 ]);
}
