import {dayHasPassed,type Day} from '../model';

export function remainingActivities(days:Day[],week:string,today:string){
 return days.flatMap((day,index)=>day.active&&!dayHasPassed(week,index,today)?[{day,index}]:[]);
}

// Only explicit clothing instructions become a badge. Preserve the full note too.
export function kitColors(note:string){
 const instruction=/(?:מגיעים|להגיע|לבוא|לבוש|תלבושת|חולצ[הת]|בצבע)\s*[:־-]?\s*(?:עם\s+)?(?:חולצה\s+)?(?:בצבע\s+)?([א-ת\s,\/ו]+?)(?:[.!?\n;]|$)/g;
 const palette=[['לבן','#ffffff'],['שחור','#202826'],['אדום','#dc3645'],['כחול','#276bc4'],['ירוק','#28814b'],['צהוב','#f3ce35'],['כתום','#ed8936'],['סגול','#8b59b6'],['ורוד','#ed91bb'],['אפור','#9aa3a0']] as const;
 const text=[...note.matchAll(instruction)].map(match=>match[1]).join(' ');
 return palette.filter(([label])=>new RegExp(`(?:^|[\\s,/])ב?${label}(?=$|[\\s,/])`).test(text)).map(([label,color])=>({label,color}));
}
