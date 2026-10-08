# Proof Before Sign 0.5.2 cleanup candidate

UNPUBLISHED. NOT SUBMITTED. Ordinary MetaMask availability remains pending. Published 0.5.1 remains on the `codex/snap-0.5.1` branch and is unchanged.

Website: https://proofofaudits.com/install
Submission contact: METAMASK_CONTACT_EMAIL=REQUIRED_FROM_FOUNDER

Use Node.js >=22. From `products/proofofaudits/proof-before-sign/snap` run `npm ci`, then:

```sh
POA_API_URL=https://proofofaudits.com POA_PASSPORT_URL=https://proofofaudits.com POA_RUNTIME_TRUST_FILE=../../../../runtime-trust.json npm run build
```

Expected manifest checksum: `/qQZCVuDQzqwtAJaf5QrMvbu8SOaZewlAiaH7cOII3M=`. Candidate archive SHA256: `7a52ab0201cb9cb3ae955a1cf95e81c78ec55c722b11976f2ff0b093f24ea35d`. The release archive contains only the five allowlisted files. The source tree includes build/test tool dependencies for review; none are installed by the release archive.

This candidate uses an AST-safe esbuild whitespace/comment cleanup, explicit informational Home fallbacks, explicit scanner strict options, a patched UUID dependency and this public repository in its manifest. Transaction proof verification, request binding and RELEASED-only review gates remain in place. A signature is not proof of safety or complete review. AI output stays DRAFT; missing evidence stays unknown. No transaction is broadcast.

The official simulator installed this exact candidate and authenticated an unsigned unknown-contract proof as NOT VERIFIED. This is not an actual installed mainnet wallet demonstration. See SNAPPER_REVIEW.md for residual tooling findings and scan coverage limits.
