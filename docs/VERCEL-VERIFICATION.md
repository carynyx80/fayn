# GitHub / Vercel preparation verification

Date: 2026-10-17. Tested with bundled Node 24.19.0.

* `node scripts/build.mjs`: PASS. Produces dist/ with explicit browser-demo runtime selection.
* `node --test --test-concurrency=1 tests/browser-demo.test.mjs tests/vercel.test.mjs`: 10 tests PASS. Covers simulated fee boundaries, token decimals, approvals, exact input/output in both directions, per-token conservation, expiry, stale quotes, balance limits, LP accounting and withdrawal ownership, one-time funded demo claims, policy bounds, persistence, reset, and the built UI across routes.
* JavaScript syntax checks: PASS. All application, service, script, simulation and test modules checked.
* `npm ci --ignore-scripts --dry-run --no-audit --no-fund`: PASS. Host npm used Node 26 and emitted the expected engine warning; actual build and test executions used Node 24.19.0. Vercel is configured to select Node 24.
* The full local EVM regression suite also PASSED after the hosting changes: 13 contract/indexer/arithmetic tests and 2 HTTP/frontend tests, plus seed deployment, solvency monitoring and 20 synthetic scenario runs. Together with the hosted suite this is **25 passing tests**. Logs are preserved in docs/verification. Hosting mode uses an API adapter, so local EVM execution remains independently testable.

No Vercel account deployment was performed or claimed. No testnet or mainnet contracts were deployed. The hosted website is explicitly simulated; public live trading needs separately deployed contracts and external-wallet integration. Visual browser QA is unverified because the in-app browser webview failed to attach; functional tests are a DOM handler harness and module tests, not screenshots or a real browser certification.

The build requires no secrets, has no server-side signing endpoints, and exports only static browser assets. Source, contracts, ABI generation, local services, tests, simulation tools and documentation are uploaded; node_modules, runtime databases, tooling caches, environment secrets and generated dist are excluded. The repository root contains vercel.json, so Vercel import requires no subdirectory selection.
