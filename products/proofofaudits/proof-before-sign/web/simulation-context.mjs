export const SIMULATION_MODE='sender-balance-override';
export const SIMULATION_BALANCE='10000000000000000000';
export function validateSimulationContext(proof,tx,commitment){
 const c=proof.simulationConditions;
 if(!c||Object.keys(c).sort().join(',')!=='balanceWei,mode,originalBalanceWei,referenceBlock,requestSha256,schemaVersion,sender'||c.schemaVersion!=='poa-diagnostic-simulation-v1'||c.mode!==SIMULATION_MODE||c.sender!==tx.from||c.balanceWei!==SIMULATION_BALANCE||!/^(0|[1-9][0-9]*)$/.test(c.originalBalanceWei)||c.requestSha256!==commitment(tx)||JSON.stringify(c.referenceBlock)!==JSON.stringify(proof.block)||proof.state!=='UNKNOWN'||proof.policy?.serverAnalysisEligible!==false||!proof.reasons.includes('diagnostic_balance_override_not_actual_state'))throw Error('invalid_diagnostic_simulation_context');
}
