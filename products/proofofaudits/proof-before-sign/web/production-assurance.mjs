import {normalizedTransaction} from './transaction-context.mjs';
import {completeClosureGate,ANALYSIS_SUPPORT_VERSION} from './analysis-support.mjs';
export const PRODUCTION_POLICY='poa_policy_v3';
export const MINIMUM_OBSERVATION_ASSURANCE='STANDARD';
export const assuranceVersions=Object.freeze({policy:PRODUCTION_POLICY,analysisSupport:ANALYSIS_SUPPORT_VERSION,authorityAnalyzer:'poa-authority-solc/1.4.0',authorityRuleset:'poa-authority-models/1.4.0',writerAnalyzer:'poa-solc-conservative/1.0.0',writerRuleset:'poa-scalar-storage/1.0.0'});
const word=v=>typeof v==='string'&&/^0x[a-f0-9]{64}$/i.test(v);
const address=v=>typeof v==='string'&&/^0x[a-f0-9]{40}$/i.test(v);
// Evidence-derived and portable. No environment input and no PROVEN shortcut.
export function observationAssurance(proof,commitment){
 // Hash exactly the JSON representation transmitted in the signed envelope.
 // Optional absent observations must remain missing facts, not throw before UNKNOWN.
 const wireCommitment=value=>commitment(JSON.parse(JSON.stringify(value??null)));
 const failed=[];if(proof.simulationConditions)failed.push('diagnostic_override_not_actual_chain_state');
 const pinned=/^[1-9][0-9]*$/.test(proof.chainId??'')&&proof.chainId!=='31337'&&/^0x[0-9a-f]+$/i.test(proof.block?.number??'')&&word(proof.block?.hash);
 if(!pinned)failed.push('pinned_supported_chain');
 if(!word(proof.block?.stateRoot))failed.push('reference_state_root');
 if(proof.traceComplete!==true||!Array.isArray(proof.traceFrames)||!proof.traceFrames.length||proof.traceFrames.some(f=>!address(f.address)||!address(f.context)||f.success!==true||f.created||!['CALL','STATICCALL','DELEGATECALL'].includes(f.type)))failed.push('complete_required_runtime_trace');
 const first=proof.traceFrames?.[0],request=proof.transaction;
 if(!request||request.chainId!==proof.chainId||first?.address!==request.to||first?.context!==request.to||first?.input!==request.data||first?.caller!==request.from||first?.depth!==0||proof.traceFrames?.some(f=>!proof.components?.some(c=>c.address===f.address&&c.context===f.context&&c.selector===f.input?.slice(0,10))))failed.push('exact_transaction_trace_binding');
 if(!proof.components?.length||proof.components.some(c=>!address(c.address)||!address(c.context)||!word(c.codeHash)))failed.push('current_material_code_identities');
 if(proof.closureGate?.deploymentResolutionComplete!==true||proof.analysisSupport?.completeness!=='COMPLETE')failed.push('material_resolution_complete');
 const state=proof.storageTrace;
 if(!request||state?.requestSha256!==commitment(normalizedTransaction(request))||state?.observationBlock?.number!==proof.block?.number||state?.observationBlock?.hash!==proof.block?.hash||state?.observationBlock?.stateRoot!==proof.block?.stateRoot)failed.push('critical_state_request_and_block_binding');
 if(state?.complete!==true||!Array.isArray(state.reads)||!Array.isArray(state.accesses)||!Array.isArray(state.events)||!Array.isArray(state.preimages)||state.reason||state.accesses.some(a=>!address(a.storageAddress)||!address(a.codeAddress)||!word(a.slot)||!word(a.value)||!['SLOAD','SSTORE'].includes(a.op)||a.op==='SSTORE'&&!word(a.newValue))||state.reads.some(r=>r.kind!=='PERSISTENT'||!state.accesses.some(a=>a.op==='SLOAD'&&a.storageAddress===r.storageAddress&&a.slot===r.slot)))failed.push('critical_state_observations');
 if(state?.complete===true&&Array.isArray(state.accesses)&&Array.isArray(state.reads)){
  const reads=new Set(state.reads.map(r=>r.storageAddress+':'+r.slot)),observed=new Set(state.accesses.filter(a=>a.op==='SLOAD').map(a=>a.storageAddress+':'+a.slot));
  if(reads.size!==state.reads.length||reads.size!==observed.size||[...observed].some(r=>!reads.has(r))||state.reads.some(r=>!proof.securityClosure?.nodes?.some(n=>n.id==='state:PERSISTENT:'+r.storageAddress+':'+r.slot&&n.resolution==='RESOLVED')))failed.push('complete_material_state_read_set');
 }
 if(!proof.securityClosure||proof.securityClosure.status!=='RESOLVED'||proof.securityClosure.widening!=='EXACT'||proof.securityClosure.unresolved?.length||proof.securityClosure.nodes?.some(n=>n.resolution!=='RESOLVED'))failed.push('no_unresolved_material_observation');
 const observed=pinned&&proof.traceComplete===true&&state?.complete===true&&proof.components?.length>0&&proof.components.every(c=>word(c.codeHash));
 return {schemaVersion:'poa-observation-assurance-v1',minimum:MINIMUM_OBSERVATION_ASSURANCE,level:failed.length?(observed?'OBSERVED':'UNKNOWN'):'STANDARD',providerAssurance:'PINNED_PROVIDER_OBSERVATIONS',referenceBlock:proof.block??null,traceSha256:wireCommitment(proof.traceFrames),stateObservationsSha256:wireCommitment(proof.storageTrace),codeIdentitiesSha256:wireCommitment((proof.components??[]).map(c=>({address:c.address,context:c.context,codeHash:c.codeHash??null}))),failedRequirements:failed};
}
export function serverAnalysisFailures(proof){
 const failed=[];if(proof.simulationConditions)failed.push('diagnostic_override_not_actual_chain_state');
 if(proof.state!=='UNKNOWN')failed.push('server_analysis_state');
 if(!Array.isArray(proof.reasons)||proof.reasons.some(r=>r!=='client_finalization_required'))failed.push('no_unresolved_analysis_failure');
 if(proof.traceComplete!==true)failed.push('complete_runtime_trace');
 if(!Number.isSafeInteger(proof.total)||proof.total<1||proof.components.length!==proof.total||proof.covered!==proof.total)failed.push('relevant_runtime_nodes');
 if(proof.components.some(c=>c.state!=='VERIFIED'||c.currentMatch!=='MATCH'))failed.push('current_review_for_every_node');
 if(proof.components.some(c=>c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'))failed.push('no_out_of_scope_node');
 if(!completeClosureGate(proof.closureGate))failed.push('complete_supported_material_closure');
 if(proof.analysisSupport?.completeness!=='COMPLETE'||proof.analysisSupport.reasons?.length||proof.analysisSupport.scope?.some(s=>s.status!=='SUPPORTED'))failed.push('analysis_support_completeness');
 if(!word(proof.block?.stateRoot))failed.push('block_state_root');
 if(proof.components.some(c=>!c.snapshot?.protectedEvidence?.envelope||c.snapshot?.release?.status!=='RELEASED'))failed.push('durable_evidence_signature');
 if(proof.internalExecution?.status!=='RESOLVED')failed.push('required_internal_execution');
 if(!Array.isArray(proof.internalExecution?.nodes)||proof.internalExecution.nodes.some(n=>n.currentMatch!=='MATCH'))failed.push('review_for_every_internal_node');
 const closure=proof.securityClosure;
 if(closure?.schemaVersion!=='poa-path-audit-v1'||closure.status!=='RESOLVED'||closure.widening!=='EXACT'||closure.unresolved.length||closure.required!==closure.reviewed||closure.nodes.some(n=>n.resolution!=='RESOLVED'||n.coverage!=='REVIEWED'))failed.push('bounded_reviewed_security_closure');
 if(!proof.authorityResolutions?.length||proof.authorityResolutions.some(a=>a.status!=='COMPLETE'||a.unresolved.length))failed.push('complete_effective_authority');
 if(proof.components.some(c=>c.snapshot?.findings?.some(f=>f.selectors.includes(c.selector)&&['CRITICAL','HIGH','MEDIUM'].includes(f.severity)&&(f.status!=='FIXED'||f.recheck!=='RECHECKED'))))failed.push('no_unresolved_material_finding');
 return failed;
}
export function productionAnalysisPolicy(proof,commitment){
 const observation=observationAssurance(proof,commitment),failed=serverAnalysisFailures(proof);
 if(observation.level!==MINIMUM_OBSERVATION_ASSURANCE)failed.push('minimum_observation_assurance');
 return {version:PRODUCTION_POLICY,mode:'PRODUCTION',phase:'SERVER_ANALYSIS',fullAllowed:false,serverAnalysisEligible:failed.length===0,serverFailedGates:failed,failedGates:[...failed,'runtime_signature','client_epoch_verification'],minimumObservationAssurance:MINIMUM_OBSERVATION_ASSURANCE,observationAssurance:observation,versions:assuranceVersions,internalExecution:proof.internalExecution?.status==='RESOLVED'?'INTERNAL_EXECUTION_RESOLVED':'INTERNAL_EXECUTION_UNKNOWN'};
}
