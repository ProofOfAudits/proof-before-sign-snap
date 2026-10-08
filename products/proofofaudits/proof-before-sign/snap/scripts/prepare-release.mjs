// Build a separate, allowlisted npm artifact; preserve the installed local demo.
import {mkdtemp,mkdir,cp,symlink,readFile,writeFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
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
const trust=resolve(process.env.POA_RUNTIME_TRUST_FILE);
const stage=await mkdtemp(resolve(tmpdir(),'poa-snap-release-'));
const destination=resolve(stage,'products/proofofaudits/proof-before-sign/snap');
await mkdir(destination,{recursive:true});
for(const folder of ['src','scripts'])await cp(resolve(snap,folder),resolve(destination,folder),{recursive:true});
await cp(resolve(proof,'web'),resolve(destination,'../web'),{recursive:true});
await copyFile(resolve(snap,'development-trust.json'),resolve(destination,'development-trust.json'));
await symlink(resolve(snap,'node_modules'),resolve(destination,'node_modules'),'dir');
await mkdir(resolve(stage,'products/proofofaudits/frontend/public/logos'),{recursive:true});
await copyFile(resolve(proof,'../frontend/public/logos/proofofaudits-mark.svg'),resolve(stage,'products/proofofaudits/frontend/public/logos/proofofaudits-mark.svg'));
const original=JSON.parse(await readFile(resolve(snap,'package.json'),'utf8'));
const packageName=process.env.POA_SNAP_PACKAGE_NAME??original.name;if(!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName))throw Error('Invalid Snap package name');
const pkg={name:packageName,version:original.version,description:original.description,main:'dist/bundle.js',private:false,repository:{type:'git',url:'https://github.com/ProofOfAudits/veersec.git'},files:['dist/bundle.js','snap.manifest.json','images/icon.svg','README.md'],publishConfig:{access:'public'}};
await writeFile(resolve(destination,'package.json'),JSON.stringify(pkg,null,2)+'\n');
await writeFile(resolve(destination,'README.md'),'# Proof Before Sign\n\nTransaction-specific security-review evidence inside MetaMask. Review evidence does not guarantee security. Missing evidence stays unknown. The proposed transaction is sent to the POA evidence service; recovery phrases and private keys are never requested.\n\nThis package is a release candidate. Publishing alone does not establish MetaMask allowlisting or mainnet wallet acceptance.\n');
function run(command,args,env=process.env){const result=spawnSync(command,args,{cwd:destination,env,encoding:'utf8',timeout:60000});if(result.status!==0)throw Error('Release preparation failed: '+command);return result.stdout;}
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
const receipt={schemaVersion:'poa.snap-release-candidate/1',package:pkg.name,version:pkg.version,apiOrigin:new URL(process.env.POA_API_URL).origin,passportOrigin:new URL(process.env.POA_PASSPORT_URL).origin,trustPolicySha256:createHash('sha256').update(await readFile(trust)).digest('hex'),manifestShasum:manifest.source.shasum,archiveSha256:createHash('sha256').update(await readFile(archive)).digest('hex'),files:[...permitted],published:false,mainnetWalletAccepted:false};
await mkdir(resolve(proof,'.local/release'),{recursive:true});
const retained=resolve(proof,'.local/release',packed.filename);await copyFile(archive,retained);
await writeFile(resolve(proof,'.local/release/snap-candidate.json'),JSON.stringify({...receipt,archive:retained},null,2)+'\n');
console.log(JSON.stringify({...receipt,archive:retained}));
