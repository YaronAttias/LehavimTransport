import {getDatabase} from '@netlify/database';
let database:ReturnType<typeof getDatabase>|undefined;
const sharedSql=()=>{database??=getDatabase({connectionString:process.env.NETLIFY_DB_URL});return database.sql};
// A narrow adapter keeps the already-tested request validation and atomic revision checks unchanged.
export const env={get PUBLIC_ORIGIN(){return process.env.TRANSPORT_PUBLIC_ORIGIN},DB:{prepare(statement:string){
 let values:unknown[]=[];
 const sql=sharedSql;
 return {
  bind(...args:unknown[]){values=args;return this},
  async first<T>(){if(statement!=='SELECT revision,data FROM transport_state WHERE id=1')throw Error('Unsupported read');const rows=await sql().unsafe(statement,values);return (rows[0]??null) as T|null},
  async run(){
   if(statement.startsWith('INSERT OR IGNORE INTO transport_state')){const rows=await sql().unsafe('INSERT INTO transport_state(id, revision, data) VALUES(1,0,$1) ON CONFLICT(id) DO NOTHING RETURNING id',values);return {meta:{changes:rows.length}}}
   if(statement==='UPDATE transport_state SET data=?,revision=revision+1 WHERE id=1 AND revision=?'){const rows=await sql().unsafe('UPDATE transport_state SET data=$1,revision=revision+1 WHERE id=1 AND revision=$2 RETURNING revision',values);return {meta:{changes:rows.length}}}
   throw Error('Unsupported write');
  }
 }
}}};
