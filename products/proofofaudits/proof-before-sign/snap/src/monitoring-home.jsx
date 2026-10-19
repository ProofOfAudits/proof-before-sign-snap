import {Box,Heading,Text,Button,Row} from '@metamask/snaps-sdk/jsx';import {safeText} from './validate.mjs';
const text=v=>safeText(v);
const impactLine=a=>a.reviewImpact==='REVIEWED_BASELINE_AFFECTED'?'A released review baseline covered the changed contract; that review no longer establishes its current code or routing.':a.impact==='POTENTIAL_DEPENDENCY'?'Previously observed dependency; current exposure and review impact not established.':'A watched subject changed; review impact is not established.';
// offered: in-memory subjects from transactions verified in this session. Nothing is watched until the user selects Watch.
export function MonitoringHome({preferences,offered=[],notice,page=0}){
 const history=preferences?.history??[],pages=Math.max(1,Math.ceil(history.length/5)),watching=s=>(preferences?.watches??[]).some(w=>w.chainId===s.chainId&&w.address===s.address);
 return <Box><Heading size="sm">Watch contracts</Heading>
 <Text>{preferences?.enabled?'Change notices enabled on this device.':'Change notices are off.'}</Text>
 <Text size="sm">POA checks for notices about every 15 minutes, only while MetaMask is open and unlocked. Nothing is delivered while MetaMask is closed or locked; changes found in that time appear in the history below at the next check. This is polling, not instant push. Notices do not establish audit coverage or current asset exposure.</Text>
 <Heading size="sm">Offered for monitoring (opt-in)</Heading>
 {offered.length?<Box><Text size="sm">Contracts from transactions POA verified on this device in this session. Nothing is watched or sent until you select Watch. Watching sends that public contract address and a random device capability to POA, never your wallet address or transaction data.</Text>
 {offered.map((s,i)=><Box><Text size="sm">{text('Chain '+s.chainId+' · '+s.address)}</Text>{watching(s)?<Text size="sm">Watching</Text>:<Button name={'poa-monitor-watch:'+i}>Watch</Button>}</Box>)}</Box>:<Text>Check a transaction to see contracts offered for watching.</Text>}
 {(preferences?.watches??[]).map(w=><Row label={'Chain '+w.chainId}><Text>{text(w.address)}</Text></Row>)}
 {preferences&&<Box><Button name="poa-monitor-poll">Check notices now</Button><Button name="poa-monitor-disable">Disable all notices</Button></Box>}
 {preferences?.serverDisablePending&&<Text>Notices are disabled locally. Server opt-out confirmation is pending and will be retried.</Text>}
 {notice&&<Text>{text(notice)}</Text>}
 <Heading size="sm">{text('Change history · page '+(page+1)+' of '+pages)}</Heading>
 {!history.length&&<Text>No delivered change notices recorded on this device.</Text>}
 {history.slice().reverse().slice(page*5,page*5+5).map(a=><Box><Text>{text(a.kind.replaceAll('_',' '))}</Text><Text size="sm">{text('Chain '+a.chainId+' · watched '+a.watchedAddress)}</Text><Text size="sm">{text('First observed at block '+a.firstObservedBlock+' · '+a.firstObservedAt)}</Text><Text size="sm">{impactLine(a)}</Text></Box>)}
 {page>0&&<Button name="poa-monitor-previous">Previous notices</Button>}{page+1<pages&&<Button name="poa-monitor-next">Next notices</Button>}
 </Box>;
}
