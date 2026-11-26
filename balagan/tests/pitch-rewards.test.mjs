import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthWindow,activeMonth,rankPitches,prize} from '../src/lib/pitch-rewards.mjs';
test('monthly cutoff follows 02:00 UTC+3 including February',()=>{
 const before=Date.parse('2027-01-31T22:59:59Z'),after=before+1000;
 assert.equal(monthWindow(after).end,after/1000);
 assert.equal(monthWindow(before).key,'2027-01');
 assert.equal(activeMonth(after).end,Date.parse('2027-02-28T23:00:00Z')/1000);
});
test('prize budget, exact ties and one winning pitch per creator',()=>{
 assert.equal(Array.from({length:50},(_,i)=>prize(i+1)).reduce((a,b)=>a+b),4770);
 const rows=Array.from({length:51},(_,i)=>({id:String(i),owner_id:String(i),votes:i<48?100-i:1}));
 const ranked=rankPitches(rows);
 assert.deepEqual(ranked.slice(48).map(r=>[r.rank,r.amount]),[[49,20],[49,20],[49,20]]);
 assert.equal(rankPitches([{id:'a',owner_id:'u',votes:3},{id:'b',owner_id:'u',votes:2},{id:'c',owner_id:'v',votes:0}]).length,1);
});
