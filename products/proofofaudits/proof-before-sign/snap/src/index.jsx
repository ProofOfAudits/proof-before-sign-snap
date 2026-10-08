import {userState,weakestLink} from '../../web/runtime-contract.mjs';
import {walletTransaction} from '../../web/transaction-context.mjs';
import { Box, Section, Heading, Text, Divider, Link, Button, Row } from '@metamask/snaps-sdk/jsx';
import { validateProof, transactionPassport, safeText } from './validate.mjs';
import {verifyRuntimeProof,acceptEpoch,commitment} from './runtime-proof.mjs';
import {WalletPath,WalletInspector,WalletHolders,WalletLegend} from './wallet-visuals.jsx';
import {visualModel} from '../../web/visual-model.mjs';
import { evidenceView,compactWalletSummary } from '../../web/evidence-view.mjs';
import {sinceReviewView} from '../../web/since-review.mjs';
import {verifyCheck,feedbackEvent} from '../../web/check-contract.mjs';
import {checkRows,hopLine,verdictCopy,friendlyFailure} from '../../web/check-view.mjs';

const label = value => safeText(value);
let stateQueue=Promise.resolve();
async function recordEpoch(p){const update=stateQueue.then(async()=>{if(typeof snap==='undefined'||!snap.request)throw Error('persistent_state_unavailable');const previous=await snap.request({method:'snap_manageState',params:{operation:'get'}});const state=acceptEpoch(previous,p,POA_RUNTIME_TRUST.trustDomain);await snap.request({method:'snap_manageState',params:{operation:'update',newState:state}});});stateQueue=update.catch(()=>{});await update;}
// Only {checkId, verdict, functionClass, reaction}: no wallet address or calldata.
async function sendFeedback(check,reaction){try{const body=feedbackEvent({checkId:check?.checkId,verdict:check?.verdict?.state,functionClass:check?.transaction?.functionClass,reaction});const response=await fetch(POA_API_URL+'/api/proof/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return response.ok?'SENT':'FAILED';}catch{return 'FAILED';}}
// Home page summary of the last check on this device. Public facts only.
async function rememberLastCheck(check){if(typeof snap==='undefined'||!snap.request||!check)return;const update=stateQueue.then(async()=>{const previous=await snap.request({method:'snap_manageState',params:{operation:'get'}})??{};await snap.request({method:'snap_manageState',params:{operation:'update',newState:{...previous,lastCheck:{protocol:check.protocol.name,title:check.transaction.title,signature:check.transaction.decoded?.signature??null,verdict:check.verdict.state,hops:check.review.hops,hopsReviewed:check.review.hopsReviewed,at:new Date().toISOString()}}}});});stateQueue=update.catch(()=>{});await update;}
function requestNonce(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function walletView(proof){const view=evidenceView(proof);view.nodes=visualModel(proof).nodes;view.routing=proof.resolution?.proxy;view.compact=compactWalletSummary(proof);view.sinceReview=sinceReviewView(proof.sinceReview);return view;}
export function proofPanel(proof) {const view=walletView(proof);view.compact={...view.compact,pilotVerdict:userState(proof.state),weakestLink:weakestLink(proof)};view.check=verifyCheck(proof.check,proof);return viewPanel(view,transactionPassport(proof,proof.transaction),false);}
function CheckSummary({check,compact,expanded}){
  const v=verdictCopy[check.verdict.state]??verdictCopy.UNKNOWN,r=checkRows(check);
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
function viewPanel(view,path,expanded,selected=0,holdersExpanded=false,legendExpanded=false,feedback=null) {
  const selectedNode=view.nodes[selected];const selectedView={...view,holders:view.holders.filter(h=>h.component===selectedNode?.name&&h.controller===selectedNode?.control.controller)};
  return <Box>
    <Text size="sm" color="muted">PROOF BEFORE SIGN</Text>
    <CheckSummary check={view.check} compact={view.compact} expanded={expanded}/>
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
    <WalletHolders view={selectedView} expanded={holdersExpanded} path={path}/>
    </Box>}
    {expanded&&<Box><Heading>Full execution path</Heading>
      <Text size="sm" color="muted">{view.pathConfirmed?'Observed external contract calls for this transaction.':'Complete runtime path not established.'}</Text>
      {(view.fullFrames??[]).map(frame=><Box><Text fontWeight="medium">{label(frame.indent+frame.label)}</Text><Text size="sm" color="muted">{label(frame.callType+' · '+frame.review)}</Text></Box>)}
      {(view.internalNodes??[]).map(node=><Box><Text fontWeight="medium">{label('↳ internal · '+node.functionName+'()')}</Text><Text size="sm" color="muted">{label(node.currentMatch==='MATCH'?'✓ Covered by reviewed code revision · '+node.auditor:'? Internal function review not confirmed')}</Text></Box>)}
      <Text size="sm" color="muted">{view.internalResolved?'Internal entries established from runtime instructions and reproduced source maps.':'Internal function execution is not established completely. Source-only reachable functions are not shown as executed.'}</Text>
    </Box>}
    <WalletLegend expanded={legendExpanded}/>
    <Feedback feedback={feedback}/>
    <Link href={POA_PASSPORT_URL+path}>View exact proof →</Link>
    {view.runtimeVerified&&<Text size="sm" color="muted">Proof verified ✓ · exact transaction · fresh when checked</Text>}
    <Text size="sm" color="muted">Review evidence does not guarantee security.</Text>
  </Box>;
}

export const onTransaction = async ({ transaction, chainId }) => {
  let timer, stage='normalize', httpStatus, requestId,verifiedExpiry;
  try {
    if (!/^eip155:[1-9][0-9]*$/.test(chainId)) throw Error('unsupported_chain');
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
        const body=await response.json();stage='verify-runtime';const signed=verifyRuntimeProof(body.runtimeProof,payload,nonce,POA_RUNTIME_TRUST);const verified=validateProof(signed.proof);transactionPassport(verified,payload);stage='verify-check';verified.verifiedCheck=verifyCheck(verified.check,verified);stage='persist-epoch';await recordEpoch(signed);verifiedExpiry=Date.parse(signed.expiresAt);stage='validate';
        return verified;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), 9000); }),
    ]);
    transactionPassport(proof,payload);
    stage='render';
    const view=walletView(proof);view.compact={...view.compact,pilotVerdict:userState(proof.state),weakestLink:weakestLink(proof)};view.check=proof.verifiedCheck;view.runtimeVerified=true;view.internalNodes=proof.internalExecution?.nodes??[];view.internalResolved=proof.internalExecution?.status==='RESOLVED';view.fullFrames=(proof.traceFrames??[]).map(frame=>{const node=view.nodes[proof.components.findIndex(c=>c.address===frame.address&&c.context===frame.context&&c.selector===(frame.input??'0x').slice(0,10))];return {indent:'↳ '.repeat(Math.min(frame.depth,5)),label:node?node.name+' · '+node.functionLabel:frame.depth===0&&['ERC1967','BEACON','ERC1167'].includes(view.routing)?'◇ Proxy entry · '+view.routing:'? Unresolved contract step',callType:frame.type,review:node?node.review+(node.auditor?' by '+node.auditor:''):'Review not confirmed'};});
    const context={view,path:transactionPassport(proof,payload),expanded:false,selected:0,holdersExpanded:false,legendExpanded:false,expiresAt:verifiedExpiry,feedback:null};
    await rememberLastCheck(view.check).catch(()=>{});
    if(typeof snap!=='undefined'&&snap.request)return {id:await snap.request({method:'snap_createInterface',params:{ui:viewPanel(view,context.path,false),context}})};
    return {content:viewPanel(view,context.path,false)};
  } catch(error) {
    const integrityFailure=['verify-runtime','verify-check','persist-epoch','validate'].includes(stage);
    const failure=integrityFailure?{symbol:'?',label:'POA proof could not be authenticated.',detail:'No audit verdict is shown. Request a fresh check.'}:friendlyFailure(error?.message);
    return { content: <Box><Text size="sm" color="muted">PROOF BEFORE SIGN</Text><Heading size="sm">{label(failure.symbol+' '+failure.label)}</Heading><Text>{label(failure.detail)}</Text>{!integrityFailure&&<Text size="sm" color="muted">UNKNOWN · No verdict is shown without verified evidence.</Text>}
    </Box> };
  } finally { if (timer) clearTimeout(timer); }
};

