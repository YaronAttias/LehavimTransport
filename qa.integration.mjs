import assert from 'node:assert/strict';
const url='http://127.0.0.1:5180';let current;
async function call(body){const r=await fetch(url+'/api/state',{method:body?'POST':'GET',headers:{Origin:url,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();return {status:r.status,json}}
async function refresh(){current=(await call()).json;return current}
async function update(body){const r=await call({...body,revision:current.revision});assert.equal(r.status,200,JSON.stringify(r.json));await refresh()}
await refresh();assert.equal(current.data.children.length,0,'Use a fresh isolated QA database, never production records');
for(const name of ['א','ב','ג','ד','ה','ו'])await update({action:'child-add',first:'בדיקה',last:name});
const ids=current.data.children.map(c=>c.id),week='2026-10-11';
for(const id of ids.slice(0,2))await update({action:'ride',week,day:0,direction:'out',childId:id,size:5});await update({action:'ride',week,day:0,direction:'back',childId:ids[2],size:7});const original=structuredClone(current.data.weeks[week][0]);
for(const id of ids.slice(4))await update({action:'attendance',week,day:0,childId:id,absent:true});assert.equal(current.data.weeks[week][0].absent.length,2);assert.deepEqual(current.data.weeks[week][0].out,original.out);assert.deepEqual(current.data.weeks[week][0].back,original.back);
for(const id of ids.slice(4))await update({action:'attendance',week,day:0,childId:id,absent:false});
const revision=current.revision;const concurrent=await Promise.all(ids.slice(4).map(childId=>call({action:'attendance',week,day:0,childId,absent:true,revision})));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);await refresh();for(const id of ids.slice(4))await update({action:'attendance',week,day:0,childId:id,absent:false});
await update({action:'schedule',week,day:1,active:true,title:'משחק בדיקה',arrival:'18:00',start:'18:15',returnTime:'19:45'});assert.equal(current.data.weeks[week][1].title,'משחק בדיקה');
const before=structuredClone(current.data.weeks[week]);await update({action:'schedule-import',week,days:before.map(d=>({...d,note:'בדיקת ייבוא',out:[],back:[],absent:[]}))});assert.deepEqual(current.data.weeks[week][0].out,original.out);assert.deepEqual(current.data.weeks[week][0].back,original.back);
console.log(JSON.stringify({ok:true,realD1:true,checks:['anonymous access','six children','independent out/back','attendance preserves rides','concurrent writes conflict','create/edit activity','import preserves registrations'],revision:current.revision,readyForBrowser:true}));
