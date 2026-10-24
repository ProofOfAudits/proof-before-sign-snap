import {Box,Section,Heading,Text,Button,Row,Link} from '@metamask/snaps-sdk/jsx';
import {safeText} from './validate.mjs';
// Verdict-first review panel. Renders a walletReviewModel built from the
// verified, finalized proof only; navigation re-pages the stored model.
const text=value=>safeText(value);
const verdictColor={FULLY_REVIEW_COVERED:'success',PARTIALLY_REVIEW_COVERED:'warning',NOT_REVIEW_COVERED:'error',UNKNOWN:'warning',INCOMPLETE:'warning'};
const sectionNames={calls:'Calls',evidence:'Evidence',unresolved:'Unresolved',activity:'24h activity',history:'History'};
const sectionTitles={calls:'Observed calls',evidence:'Per-call audit evidence',unresolved:'Unresolved paths',activity:'24h activity (indexed only)',history:'Change history for these contracts'};
const empty={calls:'No observed call frames in this proof. The execution path is not established.',evidence:'No assessed components in this proof.',unresolved:'No unresolved call paths in this proof.',activity:'No assessed components to report activity for.',history:'No change history is established for these contracts. Absence does not prove unchanged history.'};
function SectionButton({name,review}){
 const open=review.section===name,n=review.sectionCounts[name];
 return <Button name={'poa-review-'+name} size="sm">{text((open?'▾ ':'')+sectionNames[name]+(name==='activity'?'':' ('+n+')'))}</Button>;
}
export function ReviewPanel({review,explorerUrl}){
 const s=review.summary,c=s.counts,calls=s.callCoverage,open=review.section!=='summary';
 return <Box>
  <Section>
   <Text size="sm" color="muted">Review coverage · this exact transaction</Text>
   <Heading size="md">{text(s.label)}</Heading>
   <Text fontWeight="bold" color={verdictColor[s.verdict]??'warning'}>{text(s.explanation)}</Text>
   {s.reason&&<Text size="sm">{text('Why: '+s.reason)}</Text>}
   {review.warnings.map(w=><Text fontWeight="bold" color="warning">{text(w)}</Text>)}
   {!!calls&&<Box>
    <Row label="Execution analysis"><Text>{text(calls.analysisStatus)}</Text></Row>
    {calls.analysisStatus==='UNAVAILABLE'?<Text>Execution was not observed. Call counts are unknown, not zero.</Text>:<Box>
     <Text>{text(calls.counts.total+' calls · '+calls.counts.covered+' covered · '+calls.counts.changed+' changed · '+calls.counts.uncovered+' uncovered · '+calls.counts.unknown+' unknown')}</Text>
     <Text size="sm">{text(calls.uniqueFunctions+' identified functions · '+calls.uniqueContracts+' identified contracts. Repeated EVM calls count separately.')}</Text>
     {!!calls.unreturnedFrames&&<Text>{text(calls.unreturnedFrames+' additional frames were not returned. These counts cover returned frames only.')}</Text>}
     {!!calls.nonContractFrames&&<Text size="sm">Non-contract frames are not audit-review subjects and remain in Unknown.</Text>}
    </Box>}
   </Box>}
   <Row label="Instruction audit coverage"><Text>{text(s.executionAssurance?.instructionAuditCoverage==='ESTABLISHED'?'Observed instructions within established scope':s.executionAssurance?.instructionAuditCoverage==='PARTIAL'?'Partial':'Not established')}</Text></Row>
   <Row label="Integration review"><Text>{text(s.executionAssurance?.integrationReview==='ESTABLISHED'?'Observed call edges within established scope':s.executionAssurance?.integrationReview==='PARTIAL'?'Partial':'Not established')}</Text></Row>
   <Text size="sm">Component counts below describe review scope, separately from repeated calls.</Text>
   <Row label="Observed call frames"><Text>{text(String(c.observedFrames))}</Text></Row>
   <Row label="Assessed components"><Text>{text(String(c.assessedComponents))}</Text></Row>
   <Row label="Reviewed"><Text>{text(String(c.covered))}</Text></Row>
   <Row label="Changed since review"><Text>{text(String(c.changed))}</Text></Row>
   <Row label="Excluded from review"><Text>{text(String(c.excluded))}</Text></Row>
   <Row label="Coverage unknown"><Text>{text(String(c.unknown))}</Text></Row>
   <Row label="Unresolved"><Text>{text(String(c.unresolved))}</Text></Row>
   <Text size="sm" color="muted">{text(s.checkedBlockLine)}</Text>
   <Text size="sm" color="muted">{text(s.freshness)}</Text>
  </Section>
  <Box direction="horizontal"><SectionButton name="calls" review={review}/><SectionButton name="evidence" review={review}/><SectionButton name="unresolved" review={review}/></Box>
  <Box direction="horizontal"><SectionButton name="activity" review={review}/><SectionButton name="history" review={review}/></Box>
  {open&&<Section>
   <Heading size="sm">{text(sectionTitles[review.section]+' · page '+(review.page+1)+' of '+review.pages)}</Heading>
   {!review.rows.length&&<Text size="sm">{text(empty[review.section])}</Text>}
   {review.rows.map(row=><Box><Text fontWeight="medium" color={row.tone==='warning'?'warning':row.tone==='success'?'success':'default'}>{text(row.title)}</Text>{row.lines.map(line=><Text size="sm" color="muted">{text(line)}</Text>)}</Box>)}
   <Box direction="horizontal">{review.page>0&&<Button name="poa-review-previous" size="sm">Previous</Button>}{review.page+1<review.pages&&<Button name="poa-review-next" size="sm">Next</Button>}<Button name="poa-review-summary" size="sm">Close</Button></Box>
  </Section>}
  <Text size="sm" color="muted">{text(s.signedDetail)}</Text>
  {explorerUrl&&<Link href={explorerUrl}>Open this analysis in the POA Explorer →</Link>}
 </Box>;
}
