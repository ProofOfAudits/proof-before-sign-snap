# Proof Before Sign 0.7.0
Public source snapshot for the `@proofofaudits/proof-before-sign-snap@0.7.0` Snap package. Publication on npm and MetaMask allowlisting are tracked separately; this snapshot does not claim either.
Website: https://proofofaudits.com/try
Support: veer@proofofaudits.com
License: Apache-2.0 (see `LICENSE`).
Use Node.js 22 or later. From `products/proofofaudits/proof-before-sign/snap`, run `npm ci`, then:
```sh
POA_API_URL=https://proofofaudits.com POA_PASSPORT_URL=https://proofofaudits.com POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build
```
The manifest checksum must equal `tqs86M0MLBXRwU/PHDV1bWJb4uBkkr+fDzxWrOW3qmI=` (also recorded in `products/proofofaudits/proof-before-sign/snap/snap.manifest.json`). The npm archive SHA256 of the release candidate is `941ddcc9f9c71289d24830ebe41d42bc705c162df8dd95ad017c475d5323866a`. The npm package contains only its five release files. `runtime-trust.json` is the public Ed25519 runtime trust embedded in the bundle; it contains public keys only.
Only authenticated RELEASED evidence creates positive review coverage. Signature authentication does not guarantee that contracts are secure or that complete evidence exists. Missing evidence is shown as UNKNOWN. The service analyzes a proposed transaction and does not submit it. No recovery phrase or private key is requested.
