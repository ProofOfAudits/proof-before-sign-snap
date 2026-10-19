// In-wallet review model shared by the Snap (and usable by the Explorer).
// Pure and deterministic: built ONLY from reviewCoverage(proof) and fields of
// the proof itself. No network, no signature checks. The Snap calls it only on
// a proof that already passed verifyRuntimeProof -> validateProof ->
// finalizeRuntimeProof (OWNER_DECISIONS 7). Every line it produces is derived
// from the signed proof; nothing here can raise the verdict.
import {reviewCoverage,CLASS_LABELS,frameSelector} from './review-coverage.mjs';
export const WALLET_REVIEW_SCHEMA='poa.wallet-review.v1';
export const REVIEW_SECTIONS=['calls','evidence','unresolved','activity','history'];
export const ACTIVITY_COMPLETENESS=['COMPLETE','PARTIAL_DATA','NOT_INDEXED'];
export const ACTIVITY_LABELS={COMPLETE:'COMPLETE',PARTIAL_DATA:'PARTIAL DATA',NOT_INDEXED:'NOT INDEXED'};
export const DIRECT_ONLY_REASON='direct_transactions_only';
const ACTIVITY_REASON_TEXT={[DIRECT_ONLY_REASON]:'direct transactions only, internal calls via routers/Safes not indexed'};
const lower=v=>typeof v==='string'?v.toLowerCase():v;
const isAddress=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v);
const isHash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
const short=a=>isAddress(a)?lower(a).slice(0,6)+'…'+lower(a).slice(-4):a?String(a):'address not established';
const shortHash=h=>isHash(h)?lower(h).slice(0,10)+'…'+lower(h).slice(-6):null;
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const words=v=>String(v).replace(/[:]/g,' ').replaceAll('_',' ').toLowerCase().trim();
const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
const count=v=>Number.isSafeInteger(v)&&v>=0;
// Block numbers arrive as hex (engine) or decimal (indexer). Display decimal.
export function blockNumber(v){
 if(Number.isSafeInteger(v)&&v>=0)return String(v);
 if(typeof v==='string'&&/^0x[0-9a-f]{1,16}$/i.test(v))return BigInt(v).toString();
 if(typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v))return v;
 return null;
}
const isoTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(Date.parse(v)).toISOString():null;
function lastInvocation(v){
 if(v==null)return null;
 if(typeof v!=='object')return undefined;
 const block=blockNumber(v.block??v.blockNumber),at=v.timestamp==null?null:Number.isSafeInteger(v.timestamp)?new Date(v.timestamp*1000).toISOString():isoTime(v.timestamp);
 if(!block||!isHash(v.txHash??v.transactionHash))return undefined;
 return {block,txHash:lower(v.txHash??v.transactionHash),at};
}
// Validates one activity fact. Accepts the FEAT-003 call-activity shape
// (trailing 24h, distinct transactions vs invocations, indexed vs discovered)
// and the existing top-level onchainActivity shape (UTC-day top-level counts).
// Returns null for anything that cannot be shown honestly; callers render that
// as NOT INDEXED. A count is never returned without its completeness.
export function walletActivityFact(fact){
 if(!fact||typeof fact!=='object')return null;
 if(typeof fact.completeness==='string'){
  if(!ACTIVITY_COMPLETENESS.includes(fact.completeness))return null;
  const disclosure=text(fact.disclosure);
  if(fact.completeness==='NOT_INDEXED')return {kind:'CALL_ACTIVITY',status:'NOT_INDEXED',reason:text(fact.reason)??'not_in_indexed_scope',disclosure};
  const rel=fact.relevantTransactions,range=fact.indexedRange,win=fact.window??null;
  if(!count(fact.transactions24h)||!count(fact.invocations24h)||!rel||!count(rel.discovered)||!count(rel.indexed)||rel.indexed>rel.discovered||!range)return null;
  const low=blockNumber(range.low),high=blockNumber(range.high),updated=isoTime(fact.lastIndexerUpdate),last=lastInvocation(fact.lastInvocation);
  if(!low||!high||BigInt(low)>BigInt(high)||!updated||last===undefined||!disclosure)return null;
  const fromBlock=win?blockNumber(win.fromBlock):low,toBlock=win?blockNumber(win.toBlock):high;
  if(!fromBlock||!toBlock)return null;
  // COMPLETE only when every relevant transaction in the window was indexed.
  if(fact.completeness==='COMPLETE'&&(rel.indexed!==rel.discovered||!win))return null;
  if(fact.completeness==='PARTIAL_DATA'&&!text(fact.reason))return null;
  // Discovery is direct-transaction only (tx.to), so calls reached through
  // routers, gateways or Safes are not counted: a COMPLETE fact (e.g. from an
  // earlier signed proof) is shown as PARTIAL DATA, never as a complete count.
  const status=fact.completeness==='COMPLETE'?'PARTIAL_DATA':fact.completeness,reason=fact.completeness==='COMPLETE'?DIRECT_ONLY_REASON:text(fact.reason);
  return {kind:'CALL_ACTIVITY',status,transactions24h:fact.transactions24h,invocations24h:fact.invocations24h,indexed:rel.indexed,discovered:rel.discovered,fromBlock,toBlock,indexedRange:{low,high},
   window:win?{fromTime:isoTime(win.fromTime),toTime:isoTime(win.toTime)}:null,lastInvocation:last,lastIndexerUpdate:updated,reason,disclosure,
   codeHash:isHash(fact.runtimeHash??fact.codeHash)?lower(fact.runtimeHash??fact.codeHash):null};
 }
 const a=fact.activity;if(!a||typeof a!=='object')return null;
 if(a.available!==true)return {kind:'TOP_LEVEL_DAILY',status:'NOT_INDEXED',reason:text(a.reason)?.replace(/^\?\s*/,'')??'History not indexed yet',disclosure:null};
 if(a.scope!=='TOP_LEVEL_SELECTOR'||!count(a.today)||!count(a.last7d)||!Array.isArray(a.daily)||a.daily.length!==7||a.daily.some(n=>!count(n))||a.daily[6]!==a.today||a.daily.reduce((x,y)=>x+y,0)!==a.last7d||!isoTime(a.indexedThrough)||!text(a.disclosure))return null;
 // UTC-day buckets of top-level calls: no trailing-24h window, no nested
 // invocations, no indexed block range, no indexed-vs-discovered ratio. The
 // 24h status is therefore NOT INDEXED; the UTC-day fact is kept separately
 // (utcDay) and is rendered on its own labelled line, never as a 24h count.
 return {kind:'TOP_LEVEL_DAILY',status:'NOT_INDEXED',reason:'trailing_24h_not_indexed',utcDay:{today:a.today,indexedThrough:isoTime(a.indexedThrough),stale:a.stale===true},disclosure:text(a.disclosure)};
}
export function activityLine(fact){
 if(!fact||fact.status==='NOT_INDEXED')return 'NOT INDEXED · '+(fact?.reason?words(fact.reason):'24h activity not indexed for this call');
 return plural(fact.transactions24h,'tx','tx')+' · '+plural(fact.invocations24h,'call')+' in 24h · '+ACTIVITY_LABELS[fact.status]+' (indexed '+fact.indexed+' of '+fact.discovered+' direct tx, blocks '+fact.fromBlock+'-'+fact.toBlock+')'+(fact.reason?' · '+(ACTIVITY_REASON_TEXT[fact.reason]??words(fact.reason)):'');
}
const sameComponent=(f,c)=>lower(f?.context)===lower(c.context)&&lower(f?.address??f?.codeAddress)===lower(c.address)&&lower(f?.selector)===lower(c.selector)&&(!(f?.codeHash??f?.runtimeHash)||!c.codeHash||lower(f.codeHash??f.runtimeHash)===lower(c.codeHash));
// The 24h call-activity fact wins over the older UTC-day top-level fact.
// A NOT INDEXED 24h fact keeps the separately labelled UTC-day fact, if any.
function activityFor(proof,c){
 let found=null;
 for(const list of [proof.callActivity,proof.onchainActivity]){
  if(!Array.isArray(list))continue;
  const raw=list.find(f=>sameComponent(f,c));
  if(!raw)continue;
  const fact=walletActivityFact(raw)??{kind:'INVALID',status:'NOT_INDEXED',reason:'activity evidence not established'};
  if(!found){found=fact;if(fact.status!=='NOT_INDEXED')return fact;continue;}
  if(fact.utcDay)return {...found,utcDay:fact.utcDay,dayDisclosure:fact.disclosure};
 }
 return found;
}
const matchIndex=(components,f)=>components.findIndex(c=>lower(c.address)===lower(f.address)&&lower(c.context)===lower(f.context)&&lower(c.selector)===frameSelector(f));
// Signature labels come from the signed proof only, keyed by the exact
// context + code address + selector identity. A component's own verified ABI
// signature labels it. A name is borrowed only by a proxy entry: a frame whose
// direct DELEGATECALL child runs in the same storage context with the same
// selector takes the child's verified signature (chains resolve bottom-up),
// and the root frame may take the decoded VERIFIED_ABI signature of the
// transaction. A selector match alone never transfers a name between
// unrelated contracts (4-byte collisions are a spoofing vector).
const identity=(context,address,selector)=>lower(context)+'|'+lower(address)+'|'+lower(selector);
function signatureIndex(proof){
 const m=new Map(),frames=Array.isArray(proof.traceFrames)?proof.traceFrames:[];
 for(const c of proof.components??[])if(text(c.signature))m.set(identity(c.context,c.address,c.selector),c.signature);
 const root=frames[0];
 if(root&&text(proof.decoded?.signature)&&proof.decoded.confidence==='VERIFIED_ABI'&&lower(proof.decoded.selector)===frameSelector(root)){const k=identity(root.context,root.address,frameSelector(root));if(!m.has(k))m.set(k,proof.decoded.signature);}
 for(let i=frames.length-1;i>0;i--){
  const f=frames[i],p=Number.isSafeInteger(f?.parentIndex)?frames[f.parentIndex]:undefined;
  if(!p||f.type!=='DELEGATECALL'||lower(f.context)!==lower(p.context)||frameSelector(f)!==frameSelector(p))continue;
  const own=m.get(identity(f.context,f.address,frameSelector(f))),k=identity(p.context,p.address,frameSelector(p));
  if(own&&!m.has(k))m.set(k,own);
 }
 return m;
}
const signatureOf=(labels,c,f)=>c?.signature??(c?labels.get(identity(c.context,c.address,c.selector)):f?labels.get(identity(f.context,f.address,frameSelector(f))):undefined)??null;
function componentLabel(c,labels){return (c.name??short(c.address))+'.'+(signatureOf(labels,c)??c.selector);}
function functionLabel(f,c,node,labels){
 const selector=frameSelector(f);
 const fn=signatureOf(labels,c,f)??node?.functionSignature??(f.created||String(f.type).startsWith('CREATE')?'contract creation':selector==='0x'?'no calldata':selector);
 return (c?.name??node?.contractName??short(f.address))+'.'+fn;
}
function classDetail(cls,c){
 if(cls==='CHANGED_SINCE_REVIEW')return ': '+(c?.reason??'implementation differs from reviewed version');
 if(cls==='REVIEW_COVERAGE_UNKNOWN')return ': '+(c?.reason??'no approved review evidence for this exact function and deployment');
 if(cls==='EXCLUDED_FROM_REVIEW')return ': outside the approved review scope';
 if(cls==='UNRESOLVED')return c?': '+(c.codeHash?'routing unresolved':'code identity not established'):': no matching assessed component';
 if(cls==='NO_CODE')return ': not a contract review subject';
 if(cls==='PROXY_ENTRY')return ': routing only';
 return '';
}
function frameStatus(f){return f.success===false?'REVERTED'+(f.error||f.revertReason?': '+(f.revertReason??f.error):''):'success';}
function routingLine(f,node){
 const r=node?.routing;
 // Coverage follows the executed code identity (trace frame + code hash), not
 // the routing observation. An unconfirmed routing read is shown as such and
 // does not make the executed implementation unresolved.
 if(r&&r.status!=='NOT_A_PROXY_HOP')return 'Proxy '+short(r.proxy??f.context)+' → implementation '+short(r.implementation??f.address)+' · '+(r.adapter??'routing')+' '+(r.status==='UNRESOLVED'?'routing not confirmed · executed code identified from the trace':String(r.status??'').toLowerCase());
 if(f.type==='DELEGATECALL'||f.type==='CALLCODE')return 'Storage '+short(f.context)+' → code '+short(f.address)+(r?.status==='NOT_A_PROXY_HOP'?' · library/module delegatecall':'');
 return 'Contract '+(isAddress(f.address)?lower(f.address):'address not established');
}
function unresolvedReason(f,node){
 if(!isAddress(f.address))return 'frame address missing from the trace';
 if(node?.routing?.status==='UNRESOLVED')return 'proxy routing unresolved';
 return 'no matching assessed component (code not assessed)';
}
function buildSections(proof,rc,labels){
 const components=Array.isArray(proof.components)?proof.components:[],frames=Array.isArray(proof.traceFrames)?proof.traceFrames:[];
 const nodes=Array.isArray(proof.executionGraph?.nodes)?proof.executionGraph.nodes:[];
 const nodeAt=i=>nodes[i]?.index===i?nodes[i]:nodes.find(n=>n.index===i)??null;
 const calls=frames.map((f,i)=>{
  const j=matchIndex(components,f),c=j>=0?components[j]:null,node=nodeAt(i),cls=rc.frames[i]?.class??'UNRESOLVED';
  return {title:'↳ '.repeat(Math.min(Math.max(0,f.depth??0),6))+functionLabel(f,c,node,labels),tone:cls==='CHANGED_SINCE_REVIEW'?'warning':cls==='REVIEW_COVERED'?'success':'muted',
   lines:['#'+(i+1)+' · '+(f.type??'CALL')+' · depth '+(f.depth??0)+' · '+frameStatus(f),CLASS_LABELS[cls]+classDetail(cls,c),routingLine(f,node)]};
 });
 const evidence=components.map((c,j)=>{
  const cls=rc.componentClasses[j],review=c.snapshot??c.previousReview,lines=[CLASS_LABELS[cls]+classDetail(cls,c)];
  lines.push('Code '+short(c.address)+' · storage '+short(c.context)+' · '+(c.callType??'CALL'));
  if(review){
   lines.push('Audit: '+(review.auditor??'auditor not established')+(review.auditDate?' · '+review.auditDate:'')+' · report '+(review.report??'not established'));
   lines.push('Review evidence '+(review.id??'id not established')+(review.release?.releaseId?' · release '+review.release.releaseId:'')+(c.previousReview&&!c.snapshot?' · previous review':''));
   lines.push('Reviewed code '+(shortHash(review.runtimeHash)??'not established')+' at '+short(review.implementation)+(review.commit?' · commit '+String(review.commit).slice(0,12):''));
   const scope=review.functions?.find(fn=>lower(fn.selector)===lower(c.selector));
   if(cls==='EXCLUDED_FROM_REVIEW'&&scope?.scopeCitation)lines.push('Scope: '+scope.scopeCitation);
  }else lines.push('Approved review evidence: not established');
  lines.push('Current code '+(shortHash(c.codeHash)??'not established')+(c.currentMatch?' · current match '+c.currentMatch:''));
  if(cls==='CHANGED_SINCE_REVIEW'&&review&&(lower(review.runtimeHash)!==lower(c.codeHash)||lower(review.implementation)!==lower(c.address)))lines.push('Change: '+(lower(review.implementation)!==lower(c.address)?'implementation '+short(review.implementation)+' → '+short(c.address):'runtime '+(shortHash(review.runtimeHash)??'?')+' → '+(shortHash(c.codeHash)??'?')));
  if(cls==='REVIEW_COVERAGE_UNKNOWN'&&c.sourceStatus==='SOURCE_VERIFIED')lines.push('Verified source code is not verified audit scope.');
  return {title:componentLabel(c,labels),tone:cls==='CHANGED_SINCE_REVIEW'?'warning':cls==='REVIEW_COVERED'?'success':'muted',lines};
 });
 const unresolved=[];const steps=new Map();
 for(const [i,f] of frames.entries()){
  if(rc.frames[i]?.class!=='UNRESOLVED'||matchIndex(components,f)>=0)continue;
  const key=lower(f.address)+'|'+lower(f.context)+'|'+frameSelector(f);
  if(!steps.has(key))steps.set(key,{f,node:nodeAt(i),at:[]});steps.get(key).at.push(i+1);
 }
 for(const {f,node,at} of steps.values())unresolved.push({title:functionLabel(f,null,node,labels),tone:'warning',lines:['Frames #'+at.join(', #')+' · '+(f.type??'CALL'),'Unresolved: '+unresolvedReason(f,node),routingLine(f,node)]});
 for(const [j,c] of components.entries())if(rc.componentClasses[j]==='UNRESOLVED')unresolved.push({title:componentLabel(c,labels),tone:'warning',lines:['Unresolved: '+(c.codeHash?'proxy routing unresolved':'code unavailable or identity not established'),'Code '+short(c.address)+' · storage '+short(c.context)]});
 const tc=proof.traceCompleteness;
 if(proof.traceComplete!==true||!Array.isArray(proof.traceFrames)){
  const limits=[...(tc?.limitations??[]),...(proof.reasons??[]).filter(r=>/trace|frame|revert|path/i.test(r))];
  unresolved.push({title:'Execution path incomplete',tone:'warning',lines:[Array.isArray(proof.traceFrames)?'Signed proof carries '+frames.length+' of '+(count(tc?.observedFrames)?tc.observedFrames:frames.length)+' observed frames':'No observed execution trace in this proof',...(limits.length?['Limitations: '+[...new Set(limits)].map(words).join(' · ')]:[])]});
 }
 const activity=components.map(c=>{
  const fact=activityFor(proof,c),lines=[activityLine(fact)];
  if(fact?.kind==='CALL_ACTIVITY'&&fact.status!=='NOT_INDEXED'){
   lines.push(fact.lastInvocation?'Last call block '+fact.lastInvocation.block+' · tx '+shortHash(fact.lastInvocation.txHash)+(fact.lastInvocation.at?' · '+fact.lastInvocation.at:''):'No call observed in the indexed window');
   lines.push('Indexed blocks '+fact.indexedRange.low+'-'+fact.indexedRange.high+' · indexer updated '+fact.lastIndexerUpdate+(fact.codeHash?' · code '+shortHash(fact.codeHash):''));
  }
  if(fact?.utcDay)lines.push('Separate fact, not a 24h count: '+plural(fact.utcDay.today,'top-level tx','top-level tx')+' this UTC day through '+fact.utcDay.indexedThrough+(fact.utcDay.stale?' (stale)':'')+' · PARTIAL DATA · nested calls, indexed block range and indexed-vs-discovered not established');
  if(fact?.disclosure)lines.push(fact.disclosure);
  if(fact?.dayDisclosure)lines.push(fact.dayDisclosure);
  return {title:componentLabel(c,labels),tone:fact&&fact.status==='COMPLETE'?'default':'muted',lines};
 });
 const history=[];const s=proof.sinceReview;
 if(s&&s.schemaVersion==='poa_since_review_v1'){
  history.push({title:'Continuity · '+words(s.state),tone:s.state==='BROKEN'?'warning':'muted',lines:['Freshness '+words(s.freshness??'unknown')+(s.checkedThrough?' · checked through block '+(blockNumber(s.checkedThrough.number)??'?'):''),s.monitoringStartedAt?'Monitoring since '+s.monitoringStartedAt+' · earlier history unknown':'Monitoring start not established','Change impact on this transaction: '+words(s.transactionImpact??'impact_unknown')]});
  for(const ch of [...(s.relevantChanges??[])].reverse())history.push({title:words(ch.kind)+' · '+words(ch.dimension),tone:'warning',lines:['Deployment '+short(ch.deployment),'First observed '+ch.firstObservedAt+(ch.blockNumber?' · block '+(blockNumber(ch.blockNumber)??ch.blockNumber):'')+' · '+words(ch.timeQuality),...(ch.boundary?['Between blocks '+ch.boundary.fromBlock+' and '+ch.boundary.toBlock+'; activation transaction not established']:[])]});
 }
 for(const f of proof.presentationFacts??[]){
  if(!f?.change)continue;const c=components.find(x=>sameComponent(f,x));
  history.push({title:'Review gap opened · '+(c?componentLabel(c,labels):short(f.address)),tone:'warning',lines:['First observed '+f.change.firstObservedAt+(f.change.firstObservedBlock!=null?' at block '+(blockNumber(f.change.firstObservedBlock)??f.change.firstObservedBlock):''),'Exact activation time not established']});
 }
 for(const c of components)if(c.state==='CHANGED'&&c.previousReview)history.push({title:componentLabel(c,labels)+' changed since review',tone:'warning',lines:['Reviewed '+short(c.previousReview.implementation)+' runtime '+(shortHash(c.previousReview.runtimeHash)??'?')+' by '+(c.previousReview.auditor??'auditor not established'),'Current '+short(c.address)+' runtime '+(shortHash(c.codeHash)??'?')]});
 return {calls,evidence,unresolved,activity,history};
}
function mainReason(proof,rc,sections,labels){
 const components=proof.components??[],first=k=>components.find((_,j)=>rc.componentClasses[j]===k);
 const changed=first('CHANGED_SINCE_REVIEW');if(changed)return componentLabel(changed,labels)+': '+(changed.reason??'implementation differs from reviewed version');
 const unresolved=sections.unresolved[0];if(unresolved)return unresolved.title+': '+(unresolved.lines.find(l=>l.startsWith('Unresolved: '))?.slice(12)??unresolved.lines[0]);
 const unknown=first('REVIEW_COVERAGE_UNKNOWN');if(unknown)return componentLabel(unknown,labels)+': '+(unknown.reason??'review coverage not established');
 const excluded=first('EXCLUDED_FROM_REVIEW');if(excluded)return componentLabel(excluded,labels)+': explicitly excluded from review';
 const gate=proof.policy?.failedGates?.[0]??proof.reasons?.[0];
 return gate?words(gate):null;
}
// Full model: summary + every section (rows unpaged). Stored in the Snap
// interface context so navigation never needs the proof or the network.
export function walletReviewModel(proof,{section='summary',page=0,pageSize=5,issuedAt=null,now=Date.now()}={}){
 const rc=reviewCoverage(proof),labels=signatureIndex(proof),sections=buildSections(proof,rc,labels),c=rc.counts;
 const changedNames=(proof.components??[]).filter((_,j)=>rc.componentClasses[j]==='CHANGED_SINCE_REVIEW').map(x=>componentLabel(x,labels));
 const warnings=[];
 // Review coverage is one input to the overall check. A FULLY heading must not
 // hide that the overall check is weaker (failed policy gates, custom proxy
 // controls, or a non-VERIFIED state after finalization).
 if(rc.verdict==='FULLY_REVIEW_COVERED'){
  const gates=[...new Set([...(Array.isArray(proof.policy?.failedGates)?proof.policy.failedGates:[]),...((proof.reasons??[]).includes('unsupported_proxy_pattern')?['unsupported_proxy_pattern']:[])])];
  if(proof.state!=='VERIFIED'||gates.length)warnings.push('⚠ Overall check is '+(proof.state==='VERIFIED'?'VERIFIED with failed gates':'not VERIFIED ('+words(proof.state??'unknown')+')')+(gates.length?' · '+gates.slice(0,3).map(words).join(' · ')+(gates.length>3?' +'+(gates.length-3)+' more':''):'')+' · reviewed code alone does not establish the whole check');
 }
 if(rc.changedWarning)warnings.push('⚠ CHANGED · '+plural(c.changed,'component')+' differ'+(c.changed===1?'s':'')+' from the reviewed version: '+changedNames.slice(0,3).join(', ')+(changedNames.length>3?' +'+(changedNames.length-3)+' more':''));
 if(c.unresolved>0)warnings.push('? '+plural(c.unresolved,'unresolved call path')+' · open Unresolved');
 if(proof.traceComplete!==true||!Array.isArray(proof.traceFrames))warnings.push('? Complete execution path not established');
 const reverted=(proof.traceFrames??[]).filter(f=>f.success===false).length;
 if(reverted)warnings.push('⚠ '+plural(reverted,'call')+' reverted in this execution'+((proof.traceFrames??[])[0]?.success===false?' · the transaction itself reverts':''));
 if(c.excluded>0)warnings.push('⊘ '+plural(c.excluded,'component')+' explicitly excluded from review');
 const block=rc.checkedBlock,issued=isoTime(issuedAt),age=issued?Math.max(0,Math.round((now-Date.parse(issued))/1000)):null;
 const summary={verdict:rc.verdict,label:rc.label,explanation:rc.explanation,reason:rc.verdict==='FULLY_REVIEW_COVERED'?null:mainReason(proof,rc,sections,labels),changedWarning:rc.changedWarning,counts:c,
  countsLine:c.observedFrames+' observed frames · '+c.assessedComponents+' assessed · '+c.covered+' covered · '+c.changed+' changed · '+c.excluded+' excluded · '+c.unknown+' unknown · '+c.unresolved+' unresolved',
  checkedBlock:block?{number:blockNumber(block.number),hex:block.number,hash:lower(block.hash)}:null,
  checkedBlockLine:block?'Checked block '+(blockNumber(block.number)??block.number)+' · '+shortHash(block.hash):'Checked block not established',
  freshness:issued?'Evidence issued '+age+' s ago · '+issued:'Evidence issue time not established',
  executionMode:proof.executionMode??'SIMULATION',signedDetail:'All details are from the signed, transaction-bound proof.'};
 const model={schemaVersion:WALLET_REVIEW_SCHEMA,analysisId:typeof proof.passportUrl==='string'&&/^\/proof\/transaction\/[0-9a-f-]{36}$/i.test(proof.passportUrl)?proof.passportUrl.slice(19):null,
  summary,warnings,sections,sectionCounts:Object.fromEntries(REVIEW_SECTIONS.map(k=>[k,sections[k].length])),pageSize:Number.isSafeInteger(pageSize)&&pageSize>0&&pageSize<=20?pageSize:5};
 return reviewPage(model,{section,page});
}
// Deterministic pagination over a stored model: clamps out-of-range pages.
export function reviewPage(model,{section='summary',page=0}={}){
 const name=REVIEW_SECTIONS.includes(section)?section:'summary',all=name==='summary'?[]:model.sections[name]??[];
 const pages=Math.max(1,Math.ceil(all.length/model.pageSize)),at=Math.min(Math.max(0,Number.isSafeInteger(page)?page:0),pages-1);
 return {...model,section:name,page:at,pages,rows:all.slice(at*model.pageSize,(at+1)*model.pageSize)};
}
// Button names: poa-review-<section> opens (or, if open, closes) a section;
// poa-review-next / poa-review-previous page within it. Unknown -> null.
export function reviewNavigation(model,event){
 if(typeof event!=='string'||!model?.sections)return null;
 if(event==='poa-review-next')return reviewPage(model,{section:model.section,page:model.page+1});
 if(event==='poa-review-previous')return reviewPage(model,{section:model.section,page:model.page-1});
 if(event==='poa-review-summary')return reviewPage(model,{section:'summary'});
 const name=event.startsWith('poa-review-')?event.slice(11):null;
 if(!REVIEW_SECTIONS.includes(name))return null;
 return reviewPage(model,{section:model.section===name?'summary':name,page:0});
}
