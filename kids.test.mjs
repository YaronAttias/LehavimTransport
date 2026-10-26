import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const modelUrl=url(compile(fs.readFileSync('app/model.ts','utf8')));
const model=await import(modelUrl);
const kids=await import(url(compile(fs.readFileSync('app/kids/kids-model.ts','utf8').replace("'../model'",JSON.stringify(modelUrl)))));
test('Kids see today and future active days only',()=>{
 const days=Array.from({length:6},()=>({...model.blankDay(),active:true}));days[3].active=false;
 assert.deepEqual(kids.remainingActivities(days,'2026-10-25','2026-10-26').map(x=>x.index),[1,2,4,5]);
 assert.deepEqual(kids.remainingActivities(days,'2026-10-25','2026-10-31'),[]);
 assert.deepEqual(kids.remainingActivities([],'2026-11-01','2026-10-31'),[]);
});
test('Kids calendar uses Israel midnight and next week on Saturday',()=>{
 const before=new Date('2026-10-26T21:59:59Z'),after=new Date('2026-10-26T22:00:00Z');
 assert.equal(model.jerusalemDate(before),'2026-10-26');assert.equal(model.jerusalemDate(after),'2026-10-27');
 assert.equal(model.defaultWeek(new Date('2026-10-30T22:00:00Z')),'2026-11-01');
});
test('Kit badges require clothing instructions and preserve multiple colors',()=>{
 assert.deepEqual(kids.kitColors('מגיעים בצבע לבן').map(x=>x.label),['לבן']);
 assert.deepEqual(kids.kitColors('מגיעים בשחור\nמים ומגני עצם').map(x=>x.label),['שחור']);
 assert.deepEqual(kids.kitColors('תלבושת: כחול / לבן').map(x=>x.label),['לבן','כחול']);
 assert.deepEqual(kids.kitColors('משחק נגד הכחול. להביא מים'),[]);
 assert.deepEqual(kids.kitColors(''),[]);
});

test('Kids board is read only, polls on resume, retains stale data and recovers',async()=>{
 const require=createRequire(import.meta.url),effects=[],values=[];let cursor=0,poll,focus,visible,fail=false;
 const previous={document:globalThis.document,window:globalThis.window,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 globalThis.document={visibilityState:'visible',addEventListener:(_,fn)=>{visible=fn},removeEventListener(){}};
 globalThis.window={addEventListener:(_,fn)=>{focus=fn},removeEventListener(){}};
 globalThis.setInterval=(fn,ms)=>{assert.equal(ms,30000);poll=fn;return 1};globalThis.clearInterval=()=>{};
 const data={children:[{id:'a',first:'איתי',last:'כהן'},{id:'b',first:'נועם',last:'לוי'}],weeks:{'2026-10-25':[model.blankDay(),{...model.blankDay(),active:true,arrival:'18:15',start:'18:30',returnTime:'20:00',note:'מגיעים בצבע לבן',out:[{childId:'a',size:7}],back:[]}]}};
 const calls=[],request={requestState:async init=>{calls.push(init);if(fail)throw Error('offline');return {response:{ok:true},payload:{data,revision:1}}}};
 const hooks={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useEffect(fn){effects.push(fn)}};
 const m={exports:{}},commonjs=ts.transpileModule(fs.readFileSync('app/kids/KidsBoard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mock=name=>name==='react'?hooks:name==='../model'?{...model,jerusalemDate:()=> '2026-10-26',defaultWeek:()=> '2026-10-25'}:name==='../state-request'?request:name==='./kids-model'?kids:name.endsWith('.css')?{default:new Proxy({},{get:(_,key)=>key})}:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):require(name);
 const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
 const render=()=>{cursor=0;return m.exports.default()};
 let cleanup;
 try{
  new Function('require','module','exports',commonjs)(mock,m,m.exports);render();cleanup=effects[0]();await new Promise(setImmediate);
  const tree=render(),text=JSON.stringify(tree);assert.match(text,/ההורים של איתי כהן/);assert.match(text,/עדיין לא נקבע מי אוסף/);assert.match(text,/18:30/);
  assert.equal(nodes(tree).filter(n=>['button','input','select','textarea','form','a'].includes(n.type)).length,0);
  assert.equal(calls.length,1);assert.ok(calls.every(init=>!init.method||init.method==='GET'));
  fail=true;poll();await new Promise(setImmediate);assert.equal(values[0],data);assert.match(JSON.stringify(render()),/העדכון האחרון/);
  fail=false;focus();await new Promise(setImmediate);assert.equal(values[3],'');
  globalThis.document.visibilityState='hidden';const count=calls.length;poll();await new Promise(setImmediate);assert.equal(calls.length,count);
  globalThis.document.visibilityState='visible';visible();await new Promise(setImmediate);assert.equal(calls.length,count+1);
 }finally{cleanup?.();Object.assign(globalThis,previous)}
});
