import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile,mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const allowed=new Set(['/snap.manifest.json','/package.json','/dist/bundle.js','/images/icon.svg']);
createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');if(!allowed.has(req.url)){res.writeHead(404);res.end();return;}
  try{const data=await readFile('.'+req.url);res.setHeader('Content-Type',req.url.endsWith('.svg')?'image/svg+xml':req.url.endsWith('.js')?'application/javascript':'application/json');res.setHeader('Cache-Control','no-store');res.end(data);}catch{res.writeHead(404);res.end();}
}).listen(Number(process.env.POA_SNAP_PORT??8080),'127.0.0.1',()=>console.log('Local Snap: http://localhost:'+String(process.env.POA_SNAP_PORT??8080)));
// Native Snap links require HTTPS. This self-signed certificate is only for
// localhost development; no trust-store installation or public hosting occurs.
await mkdir('.local',{recursive:true});
if(!existsSync('.local/key.pem')||!existsSync('.local/cert.pem'))execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','30','-keyout','.local/key.pem','-out','.local/cert.pem','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
createHttpsServer({key:await readFile('.local/key.pem'),cert:await readFile('.local/cert.pem')},async(req,res)=>{
  if(req.method!=='GET'||!/^\/(proof(?:\/|$)|api\/proof\/(transaction|passport)\/)/.test(req.url??'')){res.writeHead(404);res.end();return;}
  try{const response=await fetch((process.env.POA_API_URL??'http://127.0.0.1:4100')+req.url,{signal:AbortSignal.timeout(5000)});res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'text/plain','cache-control':'no-store'});res.end(Buffer.from(await response.arrayBuffer()));}
  catch{res.writeHead(503);res.end('Local proof service unavailable');}
}).listen(Number(process.env.POA_PASSPORT_PORT??4443),'127.0.0.1',()=>console.log('Local HTTPS Passport: https://localhost:'+String(process.env.POA_PASSPORT_PORT??4443)+' (development certificate)'));
