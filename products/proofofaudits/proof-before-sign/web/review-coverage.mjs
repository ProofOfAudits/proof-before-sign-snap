import {executionAssurance} from './execution-assurance.mjs';
import {executionComplete} from './execution-completeness.mjs';
// The ONE deterministic review-coverage classifier shared by the engine,
// the Explorer and the Snap. Pure: no network, no signature checks. Wallet
// callers must pass a proof that was already verified and transaction-bound.
// Source verification, candidate/AI research and reviewed code at another
// deployment never become review coverage here.
export const REVIEW_COVERAGE_SCHEMA='poa.review-coverage.v1';
export const COMPONENT_CLASSES=['REVIEW_COVERED','CHANGED_SINCE_REVIEW','EXCLUDED_FROM_REVIEW','REVIEW_COVERAGE_UNKNOWN','UNRESOLVED'];
export const VERDICTS=['FULLY_REVIEW_COVERED','PARTIALLY_REVIEW_COVERED','NOT_REVIEW_COVERED','UNKNOWN','INCOMPLETE'];
export const CLASS_LABELS={REVIEW_COVERED:'REVIEW-COVERED',CHANGED_SINCE_REVIEW:'CHANGED SINCE REVIEW',EXCLUDED_FROM_REVIEW:'EXCLUDED FROM REVIEW',REVIEW_COVERAGE_UNKNOWN:'REVIEW COVERAGE UNKNOWN',UNRESOLVED:'UNRESOLVED',NO_CODE:'NO CONTRACT CODE',PROXY_ENTRY:'PROXY ENTRY'};
export const VERDICT_LABELS={FULLY_REVIEW_COVERED:'FULLY REVIEW-COVERED',PARTIALLY_REVIEW_COVERED:'PARTIALLY REVIEW-COVERED',NOT_REVIEW_COVERED:'NOT REVIEW-COVERED',UNKNOWN:'UNKNOWN',INCOMPLETE:'INCOMPLETE'};
const lower=v=>typeof v==='string'?v.toLowerCase():v;
// 0x01-0x11: Ethereum precompiles (incl. Prague BLS). No code, not a review subject.
export function isPrecompile(address){
 if(typeof address!=='string'||!/^0x0{30}[0-9a-f]{10}$/i.test(address))return false;
 const n=parseInt(address.slice(-10),16);return n>=1&&n<=0x11;
}
export function frameSelector(frame){return frame?.created?'0x':lower(String(frame?.input??'0x').slice(0,10));}
export function classifyComponent(c){
 if(c?.state==='CHANGED')return 'CHANGED_SINCE_REVIEW';
 if(c?.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE')return 'EXCLUDED_FROM_REVIEW';
 const identified=typeof c?.codeHash==='string'&&/^0x[0-9a-f]{64}$/i.test(c.codeHash);
 if(c?.state==='VERIFIED'&&c.snapshot&&c.currentMatch==='MATCH'&&identified)return 'REVIEW_COVERED';
 if(!identified||c?.coverageLevel==='ROUTING_UNRESOLVED')return 'UNRESOLVED';
 return 'REVIEW_COVERAGE_UNKNOWN';
}
const matches=(c,f)=>c?.relation!=='STATIC_REACHABLE'&&lower(c?.address)===lower(f?.address)&&lower(c?.context)===lower(f?.context)&&lower(c?.selector)===frameSelector(f);
export function reviewCoverage(proof){
 const components=Array.isArray(proof?.components)?proof.components:[];
 const frames=Array.isArray(proof?.traceFrames)?proof.traceFrames:null;
 const componentClasses=components.map(classifyComponent);
 const tally=k=>componentClasses.filter(v=>v===k).length;
 const covered=tally('REVIEW_COVERED'),changed=tally('CHANGED_SINCE_REVIEW'),excluded=tally('EXCLUDED_FROM_REVIEW'),unknown=tally('REVIEW_COVERAGE_UNKNOWN'),unresolvedComponents=tally('UNRESOLVED');
 // Same full-path rule as the wallet: exact address+context+selector; a
 // depth-0 proxy entry is routing; no-code and precompile frames are not
 // review subjects. Repeated calls to one unmatched step count once.
 // A proxy dispatcher executes code too; standard routing never grants its
 // bytecode an implicit audit exemption.
 const steps=new Set(),frameClasses=[];
 for(const [index,f] of (frames??[]).entries()){
  const i=components.findIndex(c=>matches(c,f));
  if(i>=0){frameClasses.push({index,class:componentClasses[i]});continue;}
  if(f?.codePresent===false||isPrecompile(f?.address)){frameClasses.push({index,class:'NO_CODE'});continue;}
  steps.add(lower(f?.address)+'|'+lower(f?.context)+'|'+frameSelector(f));frameClasses.push({index,class:'UNRESOLVED'});
 }
 const unresolved=steps.size+unresolvedComponents;
 const traceUnavailable=Array.isArray(proof?.reasons)&&proof.reasons.includes('execution_trace_unavailable');
 const observedFrames=Number.isSafeInteger(proof?.traceCompleteness?.observedFrames)&&proof.traceCompleteness.observedFrames>=(frames?.length??0)?proof.traceCompleteness.observedFrames:traceUnavailable?0:(frames?.length??0);
 const counts={observedFrames,assessedComponents:components.length,covered,changed,excluded,unknown,unresolved};
 const assurance=executionAssurance(proof);
 const instructionGap=!!proof?.executionRegions&&assurance.instructionAuditCoverage!=='ESTABLISHED';
 const integrationGap=!!proof?.executionRegions?.integration?.edges?.length&&assurance.integrationReview!=='ESTABLISHED';
 const reasons=[];
 if(instructionGap)reasons.push('instruction_scope_incomplete');
 if(integrationGap)reasons.push('integration_scope_incomplete');
 if(!executionComplete(proof))reasons.push('execution_path_incomplete');
 if(unresolved>0)reasons.push('unresolved_components');
 if(changed>0)reasons.push('changed_since_review');
 if(unknown>0)reasons.push('review_coverage_unknown');
 if(excluded>0)reasons.push('excluded_from_review');
 if(!components.length)reasons.push('no_assessed_components');
 // Fixed precedence, never majority voting. FULLY needs every assessed
 // component covered with a complete, fully resolved path.
 // Coverage is decided by executed-code identity: the trace frame's code
 // address plus its code hash. Proxy routing observations
 // (routingObservations, graph node routing.status) explain how a proxy
 // reached that code and are deliberately NOT inputs here; a routing read that
 // could not be confirmed does not change which code ran. Components whose own
 // routing is unresolved (coverageLevel ROUTING_UNRESOLVED) or whose code is
 // unidentified remain UNRESOLVED above.
 let verdict;
 if(!components.length&&!frames?.length)verdict='UNKNOWN';
 else if(!executionComplete(proof)||unresolved>0)verdict='INCOMPLETE';
 else if(components.length&&covered===components.length&&!instructionGap&&!integrationGap)verdict='FULLY_REVIEW_COVERED';
 else if(covered>0)verdict='PARTIALLY_REVIEW_COVERED';
 else if(components.length&&excluded+changed===components.length)verdict='NOT_REVIEW_COVERED';
 else verdict='UNKNOWN';
 const block=proof?.block&&typeof proof.block.number==='string'&&typeof proof.block.hash==='string'?{number:proof.block.number,hash:proof.block.hash}:null;
 return {schemaVersion:REVIEW_COVERAGE_SCHEMA,verdict,label:VERDICT_LABELS[verdict],changedWarning:changed>0,explanation:explain(verdict,counts,instructionGap,integrationGap),counts,componentClasses,frames:frameClasses,checkedBlock:block,reasons};
}
function explain(verdict,c,instructionGap=false,integrationGap=false){
 const list=parts=>parts.length>1?parts.slice(0,-1).join(', ')+' and '+parts.at(-1):parts[0];
 const blockers=[c.changed&&'changed',c.unknown&&'unknown',c.unresolved&&'unresolved',c.excluded&&'excluded'].filter(Boolean);
 if(verdict==='FULLY_REVIEW_COVERED')return 'Every assessed component matches its approved review scope. This does not establish instruction-level or integration review coverage.';
 if(verdict==='INCOMPLETE')return c.unresolved?'Unresolved calls prevent a complete review-coverage conclusion.':'The complete execution path was not established.';
 if(verdict==='NOT_REVIEW_COVERED')return 'No assessed component is covered by current approved review scope.';
 if(verdict==='PARTIALLY_REVIEW_COVERED'&&instructionGap)return 'Instruction-level audit scope is incomplete or unavailable for this execution.';
 if(verdict==='PARTIALLY_REVIEW_COVERED'&&integrationGap)return 'Review evidence does not cover every observed call edge.';
 if(verdict==='PARTIALLY_REVIEW_COVERED')return list(blockers).replace(/^./,v=>v.toUpperCase())+' components prevent a fully reviewed conclusion.';
 return c.assessedComponents?'Review coverage is not established for the assessed components.':'No execution evidence was established for this transaction.';
}
