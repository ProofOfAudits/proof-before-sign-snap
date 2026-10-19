// Device-local POA controls in snap_manageState under `settings`. Missing or invalid settings use the defaults.
// Callers serialize saveSettings through the existing state queue; every write keeps the other state keys.
export const DEFAULT_SETTINGS=Object.freeze({schemaVersion:'poa.settings.v1',checks:'ON',alerts:'OFF',pausedAll:false});
const valid=s=>!!s&&typeof s==='object'&&s.schemaVersion==='poa.settings.v1'&&['ON','PAUSED'].includes(s.checks)&&['OFF','ON'].includes(s.alerts)&&typeof s.pausedAll==='boolean';
export function readSettings(state){const s=state?.settings;return valid(s)?{schemaVersion:s.schemaVersion,checks:s.checks,alerts:s.alerts,pausedAll:s.pausedAll}:{...DEFAULT_SETTINGS};}
export async function loadSettings(request){return readSettings(await request({method:'snap_manageState',params:{operation:'get'}}));}
export async function saveSettings(request,patch){
 const state=await request({method:'snap_manageState',params:{operation:'get'}});
 const current=readSettings(state),next={schemaVersion:'poa.settings.v1',checks:patch?.checks??current.checks,alerts:patch?.alerts??current.alerts,pausedAll:patch?.pausedAll??current.pausedAll};if(!valid(next))throw Error('SETTINGS_INVALID');
 await request({method:'snap_manageState',params:{operation:'update',newState:{...(state??{}),settings:next}}});return {...next};
}
