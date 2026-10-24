import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';

export const CONTENT_SCHEMA='poa.runtime-content-commitment/1.0.0';
export const CONTENT_NEGOTIATION='poa-runtime-v1+content-commitment-v1';
export const MAX_RUNTIME_CONTENT_BYTES=1024*1024;
const fields=['schemaVersion','contentSha256','contentBytes','evidenceEpoch','issuedAt','expiresAt'];
const digest=bytes=>bytesToHex(sha256(bytes));

// This is an application-level content commitment, not Ed25519ph or a change
// to the KMS algorithm. PureEdDSA signs the original DSSE manifest bytes.
export function runtimeContentManifest(payload,canonical){
 const bytes=new TextEncoder().encode(canonical(payload));
 if(!bytes.length||bytes.length>MAX_RUNTIME_CONTENT_BYTES)throw Error('runtime_content_size_limit');
 return {bytes,manifest:{schemaVersion:CONTENT_SCHEMA,contentSha256:digest(bytes),contentBytes:bytes.length,evidenceEpoch:payload.evidenceEpoch,issuedAt:payload.issuedAt,expiresAt:payload.expiresAt}};
}

// Call only AFTER verifying the manifest signature and its canonical JSON.
// Full content is never interpreted until its exact bytes are authenticated.
export function openRuntimeContent(envelope,signed,decode,canonical){
 if(signed?.schemaVersion!==CONTENT_SCHEMA){if(Object.hasOwn(envelope,'content'))throw Error('unexpected_runtime_content');return signed;}
 if(Object.keys(signed).length!==fields.length||fields.some(k=>!Object.hasOwn(signed,k))||
    !Number.isSafeInteger(signed.contentBytes)||signed.contentBytes<1||signed.contentBytes>MAX_RUNTIME_CONTENT_BYTES||
    !/^[a-f0-9]{64}$/.test(signed.contentSha256??'')||typeof envelope.content!=='string'||
    envelope.content.length!==4*Math.ceil(signed.contentBytes/3))throw Error('invalid_runtime_content_commitment');
 const bytes=decode(envelope.content);
 if(bytes.length!==signed.contentBytes||digest(bytes)!==signed.contentSha256)throw Error('runtime_content_mismatch');
 const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes),payload=JSON.parse(raw);
 if(canonical(payload)!==raw)throw Error('noncanonical_runtime_content');
 if(payload?.schemaVersion===CONTENT_SCHEMA||!payload||['evidenceEpoch','issuedAt','expiresAt'].some(k=>payload[k]!==signed[k]))throw Error('runtime_content_metadata_mismatch');
 return payload;
}
