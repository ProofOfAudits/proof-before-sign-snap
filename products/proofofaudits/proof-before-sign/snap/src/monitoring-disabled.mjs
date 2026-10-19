// Default (monitoring-off) build: replaces ./monitoring.mjs and ./monitoring-home.jsx so the bundle carries no
// wallet-alert network paths and no notification code. index.jsx never calls these when monitoring is compiled out.
const unavailable=()=>{throw Error('MONITORING_NOT_BUILT');};
export const monitoringPreferences=unavailable,watchSubject=unavailable,pollMonitoring=unavailable,disableMonitoring=unavailable;
export function MonitoringHome(){return null;}
