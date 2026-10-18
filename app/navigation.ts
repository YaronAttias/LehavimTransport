import {defaultWeek} from './model';
export type View='week'|'admin';
export function navigationSelection(params:Record<string,string|string[]|undefined>={},fallbackWeek=defaultWeek()){
 const value=params.week;
 const valid=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value&&new Date(value+'T00:00:00Z').getUTCDay()===0;
 return {view:(params.view==='admin'?'admin':'week') as View,week:valid?value:fallbackWeek};
}
