import {normalizedTransaction} from '../../web/transaction-context.mjs';
// Components are deduplicated from signed trace frames, so they are bounded by
// the engine's SIGNED_TRACE_FRAME_LIMIT (src/engine.ts). Keep the two equal.
export const MAX_SIGNED_COMPONENTS=1024;
export function validateProof(value) {
  if(!value||value.schemaVersion!=='poa_transaction_evidence_v1'||!['UNKNOWN','LIVE_ANALYSIS','PARTIAL','CHANGED','VERIFIED'].includes(value.state))throw Error('invalid_proof');
  if(!Array.isArray(value.components)||value.components.length>MAX_SIGNED_COMPONENTS||value.total!==value.components.length)throw Error('invalid_components');
  const count=value.components.filter(c=>c.state==='VERIFIED').length;
  if(value.covered!==count)throw Error('invalid_coverage_count');
  if(value.state==='VERIFIED'&&value.policy?.mode==='PRODUCTION'&&!value.policy.fullAllowed)throw Error('production_policy_gate_failed');
  if(value.state==='VERIFIED'&&(!value.traceComplete||!value.total||count!==value.total))throw Error('incomplete_verified_path');
  for(const c of value.components)if(c.state==='VERIFIED'&&(!c.snapshot||!c.snapshot.reviewer||!c.snapshot.report||c.snapshot.chainId!==value.chainId||c.snapshot.deployment!==c.context||c.snapshot.runtimeHash!==c.codeHash||c.snapshot.implementation!==c.address||(c.snapshot.demo&&value.chainId!=='31337')||!c.snapshot.functions?.some(f=>f.selector===c.selector&&f.signature===c.signature&&f.coverageLevel!=='EXPLICITLY_OUT_OF_SCOPE')))throw Error('missing_verified_provenance');
  const levels=['FUNCTION_REVIEW_CONFIRMED','CONTRACT_REVIEW_CONFIRMED','COVERED_BY_REVIEWED_CODE_VERSION'];
  for(const c of value.components)if(c.state==='VERIFIED'){const mapping=c.snapshot.functions.find(f=>f.selector===c.selector&&f.signature===c.signature);const permitted=mapping.coverageLevel??'COVERED_BY_REVIEWED_CODE_VERSION',claimed=c.coverageLevel??'COVERED_BY_REVIEWED_CODE_VERSION';if(!levels.includes(claimed)||!levels.includes(permitted)||claimed!==permitted||c.currentMatch!==undefined&&c.currentMatch!=='MATCH')throw Error('review_claim_exceeds_scope');}
  for(const c of value.components)if(c.previousReview){const s=c.previousReview;if(c.state!=='CHANGED'||!s.auditor||!s.reviewer||!s.report||s.chainId!==value.chainId||s.deployment!==c.context||(s.demo&&value.chainId!=='31337')||!s.functions?.some(f=>f.selector===c.selector&&f.signature===c.signature)||(s.runtimeHash===c.codeHash&&s.implementation===c.address))throw Error('invalid_historical_review');}
  const history=value.sinceReview;
  if(history){
    if(history.schemaVersion!=='poa_since_review_v1'||!['MONITORED_SINCE','CURRENT_MATCH_ONLY','BROKEN','UNKNOWN'].includes(history.state)||history.historyComplete!==false||history.coverageBasis!=='BLOCK_END_OBSERVATIONS_ONLY'||!Array.isArray(history.relevantChanges)||history.relevantChanges.length>50||!Array.isArray(history.limitations))throw Error('invalid_continuity_summary');
    if(history.freshness==='FRESH'&&history.checkedThrough?.hash!==value.block?.hash)throw Error('continuity_block_mismatch');
    if(!value.traceComplete&&history.transactionImpact!=='IMPACT_UNKNOWN')throw Error('incomplete_continuity_impact');
    const actual=value.components.some(c=>c.currentMatch==='CHANGED')?'CHANGED':value.components.length&&value.components.every(c=>c.currentMatch==='MATCH')?'MATCH':'UNKNOWN';
    if(history.currentMatch!==actual)throw Error('continuity_current_match_mismatch');
  }
  return value;
}
export function transactionPassport(value,transaction){
  const tx=value.transaction;
  if(JSON.stringify(normalizedTransaction(tx))!==JSON.stringify(normalizedTransaction(transaction)))throw Error('wrong_transaction_execution_context');
  if(!tx||tx.chainId!==transaction.chainId||tx.from?.toLowerCase()!==transaction.from?.toLowerCase()||tx.to?.toLowerCase()!==transaction.to?.toLowerCase()||tx.data?.toLowerCase()!==transaction.data?.toLowerCase()||BigInt(tx.value)!==BigInt(transaction.value)||value.chainId!==tx.chainId||value.target?.toLowerCase()!==tx.to?.toLowerCase())throw Error('wrong_transaction_proof');
  if(!/^\/proof\/transaction\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.passportUrl??''))throw Error('exact_transaction_passport_unavailable');
  return value.passportUrl;
}
// Native JSX Text receives literal strings, not legacy Markdown. Remove only
// invisible control/bidi overrides; punctuation must remain readable.
export function safeText(value) {return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,240);}
