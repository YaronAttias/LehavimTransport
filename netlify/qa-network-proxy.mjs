// Browser QA only: upstream is fixed to the isolated, in-memory local QA server.
import http from 'node:http';
import net from 'node:net';
const upstream='http://127.0.0.1:5191';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let settings={postDelay:0,getDelay:0,mode:'normal'},events=[];
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks);
  if(req.url==='/__qa/control'){
   if(req.method==='POST'){settings={postDelay:0,getDelay:0,mode:'normal',...JSON.parse(body.toString())};events=[];}
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({settings,events}));return;
  }
  const api=req.url.startsWith('/api/state'),post=api&&req.method==='POST';
  const scenario={...settings};
  if(api)events.push({method:req.method,at:Date.now(),mode:scenario.mode});
  if(post)await sleep(scenario.postDelay);
  if(post&&scenario.mode==='reject'){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'התנגשות בדיקת QA — נסו שוב'}));return;}
  if(post&&scenario.mode==='disconnect'){req.socket.destroy();return;}
  if(post&&scenario.mode==='hang'){await sleep(60000);res.destroy();return;}
  const headers={...req.headers,host:new URL(upstream).host,'accept-encoding':'identity'};
  if(headers.origin)headers.origin=upstream;
  delete headers.connection;delete headers['content-length'];
  const result=await fetch(upstream+req.url,{method:req.method,headers,...(body.length?{body}:{}),redirect:'manual'});
  const payload=Buffer.from(await result.arrayBuffer());
  if(api&&!post)await sleep(scenario.getDelay);
  if(post&&scenario.mode==='lost-response'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'בדיקת QA: תשובת השמירה אבדה'}));return;}
  const responseHeaders={};
  for(const [key,value] of result.headers)if(!['content-encoding','content-length','transfer-encoding','connection'].includes(key))responseHeaders[key]=key==='location'?value.replace(upstream,'http://127.0.0.1:5190'):value;
  res.writeHead(result.status,responseHeaders);res.end(payload);
 }catch(error){if(!res.destroyed){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'QA proxy: '+error.message}));}}
});
server.on('upgrade',(req,socket,head)=>{
 const connection=net.connect(5191,'127.0.0.1',()=>{
  connection.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+Object.entries({...req.headers,host:'127.0.0.1:5191',origin:upstream}).map(([key,value])=>`${key}: ${value}`).join('\r\n')+'\r\n\r\n');
  if(head.length)connection.write(head);
  connection.pipe(socket);socket.pipe(connection);
 });
 connection.on('error',()=>socket.destroy());socket.on('error',()=>connection.destroy());
});
server.listen(5190,'127.0.0.1',()=>console.log('Isolated QA network proxy: http://127.0.0.1:5190'));
