import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modelModule={exports:{}};
new Function('require','module','exports',compile(fs.readFileSync('app/model.ts','utf8')))(require,modelModule,modelModule.exports);
const requestModule={exports:{}};
new Function('require','module','exports',compile(fs.readFileSync('app/state-request.ts','utf8')))(require,requestModule,requestModule.exports);
function harness(seed){
 const effects=[];
 const values=[];let cursor=0;
 const hooks={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v}]},useRef(initial){const i=cursor++;return values[i]??=( {current:initial})},useEffect(effect){effects.push(effect)},lazy(){return ()=>null},Suspense:()=>null};
 const m={exports:{}};
 const mockRequire=name=>name==='react'?hooks:name==='./model'?modelModule.exports:name==='./state-request'?requestModule.exports:name==='react/jsx-runtime'?require(name):name==='lucide-react'?new Proxy({},{get:()=>()=>null}):{default:()=>null};
 new Function('require','module','exports',compile(fs.readFileSync('app/Dashboard.tsx','utf8')))(mockRequire,m,m.exports);
 const data=seed??modelModule.exports.initial();if(!seed)data.children=[{id:'a',first:'בדיקה',last:'אחד'}];
 const render=()=>{cursor=0;return m.exports.default({initialState:{data,revision:0},initialWeek:'2026-10-11'})};
 const nodes=(node)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
 const find=predicate=>nodes(render()).find(predicate);
 find(n=>n.type==='select'&&n.props.value==='').props.onChange({target:{value:'a'}});
 return {find,values,effects,all:predicate=>nodes(render()).filter(predicate),nodes};
}
test('Booking paints before a delayed save resolves, blocks double submission, and needs no follow-up GET',async()=>{
 const original=globalThis.fetch;let resolve;const calls=[];
 globalThis.fetch=(...args)=>{calls.push(args);return new Promise(r=>{resolve=r})};
 try{
  const h=harness(),button=h.find(n=>n.props?.className==='claim');
  button.props.onClick();button.props.onClick();
  assert.equal(calls.length,1);
  assert.deepEqual(h.values[0].weeks['2026-10-11'][0].out,[{childId:'a',size:5}]);
  assert.equal(h.values[0].weeks['2026-10-11'][0].back.length,0);
  assert.ok(h.find(n=>n.props?.role==='status'&&n.props.children?.includes('שומר…')));
  resolve(Response.json({data:h.values[0],revision:1}));
  await new Promise(setImmediate);
  assert.equal(calls.length,1);assert.equal(h.values[1],1);assert.equal(h.values[5],false);
 }finally{globalThis.fetch=original}
});
test('Rejected booking restores the server board and exposes the conflict',async()=>{
 const original=globalThis.fetch;let resolve;let calls=0;let board;
 globalThis.fetch=()=>++calls===1?new Promise(r=>{resolve=r}):Promise.resolve(Response.json({data:board,revision:1}));
 try{
  const h=harness();board=structuredClone(h.values[0]);
  h.find(n=>n.props?.className==='claim').props.onClick();
  resolve(Response.json({error:'הלוח השתנה'},{status:409}));
  await new Promise(setImmediate);
  assert.deepEqual(h.values[0],board);assert.equal(h.values[4],'הלוח השתנה');assert.equal(h.values[5],false);
 }finally{globalThis.fetch=original}
});

for(const direction of ['out','back'])for(const action of ['claim','resize','cancel'])test(`${direction} ${action} updates immediately and preserves other days and direction`,async()=>{
 const original=globalThis.fetch;let resolve;
 globalThis.fetch=()=>new Promise(r=>{resolve=r});
 try{
  const seed=modelModule.exports.initial();seed.children=[{id:'a',first:'בדיקה',last:'אחד'}];
  if(action!=='claim')seed.weeks['2026-10-11'][0][direction]=[{childId:'a',size:5}];
  const h=harness(seed),before=structuredClone(seed),index=direction==='out'?0:1;
  if(action==='resize')h.find(n=>n.props?.className?.startsWith('car-choice')&&n.props.children.includes(7)).props.onClick();
  const section=h.all(n=>n.props?.className==='direction')[index];
  h.nodes(section).find(n=>action==='cancel'?n.props?.title==='ביטול שיבוץ':n.props?.className==='claim').props.onClick();
  assert.deepEqual(h.values[0].weeks['2026-10-11'][0][direction],action==='cancel'?[]:[{childId:'a',size:action==='resize'?7:5}]);
  assert.deepEqual(h.values[0].weeks['2026-10-11'][0][direction==='out'?'back':'out'],before.weeks['2026-10-11'][0][direction==='out'?'back':'out']);
  assert.deepEqual(h.values[0].weeks['2026-10-11'].slice(1),before.weeks['2026-10-11'].slice(1));
  resolve(Response.json({data:h.values[0],revision:1}));await new Promise(setImmediate);
 }finally{globalThis.fetch=original}
});

