// One evidence-to-copy model for the wallet and Passport. No new verdicts,
// token amounts, permissions or person identities are inferred by this layer.
export const states={
  VERIFIED:{symbol:'✓',title:'Verified review evidence',color:'success'},
  PARTIAL:{symbol:'◐',title:'Partial verified coverage',color:'warning'},
  CHANGED:{symbol:'≠',title:'Changed · reviewed code differs',color:'warning'},
  UNKNOWN:{symbol:'?',title:'Unknown · evidence not confirmed',color:'muted'},
  LIVE_ANALYSIS:{symbol:'↗',title:'Live analysis · review not confirmed',color:'muted'},
};
const text=(v,max=120)=>String(v??'').slice(0,max);
export function friendlyName(c,chainId){
  const demos={VaultImplementationV1:'Vault',VaultImplementationV2:'Vault',StrategyV1:'Strategy',OracleMock:'Oracle'};
  if(chainId==='31337'&&c.sourceStatus==='LOCAL_SOURCE'&&demos[c.name])return demos[c.name];
  if(/^0x[0-9a-f]{40}$/i.test(c.name??''))return 'Unidentified contract';
  return text(c.name||'Unidentified contract',72).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ');
}
export function action(proof){
  const name=proof.decoded?.confidence!=='SELECTOR_CANDIDATE'?proof.decoded?.name:undefined;
  const names={withdraw:'Withdraw',deposit:'Deposit',transfer:'Transfer',transferFrom:'Transfer',approve:'Approve spending',borrow:'Borrow',repay:'Repay',swap:'Swap',exactInput:'Swap',exactInputSingle:'Swap',exactOutput:'Swap',exactOutputSingle:'Swap',getPool:'Look up a pool'};
  return {title:names[name]??(name?text(name).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,v=>v.toUpperCase()):'Contract transaction'),signature:text(proof.decoded?.signature??(/^[A-Za-z_][A-Za-z_0-9]*\(.*\)$/.test(proof.function??'')?proof.function:'Function not confirmed'))};
}
export function control(a){
  if(!a?.controller)return {line:'Upgrade control not confirmed',detail:'POA could not confirm who can change this code.',known:false};
  const members=Array.isArray(a.owners)?[...new Set(a.owners.filter(v=>/^0x[0-9a-f]{40}$/i.test(v)))]:[];
  const threshold=Number.isInteger(a.threshold)&&a.threshold>0&&a.threshold<=members.length?a.threshold:undefined;
  const upgrade=a.capability==='upgrade';
  const line=upgrade?(threshold?`Upgrade controller · ${threshold} of ${members.length} reported signers`:a.controllerKind==='WALLET'?'⚠ 1 wallet can upgrade this code':'Upgrade controller identified · wallet or contract'): 'Owner identified · upgrade permission not confirmed';
  // A getMinDelay() getter does not prove that every upgrade goes through it.
  const delay=Number.isSafeInteger(a.timelockSeconds)&&a.timelockSeconds>=0?`Controller reports a ${a.timelockSeconds%3600===0?a.timelockSeconds/3600+'h':a.timelockSeconds+'s'} minimum delay; upgrade enforcement not confirmed.`:'No confirmed delay';
  const moduleWarning=members.length?(a.modulesComplete?(a.modules?.length?`${a.modules.length} reported modules may provide other execution paths`:'No enabled modules reported by the queried interface'):'Module list not fully established'):undefined;
  return {moduleWarning,line,detail:threshold?'Signer threshold observed; guards and other execution routes not confirmed.':undefined,delay,known:upgrade,controller:a.controller,kind:a.controllerKind,members,threshold};
}
function runtimePath(proof,nodes){
  const path=[],stack=[];
  for(const frame of proof.traceFrames??[]){
    while(stack.length&&stack.at(-1).depth>=frame.depth)stack.pop();
    const index=proof.components.findIndex(c=>c.address?.toLowerCase()===frame.address?.toLowerCase()&&c.context?.toLowerCase()===frame.context?.toLowerCase()&&c.selector?.toLowerCase()===(frame.input??'0x').slice(0,10).toLowerCase());
    const parent=stack.at(-1)?.node;
    if(index>=0){const node={...nodes[index],id:path.length,parent:parent?.id??null,parentName:parent?.name,level:parent?parent.level+1:0};path.push(node);stack.push({depth:frame.depth,node});}
    else stack.push({depth:frame.depth,node:parent});
  }
  // Unmatched components stay visible without inventing an edge or call order.
  for(const node of nodes)if(!path.some(p=>p.index===node.index))path.push({...node,id:path.length,parent:null,level:0,unplaced:true});
  return path;
}
export function evidenceView(proof){
  const nodes=proof.components.map((c,index)=>{
    const name=friendlyName(c,proof.chainId),reviewed=c.state==='VERIFIED'&&!!c.snapshot;
    const fn=text(c.signature?.split('(')[0]||'Function');
    const prior=c.state==='CHANGED'?c.previousReview:undefined;
    const review=c.snapshot??prior;
    const reviewDate=/^\d{4}-\d{2}-\d{2}/.test(review?.auditDate??'')?review.auditDate.slice(0,10):undefined;
    return {index,name,technicalName:text(c.name),state:c.state,functionLabel:c.signature?fn+'()':'Function not confirmed',reviewDate,
      review:reviewed?(c.coverageLevel==='CONTRACT_REVIEW_CONFIRMED'?`✓ Contract containing ${fn}() was in review scope`:c.coverageLevel!=='FUNCTION_REVIEW_CONFIRMED'?`✓ Code containing ${fn}() matches the reviewed revision`:`✓ ${fn}() review confirmed`) : c.state==='CHANGED'?(prior?'Last confirmed '+fn+'() review':'⚠ Previous review does not cover this code'):c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?'⚠ Outside confirmed review scope':'? Review not confirmed',
      auditor:review?text(review.auditor):undefined,demo:review?.demo===true,
      live:reviewed?`✓ You are using the reviewed ${name} version`:c.state==='CHANGED'?`⚠ This ${name} is not the reviewed version`:`? ${name} has no confirmed reviewed version`,
      control:control(c.authority??(c.context?.toLowerCase()===proof.target?.toLowerCase()?proof.authority:undefined))};
  });
  const gaps=[];
  for(const n of nodes){if(n.state==='UNKNOWN')gaps.push(`${n.name} review`);if(!n.control.known)gaps.push(`${n.name} upgrade control`);}
  gaps.push('Pause authority','Controller identities and interviews');
  const reasons={execution_trace_unavailable:'Complete transaction path',unsupported_proxy_pattern:'Custom proxy controls',unsupported_chain:'Support for this network',simulation_reverted:'Successful transaction simulation',analysis_deadline_exceeded:'Analysis within the time limit',no_contract_code:'Deployed contract code'};
  if(!proof.traceComplete)gaps.unshift('Complete transaction path');
  if(proof.policy?.internalExecution==='INTERNAL_EXECUTION_UNKNOWN')gaps.push('Internal function execution attribution');
  if(proof.reasons?.includes('production_assurance_incomplete'))gaps.push('Production evidence signatures and assurance checks');
  for(const r of proof.reasons??[])if(reasons[r])gaps.push(reasons[r]);
  const missing=nodes.filter(n=>n.state!=='VERIFIED').length;
  const conclusion=proof.state==='VERIFIED'?'The traced code matches its confirmed review scope.':proof.state==='PARTIAL'?`${missing} important ${missing===1?'part has':'parts have'} no current confirmed review.`:proof.state==='CHANGED'?'Part of this transaction uses code different from its confirmed review.':proof.state==='LIVE_ANALYSIS'?'Live code facts are available. POA has not confirmed review evidence.':'POA could not establish the complete evidence for this transaction.';
  const holders=nodes.filter(n=>n.control.controller).map(n=>({component:n.name,controller:n.control.controller,members:n.control.members.length?n.control.members:n.control.controller?[n.control.controller]:[],knownWallet:n.control.members.length>0||n.control.kind==='WALLET',evidence:(proof.controllerEvidence??[]).filter(e=>[...n.control.members,n.control.controller].includes(e.address))}));
  const pause=action(proof).title==='Withdraw'?'POA could not confirm who can pause withdrawals':`Pause authority for this action not confirmed`;
  const reviewMissing=nodes.filter(n=>n.state==='UNKNOWN').length;
  const compactGaps=[...(reviewMissing?[`${reviewMissing} ${reviewMissing===1?'review remains':'reviews remain'} unconfirmed`]:[]),...(nodes.some(n=>!n.control.known)?['Some upgrade permissions']:[])];
  if(!proof.traceComplete)compactGaps.unshift('Complete transaction path');
  if(proof.reasons?.includes('production_assurance_incomplete'))compactGaps.push('Production proof assurance');
  return {pause,compactGaps,action:action(proof),status:states[proof.state]??states.UNKNOWN,state:proof.state,nodes,path:runtimePath(proof,nodes),pathConfirmed:!!proof.traceComplete&&(proof.traceFrames?.length??0)>0,
    summary:proof.total?`${proof.covered} of ${proof.total} important parts have current verified review evidence${proof.traceComplete?'.':' · complete path not confirmed.'}`:'No complete review path established.',
    gaps:[...new Set(gaps)],conclusion,holders,demo:nodes.some(n=>n.demo)};
}
export function historyStory(change){
  const titles={IMPLEMENTATION_CHANGED:'The implementation changed',CODE_HASH_CHANGED:'The deployed code changed',OWNER_CHANGED:'The owner changed',ADMIN_CHANGED:'The upgrade administrator changed',SAFE_OWNER_CHANGED:'Controller signers changed',SAFE_THRESHOLD_CHANGED:'The required signer count changed',TIMELOCK_CHANGED:'The controller delay changed',ROLE_CHANGED:'Contract role membership changed',NEW_DEPENDENCY:'A new dependency was detected'};
  const details={IMPLEMENTATION_CHANGED:'Previous review evidence does not transfer to another implementation.',CODE_HASH_CHANGED:'Review evidence must match the current code version.',SAFE_OWNER_CHANGED:'Identity and interview evidence do not transfer to a replacement signer.'};
  return {title:titles[change.kind]??'A deployment change was recorded',detail:details[change.kind]??'The recorded fact changed; inspect its evidence below.'};
}

