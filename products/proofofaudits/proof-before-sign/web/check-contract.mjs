import {aaveDeployment} from './aave-directory.mjs';
// poa.check.v1 — the transaction check contract shared by the engine (server),
// the MetaMask Snap and the Passport. It is a deterministic projection of the
// existing poa_transaction_evidence_v1 proof (see web/transaction-context.mjs for
// the transaction commitment). It never creates evidence: every field is read
// from approved snapshots, live runtime facts or the continuity read model.
// The verdict is computed by code only. Missing evidence can never be green.
import {checkTransaction} from './transaction-context.mjs';
export const CHECK_SCHEMA='poa.check.v1';
export const EVIDENCE_SCHEMA='poa.evidence.v1';
export const FEEDBACK_SCHEMA='poa.feedback.v1';
export const VERDICT_ENGINE='poa_check_verdict_v1';
export const verdictStates=['VERIFIED_MATCH','DRIFT','COVERAGE_UNKNOWN','POA_UNVERIFIED','CODE_MATCH_DEPLOYMENT_UNVERIFIED','EXECUTION_PATH_WARNING','REVIEW_WARNING','PARTIAL','UNKNOWN'];
export const functionClasses=['supply','withdraw','borrow','repay','approve','transfer','swap','liquidate','stake','claim','governance','admin','other','unknown'];
export const reactions=['UP','DOWN'];
const lower=v=>typeof v==='string'?v.toLowerCase():v;
const text=(v,max=160)=>typeof v==='string'?v.slice(0,max):null;
const hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v)?v.toLowerCase():null;
const uuid=v=>{const m=/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(v??'');return m?m[1].toLowerCase():null;};
const DAY=86400000;

// Plain-language action from an ABI-decoded name. Selector candidates are not
// treated as decoded functions.
const classes={supply:'supply',deposit:'supply',mint:'supply',withdraw:'withdraw',redeem:'withdraw',borrow:'borrow',repay:'repay',approve:'approve',permit:'approve',increaseAllowance:'approve',setApprovalForAll:'approve',transfer:'transfer',transferFrom:'transfer',safeTransferFrom:'transfer',swap:'swap',exactInput:'swap',exactInputSingle:'swap',exactOutput:'swap',exactOutputSingle:'swap',multicall:'other',liquidationCall:'liquidate',liquidate:'liquidate',stake:'stake',unstake:'stake',claim:'claim',claimRewards:'claim',propose:'governance',castVote:'governance',execute:'governance',upgradeTo:'admin',upgradeToAndCall:'admin',transferOwnership:'admin',grantRole:'admin',revokeRole:'admin',pause:'admin',unpause:'admin'};
export function functionClass(decoded){
 if(!decoded||decoded.confidence==='SELECTOR_CANDIDATE'||typeof decoded.name!=='string')return 'unknown';
 return classes[decoded.name]??'other';
}
const tokenSymbol=v=>typeof v==='string'&&/^[A-Za-z0-9.$+-]{1,12}$/.test(v)?v:null;
export function functionTitle(decoded,token){
 const fc=functionClass(decoded);if(fc==='unknown')return 'Contract transaction';
 const verb=decoded.name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,v=>v.toUpperCase());
 const base={supply:'Supply',withdraw:'Withdraw',borrow:'Borrow',repay:'Repay',approve:'Approve spending',transfer:'Transfer',swap:'Swap',liquidate:'Liquidate'}[fc]??verb;
 const symbol=tokenSymbol(token);return symbol?base+' '+symbol:base;
}