test('A disconnected save and failed recovery release the controls and roll back',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>Promise.reject(Error('offline'));
 try{const h=harness(),before=structuredClone(h.values[0]);h.find(n=>n.props?.className==='claim').props.onClick();await new Promise(setImmediate);assert.deepEqual(h.values[0],before);assert.equal(h.values[5],false);assert.match(h.values[4],/לא ניתן להתחבר/)}finally{globalThis.fetch=original}
});

test('A poll started before saving cannot replace optimistic or committed data',async()=>{
 const original={fetch:globalThis.fetch,document:globalThis.document,setInterval:globalThis.setInterval};
 let poll;const pending=[];
 globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 globalThis.setInterval=(callback,ms)=>{if(ms===15000)poll=callback;return 0};
 globalThis.fetch=(path,options)=>new Promise(resolve=>pending.push({resolve,method:options?.method??'GET'}));
 try{
  const h=harness(),before=structuredClone(h.values[0]);h.effects[1]();poll();
  h.find(n=>n.props?.className==='claim').props.onClick();poll();assert.equal(pending.length,2);
  pending[1].resolve(Response.json({data:h.values[0],revision:2}));await new Promise(setImmediate);
  pending[0].resolve(Response.json({data:before,revision:1}));await new Promise(setImmediate);
  assert.equal(h.values[1],2);assert.equal(h.values[0].weeks['2026-10-11'][0].out.length,1);
 }finally{Object.assign(globalThis,original)}
});

test('A hung save times out after 12 seconds, restores the board and unlocks controls',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const original=globalThis.fetch;let board;
 globalThis.fetch=(path,options)=>options.method==='POST'?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')))):Promise.resolve(Response.json({data:board,revision:0}));
 try{
  const h=harness();board=structuredClone(h.values[0]);h.find(n=>n.props?.className==='claim').props.onClick();
  t.mock.timers.tick(11999);assert.equal(h.values[5],true);
  t.mock.timers.tick(1);await new Promise(setImmediate);
  assert.equal(h.values[5],false);assert.deepEqual(h.values[0],board);assert.match(h.values[4],/לא הגיב בזמן/);
 }finally{globalThis.fetch=original}
});

test('Recovery recognizes a committed save whose response was lost',async()=>{
 const original=globalThis.fetch;let committed;
 globalThis.fetch=(path,options)=>options.method==='POST'?Promise.reject(Error('lost response')):Promise.resolve(Response.json({data:committed,revision:1}));
 try{
  const h=harness();h.find(n=>n.props?.className==='claim').props.onClick();committed=structuredClone(h.values[0]);
  await new Promise(setImmediate);assert.deepEqual(h.values[0],committed);assert.equal(h.values[1],1);assert.equal(h.values[5],false);assert.match(h.values[4],/לא ניתן להתחבר/);
 }finally{globalThis.fetch=original}
});

test('Timeout also covers a stalled response body',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const original=globalThis.fetch;
 globalThis.fetch=(path,options)=>Promise.resolve({json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 try{const pending=requestModule.exports.requestState();await Promise.resolve();t.mock.timers.tick(12000);await assert.rejects(pending,/לא הגיב בזמן/)}finally{globalThis.fetch=original}
});

test('Production builds never select the disposable QA adapter even if its env flag is set',()=>{
 const m={exports:{}};
 const source=fs.readFileSync('next.config.ts','utf8').replace("import path from 'node:path';","const path=require('node:path');");
 new Function('require','module','exports',compile(source))(require,m,m.exports);
 const previous=process.env.TRANSPORT_LOCAL_QA;process.env.TRANSPORT_LOCAL_QA='1';
 try{
  const config=m.exports.default('phase-production-build');assert.equal(config.distDir,'.next');
  const webpack={NormalModuleReplacementPlugin:class {constructor(pattern,replacement){this.replacement=replacement}}};
  const result=config.webpack({plugins:[]},{webpack,dev:false});assert.match(result.plugins[0].replacement,/netlify[\\/]postgres.ts$/);
  const dev=m.exports.default('phase-development-server');assert.equal(dev.distDir,'.next-qa');
  assert.match(dev.webpack({plugins:[]},{webpack,dev:true}).plugins[0].replacement,/netlify[\\/]qa-database.ts$/);
 }finally{if(previous===undefined)delete process.env.TRANSPORT_LOCAL_QA;else process.env.TRANSPORT_LOCAL_QA=previous}
});
