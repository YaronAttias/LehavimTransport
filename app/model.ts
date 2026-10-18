export type Child={id:string;first:string;last:string};
export type Ride={childId:string;size?:5|7;availableSeats?:number};
export type Day={active:boolean;title:string;arrival:string;start:string;returnTime:string;note:string;absent:string[];attendance?:{out:string[];back:string[]};out:Ride[];back:Ride[]};
export type Data={children:Child[];weeks:Record<string,Day[]>};
export const names=['ראשון','שני','שלישי','רביעי','חמישי','שישי'];
export const blankDay=():Day=>({active:false,title:'אימון',arrival:'',start:'',returnTime:'',note:'',absent:[],out:[],back:[]});
export const isGame=(title:string)=>/^משחק(?:\s|$)/.test(title.trim());
export const activityTimesValid=(day:Pick<Day,'active'|'title'|'arrival'|'start'>)=>!day.active||!!day.arrival&&(isGame(day.title)||!!day.start);
export function endTime(start:string){if(!start)return '';const [h,m]=start.split(':').map(Number);const t=(h*60+m+90)%1440;return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
export function initial():Data {const days=names.map(blankDay);for(const i of [0,3,4]){const start=i===3?'18:45':'18:30';days[i]={...blankDay(),active:true,arrival:i===3?'18:30':'18:15',start,returnTime:endTime(start),note:i===3?'מגיעים בצבע שחור':'מגיעים בצבע לבן'}}days[1].title='אימון אישי עצמאי';days[2].title='חופש';return {children:[],weeks:{'2026-10-11':days}}}
export const rideSeats=(ride:Ride)=>ride.availableSeats??(ride.size===7?6:4);
export function seats(rides:Ride[]){return rides.reduce((n,r)=>n+rideSeats(r),0)}
export function needed(count:number,rides:Ride[]){return Math.max(0,Math.ceil((count-seats(rides))/4))}
// Existing day-wide absences remain the default until a direction is edited.
export const absentFor=(day:Day,direction:'out'|'back')=>day.attendance?.[direction]??day.absent;
export function dayIsCovered(day:Day,children:Child[]){const reviews=(['out','back'] as const).map(direction=>rideReview(day,children,direction));return reviews.some(r=>r.passengers>0)&&reviews.every(r=>r.missing===0)}
export function rideReview(day:Day,children:Child[],direction:'out'|'back'){
 const absent=absentFor(day,direction),passengers=children.filter(c=>!absent.includes(c.id)).length,rides=day[direction];
 const absentDrivers=rides.filter(r=>children.some(c=>c.id===r.childId)&&absent.includes(r.childId)).map(r=>r.childId);
 const redundant=passengers>0&&rides.length>1&&rides.some(r=>rideSeats(r)>=passengers);
 const noPassengers=passengers===0&&rides.length>0;
 return {passengers,capacity:seats(rides),shortfall:Math.max(0,passengers-seats(rides)),missing:needed(passengers,rides),absentDrivers,redundant,noPassengers,needsReview:redundant||noPassengers||absentDrivers.length>0};
}
export function sunday(date:Date){const d=new Date(date);d.setDate(d.getDate()-d.getDay());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function shift(week:string,n:number){const d=new Date(week+'T12:00:00');d.setDate(d.getDate()+n);return sunday(d)}
export function dateLabel(week:string,i=0){const d=new Date(week+'T12:00:00');d.setDate(d.getDate()+i);return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}
export function jerusalemDate(now=new Date()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const value=(key:string)=>parts.find(p=>p.type===key)!.value;return `${value('year')}-${value('month')}-${value('day')}`}
export function dayHasPassed(week:string,index:number,today:string){return new Date(Date.parse(week+'T00:00:00Z')+index*86400000).toISOString().slice(0,10)<today}
export function defaultWeek(now=new Date()){
 const date=new Date(jerusalemDate(now)+'T12:00:00Z'),day=date.getUTCDay();
 date.setUTCDate(date.getUTCDate()+(day===6?1:-day));
 return date.toISOString().slice(0,10);
}
