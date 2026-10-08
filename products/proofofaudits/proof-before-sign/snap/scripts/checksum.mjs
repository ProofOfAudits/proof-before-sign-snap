// MetaMask file checksum contract, implemented with Node built-ins.
// Matches @metamask/snaps-utils getSnapChecksum/checksumFiles: stable manifest
// without source.shasum; per-file SHA256 ordered by UTF-16 path; SHA256 of digests.
import {createHash} from 'node:crypto';
import stableStringify from 'fast-json-stable-stringify';
export function snapChecksum(manifest,bundle,icon){
 const copy=structuredClone(manifest);delete copy.source.shasum;
 const files=[['snap.manifest.json',stableStringify(copy)],['dist/bundle.js',bundle],['images/icon.svg',icon]];
 files.sort(([a],[b])=>a<b?-1:1);
 return createHash('sha256').update(Buffer.concat(files.map(([,value])=>createHash('sha256').update(value).digest()))).digest('base64');
}
