import {userState,weakestLink} from '../../web/runtime-contract.mjs';
import {walletTransaction} from '../../web/transaction-context.mjs';
import { Box, Section, Heading, Text, Divider, Link, Button, Row } from '@metamask/snaps-sdk/jsx';
import { validateProof, transactionPassport, safeText } from './validate.mjs';
import {verifyRuntimeProof,verifyRuntimeObservation,checkObservationEpoch,runtimeObservationDeadline,persistVerifiedEpoch,finalizeRuntimeProof,runtimeProofDeadline,acceptEpoch,commitment} from './runtime-proof.mjs';
import {WalletPath,WalletInspector,WalletHolders,WalletLegend} from './wallet-visuals.jsx';
import {visualModel} from '../../web/visual-model.mjs';
import { evidenceView,compactWalletSummary } from '../../web/evidence-view.mjs';
import {sinceReviewView} from '../../web/since-review.mjs';
import {verifyCheck,feedbackEvent} from '../../web/check-contract.mjs';
import {checkRows,hopLine,verdictCopy,friendlyFailure} from '../../web/check-view.mjs';

import {monitoringPreferences,watchSubject,pollMonitoring,disableMonitoring} from './monitoring.mjs';
import {MonitoringHome} from './monitoring-home.jsx';
const monitoringEnabled=typeof POA_ENABLE_MONITORING!=='undefined'&&POA_ENABLE_MONITORING;
const monitoringOrigin=typeof POA_MONITORING_URL!=='undefined'?POA_MONITORING_URL:'';
const homeInterfaces=new Map();let offeredSubjects=[];
// In-memory only (max 5): the target and distinct code-bearing component contexts of recently verified proofs.
// They are only offered on the home page; nothing is watched or sent until the user selects Watch with alerts ON.
function offerSubjects(chainId,addresses){if(!monitoringEnabled||!/^[1-9][0-9]{0,15}$/.test(String(chainId)))return;const fresh=[...new Set(addresses.map(a=>String(a??'').toLowerCase()).filter(a=>/^0x[a-f0-9]{40}$/.test(a)))].map(address=>({chainId:String(chainId),address}));offeredSubjects=[...fresh,...offeredSubjects.filter(o=>!fresh.some(n=>n.chainId===o.chainId&&n.address===o.address))].slice(0,5);}
import {readSettings,loadSettings,saveSettings} from './settings.mjs';
// Release builds check Ethereum mainnet only. A local HTTP development build may also use the local anvil chain.
const localDevelopment=/^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(POA_API_URL);
const supportedChain=chainId=>chainId==='eip155:1'||(localDevelopment&&chainId==='eip155:31337');
// Alerts cannot be ON when monitoring is compiled out of this build.
const effectiveSettings=s=>monitoringEnabled?s:{...s,alerts:'OFF'};
const settingsRequest=r=>snap.request(r);
async function currentSettings(){if(typeof snap==='undefined'||!snap.request)throw Error('settings_unavailable');return effectiveSettings(await loadSettings(settingsRequest));}
const alertsActive=s=>monitoringEnabled&&s?.alerts==='ON'&&!s.pausedAll;
import {ObservationPanel,observationNavigation} from './observation-view.jsx';
import {walletReviewModel,reviewNavigation} from '../../web/wallet-review-view.mjs';
import {ReviewPanel} from './review-view.jsx';
// Realm-local capability: only proofs that passed verifyRuntimeProof -> validateProof -> finalizeRuntimeProof
// may reach the shared review aggregation. Server data cannot add entries.
const reviewEligible=new WeakSet();
// The Explorer link is an extra for release (HTTPS) builds; every important warning is shown in the wallet.
// It is built in only when the website serves /explorer/analysis/<id> (POA_EXPLORER_ANALYSIS_LINK, off by default).
const explorerOrigin=typeof POA_EXPLORER_ANALYSIS_LINK!=='undefined'&&POA_EXPLORER_ANALYSIS_LINK===true&&/^https:\/\//.test(POA_API_URL)?POA_PASSPORT_URL:null;
const explorerUrl=review=>explorerOrigin&&review?.analysisId?explorerOrigin+'/explorer/analysis/'+review.analysisId:null;
const observationInterfaces=new Map();

