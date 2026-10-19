// Optional device-scoped watch preferences. Never receives wallet keys or grants review coverage.
const address=/^0x[a-f0-9]{40}$/,chain=/^[1-9][0-9]{0,15}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const kinds=new Set(['DEPLOYMENT_CODE_CHANGED','IMPLEMENTATION_CHANGED','IMPLEMENTATION_CODE_CHANGED','BEACON_CHANGED','ROUTING_TYPE_CHANGED','ADMIN_CHANGED','OWNER_CHANGED','PENDING_OWNER_CHANGED','CONTROLLER_ADDED','CONTROLLER_CHANGED','CONTROLLER_REMOVED','SAFE_THRESHOLD_CHANGED','SAFE_OWNER_CHANGED','SAFE_MODULE_CHANGED','SAFE_GUARD_CHANGED','SAFE_FALLBACK_HANDLER_CHANGED','TIMELOCK_CHANGED','NEW_DEPENDENCY','ROUTING_CHANGED','DIAMOND_FACETS_CHANGED']);
const reviewImpacts=new Set(['NOT_ESTABLISHED','REVIEWED_BASELINE_AFFECTED']),pointer=v=>v===null||address.test(v);
const clone=v=>JSON.parse(JSON.stringify(v));
export function monitoringPreferences(state){
 const p=state?.monitoring;if(p===undefined)return null;
 if(!p||p.schemaVersion!=='poa.wallet-monitoring.v1'||typeof p.enabled!=='boolean'||! /^[a-f0-9]{64}$/.test(p.capability)||! /^[0-9]{1,18}$/.test(p.cursor)||!Array.isArray(p.watches)||p.watches.length>20||!p.watches.every(w=>w&&chain.test(w.chainId)&&address.test(w.address))||!Array.isArray(p.delivered)||p.delivered.length>128||!p.delivered.every(id=>uuid.test(id))||!Array.isArray(p.history)||p.history.length>50||!p.history.every(a=>a&&uuid.test(a.id)&&chain.test(a.chainId)&&address.test(a.watchedAddress)&&kinds.has(a.kind)&&['DIRECT','POTENTIAL_DEPENDENCY'].includes(a.impact)&&/^[0-9]{1,20}$/.test(a.firstObservedBlock)&&typeof a.firstObservedAt==='string'&&Number.isFinite(Date.parse(a.firstObservedAt))&&(a.reviewImpact===undefined||reviewImpacts.has(a.reviewImpact)))||!Number.isFinite(p.lastPollAt)||p.lastPollAt<0)throw Error('MONITORING_STATE_INVALID');return clone(p);
}
function capability(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function api(origin){const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('MONITORING_ORIGIN_INVALID');return url.origin;}
async function call(fetcher,origin,path,token,method='GET',body,decode=false){
 let timer;const controller=typeof AbortController==='function'?new AbortController():null;
 try{return await Promise.race([(async()=>{const response=await fetcher(api(origin)+path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},redirect:'error',credentials:'omit',...(controller?{signal:controller.signal}:{}),...(body?{body:JSON.stringify(body)}:{})});if(decode)return json(response);await response.body?.cancel?.();return {ok:response.ok,status:response.status};})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Error('MONITORING_TIMEOUT'));},4000);})]);}finally{clearTimeout(timer);}
}
async function json(response){
 if(!response.ok)throw Error('MONITORING_REQUEST_FAILED');const maximum=65536;const announced=response.headers?.get('content-length');if(announced&&Number(announced)>maximum)throw Error('MONITORING_RESPONSE_LIMIT');
 let text;if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maximum)throw Error('MONITORING_RESPONSE_LIMIT');chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}text=new TextDecoder().decode(bytes);}else{text=await response.text();if(text.length>maximum)throw Error('MONITORING_RESPONSE_LIMIT');}
 return JSON.parse(text);
}
// Caller serializes these operations with the existing epoch/state write queue.
export async function watchSubject({request,fetcher=fetch,origin,subject}){
 if(!subject||!chain.test(subject.chainId)||!address.test(subject.address))throw Error('MONITORING_SUBJECT_INVALID');
 api(origin);const state=await request({method:'snap_manageState',params:{operation:'get'}}),existing=monitoringPreferences(state),p=existing??{schemaVersion:'poa.wallet-monitoring.v1',enabled:false,capability:capability(),cursor:'0',watches:[],delivered:[],history:[],lastPollAt:0};
 if(!p.watches.some(w=>w.chainId===subject.chainId&&w.address===subject.address)&&p.watches.length>=20)throw Error('MONITORING_WATCH_LIMIT');
 // Retain a new capability before any server-side watch can be created.
 if(!existing){p.serverDisablePending=true;await request({method:'snap_manageState',params:{operation:'update',newState:{...(state??{}),monitoring:clone(p)}}});}
 const response=await call(fetcher,origin,'/api/poa/wallet/watch',p.capability,'POST',{...subject,enabled:true},true);if(response.enabled!==true||response.chain_id!==subject.chainId||response.address!==subject.address)throw Error('MONITORING_WATCH_UNAVAILABLE');
 p.enabled=true;p.serverDisablePending=false;if(!p.watches.some(w=>w.chainId===subject.chainId&&w.address===subject.address))p.watches.push({...subject});
 await request({method:'snap_manageState',params:{operation:'update',newState:{...(state??{}),monitoring:p}}});return {enabled:true,watches:p.watches};
}
export async function disableMonitoring({request,fetcher=fetch,origin}){
 const state=await request({method:'snap_manageState',params:{operation:'get'}}),p=monitoringPreferences(state);if(!p)return {enabled:false,serverDisabled:true};
 p.enabled=false;p.serverDisablePending=true;await request({method:'snap_manageState',params:{operation:'update',newState:{...state,monitoring:p}}});
 let disabled=false;try{disabled=(await call(fetcher,origin,'/api/poa/wallet/disable',p.capability,'POST',{})).ok;}catch{}
 if(disabled){p.serverDisablePending=false;await request({method:'snap_manageState',params:{operation:'update',newState:{...state,monitoring:p}}});}return {enabled:false,serverDisabled:disabled};
}
// v1: review impact is never established. v2 (requested with &schema=v2) may report REVIEWED_BASELINE_AFFECTED
// (a released review baseline covers the changed subject) and pointer previous/current values; it never grants coverage.
export function validateAlerts(body,cursor){
 const v2=body?.schemaVersion==='poa.wallet-alerts.v2';
 if(!body||!v2&&body.schemaVersion!=='poa.wallet-alerts.v1'||!Array.isArray(body.alerts)||body.alerts.length>20||! /^[0-9]{1,18}$/.test(body.nextCursor)||BigInt(body.nextCursor)<BigInt(cursor))throw Error('MONITORING_RESPONSE_INVALID');let previous=BigInt(cursor);const ids=new Set();
 for(const a of body.alerts){if(!a||!uuid.test(a.id)||ids.has(a.id)||! /^[0-9]{1,18}$/.test(a.sequence)||BigInt(a.sequence)<=previous||BigInt(a.sequence)>BigInt(body.nextCursor)||!chain.test(a.chainId)||!address.test(a.subject)||!address.test(a.watchedAddress)||!kinds.has(a.kind)||!['CODE','ROUTING','CONTROL'].includes(a.dimension)||!['DIRECT','POTENTIAL_DEPENDENCY'].includes(a.impact)||!(v2?reviewImpacts.has(a.reviewImpact):a.reviewImpact==='NOT_ESTABLISHED')||v2&&(a.previousValue!==undefined&&!pointer(a.previousValue)||a.currentValue!==undefined&&!pointer(a.currentValue)||(a.previousValue===undefined)!==(a.currentValue===undefined))||! /^[0-9]{1,20}$/.test(a.firstObservedBlock)||!Number.isFinite(Date.parse(a.firstObservedAt)))throw Error('MONITORING_RESPONSE_INVALID');previous=BigInt(a.sequence);ids.add(a.id);}
 if(body.alerts.length&&body.nextCursor!==body.alerts.at(-1).sequence||!body.alerts.length&&body.nextCursor!==cursor)throw Error('MONITORING_RESPONSE_INVALID');return body;
}
export async function pollMonitoring({request,fetcher=fetch,origin,now=Date.now()}){
 const state=await request({method:'snap_manageState',params:{operation:'get'}}),p=monitoringPreferences(state);if(!p)return {notified:0};
 if(!p.enabled){if(p.serverDisablePending){try{if((await call(fetcher,origin,'/api/poa/wallet/disable',p.capability,'POST',{})).ok){p.serverDisablePending=false;await request({method:'snap_manageState',params:{operation:'update',newState:{...state,monitoring:p}}});}}catch{}}return {notified:0};}
 if(Number.isFinite(p.lastPollAt)&&now-p.lastPollAt<60000)return {notified:0,rateLimited:true};
 const body=validateAlerts(await call(fetcher,origin,'/api/poa/wallet/alerts?after='+p.cursor+'&schema=v2',p.capability,'GET',undefined,true),p.cursor);
 if(body.alerts.some(a=>!p.watches.some(w=>w.chainId===a.chainId&&w.address===a.watchedAddress)))throw Error('MONITORING_WATCH_BINDING_FAILED');
 const fresh=body.alerts.filter(a=>!p.delivered.includes(a.id));
 if(fresh.length)await request({method:'snap_notify',params:{type:'inApp',message:'POA observed '+fresh.length+' code, routing or control change'+(fresh.length===1?'':'s')+' for your watched contracts. '+(fresh.some(a=>a.reviewImpact==='REVIEWED_BASELINE_AFFECTED')?'A released review baseline no longer matches at least one changed contract.':'Review impact is not established.')+' Open POA in MetaMask for details.'}});
 p.cursor=body.nextCursor;p.lastPollAt=now;p.delivered=[...p.delivered,...fresh.map(a=>a.id)].slice(-128);p.history=[...p.history,...fresh.map(a=>({id:a.id,chainId:a.chainId,watchedAddress:a.watchedAddress,kind:a.kind,dimension:a.dimension,impact:a.impact,firstObservedBlock:a.firstObservedBlock,firstObservedAt:a.firstObservedAt,reviewImpact:a.reviewImpact}))].slice(-50);
 await request({method:'snap_manageState',params:{operation:'update',newState:{...state,monitoring:p}}});
 // Server acknowledgements are best effort after local accepted-notification state is durable.
 await Promise.allSettled(fresh.map(a=>call(fetcher,origin,'/api/poa/wallet/alerts/'+a.id+'/ack',p.capability,'POST',{})));
 return {notified:fresh.length,cursor:p.cursor};
}
