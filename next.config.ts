import type {NextConfig} from 'next';
import path from 'node:path';
import {PHASE_DEVELOPMENT_SERVER} from 'next/constants';
const nextConfig:NextConfig={
 webpack(config,{webpack,dev}){const adapter=dev&&process.env.TRANSPORT_LOCAL_QA==='1'?'netlify/qa-database.ts':'netlify/postgres.ts';config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,path.resolve(process.cwd(),adapter)));return config},
};
export default (phase:string)=>({...nextConfig,distDir:phase===PHASE_DEVELOPMENT_SERVER&&process.env.TRANSPORT_LOCAL_QA==='1'?'.next-qa':'.next'});