export const onUserInput=async({id,event,context})=>{
  if(event.type!=='ButtonClickEvent'||!(/^(poa-toggle-path|poa-toggle-holders|poa-toggle-legend|poa-feedback-up|poa-feedback-down|poa-node-[0-9]+)$/.test(event.name??'')))return;
  if(!context||!context.view||!/^\/proof\/transaction\/[0-9a-f-]{36}$/i.test(context.path??'')||Date.now()>=context.expiresAt){await snap.request({method:'snap_updateInterface',params:{id,ui:<Box><Heading>Proof Before Sign</Heading><Text>◷ Proof expired</Text><Text>Request a fresh transaction analysis.</Text></Box>,context:null}});return;}
  const next={...context};if(event.name.startsWith('poa-feedback-')){if(context.feedback)return;next.feedback=await sendFeedback(context.view.check,event.name==='poa-feedback-up'?'UP':'DOWN');}else if(event.name==='poa-toggle-path')next.expanded=!context.expanded;else if(event.name==='poa-toggle-legend')next.legendExpanded=!context.legendExpanded;else if(event.name==='poa-toggle-holders')next.holdersExpanded=!context.holdersExpanded;else{const selected=Number(event.name.slice('poa-node-'.length));if(!Number.isInteger(selected)||selected<0||selected>=context.view.nodes.length||selected>=24)return;next.selected=selected;next.holdersExpanded=false;}await snap.request({method:'snap_updateInterface',params:{id,ui:viewPanel(next.view,next.path,next.expanded,next.selected,next.holdersExpanded,next.legendExpanded,next.feedback),context:next}});
};

