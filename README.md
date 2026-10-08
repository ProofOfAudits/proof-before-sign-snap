# Proof Before Sign 0.5.1

Public source snapshot for the published `@proofofaudits/proof-before-sign-snap@0.5.1` package.

The published package is available on npm. Ordinary MetaMask public installation remains pending; this is not an allowlist approval. The Flask pilot is separate.

Website: https://proofofaudits.com/install
Support: contact@proofofaudits.com

Use Node.js 22 or later. From `products/proofofaudits/proof-before-sign/snap`, run `npm ci`, then:

```sh
POA_API_URL=https://proofofaudits.com POA_PASSPORT_URL=https://proofofaudits.com POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build
```

The manifest checksum must equal `9rVr+rFpMCKmkrp/jSmikwAYuIDxJIclKIE5bnxN4Cg=`. The immutable npm archive SHA256 is `6aaf6881e372241e1e9b4ac30988e272f62a7ccc75de5b4d7b754f3e555db1ff`. Development scripts are included for source reproduction; the npm package contains only its five release files. The original manifest repository points to the private development monorepo; this repository supplies the publicly readable source snapshot for review.

Only authenticated RELEASED evidence creates positive review coverage. AI output remains DRAFT. Signature authentication does not guarantee that contracts are secure or that complete evidence exists. The service analyzes a proposed transaction and does not submit it. No recovery phrase or private key is requested.

See SNAPPER_REVIEW.md for the completed scanner run, outstanding findings and coverage limits. Supplemental tsconfig is for scanner source discovery only.
