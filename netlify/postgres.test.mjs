import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const pg=new PGlite();
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
globalThis.__postgresTest={sql:{unsafe:async(sql,args)=>(await pg.query(sql,args)).rows}};
const adapter=await import(url(compile(fs.readFileSync('netlify/postgres.ts','utf8').replace("import {getDatabase} from '@netlify/database';","const getDatabase=()=>globalThis.__postgresTest;"))));
const DB=adapter.env.DB;
const modelUrl=url(compile(fs.readFileSync('app/model.ts','utf8')));
globalThis.__transportPgEnv={DB};
const api=await import(url(compile(fs.readFileSync('app/api/state/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__transportPgEnv;").replace("'../../model'",JSON.stringify(modelUrl)))));
const get=async()=>(await api.GET(new Request('https://local.test/api/state'))).json();
const post=async(body)=>api.POST(new Request('https://local.test/api/state',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify(body)}));
test('Postgres migration preserves all children, weeks, bookings and attendance',async()=>{
 for(const name of fs.readdirSync('netlify/database/migrations').sort())await pg.exec(fs.readFileSync('netlify/database/migrations/'+name,'utf8'));
 const seed=fs.readFileSync('netlify/database/migrations/20261016213600_import_existing_rides.sql','utf8').match(/VALUES \(1,(\d+),'([\s\S]*)'\) ON CONFLICT/);const source={revision:Number(seed[1]),data:JSON.parse(seed[2].replaceAll("''","'"))};const actual=await get();assert.deepEqual(actual.data,source.data);assert.equal(actual.revision,source.revision);
 // Re-running the seed cannot replace parents edits.
 const state=await get();const id=state.data.children[0].id;const week=Object.keys(state.data.weeks).find(w=>state.data.weeks[w].some(d=>d.active));const day=state.data.weeks[week].findIndex(d=>d.active);
 const first=await post({action:'attendance',week,day,childId:id,absent:true,revision:state.revision});assert.equal(first.status,200);
 const second=await post({action:'attendance',week,day,childId:state.data.children[1].id,absent:true,revision:state.revision});assert.equal(second.status,409);
 const after=await get();assert.equal(after.revision,state.revision+1);assert.ok(after.data.weeks[week][day].absent.includes(id));assert.deepEqual(after.data.weeks[week][day].out,state.data.weeks[week][day].out);assert.deepEqual(after.data.weeks[week][day].back,state.data.weeks[week][day].back);
 await pg.exec(fs.readFileSync('netlify/database/migrations/20261016213600_import_existing_rides.sql','utf8'));assert.deepEqual((await get()).data,after.data);
 const external=await api.POST(new Request('https://local.test/api/state',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}));assert.equal(external.status,403);
 await pg.close();
});