// Wallet-only presentation: preserve the engine verdict and established counts.
export function compactWalletSummary(proof){
  const view=evidenceView(proof);
  const count=proof.total?`${proof.covered} of ${proof.total} parts covered`:null;
  const title={VERIFIED:'Current review coverage confirmed',PARTIAL:'PARTIAL · Review evidence is missing',CHANGED:'CHANGED · Reviewed code differs',UNKNOWN:'UNKNOWN · Evidence not established',LIVE_ANALYSIS:'LIVE ANALYSIS · Review not confirmed'}[proof.state]??view.status.title;
  const verdict=`${view.status.symbol} ${title}`;
  let explanation=view.conclusion;
  if(!proof.traceComplete)explanation='Complete transaction path not confirmed.';
  else if(proof.state==='PARTIAL'){
    const missing=view.nodes.filter(n=>n.state!=='VERIFIED');
    if(missing.length===1){const node=missing[0],component=proof.components[node.index];explanation=component.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?`${node.name} is outside confirmed review scope.`:node.state==='CHANGED'?`${node.name} differs from its reviewed version.`:`${node.name} review is not confirmed.`;}
    else explanation=missing.length?`${missing.length} parts have no current confirmed review.`:'Some required evidence is not established.';
  }
  return {verdict,explanation,coverage:count};
}
