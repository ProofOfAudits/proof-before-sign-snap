// Read-only production evidence for the pinned v2 trust. Not part of the npm package.
// Sends ONE POST to /api/proof/analyze per run, built exactly like src/index.jsx onTransaction,
// then runs the Snap's verification chain unchanged. Never signs or broadcasts anything.
// Usage: node scripts/live-mainnet-check.mjs <label> <to> <data> [from] [value]
import {readFile,writeFile,access,mkdir} from 'node:fs/promises';
import {walletTransaction} from '../../web/transaction-context.mjs';
import {verifyRuntimeProof,verifyRuntimeObservation,persistVerifiedEpoch,finalizeRuntimeProof,runtimeProofDeadline,commitment} from '../src/runtime-proof.mjs';
import {validateProof,transactionPassport} from '../src/validate.mjs';
import {verifyCheck} from '../../web/check-contract.mjs';
import {componentCounts} from '../../web/evidence-view.mjs';
// The header the shipped bundle sends (POA_VERSION = package.json version). The 2026-10-17 evidence files were
// recorded with 0.5.1 before this change; their request.headers keep the value actually sent.
const API='https://proofofaudits.com',SNAP_VERSION=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
// Offline, no network: `--reverify <label>` re-checks a recorded response at its own issuance time.
if(process.argv[2]==='--reverify'){
 const rec=JSON.parse(await readFile(new URL(`../../docs/release/0.6.1/evidence/mainnet-${process.argv[3]}.json`,import.meta.url),'utf8'));
 const trust=JSON.parse(await readFile(new URL('../trust/production-ethereum-v2.json',import.meta.url),'utf8')),dev=JSON.parse(await readFile(new URL('../development-trust.json',import.meta.url),'utf8'));
 const env=rec.response.body.runtimeProof,tx=rec.request.body,nonce=rec.request.headers['x-poa-nonce'],at=Date.parse(rec.verification.signer.issuedAt)+1000;
 const attempt=(f)=>{try{f();return 'accepted';}catch(e){return 'rejected:'+e.message;}};
 console.log(JSON.stringify({label:process.argv[3],productionTrust:attempt(()=>validateProof(JSON.parse(JSON.stringify(verifyRuntimeProof(env,tx,nonce,trust,at).proof)))),developmentTrust:attempt(()=>verifyRuntimeProof(env,tx,nonce,dev,at)),wrongNonce:attempt(()=>verifyRuntimeProof(env,tx,'00000000-0000-4000-8000-000000000000',trust,at)),afterExpiry:attempt(()=>verifyRuntimeProof(env,tx,nonce,trust,at+120000)),tamperedPayload:attempt(()=>verifyRuntimeProof({...env,payload:Buffer.from(Buffer.from(env.payload,'base64').toString().replace('"UNKNOWN"','"VERIFIED"')).toString('base64')},tx,nonce,trust,at))}));
 process.exit(0);
}
const [label,to,data,from='0x000000000000000000000000000000000000dEaD',value='0x0']=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(label??'')||!/^0x[0-9a-fA-F]{40}$/.test(to??'')||!/^0x(?:[0-9a-fA-F]{2})*$/.test(data??''))throw Error('usage: <label> <to> <data> [from] [value]');
const trust=JSON.parse(await readFile(new URL('../trust/production-ethereum-v2.json',import.meta.url),'utf8'));
const outDir=new URL('../../docs/release/0.6.1/evidence/',import.meta.url),out=new URL(`mainnet-${label}.json`,outDir);
// One request per label: an existing evidence file means the POST was already spent.
if(await access(out).then(()=>true,()=>false))throw Error('evidence exists; refusing to send another POST: '+out.pathname);
function requestNonce(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
const transaction={from,to,value,data},payload=walletTransaction(transaction,'1'),nonce=requestNonce();
const headers={'content-type':'application/json','x-poa-nonce':nonce,'x-poa-snap-version':SNAP_VERSION,'x-poa-runtime-schema':'poa-runtime-v1','x-poa-calldata-sha256':commitment(payload.data),'x-poa-request-sha256':commitment(payload)};
const record={note:'Read-only simulation request; unsigned transaction shape; never signed or broadcast; no funds',label,trustFile:'snap/trust/production-ethereum-v2.json',trustDomain:trust.trustDomain,request:{method:'POST',url:API+'/api/proof/analyze',headers,body:payload,sentAt:new Date().toISOString()}};
const started=Date.now();let response,text;
try{response=await fetch(API+'/api/proof/analyze',{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});text=await response.text();}
catch(error){record.response={error:String(error?.message??error)};}
const elapsedMs=Date.now()-started;
if(response)record.response={status:response.status,elapsedMs,snapTimeoutMs:9000,withinSnapTimeout:elapsedMs<9000,headers:Object.fromEntries(['date','content-type','x-poa-request-id','x-poa-runtime-schema'].filter(h=>response.headers.has(h)).map(h=>[h,response.headers.get(h)])),body:(()=>{try{return JSON.parse(text);}catch{return text;}})()};
// Verification mirrors onTransaction: runtime signature + binding, proof shape, passport, check, epoch, finalization.
const result={verified:false,error:null,stage:'response',state:null,verdict:null,counts:null,signer:null};
try{
 if(!response?.ok)throw Error('api_http_'+(response?.status??'none'));
 const body=record.response.body;result.stage='verify-runtime';let signed;
 try{signed=verifyRuntimeProof(body.runtimeProof,payload,nonce,trust);}
 catch(error){if(error?.message!=='minimum_observation_assurance_failed')throw error;const observation=verifyRuntimeObservation(body.runtimeProof,payload,nonce,trust);validateProof(JSON.parse(JSON.stringify(observation.proof)));transactionPassport(observation.proof,payload);result.readOnlyObservation=true;signed=null;result.state=observation.proof.state;result.counts=componentCounts(observation.proof);}
 if(signed){
  result.signer={keyids:body.runtimeProof.signatures.map(s=>s.keyid),policyVersion:signed.policyVersion,issuedAt:signed.issuedAt,expiresAt:signed.expiresAt,evidenceEpoch:signed.evidenceEpoch,analysisBlock:signed.analysisBlock};
  result.stage='validate';let verified=validateProof(JSON.parse(JSON.stringify(signed.proof)));transactionPassport(verified,payload);
  result.stage='verify-check';verified.verifiedCheck=verifyCheck(verified.check,verified);
  // In-memory stand-in for snap_manageState: a fresh install with no prior epoch anchor.
  let state=null;const request=async r=>{if(r.method!=='snap_manageState')throw Error('unexpected_request');if(r.params.operation==='get')return state;state=JSON.parse(JSON.stringify(r.params.newState));return null;};
  result.stage='persist-epoch';const receipt=await persistVerifiedEpoch(signed,trust,request);
  result.stage='finalize';verified=validateProof(finalizeRuntimeProof(signed,receipt));verified.verifiedCheck=verifyCheck(verified.check,verified);runtimeProofDeadline(signed);
  result.verified=true;result.stage='done';result.state=verified.state;result.verdict=verified.verifiedCheck.verdict?.state??null;result.counts=componentCounts(verified);
  result.components=verified.components.map(c=>({address:c.address,context:c.context,selector:c.selector,name:c.name??null,state:c.state,coverageLevel:c.coverageLevel??null,reason:c.reason??null}));
  result.reasons=verified.reasons;result.policy=verified.policy??null;result.passportUrl=verified.passportUrl;
 }
}catch(error){result.error=String(error?.message??error);}
record.verification=result;record.outcome=result.verified?'PASS':'FAIL';
await mkdir(outDir,{recursive:true});await writeFile(out,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({label,outcome:record.outcome,status:record.response?.status,elapsedMs,error:result.error,stage:result.stage,state:result.state,verdict:result.verdict,counts:result.counts}));
