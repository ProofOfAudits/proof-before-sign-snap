// Short plain copy for a poa.check.v1 response. Shared by the Snap and the
// Passport. Templates only: every state comes from the deterministic verdict.
export const verdictCopy={
 VERIFIED_MATCH:{symbol:'✓',title:'Exact reviewed code',detail:'Live code, this function and every hop match approved review evidence.',color:'success'},
 DRIFT:{symbol:'≠',title:'Code changed since review',detail:'Live code differs from the reviewed version. The earlier review does not carry over.',color:'warning'},
 COVERAGE_UNKNOWN:{symbol:'?',title:'Function coverage not proven',detail:'POA knows this code, but review of this function is not proven.',color:'muted'},
 POA_UNVERIFIED:{symbol:'?',title:'Not in POA yet',detail:'POA has no review evidence for this contract.',color:'muted'},
 CODE_MATCH_DEPLOYMENT_UNVERIFIED:{symbol:'≈',title:'Reviewed code · deployment not verified',detail:'This code matches reviewed code elsewhere. This address is not bound to that review.',color:'muted'},
 EXECUTION_PATH_WARNING:{symbol:'⚠',title:'Path includes unreviewed code',detail:'The entry is reviewed, but this transaction also runs code without review evidence.',color:'warning'},
 REVIEW_WARNING:{symbol:'⚠',title:'Finding not rechecked',detail:'A finding on this path has no confirmed fix recheck.',color:'warning'},
 PARTIAL:{symbol:'◐',title:'Partial review evidence',detail:'Some parts of this transaction have no current review evidence.',color:'warning'},
 UNKNOWN:{symbol:'?',title:'Evidence not established',detail:'POA could not establish the facts needed for a result.',color:'muted'},
};
const plural=(n,one,many)=>n+' '+(n===1?one:many);
export function checkRows(check){
 const r=check.review,l=check.liveExecution,d=check.deployment,f=r.findings,pc=l.pathChange??{state:'UNKNOWN',newHops:[]};
 const live={EXACT:'✓ Exact reviewed code',CHANGED:'≠ Changed from reviewed code',CODE_MATCH_OTHER_DEPLOYMENT:'≈ Matches reviewed code elsewhere',UNKNOWN:'? No reviewed version confirmed'}[r.codeMatch];
 const fn=r.functionEvidence==='FOUND'?'✓ Review evidence found':'? Not proven';
 const path=r.executionPathEvidence==='UNKNOWN'?'? Full path not established':r.executionPathEvidence==='ALL_HOPS_REVIEWED'?`✓ ${r.hopsReviewed} of ${r.hops} hops reviewed`:`◐ ${r.hopsReviewed} of ${r.hops} hops reviewed`;
 const change=pc.state==='UNCHANGED'?'✓ Same path as at review':pc.state==='CHANGED'?'≠ '+[pc.newImplementation?'New implementation':pc.newCode?'New code':null,pc.newHops.length?plural(pc.newHops.length,'new hop','new hops'):null].filter(Boolean).join(' · ')+(pc.newImplementation||pc.newCode||pc.newHops.length?'':'Route changed')+' since review':'? Path at review not established';
 const findings=f.state==='NOT_APPLICABLE'?'? No reviewed code on this path':f.state==='NOT_ESTABLISHED'?'? Findings not mapped to this path':!f.affectingPath?'✓ None mapped to this path':f.unresolved?`⚠ ${f.affectingPath} on this path · ${f.unresolved} not rechecked`:`✓ ${f.affectingPath} on this path · fixed and rechecked`;
 const deployment=d.changedSinceReview==='CHANGED'?'≠ Changed since review':d.changedSinceReview==='NO_OBSERVED_CHANGE'?'✓ No observed change since review':'? Change history not established';
 const block=d.observationBlock?.number?'Observed at block '+(()=>{try{return BigInt(d.observationBlock.number).toString();}catch{return '?';}})():l.block?.number?'Checked at block '+(()=>{try{return BigInt(l.block.number).toString();}catch{return '?';}})():'Observation block not established';
 const reviewer=r.auditor?r.auditor+(r.scope?' · '+({FUNCTION_REVIEW_CONFIRMED:'exact function',CONTRACT_REVIEW_CONFIRMED:'contract scope',COVERED_BY_REVIEWED_CODE_VERSION:'reviewed code version',EXPLICITLY_OUT_OF_SCOPE:'out of scope'}[r.scope]??'scope not confirmed'):''):'? Reviewer not confirmed';
 const age=Number.isInteger(r.reviewAgeDays)?plural(r.reviewAgeDays,'day','days')+' since review date':null;
 const ctl=check.controls[0];
 const controls=ctl?(ctl.threshold&&ctl.members.length?`${ctl.threshold} of ${ctl.members.length} signers can ${ctl.capability==='upgrade'?'upgrade':'act'}`:ctl.kind==='WALLET'?'⚠ 1 wallet controls this code':'Controller identified')+' · '+(ctl.identitiesVerified?plural(ctl.identitiesVerified,'identity','identities')+' verified':'? identities unknown')+' · '+(ctl.interviews?plural(ctl.interviews,'interview','interviews'):'□ no interview'):'? Upgrade control not confirmed';
 return {live,fn,path,change,findings,deployment,block,reviewer,age,controls};
}
export function hopLine(h){
 const s={REVIEWED:'✓',CHANGED:'≠',NOT_REVIEWED:'⊘',CODE_REVIEWED_FUNCTION_UNPROVEN:'≈',UNKNOWN:'?'}[h.coverage]??'?';
 const what={REVIEWED:h.reviewer?.auditor?'Reviewed · '+h.reviewer.auditor:'Reviewed',CHANGED:'Changed since review',NOT_REVIEWED:'Outside review scope',CODE_REVIEWED_FUNCTION_UNPROVEN:'Code reviewed · function not proven',UNKNOWN:'Not reviewed or unknown'}[h.coverage]??'Unknown';
 const fn=h.signature?h.signature.split('(')[0]+'()':'function ?';
 return {title:`${s} ${h.delegated?'↳ delegatecall · ':h.entry?'':'→ '}${h.name} · ${fn}`,detail:what+(h.reviewer?.demo?' · demo evidence':'')};
}
// Wallet failure copy: calm, specific, never a verdict.
export function friendlyFailure(code){
 const c=String(code??'');
 if(/unsupported_chain/.test(c))return {symbol:'?',label:'Network not supported yet',detail:'POA checks Ethereum-compatible networks it is configured for.'};
 if(/invalid_transaction|unsupported_transaction_context|conflicting_|invalid_access_list|invalid_blob|authorization_execution|transaction_quantity/.test(c))return {symbol:'?',label:'Transaction format not supported',detail:'POA could not read this request. Nothing was checked.'};
 if(/contract_creation/.test(c))return {symbol:'?',label:'Contract deployment',detail:'New contracts have no deployed review baseline to compare.'};
 if(/api_http_429/.test(c))return {symbol:'◷',label:'Too many checks right now',detail:'Try again in a moment.'};
 if(/api_http_5|rpc|timeout|fetch|network|unavailable|Failed to fetch/i.test(c))return {symbol:'?',label:'Live check unavailable',detail:'POA could not reach live chain data. No result is shown instead of a guess.'};
 if(/passport_unavailable/.test(c))return {symbol:'?',label:'Proof page unavailable',detail:'The exact proof link was not issued for this request.'};
 if(/expired/.test(c))return {symbol:'◷',label:'Proof expired',detail:'Reopen the transaction for a fresh check.'};
 if(/check_verdict_mismatch|signature|trust|conflict|rollback|invalid_/.test(c))return {symbol:'×',label:'Proof could not be verified',detail:'The response did not pass signature or consistency checks. Do not rely on it.'};
 return {symbol:'?',label:'Check not completed',detail:'No trusted result is available for this transaction.'};
}
