import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:99,module:99}}).outputText).toString('base64');
const model=url(fs.readFileSync('app/model.ts','utf8'));
const {headerBand,columnEdges,normalizeCell,parseColumn}=await import(url(fs.readFileSync('app/import-schedule.ts','utf8').replace("'./model'",JSON.stringify(model))));
const source=process.argv[2];
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const band=headerBand(data,info.width,info.height),edges=columnEdges(data,info.width,info.height,7);
console.log({band,edges});
const parsedDays=[];
const worker=await createWorker(['heb','eng'],1,{cachePath:'outputs/ocr-cache'});
try{for(let i=0;i<6;i++){
 const index=6-i,left=edges[index]+6,right=edges[index+1]-6,top=band.bottom+8,bottom=Math.round(info.height*.97),factor=Math.max(1,Math.min(2.5,650/(right-left)));
 const {data:cell,info:size}=await sharp(source).extract({left,top,width:right-left,height:bottom-top}).resize(Math.round((right-left)*factor),Math.round((bottom-top)*factor)).ensureAlpha().raw().toBuffer({resolveWithObject:true});normalizeCell(cell);
 const png=await sharp(cell,{raw:size}).png().toBuffer();await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:''});const result=await worker.recognize(png);
 const header=await sharp(source).extract({left,top:band.top,width:right-left,height:band.bottom-band.top}).resize(Math.round((right-left)*factor)).png().toBuffer();await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:'0123456789./'});const h=await worker.recognize(header);
 const parsed=parseColumn(h.data.text+'\n'+result.data.text);parsedDays.push(parsed);console.log(i,JSON.stringify(parsed));fs.mkdirSync('outputs/import-qa',{recursive:true});fs.writeFileSync(`outputs/import-qa/day-${i}.txt`,h.data.text+'\n'+result.data.text);
}}finally{await worker.terminate()}

assert.deepEqual(parsedDays.map(p=>p.day.active),[true,true,false,true,false,true]);assert.equal(parsedDays[0].date,'18.10');assert.equal(parsedDays[3].day.arrival,'18:15');assert.equal(parsedDays[5].day.start,'12:45');assert.equal(parsedDays[1].day.arrival,'15:00');assert.equal(parsedDays[1].day.start,'');console.log('Attached image assertions passed');
