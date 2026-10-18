import type {Data} from './model';
export type StatePayload={data?:Data;revision?:number;error?:string};
// Bound both the request and reading its body: a stalled connection must not lock the UI.
export async function requestState(init?:RequestInit){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('/api/state',{...init,signal:controller.signal});
  const payload=await response.json() as StatePayload;
  return {response,payload};
 }catch(error){
  if(controller.signal.aborted)throw Error('השרת לא הגיב בזמן. בדקו את החיבור ונסו שוב.');
  if(error instanceof SyntaxError)throw Error('התקבלה תשובה לא תקינה מהשרת. נסו שוב.');
  throw Error('לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.');
 }finally{clearTimeout(timer)}
}
