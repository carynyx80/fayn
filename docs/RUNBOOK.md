# Local operations and deployment runbook

## Start and stop

Use Node 24. `npm ci`; `npm run compile`; `npm run dev`. The process owns local Hardhat and HTTP children. Exit with Ctrl+C. Never expose ports 8545 or 4173. If 4173 is unavailable set PORT in the terminal before npm run dev; .env.example documents variables but is not auto-loaded. All amounts are test assets. No signing keys are required. Hardhat state resets on restart; seed generates new deployment state. SQLite detects checkpoint mismatches and rolls back. For a deliberate clean rebuild, stop the service and remove only runtime/events.sqlite and its -wal/-shm companion files, then seed. Do not delete node_modules or unrelated user folders.

To run checks independently: start `npm run chain`, run `npm test`, then `npm run seed`, start `npm start`, run `npm run test:e2e`. E2E mutates local pool state and claims the seeded grant. To replenish the demonstration, either rebuild the seeded chain or explicitly fund another local grant. It never creates funds from swap fees.

## Failures and recovery

* RPC refused: start the local chain. Verify chain 31337. Do not change only chain ID to bypass signing restrictions.
* Deployment absent: stop service and seed the running chain. A stale deployment.json is not evidence contracts exist; startup checks deployed hook code.
* Index lag or retries: /api/state.status compares tip to indexed; local expected lag is one. Persistent failures return explicit errors. Confirm RPC connectivity, rate limits and disk space. Hash mismatch rolls back to common ancestor; restart and reindex from chain if database integrity is doubtful.
* Quote rejected: check approval, test asset balance, selected direction/decimals and slippage. Expired or used quote IDs require a new quote. Insufficient funds and v4 errors return an error message; no automatic retry of swaps.
* Failed claim: read vault.available and token balance, compare liabilities and funded/claimed events. A second claim without new grant must fail. Do not infer a grant from trading volume.
* Allocation discrepancy: native fees belong to manager LP accounting, not RewardVault. Router balances should be zero, vault liabilities must be <= token balances. Fee events can include donations; do not equate them with economic profitability.
* Partial launch failure: configuration, initialization and liquidity provision are separate transactions. Review confirmed receipts before retrying a step; immutable configuration cannot be overwritten. Use a new token/pool for a fresh demo launch when recovery is not appropriate.
* Admin compromise: stop creating future pools, disclose affected assets and addresses, and ask users to review withdrawal decisions. Existing immutable terms cannot be paused. There is no emergency confiscation, rescue or upgrade route.

## Monitoring implementation

`node services/monitor.mjs` is a read-only single check suitable for a supervised scheduler. It checks server/index freshness, confirmation lag, local token conservation indicators (zero router balance) and reward solvency. It exits nonzero on failures and emits JSON. This is a local executable health check, not installed hosted alerting. A deployment needs a continuous index worker, independent RPC, receipt-level failed-claim tracking, volume and fee-growth anomaly thresholds calibrated per pool, backup/restore drills and an on-call destination. No notifications are sent by this project.

SQLite runtime database is a cache: canonical chain logs are the recovery source. Back up deployment manifests and ABI/compiler artifacts separately. Preserve immutable config, constructor arguments, receipts and explorer verification before any testnet launch.
