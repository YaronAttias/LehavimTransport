import { env } from 'cloudflare:workers';
import { initial, blankDay, isGame, activityTimesValid, absentFor, seats, rideReview, type Data } from '../../model';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function config(){return env as unknown as {DB:D1Database;PUBLIC_ORIGIN?:string}}
export async function GET(req:Request){const db=config().DB;let row=await db.prepare('SELECT revision,data FROM transport_state WHERE id=1').first<{revision:number;data:string}>();if(!row){await db.prepare('INSERT OR IGNORE INTO transport_state(id, revision, data) VALUES(1,0,?)').bind(JSON.stringify(initial())).run();row=await db.prepare('SELECT revision,data FROM transport_state WHERE id=1').first<{revision:number;data:string}>()}return json({revision:row!.revision,data:JSON.parse(row!.data),role:'admin'})}
export async function POST(req:Request){try {if(req.headers.get('origin')!==(config().PUBLIC_ORIGIN||new URL(req.url).origin))return json({error:'בקשה לא מורשית'},403);const b=await req.json() as any;const c=config();const row=await c.DB.prepare('SELECT revision,data FROM transport_state WHERE id=1').first<{revision:number;data:string}>();if(!row||row.revision!==b.revision)return json({error:'הלוח עודכן על ידי הורה אחר. הנתונים רועננו, נסו שוב.'},409);const d:Data=JSON.parse(row.data);
if(b.action==='child-add'){const first=String(b.first||'').trim(),last=String(b.last||'').trim();if(!first||!last||first.length>40||last.length>40)throw Error('יש להזין שם ושם משפחה, עד 40 תווים');if(d.children.some(x=>x.first===first&&x.last===last))throw Error('הילד כבר קיים ברשימה');if(d.children.length>=6)throw Error('הקבוצה מוגבלת לשישה ילדים');d.children.push({id:crypto.randomUUID(),first,last})}
else if(b.action==='child-remove'){d.children=d.children.filter(x=>x.id!==b.childId);Object.values(d.weeks).forEach(days=>days.forEach(day=>{day.absent=day.absent.filter(x=>x!==b.childId);if(day.attendance)for(const direction of ['out','back'] as const)day.attendance[direction]=day.attendance[direction].filter(x=>x!==b.childId);day.out=day.out.filter(x=>x.childId!==b.childId);day.back=day.back.filter(x=>x.childId!==b.childId)}))}
else if(b.action==='schedule-import'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.week)||!Number.isFinite(Date.parse(b.week+'T12:00:00'))||new Date(b.week+'T12:00:00').getDay()!==0)throw Error('בחרו את תאריך יום ראשון של השבוע');
 if(!Array.isArray(b.days)||![5,6].includes(b.days.length))throw Error('יש להזין חמישה או שישה ימים');
 const previous=d.weeks[b.week]||Array.from({length:6},blankDay);
 d.weeks[b.week]=b.days.map((value:any,i:number)=>{
 if(!value||typeof value.active!=='boolean')throw Error('יום הפעילות אינו תקין');
 for(const key of ['arrival','start','returnTime'])if(typeof value[key]!=='string'||(value[key]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key])))throw Error('שעות הפעילות אינן תקינות');
 if(!activityTimesValid(value))throw Error('יש להזין שעת הגעה; באימון נדרשת גם שעת התחלה');
 return {...(previous[i]||blankDay()),active:value.active,title:String(value.title||'אימון').slice(0,80),arrival:value.arrival,start:value.start,returnTime:value.returnTime,note:String(value.note??previous[i]?.note??'').slice(0,300)};
 });
 if(b.days.length===5)d.weeks[b.week].push(previous[5]||blankDay());
}
else {if(!/^\d{4}-\d{2}-\d{2}$/.test(b.week)||!Number.isFinite(Date.parse(b.week+'T12:00:00'))||new Date(b.week+'T12:00:00').getDay()!==0)throw Error('תאריך השבוע אינו תקין');if(!Number.isInteger(b.day)||b.day<0||b.day>5)throw Error('יום לא תקין');if(!d.weeks[b.week]){if(b.action!=='schedule')throw Error('יש להגדיר את השבוע במסך הניהול');d.weeks[b.week]=Array.from({length:6},blankDay)}while(d.weeks[b.week].length<6)d.weeks[b.week].push(blankDay());const day=d.weeks[b.week][b.day];if(b.action==='schedule'){if(b.active&&isGame(String(b.title||'אימון'))&&!b.arrival)throw Error('יש להזין שעת הגעה למשחק');for(const k of ['arrival','start','returnTime'])if(b[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(b[k]))throw Error('שעה אינה תקינה');day.active=!!b.active;day.title=String(b.title||'אימון').slice(0,80);day.arrival=b.arrival||'';day.start=b.start||'';day.returnTime=b.returnTime||'';day.note=String(b.note||'').slice(0,300)}
else {if(!day.active)throw Error('אין הסעה ביום זה');if(!d.children.some(x=>x.id===b.childId))throw Error('יש לבחור ילד מהרשימה');if(b.action==='attendance'){
 if(typeof b.absent!=='boolean'||(b.direction!==undefined&&!['out','back'].includes(b.direction)))throw Error('עדכון נוכחות אינו תקין');
 if(b.direction===undefined){
  // Older clients update the whole day; preserve that existing contract.
  day.absent=day.absent.filter(x=>x!==b.childId);if(b.absent)day.absent.push(b.childId);
  if(day.attendance)for(const direction of ['out','back'] as const){day.attendance[direction]=day.attendance[direction].filter(x=>x!==b.childId);if(b.absent)day.attendance[direction].push(b.childId)}
 }else{
  day.attendance??={out:[...absentFor(day,'out')],back:[...absentFor(day,'back')]};
  const direction=b.direction as 'out'|'back';day.attendance[direction]=day.attendance[direction].filter(x=>x!==b.childId);if(b.absent)day.attendance[direction].push(b.childId);
 }
}else if(b.action==='ride'){
 if(!['out','back'].includes(b.direction))throw Error('פרטי הסעה לא תקינים');
 const key=b.direction as 'out'|'back',existing=day[key].some(x=>x.childId===b.childId);
 if(b.remove)day[key]=day[key].filter(x=>x.childId!==b.childId);
 else{
  if((b.size!==undefined&&![5,7].includes(b.size))||(b.availableSeats===undefined&&b.size===undefined))throw Error('פרטי הסעה לא תקינים');
  if(b.availableSeats!==undefined&&(!Number.isInteger(b.availableSeats)||b.availableSeats<1||b.availableSeats>6))throw Error('יש לבחור בין מקום פנוי אחד לשישה לילדי הקבוצה');
  if(!existing&&day[key].length>=2&&seats(day[key])>=rideReview(day,d.children,key).passengers)throw Error('כבר יש מספיק מקומות בכיוון זה; אפשר לעדכן שיבוץ קיים');
  day[key]=day[key].filter(x=>x.childId!==b.childId);
  day[key].push({childId:b.childId,...(b.size!==undefined?{size:b.size}:{}),...(b.availableSeats!==undefined?{availableSeats:b.availableSeats}:{})});
 }
}else throw Error('פעולה לא מוכרת')}}const result=await c.DB.prepare('UPDATE transport_state SET data=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(d),b.revision).run();if(!result.meta.changes)return json({error:'הלוח השתנה. רעננו ונסו שוב.'},409);return json({ok:true,data:d,revision:row.revision+1})}catch(e){return json({error:e instanceof Error?e.message:'אירעה שגיאה'},400)}}
