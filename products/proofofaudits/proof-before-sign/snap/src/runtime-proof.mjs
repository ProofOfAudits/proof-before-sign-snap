import {RUNTIME_SCHEMA,runtimeFields,userState,weakestLink} from '../../web/runtime-contract.mjs';
import {normalizedTransaction} from '../../web/transaction-context.mjs';
import {ed25519} from '@noble/curves/ed25519';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex,hexToBytes} from '@noble/hashes/utils';
export const TYPE='application/vnd.poa.runtime-proof.v1+json';
const utf8=s=>new TextEncoder().encode(s);
function unicode(s){for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=s.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('invalid_unicode');}else if(n>=0xdc00&&n<=0xdfff)throw Error('invalid_unicode');}}
export function canonical(value){if(value===null)return 'null';if(typeof value==='string'){unicode(value);return JSON.stringify(value);}if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_number');return JSON.stringify(value);}if(typeof value==='boolean')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object'&&!Array.isArray(value))return '{'+Object.keys(value).sort().map(k=>{unicode(k);return JSON.stringify(k)+':'+canonical(value[k]);}).join(',')+'}';throw Error('invalid_json');}
export const commitment=v=>bytesToHex(sha256(utf8(canonical(v))));
export {normalizedTransaction} from '../../web/transaction-context.mjs';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;}
function decode(s){if(typeof s!=='string'||s.length>2000000||s.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('invalid_base64');const bytes=[];for(let i=0;i<s.length;i+=4){const n=(alphabet.indexOf(s[i])<<18)|(alphabet.indexOf(s[i+1])<<12)|((s[i+2]==='='?0:alphabet.indexOf(s[i+2]))<<6)|(s[i+3]==='='?0:alphabet.indexOf(s[i+3]));bytes.push((n>>>16)&255);if(s[i+2]!=='=')bytes.push((n>>>8)&255);if(s[i+3]!=='=')bytes.push(n&255);}const out=Uint8Array.from(bytes);if(base64(out)!==s)throw Error('noncanonical_base64');return out;}
const concat=(...arrays)=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){out.set(a,at);at+=a.length;}return out;};
export const pae=(type,bytes)=>concat(utf8('DSSEv1 '+utf8(type).length+' '+type+' '+bytes.length+' '),bytes);
const hash=v=>/^[a-f0-9]{64}$/.test(v??'');
// Key identifiers narrow the local allowlist; they never supply authorization.
export function verifyRuntimeProof(envelope,tx,nonce,policy,now=Date.now()){
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
 if(proof.executionGraph){const {executionGraphRootSha256,...graph}=proof.executionGraph;if(commitment(graph)!==executionGraphRootSha256||executionGraphRootSha256!==p.executionGraphRootSha256)throw Error('execution_graph_mismatch');}else if(p.executionGraphRootSha256!==null)throw Error('execution_graph_mismatch');
 if(proof.evidenceEpochUsed!==undefined&&proof.evidenceEpochUsed!==p.evidenceEpoch)throw Error('analysis_evidence_epoch_mismatch');
 for(const c of proof.components)if(c.state==='VERIFIED'&&(!Number.isFinite(Date.parse(c.snapshot?.protectedEvidence?.expiresAt))||Date.parse(c.snapshot.protectedEvidence.expiresAt)<=now))throw Error('expired_review_evidence');
 for(const e of proof.controllerEvidence??[])if(e.verificationStatus==='POA_VERIFIED'&&(!e.identity||Date.parse(e.identity.validFrom)>now||!Number.isFinite(Date.parse(e.identity.validUntil))||Date.parse(e.identity.validUntil)<=now))throw Error('expired_controller_identity');
 if(proof.traceComplete&&(!/^0x[0-9a-f]+$/i.test(proof.block?.number??'')||!/^0x[0-9a-f]{64}$/i.test(proof.block?.hash??'')))throw Error('incoherent_analysis_block');
 if(proof.state==='VERIFIED'&&(!proof.policy?.fullAllowed||proof.policy.mode==='PRODUCTION'&&(proof.policy.failedGates?.length||proof.internalExecution?.status!=='RESOLVED')||proof.policy.mode==='LOCAL_DEVELOPMENT'&&tx.chainId!=='31337'))throw Error('strongest_result_gate_failed');
 if((proof.policy?.version??'poa_policy_v2')!==p.policyVersion)throw Error('unsupported_policy');
 for(const c of proof.components){const s=c.snapshot??c.previousReview;if(s){
 if(proof.policy?.mode==='PRODUCTION'){
  const r=s.release;
  if(!r||r.schemaVersion!=='poa-evidence-release-v1'||r.status!=='RELEASED'||typeof r.releaseId!=='string'||!hash(r.bundleSha256)||!hash(r.manifestSha256)||r.artifactSha256!==r.bundleSha256||r.artifactReference!=='sha256:'+r.bundleSha256||!Array.isArray(r.approvals)||r.approvals.length!==2||new Set(r.approvals.map(a=>a.reviewer)).size!==2||r.approvals.some(a=>!/^0x[a-f0-9]{40}$/.test(a.reviewer??'')||a.bundleSha256!==r.bundleSha256||a.manifestSha256!==r.manifestSha256||!Number.isFinite(Date.parse(a.at))||Date.parse(a.at)>Date.parse(r.releasedAt))||!Number.isFinite(Date.parse(r.releasedAt))||Date.parse(r.releasedAt)>now||!p.evidenceSnapshots.some(e=>e.id===s.id&&e.release?.releaseId===r.releaseId&&e.release?.bundleSha256===r.bundleSha256&&e.release?.manifestSha256===r.manifestSha256))throw Error('unreleased_review_evidence');
 }
 const m=s.protectedEvidence;if(!m||!p.evidenceSnapshots.some(e=>e.id===s.id&&e.epoch===m.evidenceEpoch&&e.packageSha256===m.packageSha256&&e.root===m.evidenceRootSha256))throw Error('uncommitted_review_snapshot');}}
 return p;
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
