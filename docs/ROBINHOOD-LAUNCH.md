# Robinhood launch readiness — 17 October 2026

Target: Robinhood Chain mainnet (4663), canonical WETH/USDG, administrator 0xf271a1f74a0c0773141f775ce1a368d3c18666c3. Deployment gas cap $2; initial liquidity budget $0.

No Fayn contracts were deployed and no funds were spent. Signing connection requires reauthentication. At 19:09 UTC the wallet held 0.000003753493578083 ETH. Contract code deposit alone required at least 0.000043920978 ETH at the observed gas price; this excludes execution, intrinsic and L1 data charges and is not a complete estimate. The dollar cap has not been verified. A funded pool cannot trade with zero liquidity.

`node scripts/check-robinhood.mjs` verifies public chain identity, canonical asset metadata, balances and Uniswap manager code. `node scripts/prepare-robinhood.mjs` prepares four unsigned transactions under ignored runtime/ and mines the required hook permission bits. Predicted addresses depend on pending nonce; rerun before review. It never signs or broadcasts. No pool initialization is prepared without funding and price review.

The website offers a read-only launch desk backed by GET /api/robinhood. Vercel hosts that route as a serverless function; other pages remain clearly labeled browser simulation. The endpoint verifies the fixed chain and token metadata, caches successful reads for 30 seconds, rejects writes and reports RPC errors without fabricating balances. Local EVM signing remains restricted to the local development server.

Validation: production static build passed; 13 hosted/mainnet tests passed, including chain/token mismatch and RPC failure handling. JavaScript syntax checks passed for 33 files. Earlier local contract and HTTP tests are documented separately. No independent audit or visual browser verification is claimed. Design uses self-hosted OFL Bodoni Moda, Syne and Instrument Sans with oxblood, parchment, apricot and mineral blue.

Before release: fund gas within the approved cap, obtain complete sequential gas estimates and current ETH/USD pricing, restore a secure wallet signing connection, review the unaudited contracts, then verify deployed bytecode. Liquidity funding and an initial-price decision are still required for trading. Never provide private keys or seed phrases.

Official references: https://docs.robinhood.com/chain/connecting/ ; https://docs.robinhood.com/chain/contracts/ ; https://developers.uniswap.org/docs/protocols/v4/deployments
