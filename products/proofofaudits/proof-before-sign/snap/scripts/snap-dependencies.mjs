import {resolve as resolvePath,sep} from 'node:path';
// Bare imports in the shared ../web modules resolve from this Snap's own node_modules (its lockfile), never a sibling package's, so a Snap-only checkout builds the same bundle.
// Shared by scripts/build.mjs and the handler-test harnesses so tests bundle exactly what the release bundles.
// {monitoring:false} (the default release build) swaps the Snap's monitoring modules for src/monitoring-disabled.mjs.
export function snapDependencies(snapDir,{monitoring}={}){const webDir=resolvePath(snapDir,'../web')+sep,srcDir=resolvePath(snapDir,'src')+sep,stub=resolvePath(snapDir,'src/monitoring-disabled.mjs');return {name:'snap-dependencies',setup(b){
 if(monitoring===false)b.onResolve({filter:/^\.\/(monitoring\.mjs|monitoring-home\.jsx)$/},args=>args.importer.startsWith(srcDir)?{path:stub}:undefined);
 b.onResolve({filter:/^[^./]/},async args=>{if(!args.importer.startsWith(webDir))return undefined;const r=await b.resolve(args.path,{kind:args.kind,resolveDir:snapDir});return r.errors.length?{errors:r.errors}:{path:r.path,namespace:r.namespace,external:r.external,sideEffects:r.sideEffects,suffix:r.suffix};});}};}
