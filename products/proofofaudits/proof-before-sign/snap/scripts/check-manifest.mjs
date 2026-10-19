// Official MetaMask manifest validation and SES bundle evaluation (as used by mm-snap manifest/eval).
// Usage: node scripts/check-manifest.mjs [snapDirectory]. Read-only: never rewrites the manifest.
// handlerEndowments enables the CLI's unused-exports/unused-endowments validator (exported handler without its permission and vice versa).
import {checkManifest,evalBundle} from '@metamask/snaps-utils/node';
import {handlerEndowments} from '@metamask/snaps-rpc-methods';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=resolve(process.argv[2]??resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const manifestPath=resolve(dir,'snap.manifest.json'),bundlePath=resolve(dir,'dist/bundle.js');
const summary={directory:dir,errors:[],warnings:[],evaluation:'FAIL',exports:[],platformVersion:null,shasum:null};
try{const output=await evalBundle(bundlePath);summary.evaluation='PASS';summary.exports=output.exports;}
catch(error){summary.errors.push({id:'bundle-evaluation',message:String(error?.message??error),stderr:error?.output?.stderr?.slice(0,2000)});}
try{
 const {reports}=await checkManifest(manifestPath,{updateAndWriteManifest:false,exports:summary.exports,handlerEndowments});
 // Errors always fail; a warning without an automatic fix also fails the release check.
 for(const r of reports)(r.severity==='error'||typeof r.fix!=='function'?summary.errors:summary.warnings).push({id:r.id,severity:r.severity,message:r.message});
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));summary.platformVersion=manifest.platformVersion??null;summary.shasum=manifest.source?.shasum??null;
}catch(error){summary.errors.push({id:'check-manifest',message:String(error?.message??error)});}
console.log(JSON.stringify(summary,null,2));
process.exit(summary.errors.length===0&&summary.evaluation==='PASS'?0:1);
