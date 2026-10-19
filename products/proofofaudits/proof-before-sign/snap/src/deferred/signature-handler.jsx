import { Box, Heading, Text, Row } from '@metamask/snaps-sdk/jsx';
import { safeText } from '../validate.mjs';
import { signatureInsight } from './signature-insight.mjs';

const label = value => safeText(value);
// Signature payloads have no executed transaction or authenticated runtime proof.
// Critical is required by MetaMask to display signature insight content.
export function signatureInsightPanel(signature) {
  const insight=signatureInsight(signature);
  return {severity:'critical',content:<Box>
    <Text size="sm" color="muted">PROOF BEFORE SIGN</Text>
    <Heading size="sm">NOT VERIFIED · Signature request</Heading>
    <Text>{label(insight.title)}</Text>
    {insight.rows.map(row=><Row label={row.label}><Text>{label(row.value)}</Text></Row>)}
    <Text>{label(insight.warning)}</Text>
    <Text>No EVM transaction was simulated. Audit coverage, current allowances and asset effects are not established.</Text>
    <Text size="sm" color="muted">These are untrusted payload declarations. A familiar permit format does not authenticate the contract or prove the request is safe.</Text>
  </Box>};
}
