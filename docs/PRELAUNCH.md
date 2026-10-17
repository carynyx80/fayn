# Fayn read-only release

The production build ships a pre-launch site with Robinhood Wallet account connection via WalletConnect. It contains no seeded pools, simulated balances, fabricated adoption statistics, fake transaction history, or enabled swap/liquidity/claim actions. Trading is unavailable; no Fayn contracts are deployed. Source for the local EVM research application is retained in the repository but excluded from dist.

Only eth_accounts is requested in the connection namespace, on Robinhood Chain 4663. No transaction or message signing method is requested. The address supplied by the wallet session is not proof of ownership through a signature. Any valid user address is accepted; account/network changes invalidate the displayed session. The owner supplied the public WalletConnect project ID. Configure allowed origins for localhost and the eventual Vercel domain if needed.

Validation: production build passed. Seven release tests passed, covering production output, absence of transaction permissions, account connection, wrong-network rejection and fixed mainnet status handling. The preview and connection dialog were verified in the browser. Real relay publishing failed in the local browser and the independent relay check timed out; end-to-end mobile wallet pairing is not yet verified. No successful connection is claimed. Vercel has no authenticated CLI or browser session, so no hosted release is claimed.

Vercel: import carynyx80/fayn, repository root '.', build npm run build, output dist, install npm ci --ignore-scripts, Node 24. Only the static build and read-only API belong on Vercel. The local signing server must not be hosted publicly. Contract deployment is separate and remains disabled. No fake usage figures were added.