export const onInstall = async () => {await snap.request({method:'snap_dialog',params:{type:'alert',content:<Box><Heading>Proof Before Sign is ready.</Heading><Text>Use MetaMask normally. POA checks supported transactions before you sign.</Text><Text size="sm">Missing evidence stays unknown. Review evidence does not guarantee security.</Text></Box>}});};
export const onUpdate = async () => {await snap.request({method:'snap_dialog',params:{type:'alert',content:<Box><Heading>Proof Before Sign updated.</Heading><Text>A clearer transaction summary, runtime status, and links to released protocol evidence are now available.</Text><Text size="sm">Your next check still verifies the signed proof for the exact transaction.</Text></Box>}});};
export const onHomePage = async () => {
 let last;try{const state=await snap.request({method:'snap_manageState',params:{operation:'get'}});last=state?.lastCheck;}catch{last=null;}
 let connectivity='Unavailable';try{const r=await Promise.race([fetch(POA_API_URL+'/api/proof/config'),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),3000))]);if(r.ok){const c=await r.json();if(c.runtimeProofConfigured&&c.runtimeSchema==='poa-runtime-v1')connectivity='Reachable · signed Runtime v1';}}catch{connectivity='Unavailable';}
 const lastState=last?(last.verdict==='VERIFIED_MATCH'?'VERIFIED':last.verdict==='DRIFT'?'CHANGED':['PARTIAL','EXECUTION_PATH_WARNING','REVIEW_WARNING'].includes(last.verdict)?'PARTIAL':'NOT VERIFIED'):null;
 return {content:<Box><Heading>Proof Before Sign</Heading><Text>Use MetaMask normally. POA checks supported transactions before you sign.</Text><Row label="Version"><Text>{label(POA_VERSION)}</Text></Row><Row label="Runtime"><Text>{label(connectivity)}</Text></Row><Text size="sm" color="muted">Connectivity is not a verified transaction result.</Text>
 {last?<Section><Heading size="sm">Last check on this device</Heading><Text>{label(last.protocol??'Protocol not identified')}</Text><Text>{label(lastState??'NOT VERIFIED')}</Text><Text size="sm">{label(last.at)} · historical result</Text></Section>:<Text>No check on this device yet.</Text>}
 <Section><Heading size="sm">Results</Heading>{['VERIFIED','PARTIAL','CHANGED','NOT VERIFIED'].map(s=><Text>{s}</Text>)}</Section>
 <Text size="sm">The proposed transaction is sent to POA for analysis. POA does not store wallet history. This device keeps a minimal last-check summary. Missing evidence stays unknown.</Text>
 <Link href={POA_PASSPORT_URL}>Open Proof of Audits →</Link><Link href={POA_PASSPORT_URL+'/protocols'}>Explore protocol evidence →</Link><Link href={POA_PASSPORT_URL+'/methodology'}>Methodology →</Link><Link href={POA_PASSPORT_URL+'/privacy'}>Privacy →</Link></Box>};
};