// One hop of the observed runtime path. Review state is per hop: a reviewed
// entry does not lend coverage to any dependency it calls.
function hop(c,index,proof){
 const review=c.snapshot??c.previousReview;
 const coverage=c.state==='VERIFIED'?'REVIEWED':c.state==='CHANGED'?'CHANGED':c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?'NOT_REVIEWED':c.reviewedCode?'CODE_REVIEWED_FUNCTION_UNPROVEN':'UNKNOWN';
 return {index,name:text(c.name,120),address:lower(c.address),context:lower(c.context),selector:lower(c.selector),signature:text(c.signature,200),
  callType:text(c.callType,24),relation:c.relation,delegated:lower(c.context)!==lower(c.address),entry:lower(c.context)===lower(proof.target),
  runtimeCodeHash:hash(c.codeHash),codeMatch:c.currentMatch==='MATCH'?'EXACT':c.currentMatch==='CHANGED'?'CHANGED':c.reviewedCode?.relation==='OTHER_DEPLOYMENT'?'CODE_MATCH_OTHER_DEPLOYMENT':'UNKNOWN',
  coverage,scope:c.coverageLevel??'REVIEW_NOT_CONFIRMED',
  reviewer:review?{auditor:text(review.auditor),reviewer:text(review.reviewer),report:text(review.report,400),auditDate:text(review.auditDate,10),commit:text(review.commit,40),snapshotId:text(review.id,80),demo:review.demo===true,current:c.state==='VERIFIED'}:null};
}
export function entryComponent(proof){
 const comps=Array.isArray(proof?.components)?proof.components:[];
 return comps.find(c=>lower(c.context)===lower(proof.target)&&c.relation!=='STATIC_REACHABLE')??comps.find(c=>lower(c.context)===lower(proof.target))??comps[0];
}
function findingsFor(proof,path){
 // Findings live inside approved (immutable, signed) snapshots. They affect
 // this transaction only when their selector is on the observed path for the
 // same implementation that snapshot covered.
 const items=[];let mapped=false;
 for(const c of proof.components??[]){
  const s=c.snapshot??c.previousReview;if(!s)continue;
  if(Array.isArray(s.findings))mapped=true;else continue;
  for(const f of s.findings){
   if(!Array.isArray(f.selectors)||!f.selectors.map(lower).includes(lower(c.selector)))continue;
   if(items.some(i=>i.id===f.id))continue;
   items.push({id:text(f.id,80),severity:text(f.severity,16),title:text(f.title,160),component:text(c.name,120),selector:lower(c.selector),status:f.status,fixCommit:text(f.fixCommit,40),recheck:f.recheck==='RECHECKED'?'RECHECKED':'NOT_RECHECKED',citation:text(f.citation,400)});
  }
 }
 const reviewedHops=path.filter(h=>h.reviewer).length;
 const state=!reviewedHops?'NOT_APPLICABLE':mapped?'MAPPED':'NOT_ESTABLISHED';
 const unresolved=items.filter(i=>i.status!=='FIXED'||i.recheck!=='RECHECKED');
 return {state,affectingPath:items.length,fixed:items.filter(i=>i.status==='FIXED').length,rechecked:items.filter(i=>i.status==='FIXED'&&i.recheck==='RECHECKED').length,unresolved:unresolved.length,items:items.slice(0,20)};
}
// New hops are runtime dependencies absent from the review-time baseline
// observation. Without a baseline the change is UNKNOWN, never "unchanged".
function pathChange(proof,path,baseline,entry){
 const newImplementation=!!(entry?.state==='CHANGED'&&entry.previousReview&&lower(entry.previousReview.implementation)!==lower(entry.address));
 const newCode=!!(entry?.state==='CHANGED'&&entry.previousReview&&lower(entry.previousReview.implementation)===lower(entry.address));
 if(!proof.traceComplete)return {state:'UNKNOWN',newHops:[],newImplementation,newCode,basis:'Complete execution path not established.'};
 const routing=(proof.sinceReview?.relevantChanges??[]).filter(c=>['ROUTING','DEPENDENCY'].includes(c.dimension)).length;
 if(!baseline||!Array.isArray(baseline.dependencies)){return {state:newImplementation||newCode||routing?'CHANGED':'UNKNOWN',newHops:[],newImplementation,newCode,basis:'No review-time path observation for this deployment.'};}
 const known=new Set(baseline.dependencies.map(lower));
 const newHops=[...new Set(path.filter(h=>!h.entry&&h.relation!=='STATIC_REACHABLE').map(h=>h.address).filter(a=>!known.has(a)))];
 return {state:newHops.length||newImplementation||newCode||routing?'CHANGED':'UNCHANGED',newHops,newImplementation,newCode,baselineBlock:text(baseline.blockNumber,80),baselineObservedAt:text(baseline.observedAt,40),
  basis:'Compared with the deployment path observed at review time; removed hops are not inferred from one transaction.'};
}
// Deterministic verdict. Precedence is fixed and documented here:
// UNKNOWN > DRIFT > POA_UNVERIFIED > CODE_MATCH_DEPLOYMENT_UNVERIFIED >
// COVERAGE_UNKNOWN > PARTIAL > EXECUTION_PATH_WARNING > REVIEW_WARNING > VERIFIED_MATCH.
export function computeVerdict(proof,facts){
 const reasons=[];const comps=proof?.components??[];const entry=facts.entry;
 if(!proof||!['VERIFIED','PARTIAL','CHANGED','UNKNOWN','LIVE_ANALYSIS'].includes(proof.state))return {state:'UNKNOWN',reasonCodes:['INVALID_PROOF']};
 if(!proof.traceComplete)reasons.push('EXECUTION_PATH_INCOMPLETE');
 if(!comps.length)reasons.push('NO_RUNTIME_COMPONENTS');
 for(const r of proof.reasons??[])if(['analysis_deadline_exceeded','simulation_reverted','execution_trace_unavailable','unsupported_proxy_pattern','unsupported_chain','no_contract_code','production_assurance_incomplete','block_reorganized'].includes(r))reasons.push(r.toUpperCase());
 if(reasons.length)return {state:'UNKNOWN',reasonCodes:[...new Set(reasons)]};
 const drift=comps.filter(c=>c.currentMatch==='CHANGED'||c.state==='CHANGED');
 if(drift.length){for(const c of drift)reasons.push(c.previousReview&&lower(c.previousReview.implementation)!==lower(c.address)?'IMPLEMENTATION_CHANGED':'RUNTIME_CODE_CHANGED');return {state:'DRIFT',reasonCodes:[...new Set(reasons)]};}
 const related=c=>!!(c?.snapshot||c?.previousReview||c?.reviewedCode);
 if(!entry||!related(entry))return {state:'POA_UNVERIFIED',reasonCodes:['NO_POA_EVIDENCE_FOR_CONTRACT',...(comps.some(related)?['DEPENDENCY_EVIDENCE_ONLY']:[])]};
 if(entry.state!=='VERIFIED'){
  if(entry.reviewedCode?.relation==='OTHER_DEPLOYMENT')return {state:'CODE_MATCH_DEPLOYMENT_UNVERIFIED',reasonCodes:['REVIEWED_CODE_AT_OTHER_DEPLOYMENT','DEPLOYMENT_NOT_BOUND']};
  if(entry.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE')return {state:'COVERAGE_UNKNOWN',reasonCodes:['FUNCTION_OUT_OF_SCOPE']};
  if(entry.reviewedCode?.relation==='THIS_DEPLOYMENT')return {state:'COVERAGE_UNKNOWN',reasonCodes:['FUNCTION_NOT_PROVEN_COVERED']};
  return comps.some(c=>c.state==='VERIFIED')?{state:'PARTIAL',reasonCodes:['ENTRY_REVIEW_NOT_CONFIRMED']}:{state:'COVERAGE_UNKNOWN',reasonCodes:['FUNCTION_NOT_PROVEN_COVERED']};
 }
 const unreviewed=comps.filter(c=>c!==entry&&c.relation!=='STATIC_REACHABLE'&&c.state!=='VERIFIED');
 if(unreviewed.length){reasons.push('UNREVIEWED_HOP_ON_PATH');if(facts.pathChange.newHops.length)reasons.push('NEW_DEPENDENCY_SINCE_REVIEW');}
 if(facts.findings.unresolved)reasons.push('FINDING_NOT_RECHECKED');
 if(unreviewed.length)return {state:'EXECUTION_PATH_WARNING',reasonCodes:reasons};
 if(facts.findings.unresolved)return {state:'REVIEW_WARNING',reasonCodes:reasons};
 // Green requires the engine's own VERIFIED verdict as well: this layer can
 // only narrow, never widen, the evidence engine result.
 if(proof.state!=='VERIFIED'||proof.covered!==proof.total||!proof.total)return {state:'UNKNOWN',reasonCodes:['ENGINE_NOT_VERIFIED']};
 if(proof.policy?.mode==='PRODUCTION'&&!proof.policy.fullAllowed)return {state:'UNKNOWN',reasonCodes:['PRODUCTION_POLICY_GATE']};
 return {state:'VERIFIED_MATCH',reasonCodes:['EXACT_REVIEWED_CODE','FUNCTION_IN_SCOPE','ALL_HOPS_REVIEWED']};
}
function controls(proof){
 const out=[];
 for(const c of proof.components??[]){const a=c.authority??(lower(c.context)===lower(proof.target)?proof.authority:undefined);if(!a?.controller||out.some(o=>o.controller===lower(a.controller)))continue;
  const members=Array.isArray(a.owners)?[...new Set(a.owners.map(lower))]:[];const evidence=(proof.controllerEvidence??[]).filter(e=>[...members,lower(a.controller)].includes(lower(e.address)));
  out.push({component:text(c.name,120),controller:lower(a.controller),kind:a.controllerKind??'UNKNOWN',capability:a.capability??'unknown',threshold:Number.isInteger(a.threshold)?a.threshold:null,members:members.slice(0,32),
   timelockSeconds:Number.isSafeInteger(a.timelockSeconds)?a.timelockSeconds:null,
   identitiesVerified:evidence.filter(e=>e.verificationStatus==='POA_VERIFIED').length,interviews:evidence.reduce((n,e)=>n+(e.interviews?.length??0),0),
   identity:evidence.some(e=>e.verificationStatus==='POA_VERIFIED')?'PARTIAL_OR_VERIFIED':'UNKNOWN'});}
 return out;
}
export function checkResponse(proof,options={}){
 const now=options.now?new Date(options.now):new Date();
 const comps=Array.isArray(proof?.components)?proof.components:[];
 const entry=entryComponent(proof??{});
 const path=comps.map((c,i)=>hop(c,i,proof));
 const findings=findingsFor(proof,path);
 const change=pathChange(proof,path,options.baseline??proof?.reviewBaseline,entry);
 const verdict={...computeVerdict(proof,{entry,findings,pathChange:change}),engine:VERDICT_ENGINE};
 const review=entry?.snapshot??entry?.previousReview;
 const description=aaveDeployment(proof?.chainId,proof?.target);
 const protocol=text(review?.protocol??entry?.reviewedCode?.protocol??comps.map(c=>c.snapshot?.protocol??c.previousReview?.protocol??c.reviewedCode?.protocol).find(Boolean)??description?.name,120);
 const runtime=path.filter(h=>h.relation!=='STATIC_REACHABLE');
 const s=proof?.sinceReview;
 const relevant=(s?.relevantChanges??[]).filter(c=>c.dimension!=='REVIEW_EVIDENCE');
 const lastChange=relevant.at(-1);
 const reviewedAt=Date.parse(review?.auditDate??'');
 const missing=[];
 if(!proof?.traceComplete)missing.push('Complete execution path');
 if(!protocol)missing.push('Protocol identity');
 if(entry&&entry.state!=='VERIFIED')missing.push('Function review evidence');
 for(const h of runtime)if(h.coverage!=='REVIEWED'&&!h.entry)missing.push(h.name+' review');
 if(findings.state==='NOT_ESTABLISHED')missing.push('Findings mapped to this path');
 if(change.state==='UNKNOWN')missing.push('Review-time execution path');
 if(!s||s.freshness!=='FRESH')missing.push('Fresh deployment monitoring');
 const ctl=controls(proof??{});if(!ctl.length)missing.push('Upgrade controller');if(!ctl.some(c=>c.identitiesVerified))missing.push('Key-holder identities');
 missing.push('Pause authority');
 const tx=proof?.transaction?checkTransaction(proof.transaction):{chainId:proof?.chainId??null,to:lower(proof?.target)??null,value:null,selector:lower(proof?.function)??null};
 return {schemaVersion:CHECK_SCHEMA,checkId:uuid(proof?.passportUrl),passportUrl:text(proof?.passportUrl,80),evidenceSchema:proof?.schemaVersion??null,
  protocol:{name:protocol,network:description?.network??null,market:description?.market??null,source:review?(entry.snapshot?'APPROVED_SNAPSHOT':'PREVIOUS_REVIEW'):description?'PUBLISHED_DEPLOYMENT':protocol?'RELATED_REVIEW':null},
  transaction:{...tx,decoded:proof?.decoded&&proof.decoded.confidence!=='SELECTOR_CANDIDATE'?{name:text(proof.decoded.name,80),signature:text(proof.decoded.signature,200)}:null,title:proof?.interaction?.title??functionTitle(proof?.decoded,options.tokenSymbol),functionClass:functionClass(proof?.decoded)},
  liveExecution:{proxy:['ERC1967','BEACON','ERC1167'].includes(proof?.resolution?.proxy)?{type:proof.resolution.proxy,address:lower(proof.target)}:null,
   implementation:lower(entry?.address)??null,runtimeCodeHash:hash(entry?.codeHash),block:proof?.block?{number:proof.block.number,hash:proof.block.hash}:null,traceComplete:!!proof?.traceComplete,executionPath:path.slice(0,64),pathChange:change},
  review:{codeMatch:entry?.currentMatch==='MATCH'?'EXACT':entry?.currentMatch==='CHANGED'?'CHANGED':entry?.reviewedCode?.relation==='OTHER_DEPLOYMENT'?'CODE_MATCH_OTHER_DEPLOYMENT':'UNKNOWN',
   functionEvidence:entry?.state==='VERIFIED'?'FOUND':'NOT_PROVEN',
   executionPathEvidence:!proof?.traceComplete||!runtime.length?'UNKNOWN':runtime.every(h=>h.coverage==='REVIEWED')?'ALL_HOPS_REVIEWED':'SOME_HOPS_UNREVIEWED',
   hopsReviewed:runtime.filter(h=>h.coverage==='REVIEWED').length,hops:runtime.length,
   auditor:text(review?.auditor),reviewer:text(review?.reviewer),report:text(review?.report,400),scope:entry?.coverageLevel??null,auditDate:text(review?.auditDate,10),
   reviewAgeDays:Number.isFinite(reviewedAt)&&reviewedAt<=now.getTime()?Math.floor((now.getTime()-reviewedAt)/DAY):null,demo:review?.demo===true,findings},
  deployment:{address:lower(proof?.target)??null,chainId:proof?.chainId??null,
   changedSinceReview:!s?'UNKNOWN':s.currentMatch==='CHANGED'||relevant.some(c=>['CODE','ROUTING','DEPENDENCY'].includes(c.dimension))?'CHANGED':s.freshness==='FRESH'&&s.transactionImpact==='NO_RELEVANT_CHANGE'?'NO_OBSERVED_CHANGE':'UNKNOWN',
   continuity:s?.state??'UNKNOWN',transactionImpact:s?.transactionImpact??'IMPACT_UNKNOWN',observationBlock:s?.checkedThrough??null,monitoringStartedAt:s?.monitoringStartedAt??null,
   distance:s?.distance??null,lastMeaningfulChange:lastChange?{kind:lastChange.kind,dimension:lastChange.dimension,timeQuality:lastChange.timeQuality,firstObservedAt:lastChange.firstObservedAt,blockNumber:lastChange.blockNumber}:null,
   whyNotCurrent:Array.isArray(s?.whyNotCurrent)?s.whyNotCurrent.slice(0,8):[]},
  controls:ctl,missingFacts:[...new Set(missing)].slice(0,16),
  ingestion:{status:verdict.state==='POA_UNVERIFIED'?(options.ingestionQueued===true?'QUEUED':'NOT_CONFIRMED'):'NOT_REQUIRED'},
  verdict};
}
// The Snap recomputes the verdict from the signed proof and rejects a server
// check that claims a different state.
export function verifyCheck(check,proof){
 const local=checkResponse(proof);
 if(check===undefined)return local;
 if(!check||check.schemaVersion!==CHECK_SCHEMA||!verdictStates.includes(check.verdict?.state)||check.verdict.state!==local.verdict.state||check.checkId!==local.checkId)throw Error('check_verdict_mismatch');
 return {...local,ingestion:['QUEUED','NOT_CONFIRMED','NOT_REQUIRED'].includes(check.ingestion?.status)&&local.verdict.state==='POA_UNVERIFIED'?check.ingestion:local.ingestion};
}
// Feedback carries no wallet address, calldata or transaction fingerprint.
export function feedbackEvent(input){
 const out={schemaVersion:FEEDBACK_SCHEMA,checkId:uuid(input?.checkId),verdict:input?.verdict,functionClass:input?.functionClass,reaction:input?.reaction};
 if(!out.checkId||out.checkId!==String(input.checkId).toLowerCase()||!verdictStates.includes(out.verdict)||!functionClasses.includes(out.functionClass)||!reactions.includes(out.reaction))throw Error('invalid_feedback');
 return out;
}
// poa.evidence.v1 bundle → approved-snapshot finding shape (used when a
// reviewer releases a bundle). AI claims without evidence IDs are dropped.
export function findingsFromEvidenceBundle(bundle,implementation){
 if(bundle?.schemaVersion!==EVIDENCE_SCHEMA&&bundle?.schema!==EVIDENCE_SCHEMA)throw Error('invalid_evidence_bundle');
 const evidence=new Map((bundle.evidence??[]).map(e=>[e.id,e]));
 const contract=(bundle.contracts??[]).find(c=>!implementation||lower(c.address)===lower(implementation)||lower(c.implementation)===lower(implementation));
 const selectorsFor=names=>(contract?.functions??[]).filter(f=>names.includes(f.signature)||names.includes(f.name)||names.includes(f.selector)).map(f=>lower(f.selector)).filter(s=>/^0x[0-9a-f]{8}$/.test(s));
 return (bundle.findings??[]).filter(f=>Array.isArray(f.evidenceIds)&&f.evidenceIds.length&&f.evidenceIds.every(id=>evidence.has(id))).map(f=>({id:String(f.id).slice(0,80),severity:String(f.severity??'UNKNOWN').toUpperCase().slice(0,16),title:String(f.title??'').slice(0,160),
  selectors:[...new Set(selectorsFor(f.affectedFunctions??[]))],status:f.fix?.commit||f.status==='FIXED'?'FIXED':f.status==='ACKNOWLEDGED'?'ACKNOWLEDGED':'OPEN',fixCommit:f.fix?.commit??f.fixCommit,recheck:(f.recheck?.status??f.recheck)==='RECHECKED'?'RECHECKED':'NOT_RECHECKED',citation:f.evidenceIds.join(',')})).filter(f=>f.selectors.length);
}
