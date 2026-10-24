# Proof Before Sign 0.7.1

Public source for @proofofaudits/proof-before-sign-snap@0.7.1. Apache-2.0.

Publication and allowlisting are separate. Code-only live tests passed; exact installed-wallet acceptance has not been established for this version. Review coverage is not a guarantee of security. Missing evidence remains unknown.

Support: veer@proofofaudits.com
Website: https://proofofaudits.com/try

Build with Node 22 or later from products/proofofaudits/proof-before-sign/snap:

```sh
npm ci --ignore-scripts
POA_API_URL=https://proofofaudits.com POA_PASSPORT_URL=https://proofofaudits.com POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build
```

Expected manifest shasum: U6VtWnpsQ+tqekteN7rIj+UlS/KjdFI4I2S/A1/qdGw=
Archive SHA256: 188cab9d41a74f0e2c55ccb4599539377733ac99665dc7d8735dc627273b99c9

The public runtime trust contains public keys only. Change alerts are unavailable. See the Snap README for scope, privacy and limits.
