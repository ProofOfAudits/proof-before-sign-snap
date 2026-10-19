import { build } from 'esbuild';
import {snapChecksum} from './checksum.mjs';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import {snapDependencies} from './snap-dependencies.mjs';
const snapDir=process.cwd();
const monitoringEnabled=process.env.POA_ENABLE_MONITORING==='true';
const monitoringUrl=process.env.POA_MONITORING_URL??'';if(monitoringEnabled){const u=new URL(monitoringUrl);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Monitoring requires a configured HTTPS operations origin');}
const base=process.env.POA_API_URL??'http://localhost:4100';const url=new URL(base);
const passport=new URL(process.env.POA_PASSPORT_URL??(url.protocol==='https:'?url.origin:'https://localhost:4443'));
if(passport.protocol!=='https:'||passport.username||passport.password||passport.pathname!=='/')throw Error('Passport origin must use HTTPS for native Snap links');
if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/')throw Error('API must be an HTTPS origin or local HTTP origin');
if(url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Public APIs require HTTPS');
await mkdir('dist',{recursive:true});
await mkdir('images',{recursive:true});
await copyFile(new URL('../../../frontend/public/logos/proofofaudits-mark.svg',import.meta.url),'images/icon.svg');
const devTrust=JSON.parse(await readFile('development-trust.json','utf8'));
const local=url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
const trust=process.env.POA_RUNTIME_TRUST_FILE?JSON.parse(await readFile(process.env.POA_RUNTIME_TRUST_FILE,'utf8')):local?devTrust:{trustDomain:'poa-production-unconfigured',policyVersions:['poa_policy_v2'],keys:[]};
const publicTrustFields=new Set(['trustDomain','policyVersions','keys','signatureThreshold']),publicKeyFields=new Set(['id','version','algorithm','publicKeyHex','status','activateAt','retireAt','activateEpoch','payloadType','chains','kmsKeyVersion']);
if(!local&&(Object.keys(trust).some(k=>!publicTrustFields.has(k))||trust.keys.some(key=>Object.keys(key).some(k=>!publicKeyFields.has(k)))))throw Error('Production Snap accepts public trust fields only');
// Exactly three production shapes, fail-closed: the established v2 key (no KMS binding), v3 with pinned KMS key
// versions, or the v2->v3 overlap (TRUST_V3_MIGRATION "Required ordering" step 1). The overlap is accepted ONLY for
// the single production runtime key poa-google-runtime-v1 bound to its production KMS key version, so a wallet keeps
// verifying today's v2 proofs while the 0.7.0 backend signs v3 with the same key.
const onlyPolicy=v=>Array.isArray(trust.keys)&&Array.isArray(trust.policyVersions)&&trust.policyVersions.length===1&&trust.policyVersions[0]===v;
const kmsPinned=k=>/^projects\/.+\/cryptoKeyVersions\/[1-9][0-9]*$/.test(k.kmsKeyVersion??'');
const OVERLAP_KEY={id:'poa-google-runtime-v1',publicKeyHex:'a16875405345d91554b9539d265c051b5365b7ed6b3ed99c4209428213a7a062',kmsKeyVersion:'projects/proof-of-audits-production/locations/us-central1/keyRings/poa-proof-v1/cryptoKeys/runtime-ed25519/cryptoKeyVersions/1'};
const trustV2=onlyPolicy('poa_policy_v2')&&trust.keys.every(k=>!Object.hasOwn(k,'kmsKeyVersion')),trustV3=onlyPolicy('poa_policy_v3')&&trust.keys.every(kmsPinned);
const trustOverlap=Array.isArray(trust.keys)&&Array.isArray(trust.policyVersions)&&trust.policyVersions.length===2&&trust.policyVersions[0]==='poa_policy_v2'&&trust.policyVersions[1]==='poa_policy_v3'
 &&trust.keys.length===1&&trust.keys.every(k=>k.id===OVERLAP_KEY.id&&k.publicKeyHex===OVERLAP_KEY.publicKeyHex&&k.kmsKeyVersion===OVERLAP_KEY.kmsKeyVersion);
if(!local&&!trustV2&&!trustV3&&!trustOverlap)throw Error('Production Snap requires poa_policy_v2 without KMS key versions or poa_policy_v3 with pinned KMS key versions (or the v2+v3 overlap for the production runtime key only)');
if(!local&&(!trust.keys.length||trust.keys.some(k=>k.publicKeyHex===devTrust.keys[0].publicKeyHex||!Array.isArray(k.chains)||k.chains.includes('31337'))))throw Error('Production Snap requires explicit non-development runtime trust keys');
if(!local&&trust.keys.some(k=>k.chains.length!==1||k.chains[0]!=='1'))throw Error('Production Snap trusts Ethereum mainnet (chain 1) keys only');
if(!local&&(/staging|stage|dev|local|test|synthetic/i.test(String(trust.trustDomain))||trust.keys.some(k=>/staging|stage|dev|local|test|synthetic/i.test(String(k.id)))))throw Error('Production Snap rejects staging/development trust');
if(!local&&trust.keys.some(k=>k.status==='ACTIVE'&&!(Date.parse(k.retireAt)>Date.now())))throw Error('Production Snap trust key expired');
if(!local&&!trust.keys.some(k=>k.status==='ACTIVE'&&Date.parse(k.retireAt)>Date.now()))throw Error('Production Snap requires an active unexpired trust key');
if(!trust.trustDomain||!Array.isArray(trust.policyVersions)||!Array.isArray(trust.keys)||new Set(trust.keys.map(k=>k.id)).size!==trust.keys.length||trust.keys.some(k=>k.algorithm!=='Ed25519'||!Number.isSafeInteger(k.version)||k.version<1||!/^([a-f0-9]{64})$/.test(k.publicKeyHex)||!['ACTIVE','RETIRED','REVOKED'].includes(k.status)||!Number.isFinite(Date.parse(k.activateAt))||!Number.isFinite(Date.parse(k.retireAt))||Date.parse(k.activateAt)>=Date.parse(k.retireAt)||!Number.isSafeInteger(k.activateEpoch)||k.activateEpoch<0||!Array.isArray(k.chains)||k.payloadType!=='application/vnd.poa.runtime-proof.v1+json'))throw Error('Invalid runtime trust policy');
if(!Number.isSafeInteger(trust.signatureThreshold??1)||(trust.signatureThreshold??1)<1||(trust.signatureThreshold??1)>8||new Set(trust.keys.filter(k=>k.status==='ACTIVE').map(k=>k.publicKeyHex)).size<(trust.signatureThreshold??1))throw Error('Unsatisfiable runtime signature threshold');
const {version,name:packageName}=JSON.parse(await readFile('package.json','utf8'));
if(!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName))throw Error('Invalid Snap package name');
// MetaMask requires platformVersion to equal the installed snaps-sdk version.
const platformVersion=JSON.parse(await readFile('node_modules/@metamask/snaps-sdk/package.json','utf8')).version;
if(!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(platformVersion??''))throw Error('Invalid @metamask/snaps-sdk platformVersion');
// Without endowment:cronjob MetaMask never calls onCronjob; a build without monitoring does not export it (CLI unused-exports validator).
const entry=monitoringEnabled?{entryPoints:['src/index.jsx']}:{stdin:{contents:"export {proofPanel,onTransaction,onUserInput,onInstall,onUpdate,onHomePage} from './src/index.jsx';",resolveDir:snapDir,sourcefile:'<entry-without-cronjob>',loader:'js'}};
const bundleBuild=await build({metafile:true,plugins:[snapDependencies(snapDir,{monitoring:monitoringEnabled})],...entry,jsx:'automatic',jsxImportSource:'@metamask/snaps-sdk',bundle:true,outfile:'dist/bundle.js',format:'cjs',platform:'browser',target:'es2022',define:{POA_ENABLE_MONITORING:JSON.stringify(monitoringEnabled),POA_MONITORING_URL:JSON.stringify(monitoringUrl),POA_RUNTIME_TRUST:JSON.stringify(trust),POA_API_URL:JSON.stringify(url.origin),POA_PASSPORT_URL:JSON.stringify(passport.origin),POA_EXPLORER_ANALYSIS_LINK:JSON.stringify(process.env.POA_EXPLORER_ANALYSIS_LINK==='true'),POA_VERSION:JSON.stringify(version),POA_DEBUG:JSON.stringify(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))},legalComments:'none',minifyWhitespace:true,minifySyntax:true});
await writeFile('dist/bundle-inputs.json',JSON.stringify(bundleBuild.metafile,null,2)+'\n');
const manifest={version,description:'Check live review evidence before signing.',proposedName:'Proof Before Sign',repository:{type:'git',url:'https://github.com/ProofOfAudits/proof-before-sign-snap.git'},
  source:{shasum:'',location:{npm:{filePath:'dist/bundle.js',iconPath:'images/icon.svg',packageName,registry:'https://registry.npmjs.org/'}}},
  initialPermissions:{'endowment:lifecycle-hooks':{},snap_dialog:{},'endowment:transaction-insight':{},'endowment:page-home':{},'endowment:network-access':{},snap_manageState:{}},platformVersion,manifestVersion:'0.1'};
if(monitoringEnabled){manifest.initialPermissions['snap_notify']={};manifest.initialPermissions['endowment:cronjob']={jobs:[{expression:'*/15 * * * *',request:{method:'poa_pollAlerts'}}]};}
manifest.source.shasum=snapChecksum(manifest,await readFile('dist/bundle.js'),await readFile('images/icon.svg'));
await writeFile('snap.manifest.json',JSON.stringify(manifest,null,2)+'\n');
