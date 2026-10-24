# Proof Before Sign

Transaction-specific security-review evidence inside MetaMask, for supported Ethereum mainnet transactions.

Before confirming a transaction, open **Insights from Proof Before Sign**. The Snap checks a signed POA response and shows observed calls, supported proxy routes, per-call released review coverage, changed-code evidence and unknown gaps. A complete observed external call tree does not establish complete internal execution, state influence or audit scope.

Coverage means matching released evidence for the exact deployment, code version and scope. It is not an investment recommendation or a guarantee of safety. Missing evidence stays unknown; do not interpret NOT VERIFIED as an audit verdict. The current live Morpho and USDC examples have no approved coverage and show NOT VERIFIED.

The full runtime proof is retained. Version 0.7.1 verifies a signed content commitment before interpreting the proof, preserving transaction, nonce, block, expiry and policy checks.

## Use and controls

1. Install the exact published package in MetaMask Flask while allowlisting is pending.
2. Start a supported Ethereum mainnet contract interaction and open the insight before signing.
3. Read the call tree, review evidence, checked block, expiry and gaps. Open the exact proof for details.
4. Use the Snap home page to pause transaction checks or pause all activity. Paused checks make no POA analysis requests. Change alerts are unavailable in this build.

The Snap does not sign, send, approve, block or change transactions. It requests no recovery phrase, private key or key-management permission.

When checks are on, the proposed transaction, including sender, recipient, value, calldata and supplied execution/fee fields, is sent to https://proofofaudits.com for analysis. The Snap keeps settings, an evidence epoch anchor and a minimal last-check summary locally. It does not store wallet history. See https://proofofaudits.com/privacy.

Public API and actual-bundle code tests passed on Ethereum mainnet. This release has not been tested as an installed Flask version; earlier-version wallet observations are not acceptance of 0.7.1. npm publication does not mean MetaMask approval or stable-wallet availability. Network access requires MetaMask allowlisting. Do not advertise this package as production-accepted until those gates pass.

Website: https://proofofaudits.com/try
Support and escalation: veer@proofofaudits.com
Source: https://github.com/ProofOfAudits/proof-before-sign-snap
License: Apache-2.0
