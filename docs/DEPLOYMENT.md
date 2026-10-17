# Deployment preparation

No contracts have been deployed externally. No testnet access credentials were supplied. The local app deliberately refuses signing on any chain except 31337. Do not turn off this guard to deploy it.

## Verified target

Sepolia chain 11155111 is listed in the [official Uniswap v4 deployments](https://developers.uniswap.org/docs/protocols/v4/deployments), checked 2026-10-17. Addresses are recorded in shared/networks.json. PoolManager: `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. Fayn addresses are null until deployed. The dynamic fee mechanism is described in [official documentation](https://developers.uniswap.org/docs/protocols/v4/concepts/dynamic-fees); interfaces are verified directly against pinned npm package source. Hook permission bits follow [v4-core Hooks.sol](https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol). Recheck official deployment mapping and actual bytecode before signing.

## Reproducible local setup

Use Node 24 (tested bundled 24.19.0). `npm ci`, `npm run compile`, then `npm run dev`. It starts a Cancun Hardhat chain, deploys the canonical upstream PoolManager and Fayn contracts through CREATE2, mints test assets, seeds full-range liquidity, performs a real seed swap and funds a 12.5 tUSDC grant. Open http://127.0.0.1:4173. This uses public Hardhat accounts and has no private credentials. Runtime artifacts stay in ignored runtime/. The app is a real local EVM demonstration, not testnet or mainnet functionality.

To run separate processes: `node scripts/chain.mjs`, then `npm run seed`, then `npm start`. `npm test` requires a running local chain and deploys its own fixtures; run tests before seeding the UI. `npm run simulate` writes deterministic reports. Do not run seed concurrently with tests because both use the local operator account.

## Prepare Sepolia unsigned transactions

1. Obtain explicit authorization before deploying or spending testnet gas. Choose a secure deployer wallet and reviewed multisig operator. Never paste keys or phrases into chat or .env.
2. Set SEPOLIA_RPC_URL in the local terminal. Run `node scripts/prepare-testnet.mjs DEPLOYER_ADDRESS MULTISIG_ADDRESS`. This read-only script verifies chain ID and nonempty manager code, records its hash and creates runtime/sepolia-unsigned.json. It does not certify the code hash against an audited deployment; verify it independently against the official source/explorer.
3. Review the four unsigned transactions: deploy factory; CREATE2 hook with exact 0x2080 permission bits; deploy router; deploy RewardVault with enabled=false. Predicted addresses depend on the starting nonce. Regenerate if nonce or bytecode changes. Verify the CREATE2 address and constructor args independently, simulate the complete sequence on a Sepolia fork, estimate gas and sign through a secure wallet or multisig workflow. The script does not broadcast.
4. After authorized signing and confirmation, check runtime bytecode, immutable manager/operator, permission flags and all constructor arguments. Save receipts and create a reviewed deployment manifest. Never populate client config solely from predicted addresses.
5. Verify each custom contract using `node scripts/verify-contract.mjs CONTRACT_NAME ADDRESS CONSTRUCTOR_ARGS...` with ETHERSCAN_API_KEY set locally. Submission result is not verified status; check the GUID through Etherscan's verification status API until successful. API script prepared but not exercised without credentials.
6. Operator reviews ERC20 assets then allowlists them. Prepare policy, start sufficiently far in the future, encode initial price using audited integer math, and initialize from the operator. Token approval and liquidity provision remain separate user transactions. External wallet UX and production initial-price encoder are release blockers.
7. Run fork and testnet end-to-end tests, independent audit and runbook drills. Rebates remain disabled. Publish a frontend only after removing the local signer API and adding actual wallet signing and reviewed network configuration.

The unsigned plan and verification helper are concrete deployment artifacts, not an exercised production deployment pipeline. There is no public website publication or mainnet configuration in this release.

## Local container preparation

Dockerfile and compose.yaml prepare the same local demonstration with a pinned Node 24.10.0 base and npm lockfile. `docker compose up --build` maps only host loopback port 4173; the RPC stays inside the container. BIND_ADDRESS=0.0.0.0 is limited to this container use, whose host port remains loopback. Docker was unavailable for validation, so no successful image build or container test is claimed. The Node executable workflow above is the verified path. This is not a production hosting configuration.

The verification helper follows the [Etherscan V2 Solidity verification endpoint](https://docs.etherscan.io/api-reference/endpoint/verifysourcecode), including standard JSON and ABI-encoded constructorArguments. It has not been submitted without credentials. Treat a GUID as submission acknowledgement and verify terminal status before describing any contract as explorer-verified.
