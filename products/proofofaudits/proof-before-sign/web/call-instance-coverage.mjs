import {executionComplete} from './execution-completeness.mjs';
import {classifyComponent,frameSelector,isPrecompile} from './review-coverage.mjs';

// Presentation of authenticated proof facts, never a second verdict engine.
// Every returned EVM frame has exactly one primary category. Repeated calls
// remain repeated; static candidates and Solidity internal functions are not
// invented execution frames. Callers must authenticate the proof first.
export function callInstanceCoverage(proof){
 const unavailable=proof?.traceCompleteness?.status==='UNAVAILABLE'||proof?.reasons?.includes('execution_trace_unavailable')||!Array.isArray(proof?.traceFrames);
 const frames=unavailable?[]:proof.traceFrames,components=Array.isArray(proof?.components)?proof.components:[];
 const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
 const category={REVIEW_COVERED:'COVERED',CHANGED_SINCE_REVIEW:'CHANGED',EXCLUDED_FROM_REVIEW:'UNCOVERED',REVIEW_COVERAGE_UNKNOWN:'UNKNOWN',UNRESOLVED:'UNKNOWN'};
 const instances=frames.map((frame,index)=>{
  const selector=frameSelector(frame);
  const componentIndex=components.findIndex(c=>c.relation!=='STATIC_REACHABLE'&&same(c.address,frame.address)&&same(c.context,frame.context)&&same(c.selector,selector));
  const component=components[componentIndex],nonContract=frame.codePresent===false||isPrecompile(frame.address);
  const base=nonContract?'UNKNOWN':category[classifyComponent(component)];
  const region=proof?.executionRegions?.frames?.find(r=>r.frameIndex===index);
  const classification=base==='COVERED'&&region?.excludedSteps>0?'UNCOVERED':base==='COVERED'&&region?.unknownSteps>0?'UNKNOWN':base;
  return {index,componentIndex:componentIndex<0?null:componentIndex,category:classification,reviewEligible:!nonContract,
   reason:nonContract?'not_a_contract_review_subject':componentIndex<0?'execution_identity_unresolved':classification!==base?classification==='UNCOVERED'?'executed_region_explicitly_excluded':'executed_region_scope_unknown':classifyComponent(component).toLowerCase()};
 });
 const reported=proof?.traceCompleteness?.observedFrames;
 const observedFrames=unavailable?null:Number.isSafeInteger(reported)&&reported>=frames.length?reported:frames.length;
 const unreturnedFrames=observedFrames===null?null:observedFrames-frames.length;
 const complete=!unavailable&&executionComplete(proof);
 const count=category=>instances.filter(i=>i.category===category).length;
 const addresses=new Set(),functions=new Set();
 for(const i of instances){const f=frames[i.index],c=i.componentIndex===null?undefined:components[i.componentIndex];
  if(!/^0x[0-9a-f]{40}$/i.test(f.address??'')||!i.reviewEligible||!(f.codePresent===true||/^0x[0-9a-f]{64}$/i.test(c?.codeHash??'')))continue;
  addresses.add(f.address.toLowerCase());const selector=frameSelector(f);if(/^0x[0-9a-f]{8}$/i.test(selector))functions.add(f.address.toLowerCase()+':'+selector);
 }
 return {schemaVersion:'poa.call-instance-coverage.v1',countingUnit:'RETURNED_EVM_CALL_FRAME',analysisStatus:unavailable?'UNAVAILABLE':complete?'COMPLETE':'INCOMPLETE',countsComplete:complete,
  counts:{total:instances.length,covered:count('COVERED'),changed:count('CHANGED'),uncovered:count('UNCOVERED'),unknown:count('UNKNOWN')},
  observedFrames,unreturnedFrames,uniqueContracts:addresses.size,uniqueFunctions:functions.size,nonContractFrames:instances.filter(i=>!i.reviewEligible).length,instances};
}
