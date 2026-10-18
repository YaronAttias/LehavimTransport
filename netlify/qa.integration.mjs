import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const local=process.argv.includes('--local');
const url=local?'http://127.0.0.1:5191':process.env.TRANSPORT_QA_URL;
assert.ok(['https://gvaot-bar-rides-qa.netlify.app','http://127.0.0.1:5191'].includes(url),'Write tests are restricted to isolated QA environments');
const model=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('app/model.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
let current;const checks=[];
async function call(body,origin=url){const r=await fetch(url+'/api/state',{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,json:await r.json()}}
async function refresh(){const r=await call();assert.equal(r.status,200);current=r.json;return current}
async function update(body){const r=await call({...body,revision:current.revision});assert.equal(r.status,200,JSON.stringify(r.json));await refresh()}
await refresh();if(local)assert.ok(current.data.children.every(c=>c.id.startsWith('qa-')),'Local integration requires disposable fixture children');assert.equal(current.data.children.length,6);const ids=current.data.children.map(c=>c.id),week='2026-10-18';
for(let day=0;day<5;day++){
 await update({action:'schedule',week,day,active:day<2,title:day===1?'משחק QA':'אימון QA',arrival:'18:15',start:'18:30',returnTime:'20:00'});
 for(const direction of ['out','back'])for(const r of [...current.data.weeks[week][day][direction]])await update({action:'ride',week,day,direction,childId:r.childId,size:r.size,remove:true});
 for(const id of ids)await update({action:'attendance',week,day:day<2?day:0,childId:id,absent:false});
}
checks.push('create/edit activity, defaults, inactive days');
for(const id of ids.slice(0,2))await update({action:'ride',week,day:0,direction:'out',childId:id,size:5});
await update({action:'ride',week,day:0,direction:'back',childId:ids[2],size:7});
let original=structuredClone(current.data.weeks[week][0]);assert.equal(model.rideReview(original,current.data.children,'out').missing,0);checks.push('independent directions, two small cars, one large car');
await update({action:'attendance',week,day:0,childId:ids[5],absent:true});assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').redundant,false);
await update({action:'attendance',week,day:0,childId:ids[4],absent:true});assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').redundant,true);assert.deepEqual(current.data.weeks[week][0].out,original.out);assert.deepEqual(current.data.weeks[week][0].back,original.back);checks.push('five passengers still need two small cars; four need one; preserve bookings');
await update({action:'attendance',week,day:0,childId:ids[0],absent:true});assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').absentDrivers.length,1);checks.push('absent driver child flagged');
for(const id of ids)await update({action:'attendance',week,day:0,childId:id,absent:true});assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').noPassengers,true);assert.deepEqual(current.data.weeks[week][0].out,original.out);checks.push('all absent preserve bookings and request coordination');
for(const id of ids)await update({action:'attendance',week,day:0,childId:id,absent:false});assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').redundant,false);checks.push('restoring attendance clears obsolete review');
const revision=current.revision;const results=await Promise.all(ids.slice(4).map(childId=>call({action:'attendance',week,day:0,childId,absent:true,revision})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await refresh();for(const id of ids.slice(4))await update({action:'attendance',week,day:0,childId:id,absent:true});checks.push((local?'local fixture':'real PostgreSQL')+' atomic concurrency conflict and retry');
const before=structuredClone(current.data.weeks[week]);await update({action:'schedule-import',week,days:before.map(d=>({...d,note:'בדיקת ייבוא',out:[],back:[],absent:[]}))});assert.deepEqual(current.data.weeks[week][0].out,original.out);assert.deepEqual(current.data.weeks[week][0].back,original.back);assert.equal(current.data.weeks[week][0].absent.length,2);assert.equal(current.data.weeks[week][1].absent.length,0);checks.push('import preserves attendance and bookings; days remain independent');
const saved=structuredClone(current);const invalid=await call({action:'schedule-import',week,revision:current.revision,days:before.map((d,i)=>i===1?{...d,start:'25:00'}:d)});assert.equal(invalid.status,400);await refresh();assert.deepEqual(current,saved);checks.push('invalid import is atomic');
assert.equal((await call({action:'child-add',first:'ילד שביעי',last:'QA',revision:current.revision})).status,400);
assert.equal((await call({action:'attendance',week,day:0,childId:'unknown',absent:true,revision:current.revision})).status,400);
assert.equal((await call({action:'attendance',week,day:6,childId:ids[0],absent:true,revision:current.revision})).status,400);
assert.equal((await call({action:'attendance',week,day:0,childId:ids[0],absent:true,revision:current.revision},'https://invalid.example')).status,403);
checks.push('six-child limit, invalid child/day, origin protection');
const result={ok:true,environment:local?'isolated local QA fixture':'isolated Netlify QA',checks,week,revision:current.revision};fs.mkdirSync('outputs/migration',{recursive:true});fs.writeFileSync(local?'outputs/migration/local-qa-result.json':'outputs/migration/netlify-qa-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
