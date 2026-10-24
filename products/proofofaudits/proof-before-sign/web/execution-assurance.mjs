import {executionComplete} from './execution-completeness.mjs';
// Independent dimensions. A complete call tree or a source mapping never
// proves instruction audit coverage or a reviewed cross-contract integration.
export function executionAssurance(proof){
 const a=proof?.internalExecution?.instructionAccounting;
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 const valid=a?.schemaVersion==='poa.instruction-accounting.v1'&&
  count(a.observedSteps)&&a.observedSteps>0&&count(a.sourceMappedSteps)&&count(a.unresolvedSteps)&&
  a.sourceMappedSteps+a.unresolvedSteps===a.observedSteps;
 const regions=proof?.executionRegions;
 const regionValid=regions?.schemaVersion==='poa.execution-region-coverage.v1'&&['COMPLETE','INCOMPLETE'].includes(regions.status)&&count(regions.observedSteps)&&regions.observedSteps>0&&count(regions.coveredSteps)&&count(regions.excludedSteps)&&count(regions.unknownSteps)&&regions.coveredSteps+regions.excludedSteps+regions.unknownSteps===regions.observedSteps;
 const integration=regions?.integration;
 const integrationValid=integration&&count(integration.covered)&&count(integration.excluded)&&count(integration.unknown)&&Array.isArray(integration.edges)&&integration.covered+integration.excluded+integration.unknown===integration.edges.length;
 const integrationReview=integrationValid&&integration.edges.length>0&&integration.covered===integration.edges.length&&integration.status==='ESTABLISHED'&&executionComplete(proof)?'ESTABLISHED':integrationValid&&integration.covered>0?'PARTIAL':'NOT_ESTABLISHED';
 const regionComplete=regionValid&&regions.status==='COMPLETE'&&regions.unknownSteps===0&&regions.excludedSteps===0&&executionComplete(proof);
 return {schemaVersion:'poa.execution-assurance.v1',callFrames:executionComplete(proof)?'COMPLETE':'INCOMPLETE',
  instructionSourceMapping:!valid?'UNAVAILABLE':a.unresolvedSteps===0?'SOURCE_MAPPED':'INCOMPLETE',
  observedInstructionSteps:valid?a.observedSteps:null,sourceMappedSteps:valid?a.sourceMappedSteps:null,unresolvedInstructionSteps:valid?a.unresolvedSteps:null,
  instructionAuditCoverage:regionComplete?'ESTABLISHED':regionValid&&regions.coveredSteps>0?'PARTIAL':'NOT_ESTABLISHED',instructionCoverage:regionValid?{observed:regions.observedSteps,covered:regions.coveredSteps,excluded:regions.excludedSteps,unknown:regions.unknownSteps}:null,integrationReview,
  limitations:['Component review scope does not establish coverage of every executed instruction.','Separately reviewed components do not establish review of their integration.','Simulation describes the checked block; execution at inclusion can differ.']};
}
