# Snapper 0.5.2 cleanup review

Official @sayfer_io/snapper 0.19.1, all default detectors enabled. The source/full development dependency scan processed 16 files and reported 54 DependencyOutdated entries; no other detector reported findings. Separate npm audit --omit=dev reports zero production dependency advisories.

All 54 remaining dependency entries are absent from the actual esbuild bundle input graph. Their per-entry dispositions are in snapper-dependency-disposition.json. They remain development-tool dependency advisories, including the upstream MetaMask test environment; the full development tree is not clean. They have not been hidden or called resolved. The currently published supported @metamask/snaps-jest (10.2.1) and @metamask/snaps-utils (12.6.0) versions still carry these test-tool transitive advisories. Upstream-supported remediation remains pending.

The prior TODO comments, empty Home catches and explicit-strict configuration findings were corrected in the new candidate. Generated comments are removed by esbuild parsing/minifyWhitespace, not by regex rewriting code. The published 0.5.1 bundle is immutable and was not modified.

OriginValidation requires snap.config.js and reported Not a snap project because this package uses an esbuild script. The Snap exposes no onRpcRequest entry point or dapp RPC permission; this detector’s arbitrary-origin RPC probe does not establish coverage of transaction insights. some detectors do not cover all JSX/MJS source. Zero remaining source findings does not mean all possible vulnerabilities were checked. Scan acceptance remains false. This candidate is not submission-ready and is not published.
