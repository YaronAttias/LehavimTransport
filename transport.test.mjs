import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const modelUrl=url(compile(fs.readFileSync('app/model.ts','utf8')));
const model=await import(modelUrl);
let row;
let insertCount=0,selectCount=0;
const DB={prepare(sql){let args=[];return{bind(...a){args=a;return this},async first(){selectCount++;return row?{...row}:null},async run(){if(sql.startsWith('INSERT')){insertCount++;row??={revision:0,data:args[0]};return{meta:{changes:1}}}if(sql.startsWith('UPDATE')){if(row.revision!==args[1])return{meta:{changes:0}};row={revision:row.revision+1,data:args[0]};return{meta:{changes:1}}}throw Error('Unexpected SQL')}}}};
globalThis.__transportTestEnv={DB,GROUP_CODE:'local-parent-test',ADMIN_CODE:'local-admin-test'};
globalThis.crypto??=webcrypto;
const apiSource=fs.readFileSync('app/api/state/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__transportTestEnv;").replace("'../../model'",JSON.stringify(modelUrl));
const api=await import(url(compile(apiSource)));
const req=(body,cookie='')=>new Request('https://local.test/api/state',{method:'POST',headers:{origin:'https://local.test','Content-Type':'application/json',cookie},body:JSON.stringify(body)});
async function login(code){const r=await api.POST(req({action:'login',code}));assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
async function get(cookie){return (await api.GET(new Request('https://local.test/api/state',{headers:{cookie}}))).json()}
async function change(body,cookie){const s=await get(cookie);return api.POST(req({...body,revision:s.revision},cookie))}
test('Capacity follows children and reserved driver seat',()=>{assert.equal(model.needed(6,[]),2);assert.equal(model.needed(6,[{size:5}]),1);assert.equal(model.needed(6,[{size:7}]),0);assert.equal(model.needed(4,[{size:5}]),0);assert.equal(model.needed(0,[]),0);assert.equal(model.seats([{size:5},{size:5}]),8);assert.equal(model.endTime('18:45'),'20:15');assert.equal(model.endTime('23:30'),'01:00');assert.equal(model.initial().weeks['2026-10-11'][0].returnTime,'20:00')});
test('Anonymous shared editing, days, defaults, absence and conflict protection',async()=>{
 const parent='',admin=''; assert.equal((await api.GET(new Request('https://local.test/api/state'))).status,200);
 for(let n=0;n<6;n++)assert.equal((await change({action:'child-add',first:'ילד'+n,last:'בדיקה'},parent)).status,200);
 let s=await get(parent);const ids=s.data.children.map(c=>c.id),week='2026-10-11';
 assert.deepEqual(s.data.weeks[week][0].absent,[]);
 assert.equal((await change({action:'ride',week,day:0,direction:'out',childId:ids[0],size:5},parent)).status,200);
 s=await get(parent);assert.equal(s.data.weeks[week][0].back.length,0);assert.equal(model.needed(6,s.data.weeks[week][0].out),1);
 for(const id of ids.slice(4))assert.equal((await change({action:'attendance',week,day:0,childId:id,absent:true},parent)).status,200);
 s=await get(parent);assert.equal(model.needed(6-s.data.weeks[week][0].absent.length,s.data.weeks[week][0].out),0);
 assert.equal((await api.POST(req({action:'attendance',week,day:0,childId:ids[1],absent:true,revision:0}))).status,409);
 assert.equal((await change({action:'schedule',week:'2026-10-18',day:1,active:true,title:'אימון נוסף',arrival:'18:15',start:'18:30',returnTime:'20:00'},parent)).status,200);
 s=await get(parent);assert.equal(s.data.weeks['2026-10-18'][1].active,true);assert.deepEqual(s.data.weeks['2026-10-18'][1].absent,[]);
 assert.equal((await change({action:'schedule',week:'2026-10-18',day:1,active:true,title:'אימון מעודכן',start:'19:00',returnTime:'20:30'},parent)).status,200);
 s=await get(parent);assert.equal(s.data.weeks['2026-10-18'][1].title,'אימון מעודכן');
 assert.equal((await change({action:'schedule',week:'2026-10-18',day:6,active:true},parent)).status,400);
 assert.equal((await change({action:'schedule',week:'2026-10-18',day:1,active:false},parent)).status,200);
 s=await get(parent);assert.equal(s.data.weeks['2026-10-18'][1].active,false);
 const beforeImport=await get(parent);const imported=beforeImport.data.weeks[week].map(day=>({...day,start:day.active?'19:00':day.start,returnTime:day.active?'20:30':day.returnTime,absent:[],out:[],back:[]}));
 assert.equal((await change({action:'schedule-import',week,days:imported},parent)).status,200);
 s=await get(parent);assert.deepEqual(s.data.weeks[week][0].absent,beforeImport.data.weeks[week][0].absent);assert.deepEqual(s.data.weeks[week][0].out,beforeImport.data.weeks[week][0].out);assert.equal(s.data.weeks[week][0].start,'19:00');
 const beforeInvalid=s.revision;imported[3].start='99:99';assert.equal((await change({action:'schedule-import',week,days:imported},parent)).status,400);s=await get(parent);assert.equal(s.revision,beforeInvalid);
 const bad=req({action:'child-add',first:'בדיקה',last:'בדיקה'});bad.headers.set('origin','https://other.test');assert.equal((await api.POST(bad)).status,403);
});

const importer=await import(url(compile(fs.readFileSync('app/import-schedule.ts','utf8').replace("'./model'",JSON.stringify(modelUrl)))));
test('Import understands activity times, independent practice and Sunday dates',()=>{
 const day=importer.parseColumn('11.10 א\nלהיות במגרש:\n18:15\nתחילת האימון:\n18:30\nמשחק אימון נגד קבוצה\nמגיעים בצבע לבן');assert.equal(day.day.start,'18:30');assert.equal(day.day.returnTime,'20:00');assert.equal(day.day.title,'אימון');assert.equal(day.day.note,'מגיעים בצבע לבן');assert.equal(day.date,'11.10');assert.equal(importer.inferredWeek(day.date,2026),'2026-10-11');
 assert.equal(importer.parseColumn('12.10\nאימון אישי עצמאי').day.active,false);assert.equal(importer.parseColumn('13.10\nחופש').day.active,false);assert.equal(importer.parseColumn('12.10\nמשחק\n18:15\n18:30').day.title,'משחק');assert.equal(importer.inferredWeek('32.10',2026),null);assert.equal(importer.inferredWeek('12.10',2026),null);
});

test('Past days collapse after midnight in Israel while today and future stay open',()=>{
 assert.equal(model.jerusalemDate(new Date('2026-10-15T20:59:59Z')),'2026-10-15');assert.equal(model.jerusalemDate(new Date('2026-10-15T21:00:00Z')),'2026-10-16');
 assert.equal(model.dayHasPassed('2026-10-11',4,'2026-10-15'),false);assert.equal(model.dayHasPassed('2026-10-11',4,'2026-10-16'),true);assert.equal(model.dayHasPassed('2026-10-18',0,'2026-10-16'),false);
 assert.equal(model.jerusalemDate(new Date('2026-12-01T21:59:59Z')),'2026-12-01');assert.equal(model.jerusalemDate(new Date('2026-12-01T22:00:00Z')),'2026-12-02');
});

test('Attendance changes preserve bookings and remain isolated by direction and day',async()=>{row=undefined;await get('');for(let i=0;i<6;i++)await change({action:'child-add',first:'קצה'+i,last:'בדיקה'},'');let current=await get('');const ids=current.data.children.map(c=>c.id),week='2026-10-11';const setAttendance=(id,absent,day=0)=>change({action:'attendance',week,day,childId:id,absent},'');
 for(const direction of ['out','back'])for(const id of ids.slice(0,2))assert.equal((await change({action:'ride',week,day:0,direction,childId:id,size:5},'')).status,200);
 const booked=(await get('')).data.weeks[week][0];await setAttendance(ids[4],true);await setAttendance(ids[5],true);await setAttendance(ids[5],true);current=await get('');let day=current.data.weeks[week][0];assert.equal(day.absent.length,2);assert.deepEqual(day.out,booked.out);assert.deepEqual(day.back,booked.back);assert.equal(model.rideReview(day,current.data.children,'out').redundant,true);assert.deepEqual(current.data.weeks[week][3].absent,[]);
 await setAttendance(ids[4],false);await setAttendance(ids[5],false);current=await get('');assert.equal(model.rideReview(current.data.weeks[week][0],current.data.children,'out').needsReview,false);
 await setAttendance(ids[0],true);current=await get('');assert.deepEqual(model.rideReview(current.data.weeks[week][0],current.data.children,'out').absentDrivers,[ids[0]]);assert.equal(current.data.weeks[week][0].out.length,2);
 for(const id of ids)await setAttendance(id,true);current=await get('');day=current.data.weeks[week][0];assert.equal(model.rideReview(day,current.data.children,'out').noPassengers,true);assert.deepEqual(day.out,booked.out);assert.deepEqual(day.back,booked.back);
 const revision=current.revision;assert.equal((await change({action:'attendance',week,day:0,childId:'unknown',absent:true},'')).status,400);current=await get('');assert.equal(current.revision,revision);
 await change({action:'ride',week,day:0,direction:'out',childId:ids[0],size:5,remove:true},'');current=await get('');assert.equal(current.data.weeks[week][0].out.length,1);assert.deepEqual(current.data.weeks[week][0].back,booked.back);
});
test('Concurrent last-minute attendance updates cannot overwrite each other',async()=>{const current=await get(''),week='2026-10-11',ids=current.data.children.map(c=>c.id),revision=current.revision;const results=await Promise.all(ids.slice(0,2).map(childId=>api.POST(req({action:'attendance',week,day:3,childId,absent:true,revision}))));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const after=await get('');assert.equal(after.data.weeks[week][3].absent.length,1);const missing=ids.slice(0,2).find(id=>!after.data.weeks[week][3].absent.includes(id));await change({action:'attendance',week,day:3,childId:missing,absent:true},'');assert.equal((await get('')).data.weeks[week][3].absent.length,2)});

test('Saturday defaults to the upcoming Sunday using the Israeli date',()=>{
 assert.equal(model.defaultWeek(new Date('2026-10-16T20:59:59Z')),'2026-10-11');
 assert.equal(model.defaultWeek(new Date('2026-10-16T21:00:00Z')),'2026-10-18');
 assert.equal(model.defaultWeek(new Date('2026-10-17T12:00:00Z')),'2026-10-18');
 assert.equal(model.defaultWeek(new Date('2026-10-18T12:00:00Z')),'2026-10-18');
 assert.equal(model.defaultWeek(new Date('2026-10-22T12:00:00Z')),'2026-10-18');
 assert.equal(model.defaultWeek(new Date('2026-10-30T21:59:59Z')),'2026-10-25');
 assert.equal(model.defaultWeek(new Date('2026-10-30T22:00:00Z')),'2026-11-01');
 assert.equal(model.defaultWeek(new Date('2022-12-31T12:00:00Z')),'2023-01-01');
});

test('Existing board reads require one SELECT and no initialization write',async()=>{
 const beforeInserts=insertCount,beforeSelects=selectCount;const response=await api.GET(new Request('https://local.test/api/state'));assert.equal(response.status,200);assert.equal(insertCount,beforeInserts);assert.equal(selectCount,beforeSelects+1);assert.match(response.headers.get('cache-control'),/no-store/);
});

test('Netlify canonical origin works behind an internal proxy without trusting spoofed host headers',async()=>{
 globalThis.__transportTestEnv.PUBLIC_ORIGIN='https://app.netlify.test';
 try{
 const call=origin=>api.POST(new Request('http://localhost:3000/api/state',{method:'POST',headers:{origin,'x-forwarded-host':'evil.test','content-type':'application/json'},body:JSON.stringify({action:'invalid',revision:row.revision})}));
 assert.equal((await call('https://app.netlify.test')).status,400);assert.equal((await call('https://evil.test')).status,403);
 }finally{delete globalThis.__transportTestEnv.PUBLIC_ORIGIN}
});

test('Successful writes return the committed board and revision without another read',async()=>{
 const current=await get('');const r=await api.POST(req({action:'ride',week:'2026-10-11',day:0,direction:'back',childId:current.data.children[0].id,size:7,revision:current.revision}));
 assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.revision,current.revision+1);assert.deepEqual(saved.data,JSON.parse(row.data));
});

test('Sports image includes Friday and distinguishes match reporting from kickoff',()=>{
 const texts=['18.10\nלהיות במגרש: 18:15\nתחילת האימון: 18:30\nמהלך האימון: משחק עמידה נכונה\nמגיעים בצבע שחור','19.10\nמשחק נגד גילת\n15:00\nלהיות באצטדיון\nמגיעים בצבע לבן','20.10\nחופש','21.10\nלהיות במגרש: 18:15\nתחילת האימון: 18:30\nמגיעים בצבע שחור','22.10\nחופש','23.10\nלהיות במגרש: 12:30\nתחילת האימון: 12:45\nמגיעים בצבע לבן'];
 const days=texts.map(importer.parseColumn);assert.deepEqual(days.map(c=>c.day.active),[true,true,false,true,false,true]);assert.equal(days[1].day.arrival,'15:00');assert.equal(days[1].day.start,'');assert.equal(days[1].day.returnTime,'');assert.ok(days[1].warning);assert.equal(days[5].day.start,'12:45');assert.equal(days[5].day.returnTime,'14:15');assert.equal(days[5].day.note,'מגיעים בצבע לבן');assert.equal(importer.inferredWeek(days[0].date,2026),'2026-10-18');
 const pixels=new Uint8ClampedArray([0,112,192,255,0,0,0,255,255,255,255,255]);importer.normalizeCell(pixels);assert.deepEqual([...pixels],[255,255,255,255,0,0,0,255,255,255,255,255]);
});
test('Friday import and legacy five day imports preserve Friday',async()=>{
 row=undefined;await get('');const week='2026-10-18',days=Array.from({length:6},model.blankDay);days[5]={...model.blankDay(),active:true,title:'אימון',arrival:'12:30',start:'12:45',returnTime:'14:15'};
 assert.equal((await change({action:'schedule-import',week,days},'')).status,200);assert.equal((await get('')).data.weeks[week][5].start,'12:45');
 assert.equal((await change({action:'schedule-import',week,days:days.slice(0,5)},'')).status,200);assert.equal((await get('')).data.weeks[week][5].start,'12:45');
});

test('Reupload replaces the same week, cancels removed days, preserves rides and attendance, and leaves other weeks intact',async()=>{
 row=undefined;await get('');await change({action:'child-add',first:'בדיקת',last:'ייבוא'},'');
 const week='2026-10-18',initialWeek=(await get('')).data.weeks['2026-10-11'];
 const first=Array.from({length:6},()=>({...model.blankDay(),active:true,arrival:'18:15',start:'18:30',returnTime:'20:00',note:'מגיעים בצבע שחור'}));
 assert.equal((await change({action:'schedule-import',week,days:first},'')).status,200);
 const id=(await get('')).data.children[0].id;
 await change({action:'ride',week,day:5,direction:'out',childId:id,size:5},'');
 await change({action:'ride',week,day:5,direction:'back',childId:id,size:7},'');
 await change({action:'attendance',week,day:5,childId:id,absent:true},'');
 const before=(await get('')).data.weeks[week];
 const revised=first.map(d=>({...d}));revised[0]={...model.blankDay(),title:'חופש'};revised[5]={...revised[5],title:'אימון מעודכן',arrival:'12:30',start:'12:45',returnTime:'14:15',note:''};
 assert.equal((await change({action:'schedule-import',week,days:revised},'')).status,200);
 let current=(await get('')).data;assert.deepEqual(Object.keys(current.weeks).sort(),['2026-10-11',week]);assert.deepEqual(current.weeks['2026-10-11'],initialWeek);
 assert.equal(current.weeks[week][0].active,false);assert.equal(current.weeks[week][5].start,'12:45');assert.equal(current.weeks[week][5].note,'');
 for(const key of ['out','back','absent'])assert.deepEqual(current.weeks[week][5][key],before[5][key]);
 const cancelled=Array.from({length:6},()=>({...model.blankDay(),title:'חופש'}));
 assert.equal((await change({action:'schedule-import',week,days:cancelled},'')).status,200);
 current=(await get('')).data;assert.ok(current.weeks[week].every(d=>!d.active));
 for(const key of ['out','back','absent'])assert.deepEqual(current.weeks[week][5][key],before[5][key]);
 assert.equal((await change({action:'schedule-import',week,days:revised},'')).status,200);current=(await get('')).data;
 assert.equal(current.weeks[week][5].active,true);assert.deepEqual(current.weeks[week][5].out,before[5].out);
});

test('Browser OCR game typo retains reporting-only semantics',()=>{
 const result=importer.parseColumn('19.10\nמשח7קן נגד\nגילת\n15:00\nלהיות\nבאצטדיון\nמגיעים\nבצבע לבן');
 assert.equal(result.day.title,'משחק');assert.equal(result.day.arrival,'15:00');assert.equal(result.day.start,'');assert.equal(result.day.returnTime,'');assert.ok(result.warning.includes('התייצבות'));
});

test('Game-only schedule needs arrival but permits empty kickoff and return',async()=>{
 row=undefined;await get('');const week='2026-10-18',days=Array.from({length:6},model.blankDay);days[1]={...model.blankDay(),active:true,title:'משחק נגד גילת',arrival:'15:00'};
 assert.equal(model.activityTimesValid(days[1]),true);assert.equal(model.activityTimesValid({...days[1],title:'אימון'}),false);assert.equal(model.activityTimesValid({...days[1],arrival:''}),false);assert.equal(model.isGame('משחקונים באימון'),false);
 assert.equal((await change({action:'schedule-import',week,days},'')).status,200);let current=await get('');assert.equal(current.data.weeks[week][1].start,'');assert.equal(current.data.weeks[week][1].returnTime,'');
 const revision=current.revision;days[1].arrival='';assert.equal((await change({action:'schedule-import',week,days},'')).status,400);assert.equal((await get('')).revision,revision);
 assert.equal((await change({action:'schedule',week,day:1,active:true,title:'משחק',arrival:'16:00',start:'',returnTime:''},'')).status,200);
 assert.equal((await change({action:'schedule',week,day:1,active:true,title:'משחק',arrival:'',start:'',returnTime:''},'')).status,400);
 days[1]={...days[1],title:'אימון',arrival:'15:00'};assert.equal((await change({action:'schedule-import',week,days},'')).status,400);
});

test('Directional attendance changes only the chosen leg and survives import, day edits and repeated writes',async()=>{
 row=undefined;await get('');for(let i=0;i<6;i++)await change({action:'child-add',first:'נוסע'+i,last:'כיוון'},'');const week='2026-10-18',ids=(await get('')).data.children.map(c=>c.id);
 await change({action:'schedule',week,day:0,active:true,title:'משחק',arrival:'15:00'},'');
 for(const direction of ['out','back'])await change({action:'ride',week,day:0,direction,childId:ids[0],size:5},'');
 for(const id of ids.slice(3))assert.equal((await change({action:'attendance',week,day:0,direction:'back',childId:id,absent:true},'')).status,200);
 let current=await get(''),day=current.data.weeks[week][0];assert.equal(model.rideReview(day,current.data.children,'out').passengers,6);assert.equal(model.rideReview(day,current.data.children,'back').passengers,3);assert.equal(day.out.length,1);assert.equal(day.back.length,1);
 await change({action:'attendance',week,day:0,direction:'back',childId:ids[3],absent:true},'');assert.equal((await get('')).data.weeks[week][0].attendance.back.length,3);
 const original=structuredClone((await get('')).data.weeks[week][0].attendance);await change({action:'schedule-import',week,days:current.data.weeks[week].map(d=>({...d,attendance:{out:[],back:[]}}))},'');assert.deepEqual((await get('')).data.weeks[week][0].attendance,original);
 await change({action:'schedule',week,day:0,active:true,title:'משחק',arrival:'16:00'},'');assert.deepEqual((await get('')).data.weeks[week][0].attendance,original);
 assert.equal((await change({action:'attendance',week,day:0,direction:'sideways',childId:ids[0],absent:true},'')).status,400);assert.equal((await change({action:'attendance',week,day:0,direction:'out',childId:ids[0],absent:'yes'},'')).status,400);
 await change({action:'attendance',week,day:0,direction:'out',childId:ids[0],absent:true},'');current=await get('');day=current.data.weeks[week][0];assert.deepEqual(model.rideReview(day,current.data.children,'out').absentDrivers,[ids[0]]);assert.deepEqual(model.rideReview(day,current.data.children,'back').absentDrivers,[]);
 const revision=current.revision;const race=await Promise.all(['out','back'].map(direction=>api.POST(req({action:'attendance',week,day:0,direction,childId:ids[2],absent:true,revision}))));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 await change({action:'child-remove',childId:ids[3]},'');day=(await get('')).data.weeks[week][0];assert.ok(!day.attendance.out.includes(ids[3])&&!day.attendance.back.includes(ids[3]));
});
test('First direction update preserves preexisting legacy absences in the other leg',async()=>{
 const current=await get(''),week='2026-10-18',id=current.data.children[1].id;

 const old={...model.blankDay(),active:true,title:'משחק',arrival:'15:00',absent:[id]};const state=JSON.parse(row.data);state.weeks[week][1]=old;row={...row,data:JSON.stringify(state)};
 await change({action:'attendance',week,day:1,direction:'back',childId:id,absent:false},'');const day=(await get('')).data.weeks[week][1];assert.deepEqual(model.absentFor(day,'out'),[id]);assert.deepEqual(model.absentFor(day,'back'),[]);
 await change({action:'attendance',week,day:1,childId:id,absent:true},'');const updated=(await get('')).data.weeks[week][1];assert.deepEqual(model.absentFor(updated,'out'),[id]);assert.deepEqual(model.absentFor(updated,'back'),[id]);
});

test('Custom seats replace nominal capacity and allow enough partial-capacity drivers',async()=>{
 row=undefined;await get('');for(let i=0;i<6;i++)await change({action:'child-add',first:'מושב'+i,last:'בדיקה'},'');
 const week='2026-10-18',ids=(await get('')).data.children.map(c=>c.id);
 await change({action:'schedule',week,day:0,active:true,title:'משחק',arrival:'15:00'},'');
 for(const availableSeats of [0,7,1.5,'3',null])assert.equal((await change({action:'ride',week,day:0,direction:'out',childId:ids[0],availableSeats},'')).status,400);
 for(const childId of ids.slice(0,3))assert.equal((await change({action:'ride',week,day:0,direction:'out',childId,availableSeats:2},'')).status,200);
 let current=await get(''),day=current.data.weeks[week][0];assert.equal(model.seats(day.out),6);assert.equal(model.rideReview(day,current.data.children,'out').shortfall,0);assert.equal(day.out[0].size,undefined);
 assert.equal((await change({action:'ride',week,day:0,direction:'out',childId:ids[3],availableSeats:2},'')).status,400);
 await change({action:'ride',week,day:0,direction:'back',childId:ids[0],availableSeats:1},'');
 day=(await get('')).data.weeks[week][0];assert.equal(model.seats(day.back),1);assert.equal(model.seats(day.out),6);
 await change({action:'ride',week,day:0,direction:'out',childId:ids[0],size:7},'');day=(await get('')).data.weeks[week][0];assert.equal(day.out.find(r=>r.childId===ids[0]).availableSeats,undefined);assert.equal(model.seats(day.out),10);assert.equal(model.seats(day.back),1);
 await change({action:'ride',week,day:0,direction:'out',childId:ids[0],availableSeats:1},'');current=await get('');day=current.data.weeks[week][0];assert.equal(model.rideReview(day,current.data.children,'out').shortfall,1);
 await change({action:'schedule-import',week,days:current.data.weeks[week]},'');assert.deepEqual((await get('')).data.weeks[week][0].out,day.out);
 assert.equal(model.seats([{childId:'a',size:5},{childId:'b',size:7},{childId:'c',availableSeats:3}]),13);
});
