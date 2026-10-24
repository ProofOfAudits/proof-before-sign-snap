// A signature authenticates supplied facts; it cannot make contradictory trace
// counters complete. Shared by the server, Explorer and future Snap builds.
export function executionComplete(proof){
 const frames=proof?.traceFrames,c=proof?.traceCompleteness;
 if(proof?.traceComplete!==true||!Array.isArray(frames)||frames.length===0||proof?.reasons?.includes('execution_trace_unavailable'))return false;
 if(frames[0]?.success===false||['simulation_reverted','transaction_reverted','trace_frames_unresolved'].some(reason=>proof?.reasons?.includes(reason)))return false;
 if(!c)return true; // v1 proofs did not carry counters.
 return c.status==='COMPLETE'&&Array.isArray(c.limitations)&&c.limitations.length===0&&
  Number.isSafeInteger(c.observedFrames)&&c.observedFrames===frames.length&&c.returnedFrames===frames.length;
}
