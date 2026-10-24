import {executionAssurance} from '../../web/execution-assurance.mjs';
import {Box,Heading,Text,Button,Row,Link} from '@metamask/snaps-sdk/jsx';
import {callInstanceCoverage} from '../../web/call-instance-coverage.mjs';
import {reviewCoverage} from '../../web/review-coverage.mjs';
import {safeText} from './validate.mjs';
const text=value=>safeText(value),sections=['summary','calls','coverage','controls','changes','gaps','internal','potential'];
const coverage=c=>c.coverageLevel==='EXPLICITLY_OUT_OF_SCOPE'?'Explicitly excluded':c.state==='VERIFIED'?'Approved component scope matches':c.state==='CHANGED'?'Changed since review':'No sufficient review evidence';
export function observationRows(proof,section){
 if(section==='calls')return callInstanceCoverage(proof).instances.map(instance=>{const f=proof.traceFrames[instance.index],c=instance.componentIndex===null?undefined:proof.components[instance.componentIndex];return {title:'Call '+(instance.index+1)+' · depth '+f.depth+' · '+f.type,lines:[instance.category+' · '+(c?.signature??String(f.input??'0x').slice(0,10)),'Executing code: '+f.address,'Storage context: '+f.context,'Selector: '+String(f.input??'0x').slice(0,10),f.success?'Observed successful frame':'Failed or unresolved frame',...((proof.executionRegions?.frames??[]).filter(r=>r.frameIndex===instance.index).flatMap(r=>['Executed instructions: '+r.observedSteps+' · '+r.coveredSteps+' within scope · '+r.excludedSteps+' excluded · '+r.unknownSteps+' unknown',...(r.evidence?['Region evidence: '+r.evidence.auditor+' · '+r.evidence.report]:[]),...(r.reason?['Region gap: '+r.reason]:[])])),...(c?.snapshot?.auditor?['Review attribution: '+c.snapshot.auditor]:[]),...(!instance.reviewEligible?['No contract code: not an audit-review subject.']:[])]};});
 if(section==='coverage')return proof.components.map(c=>{const snapshot=c.snapshot??c.previousReview;return {title:(c.name??c.address)+' · '+(c.signature??c.selector),lines:[coverage(c),c.reason,'Code: '+c.address,'Storage context: '+c.context,'Current runtime: '+(c.codeHash??'Not established'),...(snapshot?['Auditor: '+snapshot.auditor,'Report: '+snapshot.report,'Reviewed commit: '+snapshot.commit,'Audit date: '+snapshot.auditDate,'Reviewed repository: '+snapshot.repository,'Scope citation: '+(snapshot.functions?.find(f=>f.selector===c.selector)?.scopeCitation??'Not established'),'Review decision: '+snapshot.at,'Reviewed runtime: '+snapshot.runtimeHash,'Reviewer: '+snapshot.reviewer,'Review evidence: '+snapshot.id]:['Approved review evidence: not established'])]};});
 if(section==='controls')return [...(proof.controlGraph?.edges??[]).map(e=>({title:e.capability??e.kind??'Observed control relationship',lines:['From: '+e.from,'To: '+e.to,'Status: '+e.status]})),...(proof.authority?[{title:'Observed authority',lines:[JSON.stringify(proof.authority),'Authority observations do not establish every permission or a vulnerability.']}]:[])];
 if(section==='changes')return (proof.sinceReview?.relevantChanges??[]).map(c=>({title:c.kind,lines:['Dimension: '+c.dimension,'First observed: '+c.firstObservedAt,'Time quality: '+c.timeQuality,'Exact activation time is established only with supporting evidence.']}));
 if(section==='gaps')return [...proof.reasons,...(proof.policy?.observationAssurance?.failedRequirements??[])].map(reason=>({title:'Not established',lines:[reason]}));
 if(section==='internal')return [{title:'Instruction attribution',lines:[...((proof.internalExecution?.instructionAccounting)?['Source-mapped steps: '+proof.internalExecution.instructionAccounting.sourceMappedSteps+' of '+proof.internalExecution.instructionAccounting.observedSteps,'Unresolved steps: '+proof.internalExecution.instructionAccounting.unresolvedSteps]:['Instruction counts unavailable']),'Source attribution does not establish audit coverage.']},...(proof.internalExecution?.nodes??[]).map(n=>({title:n.functionName,lines:['Attribution: '+n.assuranceLevel,...(n.mappingMethod==='SOLC_FUNCTION_DEBUG_ENTRY'?['Observed non-inlined compiler debug entry. Inlined execution remains unknown.']:[]),'Source region: '+n.sourceFile+':'+n.sourceStart+':'+n.sourceLength,'Review: '+n.coverageLevel]}))];
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
 const assurance=executionAssurance(proof),calls=callInstanceCoverage(proof),components=reviewCoverage(proof).counts,available=calls.analysisStatus!=='UNAVAILABLE',rows=observationRows(proof,section),pages=Math.max(1,Math.ceil(rows.length/4));
 return <Box><Text size="sm">PROOF BEFORE SIGN</Text>
 {!!proof.simulationConditions&&<Box><Heading size="sm">DIAGNOSTIC SIMULATION</Heading><Text>Temporary sender balance: 10 ETH. No ETH was transferred. This is hypothetical execution, not the account’s actual on-chain state.</Text><Text size="sm">Original transaction fields and reference block are unchanged. This does not establish ordinary production acceptance.</Text></Box>}
 <Heading size="sm">? NOT VERIFIED</Heading>
 <Text>The server signature and this transaction match. Complete audit coverage could not be established.</Text>
 <Text>{text(proof.decoded?.signature??proof.function??'Action not decoded')}</Text>
 <Text size="sm">{text('Chain '+proof.chainId+' · '+proof.target)}</Text>
 <Text size="sm">{text('Checked block '+(proof.block?.number??'not established')+' · '+(proof.block?.hash??'hash unavailable'))}</Text>
 <Text size="sm">{text('This observation expires '+new Date(expiresAt).toISOString()+'. Later chain changes can affect it.')}</Text>
 <Row label="Identified call instances"><Text>{text(available?calls.counts.total:'Not established')}</Text></Row>
 {available&&<Box>
 <Row label="Covered calls"><Text>{text(calls.counts.covered)}</Text></Row>
 <Row label="Changed calls"><Text>{text(calls.counts.changed)}</Text></Row>
 <Row label="Uncovered calls"><Text>{text(calls.counts.uncovered)}</Text></Row>
 <Row label="Unknown calls"><Text>{text(calls.counts.unknown)}</Text></Row>
 <Text size="sm">{text(calls.uniqueFunctions+' identified functions · '+calls.uniqueContracts+' identified contracts')}</Text>
 <Text size="sm">Repeated EVM calls are counted separately. Internal Solidity functions are not inferred from call frames.</Text>
 {!!calls.nonContractFrames&&<Text size="sm">{text(calls.nonContractFrames+' frames have no contract code and are not audit-review subjects. They are included in Unknown, not Covered.')}</Text>}
 {!!calls.unreturnedFrames&&<Text>{text(calls.unreturnedFrames+' additional frames were not returned. Category counts cover only the returned frames.')}</Text>}
 </Box>}
 {!available&&<Text>Execution was not observed. Call counts are unknown, not zero.</Text>}
 <Row label="Execution analysis"><Text>{text(calls.analysisStatus)}</Text></Row>
 <Row label="Instruction audit coverage"><Text>{text(assurance.instructionAuditCoverage==='ESTABLISHED'?'Observed instructions within established scope':assurance.instructionAuditCoverage==='PARTIAL'?'Partial':'Not established')}</Text></Row>
 {!!assurance.instructionCoverage&&<Text size="sm">{text(assurance.instructionCoverage.covered+' within scope · '+assurance.instructionCoverage.excluded+' excluded · '+assurance.instructionCoverage.unknown+' unknown instruction occurrences')}</Text>}
 <Row label="Integration review"><Text>{text(assurance.integrationReview==='ESTABLISHED'?'Observed call edges within established scope':assurance.integrationReview==='PARTIAL'?'Partial':'Not established')}</Text></Row>
 <Row label="Reviewed components"><Text>{text(components.covered+' of '+components.assessedComponents)}</Text></Row>
 <Text size="sm">{text('Component scope: '+components.changed+' changed · '+components.excluded+' explicitly excluded · '+components.unknown+' unknown · '+components.unresolved+' unresolved steps. Component counts are separate from repeated calls.')}</Text>
 <Text size="sm">Coverage is review evidence, not a probability of safety. One material gap can prevent a complete verdict.</Text>
 {!!proof.reasons?.includes('simulation_insufficient_native_balance')&&<Text>The trace provider could not simulate this fee-bearing transaction because the sender lacks sufficient native balance. POA did not add funds or alter the transaction.</Text>}
 {section==='summary'&&<Box>
 <Text>{proof.traceComplete?'An observed call trace is available. Relevant dependency resolution remains incomplete.':'Complete observed execution was not established.'}</Text>
 <Text>{text('Routing: '+(proof.resolution?.proxy??'Unresolved'))}</Text>{!!proof.resolution?.routingObservation&&<Text size="sm">{text('Observed pattern: '+proof.resolution.routingObservation.adapter+' · '+proof.resolution.routingObservation.limitations.join(' · '))}</Text>}
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
 {!proof.simulationConditions&&<Link href={POA_PASSPORT_URL+path}>View proof →</Link>}</Box>;
}
