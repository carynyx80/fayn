# Fayn — Liquidity that bites back.

A working **local Uniswap v4 integration laboratory** with immutable launch-fee policies, actual EVM swaps and LP accounting, separately funded reward claims, persistent event indexing, and a charcoal/ivory/lime web application. No governance token. No live deployment or independent audit.


## Deploy on Vercel

Import **https://github.com/carynyx80/fayn** into Vercel. Keep **Root Directory: ./**, **Framework Preset: Other**, and **Node.js: 24.x**. The checked-in vercel.json sets install, build, and output commands. **No environment variables are required for the hosted demo.**

The Vercel deployment is an interactive **browser simulation**: pools, fee schedules, quotes, swaps, LP actions and grants are modeled with integer arithmetic and saved in this browser. It never starts Hardhat, connects to localhost, signs transactions or claims to deploy contracts. Every page displays this distinction. The full actual Uniswap v4 local application below is preserved and tested independently. Real blockchain execution on a public deployment still requires deployed contracts and a reviewed external-wallet integration. See [Vercel deployment guide](docs/VERCEL.md).

Verify the static deployment locally:

```sh
npm ci
npm run build
npm run test:hosted
```

## Run the actual local EVM application

Use **Node 24** (tested: 24.19.0) and npm. From this folder:

```sh
npm ci
npm run compile
npm run dev
```

Open **http://127.0.0.1:4173**. Click **Connect demo account**. This selects the public local Hardhat test account; it is explicitly not a real external wallet connection. Pool prices, swaps, liquidity and grants come from the seeded local chain. The server binds loopback and refuses signing outside chain 31337. Never expose it publicly or use valuable assets.

`npm run dev` starts a fresh local chain, seeds contracts, creates test assets and liquidity, executes a seed swap and funds a 12.5 tUSDC reward grant. Close with Ctrl+C. If another local chain already runs, stop it first, or use separate commands below. Shell environment variables are supported; `.env` is not automatically loaded. PORT overrides 4173 if necessary.

## Reproduce the acceptance flow

1. Connect demo account. Open **Launchpad tools → Create protected launch** (or the overview's Create button). Enter a new test symbol, initial price, 3% opening fee, 0.3% standard fee, and 30 minutes. Review immutable terms, then create the pool. This mints a test token, configures and initializes a real v4 pool and supplies liquidity. The hash route is a shareable local pool link.
2. Open the pool. Inspect the schedule, current fee, token addresses and chain-derived liquidity. Open **Transparency** for addresses and powers. Fee changes depend on block timestamps; the displayed value updates after chain transactions or a page refresh.
3. Approve input test asset if necessary. Enter an amount, direction, exact-input/output mode and slippage. Request the executable quote; inspect fee, impact and min output/max input. Execute within 45 seconds. Used or expired quote IDs fail. Balances, activity and earnings refresh from actual events/state.
4. Open **My liquidity**. Add integer liquidity units or withdraw owned units. Collectible fees come from simulated v4 collection and are settled by a real transaction. They are not total profitability. Fees are never credited again as rebates.
5. Open **Trader rewards** on the seeded tWETH pool. Claim the separately sponsor-funded grant. Another claim without new funding fails. New pools have no automatic rebate entitlement.

## Tests and economics

Current verification after Vercel adaptation: **25 passing tests** (10 hosted browser/static-build checks and 15 actual local-EVM/indexer/HTTP checks). The local deployment, monitor and synthetic simulations also pass. See [Vercel verification](docs/VERCEL-VERIFICATION.md).

After compilation, `npm run check:local` automatically starts a fresh chain, runs the complete isolated rehearsal, and stops its services. Ports 8545 and 4173 must be free. This is the shortest route to reproducing the recorded verification.

For independent processes, run these in separate terminals:

```sh
npm run chain
# Second terminal:
npm test
npm run seed
npm start
# Third terminal, while service runs:
npm run test:e2e
npm run simulate
node services/monitor.mjs
```

E2E tests mutate local balances, consume a grant, and create another pool. They never spend external funds. Do not seed or run separate fixture suites concurrently with each other because they share a local signing account. Final executed outcomes are in [test results](docs/TEST-RESULTS.md), not implied by the scripts' presence.

Economic output: [synthetic report](simulation/results/REPORT.md) and [machine-readable results](simulation/results/results.json). It models ten scenarios for Fayn and a baseline. It is a full-range constant-product approximation, not historical replay or production-economic validation.

## Repository

| Directory | Purpose |
|---|---|
| contracts | Hook, settlement router, funded vault, CREATE2 factory, demo and adversarial test assets |
| web | Responsive native-module application: overview, pools, trading, creation, LP, rewards, integrations, transparency |
| services | Loopback signing demo service, SQLite event indexer, read-only health monitor |
| shared | Pinned-network mapping, generated ABIs, ethers helpers, v4 storage readers |
| scripts | Compiler, local chain/seed/orchestrator, unsigned Sepolia plan, explorer submission helper |
| tests | Actual EVM integration, deterministic fee/accounting properties, reorg/retry, HTTP flows |
| simulation | Reproducible synthetic economic experiments and reports |
| docs | Architecture, accounting, security, integration, deployment and operations |
| runtime | Ignored ephemeral chain deployment, event cache, tooling cache; no real keys |

## Documentation

- [Architecture, decisions and trust diagram](docs/ARCHITECTURE.md)
- [Fee conservation and worked examples](docs/ACCOUNTING.md)
- [Launchpad integration guide](docs/INTEGRATION.md)
- [Local operations and failure recovery](docs/RUNBOOK.md)
- [Sepolia deployment preparation](docs/DEPLOYMENT.md)
- [Security assessment and production gates](docs/SECURITY.md)

## Boundaries

Only reviewed standard ERC20s and full-range router positions are supported. Immutable schedules cap opening at 10%, standard at 1%, duration at 24h. No hook fee or Fayn protocol fee is collected; native LP fees stay under v4 accounting. There is no 80/15/5 split. Grants are separate sponsor deposits; deployment defaults them off. No secret bot classifier, human-verification badge, oracle, tokenomics promise or guaranteed yield.

Source, ABIs, tests, local application, economic report and unsigned-deployment helpers are delivered. **External-wallet signing, independent audit, chain-specific aggregator/fork validation, production hosting, full static/fuzz campaigns and tested testnet deployment remain release gates.** Native-module frontend and SQLite were chosen for a single-user reproducible laboratory; this is not the complete production launchpad platform requested in the broader brief. Browser visual QA is only claimed if recorded in TEST-RESULTS.md. Do not deploy the local signer service as a public web backend.
