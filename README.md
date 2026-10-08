# Proof Before Sign 0.5.2 final local-wallet candidate

UNPUBLISHED. NOT SUBMITTED. Published production remains 0.5.1. Version 0.5.2 is frozen for manual Flask capture and is not published until that capture succeeds.

Website: https://proofofaudits.com/install
Support: https://proofofaudits.com/support

Use Node >=22. From `products/proofofaudits/proof-before-sign/snap`, run `npm ci --ignore-scripts`, then:

```sh
POA_API_URL=https://proofofaudits.com POA_PASSPORT_URL=https://proofofaudits.com POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build
```

Manifest checksum: `ZKO4LMbvWbsSCBj7o7ZOzupz8QM2X1QxVi4rop9k49o=`. Candidate archive SHA256: `3e14f6e018855693f336abf443781d4dcabf800f99fb037e0ff3e46539857b81`. The checksum helper follows MetaMask’s stable-manifest, sorted per-file SHA256 contract and was independently matched against the official utility. The official `mm-snap eval` successfully evaluated the exact bundle in SES.

The legacy Jest/MetaMask simulation and broad checksum utility chains were removed from the release build dependencies and replaced by Node built-in focused handler checks plus official external SES evaluation. Every previous scanner entry is triaged in snapper-dependency-disposition.json. The complete remaining build/runtime dependency tree reports zero advisories, and the official default Snapper scan reports zero findings. No detector was disabled. OriginValidation’s dapp RPC probe does not run for this esbuild project; there is no onRpcRequest export or dapp RPC permission. This is a documented coverage limit, not a claim of independent audit.

RELEASED-only positive evidence, AI DRAFT status and two actual independent reviewers remain required. A signed proof authenticates origin/request binding, not safety or approved coverage. The focused final handler check authenticated an unsigned unknown-contract result as NOT VERIFIED and rejected malformed signed evidence. Actual wallet installation/media remain manual and pending.
