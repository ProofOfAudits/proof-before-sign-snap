import {Box,Heading,Text,Button,Row,Link} from '@metamask/snaps-sdk/jsx';
import {coverageDimensions} from '../../web/coverage-dimensions.mjs';
import {safeText} from './validate.mjs';
const text=value=>safeText(value),sections=['summary','calls','coverage','controls','changes','gaps','internal','potential'];
const coverage=c=>c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?'Explicitly excluded':c.state==='VERIFIED'?'Approved component scope matches':c.state==='CHANGED'?'Changed since review':'No sufficient review evidence';
export function observationRows(proof,section){
 if(section==='calls')return (proof.traceFrames??[]).map((f,i)=>({title:'Call '+(i+1)+' · depth '+f.depth+' · '+f.type,lines:['Executing code: '+f.address,'Storage context: '+f.context,'Selector: '+String(f.input??'0x').slice(0,10),f.success?'Observed successful frame':'Failed or unresolved frame']}));
 if(section==='coverage')return proof.components.map(c=>{const snapshot=c.snapshot??c.previousReview;return {title:(c.name??c.address)+' · '+(c.signature??c.selector),lines:[coverage(c),c.reason,'Code: '+c.address,'Storage context: '+c.context,'Current runtime: '+(c.codeHash??'Not established'),...(snapshot?['Auditor: '+snapshot.auditor,'Report: '+snapshot.report,'Reviewed commit: '+snapshot.commit,'Audit date: '+snapshot.auditDate,'Reviewed repository: '+snapshot.repository,'Scope citation: '+(snapshot.functions?.find(f=>f.selector===c.selector)?.scopeCitation??'Not established'),'Review decision: '+snapshot.at,'Reviewed runtime: '+snapshot.runtimeHash,'Reviewer: '+snapshot.reviewer,'Review evidence: '+snapshot.id]:['Approved review evidence: not established'])]};});
 if(section==='controls')return [...(proof.controlGraph?.edges??[]).map(e=>({title:e.capability??e.kind??'Observed control relationship',lines:['From: '+e.from,'To: '+e.to,'Status: '+e.status]})),...(proof.authority?[{title:'Observed authority',lines:[JSON.stringify(proof.authority),'Authority observations do not establish every permission or a vulnerability.']}]:[])];
 if(section==='changes')return (proof.sinceReview?.relevantChanges??[]).map(c=>({title:c.kind,lines:['Dimension: '+c.dimension,'First observed: '+c.firstObservedAt,'Time quality: '+c.timeQuality,'Exact activation time is established only with supporting evidence.']}));
 if(section==='gaps')return [...proof.reasons,...(proof.policy?.observationAssurance?.failedRequirements??[])].map(reason=>({title:'Not established',lines:[reason]}));
 if(section==='internal')return (proof.internalExecution?.nodes??[]).map(n=>({title:n.functionName,lines:['Attribution: '+n.assuranceLevel,...(n.mappingMethod==='SOLC_FUNCTION_DEBUG_ENTRY'?['Observed non-inlined compiler debug entry. Inlined execution remains unknown.']:[]),'Source region: '+n.sourceFile+':'+n.sourceStart+':'+n.sourceLength,'Review: '+n.coverageLevel]}));
 if(section==='potential')return (proof.staticRelationships??[]).map(e=>({title:'Potential dependency · not an observed call',lines:[JSON.stringify(e)]}));
 return [];
}
export function observationNavigation(section,page,event,proof){
 if(typeof event!=='string')return null;
 if(event.startsWith('poa-observation-section-')){const next=event.slice('poa-observation-section-'.length);return sections.includes(next)?{section:next,page:0}:null;}
 const maximum=Math.max(0,Math.ceil(observationRows(proof,section).length/4)-1);
 if(event==='poa-observation-next')return {section,page:Math.min(maximum,page+1)};
 if(event==='poa-observation-previous')return {section,page:Math.max(0,page-1)};
 return null;
}
export function ObservationPanel({proof,path,expiresAt,section='summary',page=0}){
 const dimensions=coverageDimensions(proof),counts=dimensions.counts,rows=observationRows(proof,section),pages=Math.max(1,Math.ceil(rows.length/4));
 return <Box><Text size="sm">PROOF BEFORE SIGN</Text><Heading size="sm">? NOT VERIFIED</Heading>
 <Text>The server signature and this transaction match. Complete audit coverage could not be established.</Text>
 <Text>{text(proof.decoded?.signature??proof.function??'Action not decoded')}</Text>
 <Text size="sm">{text('Chain '+proof.chainId+' · '+proof.target)}</Text>
 <Text size="sm">{text('Checked block '+(proof.block?.number??'not established')+' · '+(proof.block?.hash??'hash unavailable'))}</Text>
 <Text size="sm">{text('This observation expires '+new Date(expiresAt).toISOString()+'. Later chain changes can affect it.')}</Text>
 <Row label="Reviewed components"><Text>{text(proof.covered+' of '+proof.total)}</Text></Row>
 <Row label="Changed since review"><Text>{text(counts.changedSinceReview)}</Text></Row>
 <Row label="No confirmed coverage"><Text>{text(counts.unknown)}</Text></Row>
 <Row label="Explicitly excluded"><Text>{text(counts.excluded)}</Text></Row>
 <Row label="Unresolved component labels"><Text>{text(counts.unresolved)}</Text></Row>
 <Row label="Observed call frames"><Text>{text(counts.observedCallFrames??'Not established')}</Text></Row>
 <Text size="sm">Counts distinguish component scope from repeated EVM call frames. A majority never establishes complete coverage.</Text>
 {section==='summary'&&<Box>
 <Text>{proof.traceComplete?'An observed call trace is available. Relevant dependency resolution remains incomplete.':'Complete observed execution was not established.'}</Text>
 <Text>{text('Routing: '+(proof.resolution?.proxy??'Unresolved'))}</Text>{proof.resolution?.routingObservation&&<Text size="sm">{text('Observed pattern: '+proof.resolution.routingObservation.adapter+' · '+proof.resolution.routingObservation.limitations.join(' · '))}</Text>}
 <Text>{text('Review gaps: '+proof.reasons.join(' · '))}</Text>
 <Text>{proof.components.some(c=>c.state==='CHANGED')?'Executing code differs from an approved reviewed version. Inspect coverage details.':'No reviewed-code change is established by this summary; missing review evidence remains unknown.'}</Text>
 <Text>{proof.controlGraph?.edges?.length?'Control relationships are available below. Active upgrade authority is not itself a vulnerability.':'Relevant control authority is not fully established.'}</Text>
 </Box>}
 <Box>{sections.map(name=><Button name={'poa-observation-section-'+name} size="sm">{text(name==='calls'?'Observed calls':name==='coverage'?'Review evidence':name==='potential'?'Potential dependencies':name==='gaps'?'All review gaps':name==='internal'?'Internal attribution':name)}</Button>)}</Box>
 {section!=='summary'&&<Box><Heading size="sm">{text(section+' · page '+(page+1)+' of '+pages)}</Heading>
 {!rows.length&&<Text>No established entries for this view. Absence does not establish complete coverage or unchanged history.</Text>}
 {rows.slice(page*4,page*4+4).map(row=><Box><Text fontWeight="bold">{text(row.title)}</Text>{row.lines.map(line=><Text size="sm">{text(line)}</Text>)}</Box>)}
 {page>0&&<Button name="poa-observation-previous">Previous</Button>}{page+1<pages&&<Button name="poa-observation-next">Next</Button>}
 </Box>}
 <Text size="sm">No verified audit verdict or signing authorization is granted. POA does not guarantee transaction safety.</Text>
 <Link href={POA_PASSPORT_URL+path}>View proof →</Link></Box>;
}
