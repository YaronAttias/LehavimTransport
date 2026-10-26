'use client';
import {useEffect,useState} from 'react';
import {Car,Shirt,Info,ArrowUpRight,ArrowDownLeft,ShieldCheck,RefreshCw} from 'lucide-react';
import {type Data,type Day,names,jerusalemDate,defaultWeek,dateLabel,isGame,rideReview} from '../model';
import {requestState} from '../state-request';
import {kitColors,remainingActivities} from './kids-model';
import styles from './kids.module.css';

export default function KidsBoard(){
 const [data,setData]=useState<Data|null>(null),[today,setToday]=useState(''),[week,setWeek]=useState(''),[error,setError]=useState(''),[updated,setUpdated]=useState('');
 useEffect(()=>{
  let stopped=false,inFlight=false;
  const tick=()=>{setToday(jerusalemDate());setWeek(defaultWeek())};
  async function refresh(){
   tick();if(inFlight)return;inFlight=true;
   try{const {response,payload}=await requestState({cache:'no-store'});if(!response.ok||!payload.data)throw Error('לא הצלחנו לעדכן את הלוח');if(!stopped){setData(payload.data);setError('');setUpdated(new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}).format(new Date()))}}
   catch{if(!stopped)setError('לא הצלחנו לעדכן. בדקו את החיבור — ננסה שוב אוטומטית.')}
   finally{inFlight=false}
  }
  const visibleRefresh=()=>{if(document.visibilityState==='visible')void refresh()};
  void refresh();const timer=setInterval(visibleRefresh,30000);
  window.addEventListener('focus',visibleRefresh);document.addEventListener('visibilitychange',visibleRefresh);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',visibleRefresh);document.removeEventListener('visibilitychange',visibleRefresh)};
 },[]);
 const days=data?.weeks[week],activities=remainingActivities(days??[],week,today);
 function transport(day:Day,direction:'out'|'back'){
  const review=rideReview(day,data!.children,direction),rides=day[direction];
  const unresolved=review.passengers>0&&review.missing>0;
  return <div className={`${styles.ride} ${unresolved?styles.pending:''}`}>
   <span className={styles.car}><Car size={25}/></span><div className={styles.rideText}><span className={styles.rideLabel}>{direction==='out'?<ArrowUpRight size={16}/>:<ArrowDownLeft size={16}/>} {direction==='out'?'מי מסיע בהלוך':'מי אוסף בחזור'}</span>
   {rides.map(ride=>{const child=data!.children.find(c=>c.id===ride.childId);return <strong key={ride.childId}>{child?`ההורים של ${child.first} ${child.last}`:'משפחה ששובצה'}</strong>})}
   {!rides.length&&<strong>{review.passengers===0?'אין צורך בהסעה':direction==='out'?'עדיין לא נקבע מי מסיע':'עדיין לא נקבע מי אוסף'}</strong>}
   {rides.length>0&&unresolved&&<small>השיבוץ עדיין לא הושלם</small>}
   {review.needsReview&&<small>ההורים מתאמים את ההסעה — כדאי לוודא איתם לפני היציאה.</small>}
   </div></div>;
 }
 function card(day:Day,index:number,featured:boolean){
  const colors=kitColors(day.note),isToday=new Date(Date.parse(week+'T00:00:00Z')+index*86400000).toISOString().slice(0,10)===today;
  return <article key={index} className={`${styles.card} ${featured?styles.featured:''}`} aria-label={`${names[index]} ${day.title}`}>
   <div className={styles.cardHeading}><div><span className={styles.activity}>{isGame(day.title)?'⚽ משחק':'⚽ אימון'}</span><h2>יום {names[index]} <span>· {dateLabel(week,index)}</span></h2></div>{featured&&<span className={styles.today}>{isToday?'היום':'הפעילות הקרובה'}</span>}</div>
   {!['אימון','משחק'].includes(day.title)&&<p className={styles.activityTitle}>{day.title}</p>}
   <div className={styles.times}>{([['מגיעים',day.arrival],['מתחילים',day.start],['חוזרים',day.returnTime]] as const).filter(([,time])=>time).map(([label,time])=><div key={label}><span>{label}</span><b dir="ltr">{time}</b></div>)}</div>
   {colors.length>0&&<div className={styles.kits}>{colors.map(kit=><span className={styles.kit} key={kit.label}><Shirt size={32} fill={kit.color} color={kit.label==='שחור'?'#69766f':'#173c31'}/><b>מגיעים ב{kit.label}</b></span>)}</div>}
   <div className={styles.rides}>{transport(day,'out')}{transport(day,'back')}</div>
   {day.note&&<div className={styles.note}><Info size={20}/><p>{day.note}</p></div>}
  </article>;
 }
 return <main className={styles.board}>
  <div className={styles.hero}><div className={styles.pitch} aria-hidden="true"/><span className={styles.ball} aria-hidden="true">⚽</span><div className={styles.heroContent}><p>גבעות בר · הכדורגל שלנו</p><h1>עולים <em>למגרש</em></h1><p>כל האימונים וההסעות במקום אחד</p>{week&&<span className={styles.week}>{dateLabel(week)}–{dateLabel(week,5)}</span>}</div></div>
  <div className={styles.content}>
   {error&&<div className={styles.error} role="alert">{error}{data&&<span>מוצגים הנתונים מהעדכון האחרון ב־{updated}</span>}</div>}
   {!data&&!error&&<p className={styles.empty} role="status"><RefreshCw size={25}/>טוענים את השבוע שלנו…</p>}
   {data&&activities.length===0&&<div className={styles.empty}><span aria-hidden="true">⚽</span><h2>{days?'אין עוד הסעות השבוע':'לוח השבוע עדיין לא פורסם'}</h2><p>{days?'נתראה על המגרש!':'כשההורים יעדכנו, כל הפרטים יופיעו כאן.'}</p></div>}
   {activities.map(({day,index},position)=><div key={index}>{position===1&&<h2 className={styles.next}>בהמשך השבוע <span aria-hidden="true">━━━━</span></h2>}{card(day,index,position===0)}</div>)}
   {updated&&<p className={styles.updated}><span className={error?styles.stale:styles.live}/>{error?'העדכון האחרון':'עודכן ב־'}{updated} · מתעדכן אוטומטית</p>}
   <p className={styles.readonly}><ShieldCheck size={15}/> הלוח של הקבוצה · לצפייה בלבד</p>
  </div>
 </main>;
}
