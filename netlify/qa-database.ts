// Selected only by `next dev` with TRANSPORT_LOCAL_QA=1. Never used in a production build.
import {initial} from '../app/model';
const storage=globalThis as unknown as {__transportLocalQA?:{revision:number;data:string}};
if(!storage.__transportLocalQA){
 const data=initial();
 data.children=Array.from({length:6},(_,i)=>({id:`qa-${i+1}`,first:`ילד ${i+1}`,last:'בדיקה'}));
 data.weeks['2026-10-18']=structuredClone(data.weeks['2026-10-11']);
 storage.__transportLocalQA={revision:0,data:JSON.stringify(data)};
}
export const env={PUBLIC_ORIGIN:'http://127.0.0.1:5191',DB:{prepare(statement:string){
 let args:unknown[]=[];
 return {bind(...values:unknown[]){args=values;return this},async first(){return {...storage.__transportLocalQA!}},async run(){
  const row=storage.__transportLocalQA!;
  if(statement.startsWith('INSERT'))return {meta:{changes:0}};
  if(!statement.startsWith('UPDATE'))throw Error('Unexpected local QA query');
  if(row.revision!==args[1])return {meta:{changes:0}};
  storage.__transportLocalQA={revision:row.revision+1,data:String(args[0])};return {meta:{changes:1}};
 }};
}}};
