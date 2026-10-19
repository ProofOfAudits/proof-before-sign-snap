import {productionAnalysisPolicy,PRODUCTION_POLICY} from './production-assurance.mjs';
import {verifyTimelockControlState} from './timelock-control.mjs';
import {verifySafeControlState} from './safe-control.mjs';
import {analysisEnvelope,ANALYSIS_SUPPORT_VERSION,completeClosureGate,closureGateKeys} from './analysis-support.mjs';
import {RUNTIME_SCHEMA,runtimeFields,userState,weakestLink} from './runtime-contract.mjs';
import {normalizedTransaction} from './transaction-context.mjs';
import {ed25519} from '@noble/curves/ed25519';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex,hexToBytes} from '@noble/hashes/utils';
export const TYPE='application/vnd.poa.runtime-proof.v1+json';
const authenticatedPayloads=new WeakMap(),persistedEpochs=new WeakMap(),readOnlyObservations=new WeakMap();
const utf8=s=>new TextEncoder().encode(s);
function unicode(s){for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=s.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('invalid_unicode');}else if(n>=0xdc00&&n<=0xdfff)throw Error('invalid_unicode');}}
export function canonical(value){if(value===null)return 'null';if(typeof value==='string'){unicode(value);return JSON.stringify(value);}if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_number');return JSON.stringify(value);}if(typeof value==='boolean')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object'&&!Array.isArray(value))return '{'+Object.keys(value).sort().map(k=>{unicode(k);return JSON.stringify(k)+':'+canonical(value[k]);}).join(',')+'}';throw Error('invalid_json');}
export const commitment=v=>bytesToHex(sha256(utf8(canonical(v))));
export {normalizedTransaction} from './transaction-context.mjs';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;}
function decode(s){if(typeof s!=='string'||s.length>2000000||s.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('invalid_base64');const bytes=[];for(let i=0;i<s.length;i+=4){const n=(alphabet.indexOf(s[i])<<18)|(alphabet.indexOf(s[i+1])<<12)|((s[i+2]==='='?0:alphabet.indexOf(s[i+2]))<<6)|(s[i+3]==='='?0:alphabet.indexOf(s[i+3]));bytes.push((n>>>16)&255);if(s[i+2]!=='=')bytes.push((n>>>8)&255);if(s[i+3]!=='=')bytes.push(n&255);}const out=Uint8Array.from(bytes);if(base64(out)!==s)throw Error('noncanonical_base64');return out;}
const concat=(...arrays)=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){out.set(a,at);at+=a.length;}return out;};
export const pae=(type,bytes)=>concat(utf8('DSSEv1 '+utf8(type).length+' '+type+' '+bytes.length+' '),bytes);
const hash=v=>/^[a-f0-9]{64}$/.test(v??'');
// Key identifiers narrow the local allowlist; they never supply authorization.
export function verifyRuntimeProof(envelope,tx,nonce,policy,now=Date.now()){
 return verifyBoundEnvelope(envelope,tx,nonce,policy,now,false);
}
// Authenticated incomplete observations may explain NOT VERIFIED. They never
// enter the authorization/finalization capability maps used by assured proofs.
export function verifyRuntimeObservation(envelope,tx,nonce,policy,now=Date.now()){
 const p=verifyBoundEnvelope(envelope,tx,nonce,policy,now,true);
 if(p.policyVersion!==PRODUCTION_POLICY||p.proof.state!=='UNKNOWN'||p.proof.policy.fullAllowed!==false||p.proof.policy.serverAnalysisEligible!==false)throw Error('read_only_observation_required');
 return p;
}
function verifyBoundEnvelope(envelope,tx,nonce,policy,now,readOnly){
 if(!envelope||envelope.payloadType!==TYPE||!Array.isArray(envelope.signatures)||envelope.signatures.length>8)throw Error('wrong_or_missing_runtime_envelope');
 const bytes=decode(envelope.payload),message=pae(TYPE,bytes);
 const trusted=policy.keys.filter(k=>k.algorithm==='Ed25519'&&k.payloadType===TYPE&&k.status==='ACTIVE'&&Date.parse(k.activateAt)<=now&&now<Date.parse(k.retireAt)&&k.chains.includes(tx.chainId));
 const threshold=policy.signatureThreshold??1;if(!Number.isSafeInteger(threshold)||threshold<1||threshold>8)throw Error('invalid_signature_threshold');
 const authenticated=trusted.filter(k=>envelope.signatures.some(s=>{if(s.keyid!==k.id)return false;try{return ed25519.verify(decode(s.sig),message,hexToBytes(k.publicKeyHex),{zip215:false});}catch{return false;}}));
 if(new Set(authenticated.map(k=>k.publicKeyHex)).size<threshold)throw Error('untrusted_or_invalid_signature');
 // Decode semantic fields only after authentication. Canonical equality also
 // rejects duplicate keys and alternate JSON representations.
 const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes),p=JSON.parse(raw);if(canonical(p)!==raw)throw Error('noncanonical_payload');
 if(Object.keys(p).length!==runtimeFields.length||runtimeFields.some(k=>!Object.hasOwn(p,k)))throw Error('unsupported_runtime_schema');
 const issued=Date.parse(p.issuedAt),expiry=Date.parse(p.expiresAt);if(!Number.isFinite(issued)||!Number.isFinite(expiry)||expiry<=now||issued>now+5000||expiry<=issued||expiry-issued>60000)throw Error('expired_or_invalid_runtime_proof');
 if(p.schemaVersion!==RUNTIME_SCHEMA||p.transactionFingerprintSha256!==commitment(normalizedTransaction(tx))||p.chainId!==tx.chainId||p.nonce!==nonce||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(p.analysisId??''))throw Error('runtime_transaction_binding_failed');
 if(!policy.policyVersions.includes(p.policyVersion)||!Number.isSafeInteger(p.evidenceEpoch)||p.evidenceEpoch<0||!hash(p.evidenceRootSha256)||!Array.isArray(p.evidenceSnapshots)||p.evidenceSnapshots.length>10000)throw Error('invalid_runtime_metadata');
 const eligible=authenticated.filter(k=>issued>=Date.parse(k.activateAt)&&issued<Date.parse(k.retireAt)&&p.evidenceEpoch>=k.activateEpoch);if(new Set(eligible.map(k=>k.publicKeyHex)).size<threshold)throw Error('key_not_active_for_proof');
 if(!Array.isArray(p.controllerManifest)||commitment({snapshots:p.evidenceSnapshots,controllers:p.controllerManifest})!==p.evidenceRootSha256)throw Error('evidence_root_mismatch');
 if(new Set(p.evidenceSnapshots.map(e=>e.id)).size!==p.evidenceSnapshots.length||p.evidenceSnapshots.some(e=>typeof e.id!=='string'||!Number.isSafeInteger(e.epoch)||e.epoch<1||e.epoch>p.evidenceEpoch||!hash(e.packageSha256)||!hash(e.root)))throw Error('invalid_snapshot_manifest');
 const request=normalizedTransaction(tx);if(canonical(p.requestBinding)!==canonical({target:request.to,value:request.value,calldataSha256:commitment(request.data)}))throw Error('runtime_request_binding_failed');
 const proof=p.proof;if(!proof||proof.passportUrl!=='/proof/transaction/'+p.analysisId||proof.chainId!==p.chainId||commitment(normalizedTransaction(proof.transaction))!==p.transactionFingerprintSha256||canonical(proof.block??null)!==canonical(p.analysisBlock)||canonical(proof.policy??null)!==canonical(p.policy)||canonical(proof.components)!==canonical(p.coverageDecisions)||canonical({authorities:proof.components.map(c=>({context:c.context,authority:c.authority??null})),capabilityGraph:proof.controlGraph??null})!==canonical(p.controlResult)||proof.state!==p.overallResult||canonical(proof.reasons)!==canonical(p.warnings))throw Error('runtime_commitment_mismatch');
 if(p.userState!==userState(proof.state)||p.weakestLink!==weakestLink(proof))throw Error('runtime_display_binding_failed');
 // A valid server signature cannot introduce a new policy mode or weaken a
 // boolean gate through JSON coercion. UNKNOWN responses may omit policy.
 if(proof.policy&&(!['PRODUCTION','LOCAL_DEVELOPMENT'].includes(proof.policy.mode)||typeof proof.policy.fullAllowed!=='boolean'||!Array.isArray(proof.policy.failedGates)||proof.policy.failedGates.some(g=>typeof g!=='string')))throw Error('invalid_runtime_policy');
 const twoPhase=p.policyVersion===PRODUCTION_POLICY;
 if(twoPhase){
  if(!proof.closureGate||Object.keys(proof.closureGate).length!==closureGateKeys.length||closureGateKeys.some(k=>typeof proof.closureGate[k]!=='boolean'))throw Error('malformed_closure_gate');
  if(proof.state==='VERIFIED'||proof.policy?.mode!=='PRODUCTION'||canonical(proof.policy)!==canonical(productionAnalysisPolicy(proof,commitment)))throw Error('invalid_server_analysis_policy');
  const bindings=proof.runtimeSigningKeys;
  if(!Array.isArray(bindings)||!bindings.length||new Set(bindings.map(k=>k.keyId)).size!==bindings.length||bindings.some(k=>!eligible.some(t=>t.id===k.keyId&&t.kmsKeyVersion===k.kmsKeyVersion&&typeof t.kmsKeyVersion==='string'))||eligible.some(k=>!bindings.some(b=>b.keyId===k.id&&b.kmsKeyVersion===k.kmsKeyVersion)))throw Error('runtime_key_version_binding_failed');
  if(proof.policy.observationAssurance.level!=='STANDARD'&&!readOnly)throw Error('minimum_observation_assurance_failed');
 }
 if(proof.executionGraph){const {executionGraphRootSha256,...graph}=proof.executionGraph;if(commitment(graph)!==executionGraphRootSha256||executionGraphRootSha256!==p.executionGraphRootSha256)throw Error('execution_graph_mismatch');}else if(p.executionGraphRootSha256!==null)throw Error('execution_graph_mismatch');
 if(proof.securityClosure){const {graphRootSha256,...closure}=proof.securityClosure;if(closure.schemaVersion!=='poa-path-audit-v1'||commitment(closure)!==graphRootSha256||canonical(proof.executionGraph?.securityClosure)!==canonical(proof.securityClosure))throw Error('security_closure_commitment_mismatch');}
 if(proof.analysisSupport&&(proof.analysisSupport.schemaVersion!=='poa-analysis-support-v1'||proof.analysisSupport.version!==ANALYSIS_SUPPORT_VERSION||canonical(proof.analysisSupport.envelope)!==canonical(analysisEnvelope)||proof.analysisSupport.envelopeSha256!==commitment(analysisEnvelope)||canonical(proof.executionGraph?.analysisSupport)!==canonical(proof.analysisSupport)||canonical(proof.executionGraph?.closureGate)!==canonical(proof.closureGate)))throw Error('analysis_support_commitment_mismatch');
 if((proof.state==='VERIFIED'||twoPhase&&proof.policy.serverAnalysisEligible)&&proof.policy?.mode==='PRODUCTION'&&(!completeClosureGate(proof.closureGate)||proof.analysisSupport?.completeness!=='COMPLETE'||proof.analysisSupport.reasons.length||proof.analysisSupport.scope.some(s=>s.status!=='SUPPORTED')))throw Error('analysis_support_gate_failed');
 const strongest=(proof.state==='VERIFIED'||twoPhase&&proof.policy.serverAnalysisEligible)&&proof.policy?.mode==='PRODUCTION';
 const inspectAuthority=(result,depth=0)=>{const {observationHash,...observation}=result;if(depth>8||result.schema!=='poa-authority-resolution/1.0.0'||!Number.isFinite(Date.parse(result.observedAt))||Date.parse(result.observedAt)<now-60000||Date.parse(result.observedAt)>now+5000||commitment(observation)!==observationHash||result.observationBlock?.number!==proof.block?.number||result.observationBlock?.hash!==proof.block?.hash)throw Error('authority_observation_commitment_mismatch');
  if(result.safeState){verifySafeControlState(result.safeState,proof.block,commitment);if(result.authorityModel!=='SAFE'||result.safeState.address!==result.storageAddress||result.safeState.singleton!==result.codeAddress||result.safeState.singletonCodeIdentity!==result.codeIdentity||result.safeState.artifactHash!==result.artifactHash)throw Error('safe_authority_context_mismatch');
   const states=[];const collect=state=>{states.push(state);for(const module of state.modules)if(module.child)collect(module.child);};collect(result.safeState);
   for(const state of states)if(state.status==='COMPLETE'&&!result.nodes?.some(n=>n.storageAddress===state.address&&n.quorum))throw Error('safe_quorum_binding_mismatch');
   for(const node of result.nodes??[])if(node.quorum){const state=states.find(s=>s.address===node.storageAddress);const required=node.storageAddress===result.storageAddress&&result.selector==='0xd4d9bdcd'?1:state?.threshold;if(!state||node.quorum.required!==required||canonical(node.quorum.members)!==canonical(state.owners))throw Error('safe_quorum_binding_mismatch');}
  }
  if(result.timelockState){const state=verifyTimelockControlState(result.timelockState,proof.block,commitment);if(result.authorityModel!=='TIMELOCK'||state.address!==result.storageAddress||state.address!==result.codeAddress||state.codeIdentity!==result.codeIdentity||state.artifactHash!==result.artifactHash)throw Error('timelock_authority_context_mismatch');const delayed=['0x134008d3','0xe38335e5','0x64d62353'].includes(result.selector)||['0x2f2ff15d','0xd547741f'].includes(result.selector)&&!state.externalAdministrators.length;if(state.completeness==='COMPLETE'&&delayed&&!result.nodes?.some(n=>n.storageAddress===state.address&&n.timelockExecution))throw Error('timelock_execution_binding_mismatch');for(const node of result.nodes??[])if(node.timelockExecution&&node.storageAddress===state.address){const t=node.timelockExecution;if(t.minimumDelaySeconds!==state.minDelaySeconds||t.proposerRole!==state.proposers.role||t.executorRole!==state.executors.role||t.executorOpenToAnyone!==state.executorOpenToAnyone)throw Error('timelock_execution_binding_mismatch');}if(result.protocolEnforcedDelay&&(state.completeness!=='COMPLETE'||String(result.protocolEnforcedDelay.seconds)!==(delayed?state.minDelaySeconds:'0')))throw Error('timelock_delay_binding_mismatch');
   for(const role of state.roleAdministrators)for(const holder of role.controllers)if(holder.safeState){const states=[];const collect=s=>{states.push(s);for(const m of s.modules)if(m.child)collect(m.child);};collect(holder.safeState);for(const safe of states){if(!result.nodes?.some(n=>n.storageAddress===safe.address&&n.quorum))throw Error('safe_quorum_binding_mismatch');for(const node of result.nodes??[])if(node.quorum&&node.storageAddress===safe.address&&(node.quorum.required!==safe.threshold||canonical(node.quorum.members)!==canonical(safe.owners)))throw Error('safe_quorum_binding_mismatch');}}
  }
  for(const observation of result.observations??[])for(const key of ['safeOwnerAuthority','proxyAdminAuthority','timelockOwnerAuthority'])if(observation[key])inspectAuthority(observation[key],depth+1);
  if(strongest&&(result.status!=='COMPLETE'||result.unresolved.length||!['OWNABLE','ACCESS_CONTROL_ENUMERABLE','SAFE','TIMELOCK'].includes(result.authorityModel)||result.authorityModel==='ACCESS_CONTROL_ENUMERABLE'&&analysisEnvelope.authority.accessControlEnumerable!==true||result.authorityModel==='SAFE'&&(analysisEnvelope.authority.safe!==true||result.safeState?.status!=='COMPLETE')||result.authorityModel==='TIMELOCK'&&(analysisEnvelope.authority.timelock!==true||result.timelockState?.completeness!=='COMPLETE')))throw Error('authority_completeness_gate_failed');
 };
 for(const result of proof.authorityResolutions??[])inspectAuthority(result);
 if(proof.authorityResolutions&&canonical(proof.executionGraph?.authorityResolutions)!==canonical(proof.authorityResolutions))throw Error('authority_graph_binding_mismatch');
 if(strongest&&!proof.authorityResolutions?.length)throw Error('authority_completeness_gate_failed');
 if(proof.evidenceEpochUsed!==undefined&&proof.evidenceEpochUsed!==p.evidenceEpoch)throw Error('analysis_evidence_epoch_mismatch');
 for(const c of proof.components)if(c.state==='VERIFIED'&&(!Number.isFinite(Date.parse(c.snapshot?.protectedEvidence?.expiresAt))||Date.parse(c.snapshot.protectedEvidence.expiresAt)<=now))throw Error('expired_review_evidence');
 for(const e of proof.controllerEvidence??[])if(e.verificationStatus==='POA_VERIFIED'&&(!e.identity||Date.parse(e.identity.validFrom)>now||!Number.isFinite(Date.parse(e.identity.validUntil))||Date.parse(e.identity.validUntil)<=now))throw Error('expired_controller_identity');
 if(proof.traceComplete&&(!/^0x[0-9a-f]+$/i.test(proof.block?.number??'')||!/^0x[0-9a-f]{64}$/i.test(proof.block?.hash??'')))throw Error('incoherent_analysis_block');
 if(proof.state==='VERIFIED'&&(proof.policy?.fullAllowed!==true||proof.policy.failedGates.length||proof.policy.mode==='PRODUCTION'&&proof.internalExecution?.status!=='RESOLVED'||proof.policy.mode==='LOCAL_DEVELOPMENT'&&tx.chainId!=='31337'))throw Error('strongest_result_gate_failed');
 if((proof.state==='VERIFIED'||strongest)&&(proof.traceComplete!==true||!Number.isSafeInteger(proof.total)||proof.total<1||proof.total!==proof.components.length||proof.covered!==proof.total||proof.components.some(c=>c.state!=='VERIFIED'||c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE')))throw Error('strongest_coverage_gate_failed');
 if(strongest&&(!/^0x[0-9a-f]{64}$/i.test(proof.block?.stateRoot??'')||proof.components.some(c=>c.snapshot?.findings?.some(f=>f.selectors.includes(c.selector)&&['CRITICAL','HIGH','MEDIUM'].includes(f.severity)&&(f.status!=='FIXED'||f.recheck!=='RECHECKED')))))throw Error('strongest_material_evidence_gate_failed');
 if(strongest&&(!proof.securityClosure||proof.securityClosure.status!=='RESOLVED'||proof.securityClosure.widening!=='EXACT'||proof.securityClosure.unresolved.length||proof.securityClosure.required!==proof.securityClosure.reviewed||proof.securityClosure.nodes.some(n=>n.resolution!=='RESOLVED'||n.coverage!=='REVIEWED')))throw Error('security_closure_gate_failed');
 if((proof.policy?.version??'poa_policy_v2')!==p.policyVersion)throw Error('unsupported_policy');
 for(const c of proof.components){const s=c.snapshot??c.previousReview;if(s){
 if(proof.policy?.mode==='PRODUCTION'){
  const r=s.release;
  if(!r||r.schemaVersion!=='poa-evidence-release-v1'||r.status!=='RELEASED'||typeof r.releaseId!=='string'||!hash(r.bundleSha256)||!hash(r.manifestSha256)||r.artifactSha256!==r.bundleSha256||r.artifactReference!=='sha256:'+r.bundleSha256||!Array.isArray(r.approvals)||r.approvals.length!==2||new Set(r.approvals.map(a=>a.reviewer)).size!==2||r.approvals.some(a=>!/^0x[a-f0-9]{40}$/.test(a.reviewer??'')||a.bundleSha256!==r.bundleSha256||a.manifestSha256!==r.manifestSha256||!Number.isFinite(Date.parse(a.at))||Date.parse(a.at)>Date.parse(r.releasedAt))||!Number.isFinite(Date.parse(r.releasedAt))||Date.parse(r.releasedAt)>now||!p.evidenceSnapshots.some(e=>e.id===s.id&&e.release?.releaseId===r.releaseId&&e.release?.bundleSha256===r.bundleSha256&&e.release?.manifestSha256===r.manifestSha256))throw Error('unreleased_review_evidence');
 }
 const m=s.protectedEvidence;if(!m||!p.evidenceSnapshots.some(e=>e.id===s.id&&e.epoch===m.evidenceEpoch&&e.packageSha256===m.packageSha256&&e.root===m.evidenceRootSha256))throw Error('uncommitted_review_snapshot');}}
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};freeze(p);(readOnly?readOnlyObservations:authenticatedPayloads).set(p,{domain:policy.trustDomain,until:Math.min(expiry,...eligible.map(k=>Date.parse(k.retireAt)))});return p;
}
export function runtimeObservationDeadline(p){if(!readOnlyObservations.has(p))throw Error('unauthenticated_runtime_observation');return readOnlyObservations.get(p).until;}
export async function checkObservationEpoch(p,policy,request){
 const observed=readOnlyObservations.get(p);
 if(!observed||observed.domain!==policy.trustDomain||Date.now()>=observed.until)throw Error('unauthenticated_or_expired_observation');
 const state=await request({method:'snap_manageState',params:{operation:'get'}});
 if(Date.now()>=observed.until)throw Error('expired_runtime_observation');
 acceptEpoch(state,p,policy.trustDomain); // Compare existing anchor; never write.
}
// Version 1 migration retains the previously observed root. Clearing Snap state
// starts a fresh observation history; it cannot restore the deleted trust anchor.
export function acceptEpoch(state,p,domain){
 if(typeof domain!=='string'||!domain||!Number.isSafeInteger(p.evidenceEpoch)||p.evidenceEpoch<0||!hash(p.evidenceRootSha256))throw Error('invalid_evidence_epoch');
 const old=state?.runtimeEpochs?.[domain];
 if(old&&(!Number.isSafeInteger(old.epoch)||old.epoch<0||!hash(old.root)))throw Error('invalid_persisted_epoch_state');
 if(old?.schemaVersion===2&&(old.maxSeenEvidenceEpoch!==old.epoch||!old.acceptedRootByEpoch||typeof old.acceptedRootByEpoch!=='object'||Array.isArray(old.acceptedRootByEpoch)))throw Error('invalid_persisted_epoch_state');
 if(old?.schemaVersion!==undefined&&old.schemaVersion!==2)throw Error('unsupported_epoch_state_version');
 const roots={...(old?.acceptedRootByEpoch??{})};
 for(const [epoch,root]of Object.entries(roots))if(!/^(0|[1-9][0-9]*)$/.test(epoch)||!Number.isSafeInteger(Number(epoch))||Number(epoch)>old.epoch||!hash(root))throw Error('invalid_persisted_epoch_state');
 if(old){if(roots[old.epoch]&&roots[old.epoch]!==old.root)throw Error('invalid_persisted_epoch_state');roots[old.epoch]=old.root;}
 if(old&&p.evidenceEpoch<old.epoch)throw Error('evidence_rollback');
 if(roots[p.evidenceEpoch]&&roots[p.evidenceEpoch]!==p.evidenceRootSha256)throw Error('evidence_epoch_conflict');
 // Bound encrypted state without discarding historical integrity observations.
 // Exhaustion fails closed and requires an explicitly provisioned migration.
 if(!roots[p.evidenceEpoch]&&Object.keys(roots).length>=4096)throw Error('epoch_history_capacity_reached');
 roots[p.evidenceEpoch]=p.evidenceRootSha256;
 return {...(state??{}),runtimeEpochs:{...(state?.runtimeEpochs??{}),[domain]:{schemaVersion:2,epoch:p.evidenceEpoch,maxSeenEvidenceEpoch:p.evidenceEpoch,root:p.evidenceRootSha256,acceptedRootByEpoch:roots}}};
}

// Receipts are realm-local capabilities, never deserialized server booleans.
function authenticatedFresh(p,now=Date.now()){if(!authenticatedPayloads.has(p)||now>=authenticatedPayloads.get(p).until||Date.parse(p.issuedAt)>now+5000)throw Error('expired_runtime_finalization');}
export function runtimeProofDeadline(p){if(!authenticatedPayloads.has(p))throw Error('unauthenticated_runtime_proof');return authenticatedPayloads.get(p).until;}
export async function persistVerifiedEpoch(p,policy,request){
 if(!authenticatedPayloads.has(p)||authenticatedPayloads.get(p).domain!==policy.trustDomain||typeof request!=='function')throw Error('unauthenticated_epoch_persistence');
 authenticatedFresh(p);
 const previous=await request({method:'snap_manageState',params:{operation:'get'}});
 authenticatedFresh(p);
 const state=acceptEpoch(previous,p,policy.trustDomain);
 await request({method:'snap_manageState',params:{operation:'update',newState:state}});
 const readback=await request({method:'snap_manageState',params:{operation:'get'}});
 if(canonical(readback?.runtimeEpochs?.[policy.trustDomain]??null)!==canonical(state.runtimeEpochs[policy.trustDomain]))throw Error('epoch_persistence_readback_failed');
 authenticatedFresh(p);
 const receipt=Object.freeze({});persistedEpochs.set(receipt,p);return receipt;
}
export function finalizeRuntimeProof(p,receipt,now=Date.now()){
 if(!authenticatedPayloads.has(p)||persistedEpochs.get(receipt)!==p)throw Error('client_epoch_verification_required');
 authenticatedFresh(p,now);
 const proof=JSON.parse(JSON.stringify(p.proof));
 if(p.policyVersion===PRODUCTION_POLICY){
  const expected=productionAnalysisPolicy(proof,commitment);
  if(canonical(expected)!==canonical(proof.policy)||expected.observationAssurance.level!=='STANDARD')throw Error('client_analysis_policy_mismatch');
  proof.state=expected.serverAnalysisEligible?'VERIFIED':proof.state;
  if(expected.serverAnalysisEligible)proof.reasons=proof.reasons.filter(r=>r!=='client_finalization_required');
  proof.policy={...expected,phase:'CLIENT_FINALIZED',fullAllowed:expected.serverAnalysisEligible,failedGates:[...expected.serverFailedGates]};
  delete proof.check;
 }
 return proof;
}
