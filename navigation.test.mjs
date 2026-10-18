import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const model=url(compile(fs.readFileSync('app/model.ts','utf8')));
const nav=await import(url(compile(fs.readFileSync('app/navigation.ts','utf8').replace("'./model'",JSON.stringify(model)))));
globalThis.__navigationTestReact=React;
const Form=(await import(url(compile('const React=globalThis.__navigationTestReact;\n'+fs.readFileSync('app/NavigationLink.tsx','utf8'))))).default;
test('Native links carry the requested view and week before JavaScript',()=>{
 let called=false;const html=renderToStaticMarkup(React.createElement(Form,{view:'admin',week:'2026-10-11',onNavigate:()=>{called=true}},'ניהול'));
 const href=html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&');assert.equal(called,false);assert.ok(href.startsWith('/?'));const params=Object.fromEntries(new URL(href,'https://local.test').searchParams);assert.deepEqual(nav.navigationSelection(params,'2026-10-18'),{view:'admin',week:'2026-10-11'});assert.match(html,/<a /);

});
test('Week navigation preserves the selected tab and valid historical Sunday',()=>{
 assert.deepEqual(nav.navigationSelection({view:'week',week:'2026-10-11'},'2026-10-18'),{view:'week',week:'2026-10-11'});
 assert.deepEqual(nav.navigationSelection({view:'admin',week:'2026-10-18'},'2026-10-25'),{view:'admin',week:'2026-10-18'});
});
test('Invalid or repeated query parameters fall back safely to the default week',()=>{
 for(const week of ['2026-02-30','2026-10-12','javascript:alert(1)',['2026-10-11','2026-10-18'],''])assert.equal(nav.navigationSelection({view:'other',week},'2026-10-18').week,'2026-10-18');
 assert.equal(nav.navigationSelection({view:['admin']},'2026-10-18').view,'week');
});