const label = value => safeText(value);
let stateQueue=Promise.resolve();
function queuedState(work){const result=stateQueue.then(work);stateQueue=result.catch(()=>{});return result;}
async function recordEpoch(p){const update=stateQueue.then(async()=>{if(typeof snap==='undefined'||!snap.request)throw Error('persistent_state_unavailable');return persistVerifiedEpoch(p,POA_RUNTIME_TRUST,r=>snap.request(r));});stateQueue=update.catch(()=>{});return update;}
// Only {checkId, verdict, functionClass, reaction}: no wallet address or calldata.
async function sendFeedback(check,reaction){try{const body=feedbackEvent({checkId:check?.checkId,verdict:check?.verdict?.state,functionClass:check?.transaction?.functionClass,reaction});const response=await fetch(POA_API_URL+'/api/proof/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return response.ok?'SENT':'FAILED';}catch{return 'FAILED';}}
// Home page summary of the last check on this device. Public facts only.
async function rememberLastCheck(check){if(typeof snap==='undefined'||!snap.request||!check)return;const update=stateQueue.then(async()=>{const previous=await snap.request({method:'snap_manageState',params:{operation:'get'}});const anchor=previous?.runtimeEpochs?.[POA_RUNTIME_TRUST.trustDomain];if(!anchor)throw Error('epoch_anchor_missing');acceptEpoch(previous,{evidenceEpoch:anchor.epoch,evidenceRootSha256:anchor.root},POA_RUNTIME_TRUST.trustDomain);await snap.request({method:'snap_manageState',params:{operation:'update',newState:{...previous,lastCheck:{protocol:check.protocol.name,title:check.transaction.title,signature:check.transaction.decoded?.signature??null,verdict:check.verdict.state,hops:check.review.hops,hopsReviewed:check.review.hopsReviewed,at:new Date().toISOString()}}}});});stateQueue=update.catch(()=>{});await update;}
function requestNonce(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function walletView(proof){const view=evidenceView(proof);view.nodes=visualModel(proof).nodes;view.analysisSupport=proof.analysisSupport;view.observationAssurance=proof.policy?.version==='poa_policy_v3'?proof.policy.observationAssurance.level:null;view.securityClosure=proof.securityClosure;view.routing=proof.resolution?.proxy;view.market=proof.interaction?.market;view.capabilities=proof.controlGraph?.edges??[];view.findings=proof.components.flatMap(c=>(c.snapshot?.findings??[]).filter(f=>f.selectors?.includes(c.selector))).filter((f,i,all)=>all.findIndex(x=>x.title===f.title)===i);view.compact=compactWalletSummary(proof);view.sinceReview=sinceReviewView(proof.sinceReview);return view;}
export function proofPanel(proof) {const view=walletView(proof);view.compact={...view.compact,pilotVerdict:userState(proof.state),weakestLink:weakestLink(proof)};view.check=verifyCheck(proof.check,proof);return viewPanel(view,transactionPassport(proof,proof.transaction),false);}
function CheckSummary({check,compact,expanded}){
  const v=verdictCopy[check.verdict.state]??verdictCopy.UNKNOWN,r=checkRows(check);
  const chain=check.deployment?.chainId??check.transaction?.chainId,contract=check.deployment?.address??check.transaction?.to,counts=compact?.counts;
  const ingest=check.verdict.state==='POA_UNVERIFIED'?(check.ingestion.status==='QUEUED'?'Added to the POA research queue.':'POA research queue not confirmed for this check.'):null;
  return <Section>
    <Text size="sm" color="muted">{label((check.protocol.name??'Protocol not identified')+(check.protocol.network?' · '+check.protocol.network:'')+(check.protocol.market?' · '+check.protocol.market:''))}</Text>
    <Heading size="md">{label(check.transaction.title)}</Heading>
    <Text size="sm" color="muted">{label(check.transaction.decoded?.signature??'Function not decoded')}</Text>
    <Heading size="sm">{label(compact?.pilotVerdict??v.symbol+' '+v.title)}</Heading>
    {compact?.weakestLink&&<Text>{label('Weakest link: '+compact.weakestLink)}</Text>}
    {compact?.coverage&&<Text fontWeight="bold" color={v.color}>{label(compact.coverage)}</Text>}
    <Text>{label(compact?.explanation&&check.verdict.state!=='VERIFIED_MATCH'?compact.explanation:v.detail)}</Text>
    {ingest&&<Text size="sm" color="muted">{label(ingest)}</Text>}
    <Row label="Chain"><Text>{label(chain==null?'Not established':String(chain)==='1'?'Ethereum mainnet (chainId 1)':'chainId '+chain)}</Text></Row>
    <Row label="Contract"><Text>{label(contract?String(contract).toLowerCase():'Not established')}</Text></Row>
    {counts&&<Row label="Components"><Text>{label(compact.countsLabel??'Not established')}</Text></Row>}
    <Row label="Execution coverage"><Text>{label(check.review.hopsReviewed+' / '+check.review.hops+' material components reviewed')}</Text></Row>
    <Row label="Live code"><Text>{label(r.live)}</Text></Row>
    {expanded&&<Row label="Function"><Text>{label(r.fn)}</Text></Row>}
    {expanded&&<Row label="Execution path"><Text>{label(r.path)}</Text></Row>}
    <Row label="Path since review"><Text>{label(r.change)}</Text></Row>
    {expanded&&<Row label="Findings"><Text>{label(r.findings)}</Text></Row>}
    {expanded&&<Row label="Deployment"><Text>{label(r.deployment)}</Text></Row>}
    <Text size="sm" color="muted">{label(r.block)}</Text>
    <Row label="Reviewer"><Text>{label(r.reviewer)}</Text></Row>
    {r.age&&<Text size="sm" color="muted">{label(r.age+' · context, not risk')}</Text>}
    <Row label="Controls"><Text>{label(r.controls)}</Text></Row>
    {check.missingFacts.length>0&&<Text size="sm" color="muted">{label('? Not established: '+check.missingFacts.slice(0,4).join(' · ')+(check.missingFacts.length>4?' · +'+(check.missingFacts.length-4)+' more':''))}</Text>}
  </Section>;
}
function RouteCoverage({check}){
  const hops=check.liveExecution.executionPath.filter(h=>h.relation!=='STATIC_REACHABLE').slice(0,12);
  return <Section><Heading size="sm">Route coverage</Heading>
    {check.liveExecution.proxy&&<Text size="sm">{label('◇ Proxy · '+check.liveExecution.proxy.type+' · routing only')}</Text>}
    {hops.map(h=>{const line=hopLine(h);return <Box><Text size="sm" fontWeight="medium">{label(line.title)}</Text><Text size="sm" color="muted">{label(line.detail)}</Text></Box>;})}
    {check.liveExecution.pathChange.newHops.length>0&&<Text size="sm" color="warning">{label('≠ New since review: '+check.liveExecution.pathChange.newHops.map(a=>a.slice(0,6)+'…'+a.slice(-4)).join(', '))}</Text>}
    {!check.liveExecution.traceComplete&&<Text size="sm" color="muted">? Complete path not established</Text>}
  </Section>;
}
function Feedback({feedback}){
  if(feedback==='SENT')return <Text size="sm" color="muted">Thanks · feedback recorded without your address or transaction data.</Text>;
  if(feedback==='FAILED')return <Text size="sm" color="muted">Feedback not sent.</Text>;
  return <Box><Text size="sm" color="muted">Was this check useful?</Text><Box direction="horizontal"><Button name="poa-feedback-up" size="sm">👍 Useful</Button><Button name="poa-feedback-down" size="sm">👎 Not useful</Button></Box></Box>;
}
function MaterialEvidence({view}){
 return <Box>
 {view.market&&<Section><Heading size="sm">Market assumptions</Heading>
 <Text size="sm">{label('Market '+view.market.marketId)}</Text>
 {['loanToken','collateralToken','oracle','irm','lltv'].map(key=><Row label={key==='irm'?'IRM':key==='lltv'?'LLTV (18 decimals)':key}><Text>{label(view.market[key])}</Text></Row>)}
 <Text size="sm" color="muted">Pinned parameters identify dependencies. Review evidence and continuity are checked separately.</Text>
 </Section>}
 {(view.findings??[]).length>0&&<Section><Heading size="sm">Relevant findings</Heading>
 {view.findings.slice(0,8).map(f=><Box><Text>{label(f.severity+' · '+f.title)}</Text><Text size="sm" color="muted">{label('Status '+f.status+' · recheck '+f.recheck)}</Text><Text size="sm">{label(f.citation)}</Text></Box>)}
 <Text size="sm" color="muted">A reported fix does not establish that this live deployment matches the fixed build. Open View proof for complete evidence.</Text>
 </Section>}
 {(view.capabilities??[]).length>0&&<Section><Heading size="sm">Who can change assumptions?</Heading>
 {view.capabilities.slice(0,12).map(c=><Text size="sm">{label(c.capability.replaceAll('_',' ')+' · '+c.from+' · '+c.status)}</Text>)}
 <Text size="sm">{label(view.fastestChange)}</Text>
 <Text size="sm" color="muted">External dependencies require their own evidence.</Text>
 </Section>}
 </Box>;
}
function viewPanel(view,path,expanded,selected=0,holdersExpanded=false,legendExpanded=false,feedback=null) {
  const selectedNode=view.nodes[selected];const selectedView={...view,holders:view.holders.filter(h=>h.component===selectedNode?.name&&h.controller===selectedNode?.control.controller)};
  return <Box>
    <Text size="sm" color="muted">PROOF BEFORE SIGN</Text>
    {view.review&&<ReviewPanel review={view.review} explorerUrl={explorerUrl(view.review)}/>}
    {view.review&&<Divider />}
    <CheckSummary check={view.check} compact={view.compact} expanded={expanded}/>
    {view.demo&&<Text size="sm" color="warning">Synthetic demo evidence · local test only</Text>}
    <Link href={POA_PASSPORT_URL+path}>View proof →</Link>
    <Button name="poa-toggle-path" size="sm">{expanded?'Hide path and evidence':'Show path and evidence'}</Button>
    {expanded&&<Box><Divider />
    <Heading>Your live path</Heading>
    <WalletPath view={view} selected={selected}/>
    <RouteCoverage check={view.check}/>
    <WalletInspector view={view} selected={selected} path={path}/>
    <Section><Heading>Since review</Heading>
      <Text>{label(view.sinceReview.headline)}</Text>
      <Text size="sm">{label(view.sinceReview.impact)}</Text>
      {view.sinceReview.continuity&&<Text size="sm">{label(view.sinceReview.continuity)}</Text>}
      {view.sinceReview.distance&&<Text size="sm" color="muted">{label(view.sinceReview.distance)}</Text>}
      {view.sinceReview.lastChange&&<Text size="sm" color="muted">{label(view.sinceReview.lastChange)}</Text>}
      {view.sinceReview.why.length>0&&<Text size="sm" color="muted">{label((view.check.verdict.state==='VERIFIED_MATCH'?'Why current? ':'Why not fully current? ')+view.sinceReview.why.slice(0,3).join(' · '))}</Text>}
      <Text size="sm" color="muted">{label(view.sinceReview.detail)}</Text>
      <Text size="sm" color="muted">Current match does not prove uninterrupted history.</Text>
      <Link href={POA_PASSPORT_URL+path+'#change-ledger'}>View change ledger →</Link>
    </Section>
    <MaterialEvidence view={view}/><WalletHolders view={selectedView} expanded={holdersExpanded} path={path}/>
    </Box>}
    {expanded&&<Box><Heading>Full execution path</Heading>
      <Text size="sm" color="muted">{view.pathConfirmed?'Observed external contract calls for this transaction.':'Complete runtime path not established.'}</Text>
      {(view.fullFrames??[]).map(frame=><Box><Text fontWeight="medium">{label(frame.indent+frame.label)}</Text><Text size="sm" color="muted">{label(frame.callType+' · '+frame.review)}</Text></Box>)}
      {(view.internalNodes??[]).map(node=><Box><Text fontWeight="medium">{label('↳ internal · '+node.functionName+'()')}</Text><Text size="sm" color="muted">{label(node.currentMatch==='MATCH'?'✓ Covered by reviewed code revision · '+node.auditor:'? Internal function review not confirmed')}</Text></Box>)}
      <Text size="sm" color="muted">{view.internalResolved?'Internal entries established from runtime instructions and reproduced source maps.':'Internal function execution is not established completely. Source-only reachable functions are not shown as executed.'}</Text>
    </Box>}
    {expanded&&<Box><Heading>What can change or control this?</Heading>
      <Text>{label(view.fastestChange)}</Text>
      <Text>{view.securityClosure?.status==='RESOLVED'?'Required dependency closure resolved.':'Complete state-writer and authority coverage is not established.'}</Text>
      {view.analysisSupport?.completeness!=='COMPLETE'&&<Text>NOT VERIFIED · Path contains storage or control semantics POA cannot yet prove.</Text>}
      {(view.analysisSupport?.reasons??[]).slice(0,3).map(reason=><Text size="sm" color="muted">{label(reason.split(':')[0].replaceAll('_',' ').toLowerCase())}</Text>)}
      <Text size="sm" color="muted">This is separate from the simulated calls above. A function can influence this transaction without executing in it.</Text>
      {(view.securityClosure?.nodes??[]).slice(0,8).map(node=><Box><Text>{label(node.label+' · '+node.kind.replaceAll('_',' ').toLowerCase())}</Text><Text size="sm" color="muted">{label(node.coverage==='REVIEWED'?'Review evidence matched':'Review evidence not established')}</Text></Box>)}
      {(view.securityClosure?.nodes?.length??0)>8&&<Text size="sm">Open the exact proof for the full dependency graph.</Text>}
      {(view.securityClosure?.unresolved??[]).slice(0,3).map(reason=><Text size="sm" color="muted">{label(reason.split(':')[0].replaceAll('_',' ').toLowerCase())}</Text>)}
    </Box>}
    <WalletLegend expanded={legendExpanded}/>
    <Feedback feedback={feedback}/>
    <Link href={POA_PASSPORT_URL+path}>View exact proof →</Link>
    {view.observationAssurance&&<Text size="sm" color="muted">Observation assurance: {label(view.observationAssurance)} · pinned provider observations</Text>}
    {view.runtimeVerified&&<Text size="sm" color="muted">Proof verified ✓ · exact transaction · fresh when checked</Text>}
    <Text size="sm" color="muted">Review evidence does not guarantee security.</Text>
  </Box>;
}

function StaticNotice({title,detail}){return <Box><Text size="sm" color="muted">PROOF BEFORE SIGN</Text><Heading size="sm">{label(title)}</Heading><Text>{label(detail)}</Text></Box>;}
export const onTransaction = async ({ transaction, chainId }) => {
  // Settings are read before any network request, trace or state write. Unreadable settings fail closed.
  let settings;try{settings=await currentSettings();}catch{return {content:<StaticNotice title="POA settings unavailable" detail="No POA analysis was performed. MetaMask signing continues normally."/>};}
  if(settings.checks==='PAUSED'||settings.pausedAll)return null;
  if(!supportedChain(chainId))return {content:<StaticNotice title="Ethereum mainnet only" detail="Proof Before Sign checks Ethereum mainnet only in this version. No POA request was made for this network."/>};
  let timer, stage='normalize', httpStatus, requestId,verifiedExpiry,verifiedIssuedAt;
  try {
    if(!transaction||typeof transaction!=='object')throw Error('invalid_transaction');
    if(!transaction.to)throw Error('contract_creation');
    const payload = walletTransaction(transaction,chainId.slice(7));
    const nonce=requestNonce();stage='fetch';
    const proof = await Promise.race([
      (async () => {
        const response = await fetch(POA_API_URL + '/api/proof/analyze', { method: 'POST', headers: { 'content-type': 'application/json','x-poa-nonce':nonce,'x-poa-snap-version':POA_VERSION,'x-poa-runtime-schema':'poa-runtime-v1','x-poa-calldata-sha256':commitment(payload.data),'x-poa-request-sha256':commitment(payload) }, body: JSON.stringify(payload) });
        httpStatus=response.status;requestId=response.headers?.get('x-poa-request-id');
        stage='response';
        if (!response.ok) throw Error('api_http_'+httpStatus);
        const body=await response.json();stage='verify-runtime';let signed;
        try{signed=verifyRuntimeProof(body.runtimeProof,payload,nonce,POA_RUNTIME_TRUST);}
        catch(error){
          if(error?.message!=='minimum_observation_assurance_failed')throw error;
          const observation=verifyRuntimeObservation(body.runtimeProof,payload,nonce,POA_RUNTIME_TRUST);
          validateProof(JSON.parse(JSON.stringify(observation.proof)));transactionPassport(observation.proof,payload);
          await checkObservationEpoch(observation,POA_RUNTIME_TRUST,r=>snap.request(r));
          return {readOnlyObservation:observation};
        }
        let verified=validateProof(JSON.parse(JSON.stringify(signed.proof)));transactionPassport(verified,payload);stage='verify-check';verified.verifiedCheck=verifyCheck(verified.check,verified);stage='persist-epoch';const epochReceipt=await recordEpoch(signed);verified=validateProof(finalizeRuntimeProof(signed,epochReceipt));verified.verifiedCheck=verifyCheck(verified.check,verified);verifiedExpiry=runtimeProofDeadline(signed);verifiedIssuedAt=signed.issuedAt;stage='validate';reviewEligible.add(verified);
        return verified;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), 9000); }),
    ]);
    if(proof.readOnlyObservation){
      const p=proof.readOnlyObservation,observation=p.proof;
      if(Date.now()>=runtimeObservationDeadline(p))throw Error('expired_runtime_proof');
      offerSubjects(observation.chainId,[observation.target]);
      const path=transactionPassport(observation,payload),expiresAt=runtimeObservationDeadline(p);
      const ui=<ObservationPanel proof={observation} path={path} expiresAt={expiresAt}/>;
      if(typeof snap==='undefined'||!snap.request)return {content:ui};
      for(const [key,item]of observationInterfaces)if(Date.now()>=item.expiresAt)observationInterfaces.delete(key);
      if(observationInterfaces.size>=32)observationInterfaces.delete(observationInterfaces.keys().next().value);
      const observationId=requestNonce();
      const id=await snap.request({method:'snap_createInterface',params:{ui,context:{observationId,section:'summary',page:0}}});
      observationInterfaces.set(observationId,{id,p,path,expiresAt,section:'summary',page:0});return {id};
    }
    transactionPassport(proof,payload);
    // Explicit guard (OWNER_DECISIONS 7): no aggregation without a verified, finalized proof.
    if(!reviewEligible.has(proof))throw Error('review_requires_verified_proof');
    stage='render';const review=walletReviewModel(proof,{issuedAt:verifiedIssuedAt});offerSubjects(proof.chainId,[proof.target,...(proof.components??[]).filter(c=>c.codeHash).map(c=>c.context)]);
    const view=walletView(proof);view.securityClosure=proof.securityClosure;view.compact={...view.compact,pilotVerdict:userState(proof.state),weakestLink:weakestLink(proof)};view.check=proof.verifiedCheck;view.runtimeVerified=true;view.review=review;view.internalNodes=proof.internalExecution?.nodes??[];view.internalResolved=proof.internalExecution?.status==='RESOLVED';view.fullFrames=(proof.traceFrames??[]).map(frame=>{const node=view.nodes[proof.components.findIndex(c=>c.address===frame.address&&c.context===frame.context&&c.selector===(frame.input??'0x').slice(0,10))];return {indent:'↳ '.repeat(Math.min(frame.depth,5)),label:node?node.name+' · '+node.functionLabel:frame.depth===0&&['ERC1967','BEACON','ERC1167'].includes(view.routing)?'◇ Proxy entry · '+view.routing:'? Unresolved contract step',callType:frame.type,review:node?node.review+(node.auditor?' by '+node.auditor:''):'Review not confirmed'};});
    const context={view,path:transactionPassport(proof,payload),expanded:false,selected:0,holdersExpanded:false,legendExpanded:false,expiresAt:verifiedExpiry,feedback:null};
    await rememberLastCheck(view.check).catch(()=>{});
    if(Date.now()>=verifiedExpiry){stage='validate';throw Error('expired_runtime_proof');}
    if(typeof snap!=='undefined'&&snap.request)return {id:await snap.request({method:'snap_createInterface',params:{ui:viewPanel(view,context.path,false),context}})};
    return {content:viewPanel(view,context.path,false)};
  } catch(error) {
    const integrityFailure=['verify-runtime','verify-check','persist-epoch','validate'].includes(stage);
    const failure=integrityFailure?{symbol:'?',label:'POA proof could not be authenticated.',detail:'No audit verdict is shown. Request a fresh check.'}:friendlyFailure(error?.message);
    return { content: <Box><Text size="sm" color="muted">PROOF BEFORE SIGN</Text><Heading size="sm">{label(failure.symbol+' '+failure.label)}</Heading><Text>{label(failure.detail)}</Text>{!integrityFailure&&<Text size="sm" color="muted">UNKNOWN · No verdict is shown without verified evidence.</Text>}
    </Box> };
  } finally { if (timer) clearTimeout(timer); }
};

async function updateHome(id,item,notice){item.notice=notice;const ui=await homeUi(item);await snap.request({method:'snap_updateInterface',params:{id,ui,context:{kind:'poa-home'}}});}
// Local settings changes only. Turning alerts ON is the consent and makes no request; turning them OFF opts out once.
async function changeSettings(name){
  return queuedState(async()=>{
    const s=effectiveSettings(await loadSettings(settingsRequest));
    if(name==='poa-settings-resume')return saveSettings(settingsRequest,{pausedAll:false});
    if(s.pausedAll)throw Error('settings_paused');
    if(name==='poa-settings-pause-all')return saveSettings(settingsRequest,{pausedAll:true});
    if(name==='poa-settings-checks')return saveSettings(settingsRequest,{checks:s.checks==='ON'?'PAUSED':'ON'});
    if(name==='poa-settings-alerts'&&monitoringEnabled){
      const next=await saveSettings(settingsRequest,{alerts:s.alerts==='ON'?'OFF':'ON'});
      if(next.alerts==='OFF'){let preferences;try{preferences=monitoringPreferences(await snap.request({method:'snap_manageState',params:{operation:'get'}}));}catch{}if(preferences?.enabled)await disableMonitoring({request:settingsRequest,origin:monitoringOrigin}).catch(()=>{});}
      return next;
    }
    throw Error('settings_action_unavailable');
  });
}
export const onUserInput=async({id,event,context})=>{
  if(event.type==='ButtonClickEvent'&&event.name?.startsWith('poa-settings-')){
    const current=homeInterfaces.get(id)??{page:0};let notice;
    try{await changeSettings(event.name);}catch(error){notice=error?.message==='settings_paused'?'POA is paused. Resume POA first.':error?.message==='settings_action_unavailable'?undefined:'POA settings could not be saved. Nothing was changed.';}
    await updateHome(id,current,notice);return;
  }
  if(monitoringEnabled&&event.type==='ButtonClickEvent'&&event.name?.startsWith('poa-monitor-')){
    const current=homeInterfaces.get(id);if(!current)return;
    let notice,settings;try{settings=await currentSettings();}catch{}
    // No watch, poll or opt-out request unless alerts are ON and POA is not paused.
    if((event.name.startsWith('poa-monitor-watch')||['poa-monitor-disable','poa-monitor-poll'].includes(event.name))&&!alertsActive(settings)){await updateHome(id,current,'Change alerts are off or POA is paused. No POA request was made.');return;}
    try{
      if(/^poa-monitor-watch:[0-4]$/.test(event.name)){const subject=current.offered?.[Number(event.name.slice(18))];if(!subject)throw Error('no offered contract');await queuedState(()=>watchSubject({request:r=>snap.request(r),origin:monitoringOrigin,subject}));notice='Watch enabled. Missing review evidence remains unknown.';}
      else if(event.name==='poa-monitor-disable'){const result=await queuedState(()=>disableMonitoring({request:r=>snap.request(r),origin:monitoringOrigin}));notice=result.serverDisabled?'All change notices disabled.':'Disabled locally; server confirmation pending.';}
      else if(event.name==='poa-monitor-poll'){const result=await queuedState(()=>pollMonitoring({request:r=>snap.request(r),origin:monitoringOrigin}));notice=result.rateLimited?'Please wait before checking again.':'Available notices checked; '+result.notified+' changes notified.';}
      else if(event.name==='poa-monitor-next')current.page++;
      else if(event.name==='poa-monitor-previous')current.page=Math.max(0,current.page-1);else return;
    }catch{notice='Monitoring could not complete. No audit coverage or signing authorization was granted.';}
    await updateHome(id,current,notice);return;
  }
  if(event.type==='ButtonClickEvent'&&event.name?.startsWith('poa-observation-')){
    const item=observationInterfaces.get(context?.observationId);
    if(!item||item.id!==id||Date.now()>=item.expiresAt){await snap.request({method:'snap_updateInterface',params:{id,ui:<Box><Heading>Observation expired or unavailable</Heading><Text>Request a fresh transaction analysis.</Text></Box>,context:null}});return;}
    try{await checkObservationEpoch(item.p,POA_RUNTIME_TRUST,r=>snap.request(r));}catch{observationInterfaces.delete(context.observationId);await snap.request({method:'snap_updateInterface',params:{id,ui:<Box><Heading>Observation could not be verified</Heading><Text>Request a fresh transaction analysis.</Text></Box>,context:null}});return;}
    const next=observationNavigation(item.section,item.page,event.name,item.p.proof);if(!next)return;
    Object.assign(item,next);await snap.request({method:'snap_updateInterface',params:{id,ui:<ObservationPanel proof={item.p.proof} path={item.path} expiresAt={item.expiresAt} section={item.section} page={item.page}/>,context:{observationId:context.observationId,...next}}});return;
  }
  if(event.type!=='ButtonClickEvent'||!(/^(poa-toggle-path|poa-toggle-holders|poa-toggle-legend|poa-feedback-up|poa-feedback-down|poa-node-[0-9]+|poa-review-(calls|evidence|unresolved|activity|history|summary|next|previous))$/.test(event.name??'')))return;
  if(!context||!context.view||!/^\/proof\/transaction\/[0-9a-f-]{36}$/i.test(context.path??'')||Date.now()>=context.expiresAt){await snap.request({method:'snap_updateInterface',params:{id,ui:<Box><Heading>Proof Before Sign</Heading><Text>◷ Proof expired</Text><Text>Request a fresh transaction analysis.</Text></Box>,context:null}});return;}
  // Feedback is a POA request: a stale interface cannot send it while checks or all POA activity are paused.
  const next={...context};if(event.name.startsWith('poa-feedback-')){if(context.feedback)return;let settings;try{settings=await currentSettings();}catch{}next.feedback=!settings||settings.checks==='PAUSED'||settings.pausedAll?'FAILED':await sendFeedback(context.view.check,event.name==='poa-feedback-up'?'UP':'DOWN');}else if(event.name.startsWith('poa-review-')){const review=reviewNavigation(context.view.review,event.name);if(!review)return;next.view={...context.view,review};}else if(event.name==='poa-toggle-path')next.expanded=!context.expanded;else if(event.name==='poa-toggle-legend')next.legendExpanded=!context.legendExpanded;else if(event.name==='poa-toggle-holders')next.holdersExpanded=!context.holdersExpanded;else{const selected=Number(event.name.slice('poa-node-'.length));if(!Number.isInteger(selected)||selected<0||selected>=context.view.nodes.length||selected>=24)return;next.selected=selected;next.holdersExpanded=false;}await snap.request({method:'snap_updateInterface',params:{id,ui:viewPanel(next.view,next.path,next.expanded,next.selected,next.holdersExpanded,next.legendExpanded,next.feedback),context:next}});
};

export const onInstall = async () => {await snap.request({method:'snap_dialog',params:{type:'alert',content:<Box><Heading>Proof Before Sign is ready.</Heading><Text>Use MetaMask normally. POA checks Ethereum mainnet transactions before you sign.</Text><Text>Transaction checks are ON by default. Change alerts are OFF.</Text><Text size="sm">To pause, open Proof Before Sign from the MetaMask Snaps menu and choose Pause transaction checks or Pause all POA activity.</Text><Text size="sm">Missing evidence stays unknown. Review evidence does not guarantee security.</Text></Box>}});};
export const onUpdate = async () => {await snap.request({method:'snap_dialog',params:{type:'alert',content:<Box><Heading>Proof Before Sign updated.</Heading><Text size="sm">{label('Version '+POA_VERSION)}</Text><Text>You can now pause transaction checks or all POA activity from the Proof Before Sign home page.</Text><Text>Transaction checks cover Ethereum mainnet only. Signature and login requests are no longer interrupted by POA.</Text><Text size="sm">Your next check still verifies the signed proof for the exact transaction.</Text></Box>}});};
function SettingsSection({settings}){
 if(!settings)return <Section><Heading size="sm">POA controls</Heading><Text>POA settings unavailable. No POA requests were made.</Text><Text size="sm">To disable POA completely: MetaMask Settings → Snaps → Proof Before Sign → disable.</Text></Section>;
 return <Section><Heading size="sm">POA controls</Heading>
 {settings.pausedAll?<Box><Text fontWeight="bold">POA is paused. No POA requests are made.</Text><Button name="poa-settings-resume">Resume POA</Button></Box>:<Box>
 <Text fontWeight="bold">{settings.checks==='ON'?'Transaction checks: ON':'Transaction checks: PAUSED'}</Text>
 <Button name="poa-settings-checks">{settings.checks==='ON'?'Pause transaction checks':'Resume transaction checks'}</Button>
 <Text size="sm">When paused, POA skips analysis and makes no backend requests. MetaMask signing continues normally.</Text>
 {monitoringEnabled?<Box><Button name="poa-settings-alerts">{settings.alerts==='ON'?'Change alerts: ON':'Change alerts: OFF'}</Button><Text size="sm">{settings.alerts==='ON'?'Select the button to turn change alerts off.':'Select the button to turn change alerts on. Watching a contract later sends that public contract selection to POA.'}</Text></Box>:<Text>Change alerts: unavailable in this build</Text>}
 <Button name="poa-settings-pause-all">Pause all POA activity</Button>
 <Text size="sm">Stops transaction checks, change alerts and all POA network requests until you resume.</Text>
 </Box>}
 <Text size="sm">To disable POA completely: MetaMask Settings → Snaps → Proof Before Sign → disable.</Text>
 </Section>;
}
// Builds the home interface. Reads settings first; nothing is fetched while paused or when settings are unreadable.
async function homeUi(item={page:0}){
 let state,settings,preferences;try{state=await snap.request({method:'snap_manageState',params:{operation:'get'}});settings=effectiveSettings(readSettings(state));}catch{settings=null;}
 const last=state?.lastCheck,paused=!settings||settings.checks==='PAUSED'||settings.pausedAll;
 let connectivity=!settings?'not contacted · settings unavailable':paused?'not contacted while paused':item.runtime??'Unavailable';
 // One config check per home interface while active; re-renders after button clicks reuse it.
 if(!paused&&!item.runtime){try{const r=await Promise.race([fetch(POA_API_URL+'/api/proof/config'),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),3000))]);if(r.ok){const c=await r.json();if(c.runtimeProofConfigured&&c.runtimeSchema==='poa-runtime-v1')connectivity='Reachable · signed Runtime v1';}}catch{connectivity='Unavailable';}item.runtime=connectivity;}
 const alerts=alertsActive(settings);if(alerts){item.offered=offeredSubjects.slice();try{preferences=monitoringPreferences(state);}catch{item.notice=item.notice??'Monitoring preferences are unavailable.';}}
 item.page=Math.min(item.page??0,Math.max(0,Math.ceil((preferences?.history?.length??0)/5)-1));
 const lastState=last?(last.verdict==='VERIFIED_MATCH'?'VERIFIED':last.verdict==='DRIFT'?'CHANGED':['PARTIAL','EXECUTION_PATH_WARNING','REVIEW_WARNING'].includes(last.verdict)?'PARTIAL':'NOT VERIFIED'):null;
 return <Box><Heading>Proof Before Sign</Heading><Text>Use MetaMask normally. POA checks supported transactions before you sign.</Text><Row label="Version"><Text>{label(POA_VERSION)}</Text></Row><Text size="sm">{label('Runtime: '+connectivity)}</Text><Text size="sm" color="muted">Connectivity is not a verified transaction result.</Text>
 <SettingsSection settings={settings}/>
 {item.notice&&!alerts&&<Text>{label(item.notice)}</Text>}
 {last?<Section><Heading size="sm">Last check on this device</Heading><Text>{label(last.protocol??'Protocol not identified')}</Text><Text>{label(lastState??'NOT VERIFIED')}</Text><Text size="sm">{label(last.at)} · historical result</Text></Section>:<Text>No check on this device yet.</Text>}
 <Section><Heading size="sm">Results</Heading>{['VERIFIED','PARTIAL','CHANGED','NOT VERIFIED'].map(s=><Text>{s}</Text>)}</Section>
 <Text size="sm">When checks are ON, the proposed Ethereum mainnet transaction is sent to POA for analysis. Nothing is sent while paused. POA does not store wallet history. This device keeps a minimal last-check summary. Missing evidence stays unknown.</Text>
 {alerts&&<MonitoringHome preferences={preferences} offered={item.offered} notice={item.notice} page={item.page}/>}
 <Link href={POA_PASSPORT_URL}>Open Proof of Audits →</Link><Link href={POA_PASSPORT_URL+'/protocols'}>Explore protocol evidence →</Link><Link href={POA_PASSPORT_URL+'/methodology'}>Methodology →</Link><Link href={POA_PASSPORT_URL+'/privacy'}>Privacy →</Link></Box>;
}
export const onHomePage = async () => {
 const item={page:0},ui=await homeUi(item);
 const id=await snap.request({method:'snap_createInterface',params:{ui,context:{kind:'poa-home'}}});
 if(homeInterfaces.size>=8)homeInterfaces.delete(homeInterfaces.keys().next().value);homeInterfaces.set(id,item);return {id};
};

// Permissioned scheduled polling; nothing is fetched or notified before opt-in.
// The lock check stays first so encrypted state (including settings) is never read while MetaMask is locked.
export const onCronjob=async({request}={})=>{if(!monitoringEnabled||request?.method!=='poa_pollAlerts')return;try{const client=await snap.request({method:'snap_getClientStatus'});if(client?.locked!==false)return {notified:0,status:'LOCKED'};let settings;try{settings=await currentSettings();}catch{return {notified:0,status:'SETTINGS_UNAVAILABLE'};}if(settings.pausedAll)return {notified:0,status:'PAUSED'};if(settings.alerts!=='ON')return {notified:0,status:'ALERTS_OFF'};return await queuedState(()=>pollMonitoring({request:r=>snap.request(r),origin:monitoringOrigin}));}catch{return {notified:0,status:'UNAVAILABLE'};}};
