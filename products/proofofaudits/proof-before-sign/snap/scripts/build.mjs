import { build } from 'esbuild';
import { getSnapChecksum, VirtualFile } from '@metamask/snaps-utils';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
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
if(!local&&(!trust.keys.length||trust.keys.some(k=>k.publicKeyHex===devTrust.keys[0].publicKeyHex||k.chains.includes('31337'))))throw Error('Production Snap requires explicit non-development runtime trust keys');
if(!trust.trustDomain||!Array.isArray(trust.policyVersions)||!Array.isArray(trust.keys)||new Set(trust.keys.map(k=>k.id)).size!==trust.keys.length||trust.keys.some(k=>k.algorithm!=='Ed25519'||!Number.isSafeInteger(k.version)||k.version<1||!/^([a-f0-9]{64})$/.test(k.publicKeyHex)||!['ACTIVE','RETIRED','REVOKED'].includes(k.status)||!Number.isFinite(Date.parse(k.activateAt))||!Number.isFinite(Date.parse(k.retireAt))||Date.parse(k.activateAt)>=Date.parse(k.retireAt)||!Number.isSafeInteger(k.activateEpoch)||k.activateEpoch<0||!Array.isArray(k.chains)||k.payloadType!=='application/vnd.poa.runtime-proof.v1+json'))throw Error('Invalid runtime trust policy');
if(!Number.isSafeInteger(trust.signatureThreshold??1)||(trust.signatureThreshold??1)<1||(trust.signatureThreshold??1)>8||new Set(trust.keys.filter(k=>k.status==='ACTIVE').map(k=>k.publicKeyHex)).size<(trust.signatureThreshold??1))throw Error('Unsatisfiable runtime signature threshold');
const {version,name:packageName}=JSON.parse(await readFile('package.json','utf8'));
if(!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName))throw Error('Invalid Snap package name');
const bundleBuild=await build({metafile:true,entryPoints:['src/index.jsx'],jsx:'automatic',jsxImportSource:'@metamask/snaps-sdk',bundle:true,outfile:'dist/bundle.js',format:'cjs',platform:'browser',target:'es2022',define:{POA_RUNTIME_TRUST:JSON.stringify(trust),POA_API_URL:JSON.stringify(url.origin),POA_PASSPORT_URL:JSON.stringify(passport.origin),POA_VERSION:JSON.stringify(version),POA_DEBUG:JSON.stringify(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))},legalComments:'none',minifyWhitespace:true});
await writeFile('dist/bundle-inputs.json',JSON.stringify(bundleBuild.metafile,null,2)+'\n');
const manifest={version,description:'Check live review evidence before signing.',proposedName:'Proof Before Sign',repository:{type:'git',url:'https://github.com/ProofOfAudits/proof-before-sign-snap.git'},
  source:{shasum:'',location:{npm:{filePath:'dist/bundle.js',iconPath:'images/icon.svg',packageName,registry:'https://registry.npmjs.org/'}}},
  initialPermissions:{'endowment:lifecycle-hooks':{},snap_dialog:{},'endowment:transaction-insight':{},'endowment:page-home':{},'endowment:network-access':{},snap_manageState:{}},manifestVersion:'0.1'};
manifest.source.shasum=await getSnapChecksum({manifest:new VirtualFile({path:'snap.manifest.json',value:JSON.stringify(manifest),result:manifest}),sourceCode:new VirtualFile({path:'dist/bundle.js',value:await readFile('dist/bundle.js','utf8')}),svgIcon:new VirtualFile({path:'images/icon.svg',value:await readFile('images/icon.svg','utf8')}),auxiliaryFiles:[],localizationFiles:[]});
await writeFile('snap.manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Snap bundle and manifest built for '+url.origin);
