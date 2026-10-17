# Verification record — 2026-10-17

Environment: Windows, Node 24.19.0, Solidity 0.8.26 optimizer 200 / viaIR / Cancun, pinned v4-core 1.0.2 canonical PoolManager artifact, ethers 6.15.0, Hardhat 2.26.3, OpenZeppelin 5.4.0. No external credentials, funding or deployment used.

## Executed checks

**Final outcome: PASS. 13 contract/indexer/arithmetic tests plus 2 frontend/HTTP tests = 15 passing, zero failing. Seed deployment, health/solvency monitoring and 20 synthetic scenario runs also passed.** Commands were executed against a fresh local Cancun chain; no testnet or mainnet transactions occurred.

Custom contracts compiled successfully. Runtime sizes: FaynHook 2,807 bytes; FaynRouter 5,844 bytes; RewardVault 1,825 bytes; Create2Factory 429 bytes. All below the EVM contract size limit. ABIs are generated in shared/abis. PoolManager is taken from the exact pinned upstream npm package artifact; an earlier source compilation also succeeded. Solidity emitted the upstream EIP-1153 transient-storage composability warning when compiling the core from source. It is not proof of a Fayn defect, and does not remove integration review requirements.

The isolated rehearsal runs `node scripts/check-local.mjs`: new local chain, contract/indexer/property tests, real seeded deployment, HTTP service, frontend and HTTP end-to-end tests, monitoring and synthetic simulation. It stops child services afterward. Latest detailed outputs are copied into docs/verification/ for delivery; ephemeral raw chain logs remain ignored. The final executed counts are in those logs.

Coverage includes:

* Fee boundaries before/at/after start/end; 200 reproducible random timestamps and monotonicity checks; millionth rounding.
* Policy authorization, immutability, direct callback denial, fee and duration limits, reviewed asset gate and operator-only initialization.
* Actual core swaps, both directions and exact input/output; full-fill enforcement; deadline, fee-ceiling and slippage failures; missing balances/allowances.
* Twenty deterministic alternating input-size swaps with wallet + manager conservation per token, zero residual router balances, fee collection and zero duplicate collection.
* Liquidity addition, collection, partial/full removal and rejection of withdrawal from another wallet's position.
* Reward sponsor authorization, funding sufficiency, wrong pool/epoch/user/vault, duplicate claims, disabled vault, callback reentrancy and fee-on-transfer deposit rejection.
* Index idempotency, rollback/replay after a simulated reorg, confirmation cutoff, rate-limit retry and persistent reopen checkpoint.
* Fee-exclusive spot-impact arithmetic in both directions and with a protocol fee.
* HTTP session and origin rejection, both token approvals, fee-inclusive quotes, actual swaps, consumed quote rejection, LP add/remove/collect, funded claim and duplicate rejection, actual pool creation and indexed discovery.
* Frontend harness renders every route against actual HTTP state, reviews a launch policy, requests an executable quote, and clears it after amount editing.
* Monitor checks service, confirmation lag, freshness, zero router token residuals and vault solvency. Synthetic simulation generates ten scenarios, each Fayn and baseline.

## Meaningful failures fixed

1. Corrected v4 parameter imports to PoolOperation.sol for the pinned release.
2. Added operator-only initialization to close the configure-to-initialize initial-price interference window.
3. Moved npm/Hardhat writable caches into runtime to respect workspace constraints.
4. Replaced unavailable local HTTP port 3000 with 4173.
5. Corrected local launch time advancement: never attempt to set the next block behind the latest block; add startup buffer.
6. Corrected monitor URL joining when FAYN_URL is a base URL.

## Verification limits

The UI has syntax and functional DOM-handler tests, **not completed browser visual QA**: the available browser automation timed out. Responsive CSS and accessibility semantics were implemented but no screenshot, assistive-technology certification or cross-browser pass is claimed. No Lighthouse, Slither, formal verification, Foundry campaign, historical replay, external wallet/aggregator integration, testnet transaction or Docker run was performed. Seeded randomized tests are bounded deterministic checks, not exhaustive proofs. Etherscan submission and unsigned-deployment scripts have syntax validation but need real RPC/API access and authorized testnet rehearsal. Docker/Compose are prepared only. No independent audit exists.
