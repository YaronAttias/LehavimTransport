import {blankDay,endTime,type Day} from './model';

export function headerBand(pixels:Uint8ClampedArray|Uint8Array,width:number,height:number){
 const rows:number[]=[];for(let y=0;y<height*.28;y++){let dark=0,total=0;for(let x=0;x<width;x+=3){const p=(y*width+x)*4;if(pixels[p]<95&&pixels[p+1]<95&&pixels[p+2]<95)dark++;total++}if(dark/total>.75)rows.push(y)}
 const groups:number[][]=[];for(const y of rows){const g=groups[groups.length-1];if(g&&y-g[g.length-1]<6)g.push(y);else groups.push([y])}
 if(groups.length>=2)return {top:groups[0][groups[0].length-1]+7,bottom:groups[1][0]-7};
 return {top:Math.round(height*.085),bottom:Math.round(height*.145)};
}

export function columnEdges(pixels:Uint8ClampedArray|Uint8Array,width:number,height:number,count:number){
 const candidates:number[]=[];const from=Math.floor(height*.2),to=Math.floor(height*.85);
 for(let x=0;x<width;x++){let dark=0,total=0;for(let y=from;y<to;y+=4){const p=(y*width+x)*4;if(pixels[p]<95&&pixels[p+1]<95&&pixels[p+2]<95)dark++;total++}if(dark/total>.65)candidates.push(x)}
 const groups:number[][]=[];for(const x of candidates){const last=groups[groups.length-1];if(last&&x-last[last.length-1]<5)last.push(x);else groups.push([x])}
 const edges=groups.map(g=>Math.round(g.reduce((a,b)=>a+b,0)/g.length));
 if(edges.length===count+1)return edges;
 return Array.from({length:count+1},(_,i)=>Math.round(i*width/count));
}
export function parseColumn(text:string):{day:Day;date:string;warning:string}{
 const clean=text.replace(/[\u200e\u200f]/g,'');
 const date=clean.split('\n').slice(0,3).join(' ').match(/\b([0-3]?\d)\s*[./]\s*([01]?\d)\b/);
 // Exercise durations and repeated OCR times must not shift activity fields.
 const schedule=clean.split(/מהלך\s*האימון/)[0];
 const matches=[...schedule.matchAll(/\b([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\b/g)];
 const times=[...new Set(matches.map(m=>`${m[1].padStart(2,'0')}:${m[2]}`))];
 const prefix=schedule.slice(0,matches[0]?.index??schedule.length);
 const inactive=/חופש|מנוחה|עצמאי|אימון אישי/.test(prefix);
 const active=!inactive&&times.length>0;
 const title=inactive?(/אישי|עצמאי/.test(prefix)?'אימון אישי עצמאי':'חופש'):/משח[קך7]/.test(prefix)?'משחק':'אימון';
 const arrival=active?times[0]||'':'';
 // A stadium reporting time does not specify match kickoff.
 const arrivalOnly=title==='משחק'&&times.length===1&&/להיות|הגעה|התייצבות/.test(schedule);
 const start=active&&!arrivalOnly?(times[1]||times[0]||''):'';
 const note=/מגיעים[\s\S]{0,70}שחור/.test(clean)?'מגיעים בצבע שחור':/מגיעים[\s\S]{0,70}לבן/.test(clean)?'מגיעים בצבע לבן':'';
 return {day:{...blankDay(),active,title,arrival,start,returnTime:title==='משחק'?'':endTime(start),note},date:date?`${Number(date[1])}.${Number(date[2])}`:'',warning:inactive?'':arrivalOnly?'זוהתה שעת התייצבות למשחק. אפשר להשאיר את שעות ההתחלה והחזרה ריקות.':title==='משחק'?'במשחק נדרשת שעת הגעה בלבד; שעות התחלה וחזרה אינן חובה.':times.length<2?'לא זוהו שתי שעות — יש לבדוק את יום הפעילות והשעות.':''};
}
export function inferredWeek(date:string,year:number){const [day,month]=date.split('.').map(Number);if(!day||!month)return null;const d=new Date(year,month-1,day,12);if(d.getMonth()!==month-1||d.getDate()!==day||d.getDay()!==0)return null;return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}

// Remove saturated backgrounds while preserving black text for OCR.
export function normalizeCell(pixels:Uint8ClampedArray){
 for(let p=0;p<pixels.length;p+=4){const blue=pixels[p+2]>pixels[p]+45&&pixels[p+1]>pixels[p]+35;const ink=blue?255:Math.min(pixels[p],pixels[p+1],pixels[p+2]);pixels[p]=pixels[p+1]=pixels[p+2]=ink;pixels[p+3]=255}
}
