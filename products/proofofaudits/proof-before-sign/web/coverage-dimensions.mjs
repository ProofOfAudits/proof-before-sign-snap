// Deterministic presentation of signed facts. Does not replace production policy
// or upgrade a component's approved scope, execution assurance or authority.
export function coverageDimensions(proof){
 const changes=proof.sinceReview?.relevantChanges??[];
 const components=(proof.components??[]).map(c=>{
  const unresolved=!c.codeHash||c.coverageLevel==='ROUTING_UNRESOLVED';
  const routingIncomplete=proof.resolution?.proxy==='UNKNOWN'&&c.context===proof.target;
  const matches=c.snapshot&&c.snapshot.chainId===proof.chainId&&c.snapshot.deployment===c.context&&c.snapshot.implementation===c.address&&c.snapshot.runtimeHash===c.codeHash;
  const changedReview=c.state==='CHANGED'&&!!c.previousReview;
  const changedObservation=changes.some(change=>change.dimension==='CODE'&&[c.address,c.context].includes(change.subject));
  const review=c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?'EXPLICITLY_EXCLUDED':unresolved?'UNRESOLVED':c.state==='VERIFIED'&&matches?'COVERED_BY_APPROVED_SCOPE':'NO_SUFFICIENT_EVIDENCE';
  const code=unresolved?'UNRESOLVED':changedReview?'CHANGED_SINCE_REVIEW':matches?'MATCHES_REVIEWED_VERSION':changedObservation?'CHANGED_SINCE_PREVIOUS_OBSERVATION':'NO_COMPARISON_BASELINE';
  return {identity:[proof.chainId,c.context,c.address,c.codeHash??'',c.selector].join(':'),relation:c.relation,review,code,analysis:c.relation==='STATIC_REACHABLE'?'NOT_OBSERVED':!proof.traceComplete?'TRACE_INCOMPLETE':unresolved||routingIncomplete?'PARTIALLY_RESOLVED':proof.securityClosure?.status!=='RESOLVED'?'DEPENDENCIES_UNRESOLVED':'OBSERVED_EXECUTION_RESOLVED'};
 });
 const distinct=[...new Map(components.filter(c=>c.relation==='RUNTIME_OBSERVED').map(c=>[c.identity,c])).values()];
 const runtime=(proof.components??[]).filter(c=>c.relation==='RUNTIME_OBSERVED');
 return {components,counts:{observedCallFrames:proof.traceComplete?(proof.traceFrames??[]).length:null,distinctMaterialComponents:distinct.length,distinctExecutingCodeIdentities:new Set(runtime.filter(c=>c.codeHash).map(c=>c.address+':'+c.codeHash)).size,identifiedFunctionSelectors:new Set(runtime.map(c=>c.address+':'+c.selector)).size,covered:distinct.filter(c=>c.review==='COVERED_BY_APPROVED_SCOPE').length,excluded:distinct.filter(c=>c.review==='EXPLICITLY_EXCLUDED').length,unknown:distinct.filter(c=>c.review==='NO_SUFFICIENT_EVIDENCE').length,unresolved:distinct.filter(c=>c.review==='UNRESOLVED'||c.analysis==='PARTIALLY_RESOLVED').length,changedSinceReview:distinct.filter(c=>c.code==='CHANGED_SINCE_REVIEW').length,changedSinceObservation:distinct.filter(c=>c.code==='CHANGED_SINCE_PREVIOUS_OBSERVATION').length,knownPotentialRelationships:(proof.staticRelationships??[]).length},limitations:['Counts describe supplied signed observations, not an enumeration of every possible future path.','A code match and review coverage are independent from dependency and authority completeness.']};
}
