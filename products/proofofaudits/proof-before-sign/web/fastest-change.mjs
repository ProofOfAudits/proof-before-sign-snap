import {completeClosureGate} from './analysis-support.mjs';
// Derived from the signed proof, never from getter hints or Safe thresholds.
// Unknown paths participate in the result; they are never filtered out.
function delay(result, depth=0) {
 if(depth>8||result?.status!=='COMPLETE'||result.unresolved?.length||!result.artifactHash)return null;
 if(result.timelockState){
  const s=result.timelockState;
  if(s.completeness!=='COMPLETE'||s.unresolved.length||s.pendingOperations.length)return null;
  const delayed=['0x134008d3','0xe38335e5','0x64d62353'].includes(result.selector)||['0x2f2ff15d','0xd547741f'].includes(result.selector)&&!s.externalAdministrators.length;
  const n=delayed?s.minDelaySeconds:'0';
  if(typeof n!=='string'||!/^(0|[1-9][0-9]*)$/.test(n)||BigInt(n)>BigInt(Number.MAX_SAFE_INTEGER))return null;
  return Number(n);
 }
 // A fully resolved native Safe has an immediate owner execution route.
 // Quorum size does not introduce a protocol time delay.
 if(result.safeState)return result.safeState.status==='COMPLETE'&&!result.safeState.unresolved.length?0:null;
 const children=[];
 for(const observation of result.observations??[])for(const key of ['safeOwnerAuthority','timelockOwnerAuthority','proxyAdminAuthority'])if(observation?.[key])children.push(observation[key]);
 if(children.length!==1)return null;
 return delay(children[0],depth+1);
}
export function fastestChangePath(proof){
 const results=proof?.authorityResolutions??[],paths=results.map(r=>({storageAddress:r.storageAddress,codeAddress:r.codeAddress,selector:r.selector,capability:r.capability,seconds:delay(r)}));
 const complete=completeClosureGate(proof?.closureGate)&&proof?.securityClosure?.status==='RESOLVED'&&proof.securityClosure.widening==='EXACT'&&!proof.securityClosure.unresolved.length&&results.length>0&&paths.every(p=>p.seconds!==null);
 return {status:complete?'COMPLETE':'UNKNOWN',seconds:complete?Math.min(...paths.map(p=>p.seconds)):null,paths};
}
export function fastestChangeLabel(proof){const value=fastestChangePath(proof);if(value.status!=='COMPLETE')return 'Fastest supported change path: UNKNOWN';const n=value.seconds;return 'Fastest supported change path: '+(n===0?'no protocol delay':n%86400===0?n/86400+'d':n%3600===0?n/3600+'h':n%60===0?n/60+'m':n+'s');}
