import Dashboard from './Dashboard';
import {GET} from './api/state/route';
import {navigationSelection} from './navigation';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const selection=navigationSelection(await searchParams);
 try{const response=await GET(new Request('https://internal/api/state'));return <Dashboard initialState={await response.json()} initialTab={selection.view} initialWeek={selection.week}/>}
 catch{return <Dashboard initialTab={selection.view} initialWeek={selection.week}/>}
}
