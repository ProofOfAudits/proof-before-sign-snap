// Shared, immutable production envelope. Runtime observation support is wider
// than eligibility for the strongest verdict. Never infer semantic support
// from a successful call trace, ABI label, getter or Keccak preimage alone.
export const ANALYSIS_SUPPORT_VERSION='poa-analysis-support/1.4.0';
export const analysisEnvelope={
 storage:{scalar:true,packed:true,structs:true,exactMappingEntry:false,nestedMapping:false,dynamicArrays:'UNSUPPORTED',namespaces:'UNSUPPORTED',arbitraryAssembly:'UNSUPPORTED',transient:'UNSUPPORTED'},
 routing:{direct:true,erc1967:false,uups:false,beacon:false,minimalProxy:false,diamond:false,arbitraryDynamicDispatch:'UNSUPPORTED'},
 authority:{ownable:true,accessControl:false,accessControlEnumerable:true,proxyAdmin:false,safe:true,safeVersions:'1.4.1_NATIVE_EXACT_RELEASED_CODE',safeExtensions:'EOA_OR_RECURSIVELY_RELEASED_NATIVE_SAFE_MODULES_ONLY;NO_GUARD_OR_FALLBACK',timelock:true,timelockVersions:'NATIVE_4.9.6_OR_5.4.0_EXACT_RELEASED_CREATION',timelockHistory:'BOUNDED_COMPLETE_FROM_CREATION;NO_UNRESOLVED_QUEUED_OPERATIONS',customAuthority:'UNSUPPORTED'},
};
for(const group of Object.values(analysisEnvelope))Object.freeze(group);Object.freeze(analysisEnvelope);
export const closureGateKeys=['runtimeTraceComplete','deploymentResolutionComplete','writerClosureComplete','authorityClosureComplete','evidenceApplicabilityComplete','continuityComplete','analysisSupportComplete'];
export function completeClosureGate(gate){return !!gate&&Object.keys(gate).length===closureGateKeys.length&&closureGateKeys.every(k=>gate[k]===true);}
