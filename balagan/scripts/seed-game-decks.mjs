import {readFile,writeFile} from 'node:fs/promises';
const here=new URL('../game-worker/decks/',import.meta.url);
const {w,s,p}=JSON.parse(await readFile(new URL('catalog.json',here),'utf8'));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
for(const [game,rows,prefix,count] of [['wemember',w,'W',99],['sorriest',s,'S',150],['barara',[
 'The missing cookie|The accused was seen near an empty plate and a trail of crumbs.',
 'The borrowed umbrella|A yellow umbrella disappeared just before it rained.'
],'B',2]]){
 if(rows.length!==count||new Set(rows).size!==count)throw Error('Invalid '+game+' deck');
 const commands=['CREATE TABLE IF NOT EXISTS prompt_deck (id TEXT PRIMARY KEY, template TEXT NOT NULL, slots_json TEXT NOT NULL CHECK(json_valid(slots_json)));'];
 for(const [i,row] of rows.entries()){
  const keys=[...row.matchAll(/\[([A-Z]{2})\]/g)].map(match=>match[1]);
  if(game!=='barara'&&(keys.length!==3||new Set(keys).size!==3||keys.some(key=>p[key]?.length!==5)))throw Error('Invalid deck row '+row);
  const id=prefix+String(i+1).padStart(3,'0');
  commands.push("INSERT INTO prompt_deck VALUES ("+[id,row,JSON.stringify(Object.fromEntries(keys.map(key=>[key,p[key]])))].map(quote).join(',')+") ON CONFLICT(id) DO UPDATE SET template=excluded.template,slots_json=excluded.slots_json;");
 }
 await writeFile(new URL(game+'.sql',here),commands.join('\n')+'\n');
}
