# Deploy Fayn on Vercel

## Import settings

1. Import **carynyx80/fayn** from GitHub in the [Vercel new-project screen](https://vercel.com/new).
2. Select the repository root (`./`), **Other** framework and **Node.js 24.x**.
3. Keep the settings from `vercel.json`:
   - Install: `npm ci --ignore-scripts`
   - Build: `npm run build`
   - Output: `dist`
4. No environment variables, RPC keys, private keys or database are needed for the browser demonstration. Deploy after reviewing these settings.

The build copies only the browser assets and replaces runtime-config.js with `mode: 'browser-demo'`. It does not run Solidity compilation, start a blockchain, seed localhost, start the Node signing service, or export SQLite. Navigation uses URL hash routes, so a pool link reloads through the same static entry point.

Settings follow [Vercel's static project configuration](https://vercel.com/docs/project-configuration/vercel-json) and [Node version support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Node 24 is an available Vercel runtime; source is pinned to the Node 24 major in package.json. Vercel platform deployment itself is not claimed verified until the user imports and deploys the repository.

## What works in the hosted application

Every page opens without a localhost service. Browser demo account selection, pool discovery/filtering, fee schedules, token precision, approvals, exact-input/output quotes in both directions, simulated swaps, min/max limits, expiry and stale-quote rejection, LP deposits/withdrawals and collection, separately allocated demo grants, one-time claims, creation-policy review, simulated pool creation, and action history are implemented.

All of those hosted actions are **simulated**. There is a persistent banner and mode label. Browser asset IDs are not contract addresses, actions are not blockchain transactions, and modeled earnings have no real value. The reserve calculation is a constant-product approximation using BigInt, not v4 tick math. Modeled fees are held separately, allocated only to liquidity present when the trade occurs, and paid from modeled reserves. The seeded grant is separate from LP fee income. Automatic trading eligibility is not claimed.

State persists in localStorage on this device; it is editable by the user and is not an authoritative or secure ledger. Tabs can race, device-clock changes affect the schedule, and clearing browser storage removes demo positions. Sharing a pool URL does not share its browser-local data with another device. Reset demo clears only this application's storage key. If browser storage is unavailable, the adapter uses a temporary in-memory session; do not expect persistence.

## Actual blockchain functionality

The same repository preserves the contracts, generated ABIs, local EVM settlement router, funded reward vault, CREATE2 deployment, SQLite indexer, deployment scripts, economic models and the previously tested local application. `npm run dev` serves the unchanged actual local EVM mode using the source runtime-config.js. Hosted and local modes share the frontend through client-api.js; the static build selects the browser adapter, and the local service selects the real HTTP API.

For real public testnet execution: deploy and verify reviewed contracts, implement external-wallet signing/network switching, replace browser simulation with onchain reads, and run the indexer with durable external infrastructure. Keep the local signing service private; do not point a Vercel rewrite at it or deploy it as a public signing backend. A successful Vercel static deployment does not mean contracts are deployed or audited.

## Reproduce checks

```sh
npm ci
npm run build
npm run test:hosted
npm run check:syntax
npm run compile
npm run check:local
```

The hosted tests verify integer arithmetic, conservation, fees, quotes, approvals, liquidity, claims, persistence, reset and policy bounds; they also exercise the built UI handlers across routes. The isolated local rehearsal verifies actual EVM flows. Neither suite is a completed cross-browser visual/accessibility audit. Deployment verification records are in docs/verification/ and docs/TEST-RESULTS.md.
