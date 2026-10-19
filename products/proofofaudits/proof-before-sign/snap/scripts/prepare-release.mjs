// Build a separate, allowlisted npm artifact; preserve the installed local demo.
import {mkdtemp,mkdir,cp,symlink,readFile,writeFile,copyFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,basename,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const snap=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const proof=resolve(snap,'..');
for(const name of ['POA_API_URL','POA_PASSPORT_URL','POA_RUNTIME_TRUST_FILE'])if(!process.env[name])throw Error('Release requires '+name);
for(const name of ['POA_API_URL','POA_PASSPORT_URL']){
 const url=new URL(process.env[name]);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||['localhost','127.0.0.1'].includes(url.hostname))throw Error('Release requires public HTTPS origins');
}
// License is an owner decision: never invented here. Syntactic SPDX short identifier (incl. LicenseRef-*) or UNLICENSED.
const license=process.env.POA_SNAP_LICENSE||undefined;
if(license!==undefined&&!/^(UNLICENSED|LicenseRef-[A-Za-z0-9.-]+|[A-Za-z0-9][A-Za-z0-9.+-]*)$/.test(license))throw Error('POA_SNAP_LICENSE must be an SPDX license identifier or UNLICENSED');
if(!license)console.warn('license not set - owner decision required');
// Public support contact is an owner decision too: never hard-coded. An email address or an https URL.
const supportContact=process.env.POA_SUPPORT_CONTACT||undefined;
if(supportContact!==undefined&&!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(supportContact)&&!/^https:\/\/[^\s/?#]+(\/[^\s]*)?$/.test(supportContact))throw Error('POA_SUPPORT_CONTACT must be an email address or an https URL');
if(!supportContact)console.warn('support contact not set - owner decision required');
const trust=resolve(process.env.POA_RUNTIME_TRUST_FILE);
const stage=await mkdtemp(resolve(tmpdir(),'poa-snap-release-'));
const destination=resolve(stage,'products/proofofaudits/proof-before-sign/snap');
await mkdir(destination,{recursive:true});
for(const folder of ['src','scripts'])await cp(resolve(snap,folder),resolve(destination,folder),{recursive:true});
await cp(resolve(proof,'web'),resolve(destination,'../web'),{recursive:true});
await copyFile(resolve(snap,'tsconfig.json'),resolve(destination,'tsconfig.json'));
await copyFile(resolve(snap,'development-trust.json'),resolve(destination,'development-trust.json'));
await symlink(resolve(snap,'node_modules'),resolve(destination,'node_modules'),'dir');
await mkdir(resolve(stage,'products/proofofaudits/frontend/public/logos'),{recursive:true});
await copyFile(resolve(proof,'../frontend/public/logos/proofofaudits-mark.svg'),resolve(stage,'products/proofofaudits/frontend/public/logos/proofofaudits-mark.svg'));
const original=JSON.parse(await readFile(resolve(snap,'package.json'),'utf8'));
const packageName=process.env.POA_SNAP_PACKAGE_NAME??original.name;if(!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName))throw Error('Invalid Snap package name');
const pkg={name:packageName,version:original.version,description:original.description,...(license?{license}:{}),main:'dist/bundle.js',private:false,repository:{type:'git',url:'https://github.com/ProofOfAudits/proof-before-sign-snap.git'},files:['dist/bundle.js','snap.manifest.json','images/icon.svg','README.md'],publishConfig:{access:'public'}};
await writeFile(resolve(destination,'package.json'),JSON.stringify(pkg,null,2)+'\n');
const readme='# Proof Before Sign\n\nTransaction-specific security-review evidence inside MetaMask. Review evidence does not guarantee security. Missing evidence stays unknown. The proposed transaction is sent to the POA evidence service; recovery phrases and private keys are never requested.\n\nThis package is a release candidate. Publishing alone does not establish MetaMask allowlisting or mainnet wallet acceptance.\n';
await writeFile(resolve(destination,'README.md'),readme);
function run(command,args,env=process.env,cwd=destination,timeout=60000){const result=spawnSync(command,args,{cwd,env,encoding:'utf8',timeout});if(result.status!==0)throw Error('Release preparation failed: '+command+' '+args.join(' ')+'\n'+(result.stderr??'').slice(-2000));return result.stdout;}
run(process.execPath,['scripts/build.mjs'],{...process.env,POA_RUNTIME_TRUST_FILE:trust});
const manifest=JSON.parse(await readFile(resolve(destination,'snap.manifest.json'),'utf8'));
if(manifest.version!==pkg.version||manifest.source.location.npm.packageName!==pkg.name||!manifest.source.shasum)throw Error('Release manifest mismatch');
const bundle=await readFile(resolve(destination,'dist/bundle.js'),'utf8');
if(bundle.includes('http://localhost:4100')||bundle.includes('https://localhost:4443'))throw Error('Development endpoint in release bundle');
run('npm',['pack','--ignore-scripts','--loglevel=notice'],{...process.env,npm_config_cache:resolve(stage,'npm-cache')});
const packed={filename:pkg.name.replace(/^@/,'').replace('/','-')+'-'+pkg.version+'.tgz'};
const archive=resolve(destination,packed.filename);
const packedFiles=run('tar',['-tzf',archive]).trim().split('\n').map(name=>name.replace(/^package\//,''));
const permitted=new Set(['package.json','README.md','dist/bundle.js','snap.manifest.json','images/icon.svg']);
if(packedFiles.length!==permitted.size||packedFiles.some(name=>!permitted.has(name)))throw Error('Release package contains unexpected files');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
// Public source set, mirroring github.com/ProofOfAudits/proof-before-sign-snap: Snap source + only the shared web modules the bundle consumes; no dist/, node_modules or tests.
const exportRoot=resolve(proof,'.local/release/public-source',pkg.version);
await rm(exportRoot,{recursive:true,force:true});
const exportSnap=resolve(exportRoot,'products/proofofaudits/proof-before-sign/snap');
for(const folder of ['src','scripts'])await cp(resolve(snap,folder),resolve(exportSnap,folder),{recursive:true});
for(const file of ['package-lock.json','tsconfig.json','development-trust.json'])await copyFile(resolve(snap,file),resolve(exportSnap,file));
await mkdir(resolve(exportSnap,'trust'),{recursive:true});await copyFile(trust,resolve(exportSnap,'trust',basename(trust)));
await copyFile(trust,resolve(exportRoot,'runtime-trust.json'));
await copyFile(resolve(destination,'snap.manifest.json'),resolve(exportSnap,'snap.manifest.json'));
await writeFile(resolve(exportSnap,'README.md'),readme);
const inputs=Object.keys(JSON.parse(await readFile(resolve(destination,'dist/bundle-inputs.json'),'utf8')).inputs);
const webInputs=inputs.filter(name=>name.startsWith('../web/')).sort();
if(inputs.some(name=>!name.startsWith('../web/')&&!name.startsWith('src/')&&!/(^|\/)node_modules\//.test(name)&&!name.startsWith('<')))throw Error('Bundle input outside the public source set');
for(const name of webInputs){await mkdir(dirname(resolve(exportSnap,name)),{recursive:true});await copyFile(resolve(snap,name),resolve(exportSnap,name));}
await mkdir(resolve(exportRoot,'products/proofofaudits/frontend/public/logos'),{recursive:true});
await copyFile(resolve(proof,'../frontend/public/logos/proofofaudits-mark.svg'),resolve(exportRoot,'products/proofofaudits/frontend/public/logos/proofofaudits-mark.svg'));
const {scripts}=original;
const sourcePkg={name:packageName,version:original.version,private:false,description:original.description,...(license?{license}:{}),repository:pkg.repository,main:original.main,files:pkg.files,scripts:{build:scripts.build,'check:manifest':scripts['check:manifest']},dependencies:original.dependencies,devDependencies:original.devDependencies,engines:original.engines,overrides:original.overrides};
await writeFile(resolve(exportSnap,'package.json'),JSON.stringify(sourcePkg,null,2)+'\n');
const archiveSha256=sha256(await readFile(archive));
await writeFile(resolve(exportRoot,'.gitignore'),'**/node_modules\n**/node_modules/\n.env\n.env.*\n**/dist/bundle-inputs.json\n');
await writeFile(resolve(exportRoot,'README.md'),`# Proof Before Sign ${pkg.version}\nPublic source snapshot for the \`${pkg.name}@${pkg.version}\` Snap package. Publication on npm and MetaMask allowlisting are tracked separately; this snapshot does not claim either.\nWebsite: https://proofofaudits.com/try\n${supportContact?'Support: '+supportContact+'\n':''}${license==='Apache-2.0'?'License: Apache-2.0 (see `LICENSE`).\n':''}Use Node.js 22 or later. From \`products/proofofaudits/proof-before-sign/snap\`, run \`npm ci\`, then:\n\`\`\`sh\nPOA_API_URL=${new URL(process.env.POA_API_URL).origin} POA_PASSPORT_URL=${new URL(process.env.POA_PASSPORT_URL).origin} POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build\n\`\`\`\nThe manifest checksum must equal \`${manifest.source.shasum}\` (also recorded in \`products/proofofaudits/proof-before-sign/snap/snap.manifest.json\`). The npm archive SHA256 of the release candidate is \`${archiveSha256}\`. The npm package contains only its five release files. \`runtime-trust.json\` is the public Ed25519 runtime trust embedded in the bundle; it contains public keys only.\nOnly authenticated RELEASED evidence creates positive review coverage. Signature authentication does not guarantee that contracts are secure or that complete evidence exists. Missing evidence is shown as UNKNOWN. The service analyzes a proposed transaction and does not submit it. No recovery phrase or private key is requested.\n`);
// Owner decision (0.7.0): Apache-2.0 for the public source export only. The npm archive keeps its five allowlisted files; no other package is relicensed.
if(license==='Apache-2.0')await copyFile(resolve(snap,'scripts/assets/LICENSE-Apache-2.0.txt'),resolve(exportRoot,'LICENSE'));
const snapperReview=resolve(proof,'docs/release',pkg.version,'SNAPPER_REVIEW.md');
if(await stat(snapperReview).then(()=>true,()=>false))await copyFile(snapperReview,resolve(exportRoot,'SNAPPER_REVIEW.md'));
async function list(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())out.push(...await list(path));else out.push(path);}return out;}
const sourceFiles=[];for(const path of await list(exportRoot)){const bytes=await readFile(path);sourceFiles.push({path:relative(exportRoot,path).split(sep).join('/'),sha256:sha256(bytes),bytes:bytes.length});}
sourceFiles.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const sourceManifest=JSON.stringify({version:pkg.version,files:sourceFiles},null,2)+'\n';
await writeFile(resolve(exportRoot,'SOURCE_MANIFEST.json'),sourceManifest);
// Reproducibility: a clean install of the exported lockfile and a build with the exported trust must reproduce the packed manifest checksum and bundle byte-for-byte.
const verify=await mkdtemp(resolve(tmpdir(),'poa-snap-source-verify-'));
try{
 await cp(exportRoot,verify,{recursive:true});
 const verifySnap=resolve(verify,'products/proofofaudits/proof-before-sign/snap');
 run('npm',['ci','--no-audit','--no-fund','--loglevel=error'],process.env,verifySnap,900000);
 run(process.execPath,['scripts/build.mjs'],{...process.env,POA_RUNTIME_TRUST_FILE:resolve(verify,'runtime-trust.json')},verifySnap);
 const rebuilt=JSON.parse(await readFile(resolve(verifySnap,'snap.manifest.json'),'utf8'));
 if(rebuilt.source.shasum!==manifest.source.shasum||sha256(await readFile(resolve(verifySnap,'dist/bundle.js')))!==sha256(bundle))throw Error('Public source export does not rebuild the packed artifact');
}finally{await rm(verify,{recursive:true,force:true});}
const receipt={schemaVersion:'poa.snap-release-candidate/1',package:pkg.name,version:pkg.version,license:license??null,supportContact:supportContact??null,apiOrigin:new URL(process.env.POA_API_URL).origin,passportOrigin:new URL(process.env.POA_PASSPORT_URL).origin,trustPolicySha256:sha256(await readFile(trust)),manifestShasum:manifest.source.shasum,archiveSha256,files:[...permitted],sourceStage:destination,publicSource:{path:exportRoot,sourceManifestSha256:sha256(sourceManifest),files:sourceFiles.length,rebuildMatchesPackedShasum:true},published:false,mainnetWalletAccepted:false};
await mkdir(resolve(proof,'.local/release'),{recursive:true});
const retained=resolve(proof,'.local/release',packed.filename);await copyFile(archive,retained);
await writeFile(resolve(proof,`.local/release/snap-candidate-${pkg.version}.json`),JSON.stringify({...receipt,archive:retained},null,2)+'\n');
console.log(JSON.stringify({...receipt,archive:retained}));
