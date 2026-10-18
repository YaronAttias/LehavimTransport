import {Users,ChevronDown} from 'lucide-react';
import {absentFor,names,type Child,type Day} from './model';

type Props={day:Day;dayIndex:number;children:Child[];direction:'out'|'back';busy:boolean;onChange:(childId:string,absent:boolean)=>void};
export default function DirectionAttendance({day,dayIndex,children,direction,busy,onChange}:Props){
 const absent=absentFor(day,direction),count=children.filter(c=>!absent.includes(c.id)).length;
 const label=direction==='out'?'בהלוך':'בחזור';
 return <details className="attendance direction-attendance">
  <summary aria-label={`נוכחות ${label} ביום ${names[dayIndex]}: ${count} מתוך ${children.length} נוסעים — עדכון נוסעים`}>
   <span className="attendance-count"><Users size={16}/><b>{count} מתוך {children.length}</b> נוסעים</span>
   <span className="attendance-action">עדכון נוסעים<ChevronDown size={16}/></span>
  </summary>
  <p>סמנו מי צריך הסעה {label}. השינוי נשמר מיד ומשפיע רק על כיוון זה.</p>
  <fieldset className="attendance-list"><legend className="sr-only">נוסעים {label} ביום {names[dayIndex]}</legend>
   {children.map(child=>{const riding=!absent.includes(child.id);return <label className={riding?'riding':'not-riding'} key={child.id}>
    <input type="checkbox" aria-label={`נוסע/ת ${label}: ${child.first} ${child.last}`} checked={riding} disabled={busy} onChange={e=>onChange(child.id,!e.target.checked)}/>
    <span>{child.first} {child.last}</span><small>{riding?'נוסע/ת':'ללא הסעה'}</small>
   </label>})}
  </fieldset>
 </details>;
}
