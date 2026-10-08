// Shared by the backend signer and the shipped Snap verifier.
export const RUNTIME_SCHEMA='poa-runtime-v1';
export const runtimeFields=['schemaVersion','analysisId','requestBinding','transactionFingerprintSha256','chainId','analysisBlock','evidenceSnapshots','evidenceEpoch','controllerManifest','evidenceRootSha256','policyVersion','policy','executionGraphRootSha256','coverageDecisions','controlResult','overallResult','userState','weakestLink','warnings','proof','issuedAt','expiresAt','nonce'];
export function userState(state){return state==='VERIFIED'?'VERIFIED':state==='CHANGED'?'CHANGED':state==='PARTIAL'?'PARTIAL':'NOT VERIFIED';}
export function weakestLink(proof){return proof.components.find(c=>c.state==='CHANGED')?.reason??proof.components.find(c=>c.state!=='VERIFIED')?.reason??proof.reasons[0]??null;}
