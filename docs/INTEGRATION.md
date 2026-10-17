# Launchpad integration guide

Run the setup in README.md. Artifacts live in shared/abis; functions and configuration live in shared/chain.mjs and shared/networks.json. The browser's integrations page mirrors the basic calls. All transaction amounts are integers in raw token units; symbols are display metadata only.

## Launch sequence

1. Review standard ERC20 addresses, network, decimals, token behavior, fees and administrative powers. Have the immutable operator call allowAsset for each. Deployments should use a multisig; this demonstration uses the local account.
2. Sort currencies ascending by numeric address, select dynamic fee flag 0x800000, tickSpacing 60, and the verified hook address. Pool ID is keccak256(abi.encode(PoolKey)). Use the shared poolId helper.
3. Configure once: start >= current block time; end > start and no more than 24h later; 100 <= normal <= 10,000; normal <= opening <= 100,000 millionths. Example 30,000 to 3,000 over 1,800 seconds. Terms cannot change. The local wizard's review screen displays these powers before sending transactions.
4. Initialize from the operator with sqrtPriceX96. Price is raw token1/token0; account for decimal difference. The local test wizard approximates this using Number and Math.sqrt; production needs audited integer encoding. An unrelated account cannot initialize the pool. There is no liquidity-lock guarantee.
5. User approves router for each token and calls modify(key, positiveLiquidity, maxToken0, maxToken1, deadline). Full-range liquidity is normalized units, not a sum of token balances. Liquidity ownership ledger key is pool + wallet; the manager position salt derives from wallet. Never send custody of an NFT to this router.

## Quotes and swaps

```js
// ethers v6, using actual wallet signer and generated ABIs in a reviewed integration.
const now = (await provider.getBlock('latest')).timestamp;
const maxFee = await hook.feeAt(poolId(key), now);
const amount = parseUnits('0.1', tokenInDecimals);
const result = await router.swap.staticCall(key, zeroForOne, -amount,
  0, maxFee, now + 120);
const output = zeroForOne ? result[1] : result[0];
const minimumOut = output * 995n / 1000n;
// Refresh after 45 seconds or on account, network, direction, amount or policy changes.
await router.swap(key, zeroForOne, -amount, minimumOut, maxFee, now + 120);
```

For exact output, amountSpecified is positive and limit is maximum gross input. The router enforces exact requested amount, rejecting partial execution. Input approval is required before executable simulation. Real RPC eth_call may need sufficient balances and approvals; never treat a purely arithmetic quote as executable. Current frontend talks to a strictly local test signer; this SDK example does not imply deployed wallet UX.

The dynamic fee applies equally to compatible external routers. Caller identity and hookData do not determine fees. An aggregator must preserve its own deadlines, fees and slippage constraints. Universal Router / PositionManager end-to-end paths have not been tested here and are required before production integration.

## LP and reward flows

Simulate modify(key,0,max,max,deadline) to see currently collectible LP fee token deltas. Submit the same action to collect. Principal is not included in that zero-change operation. Withdraw a negative liquidity amount with minimum token outputs; only caller's ledger balance may be burned. Earnings, principal, separately funded grants and total profitability are different quantities.

RewardVault.available(key(pool,epoch,user,token)) is the claim authority. It includes chain and vault in key derivation. claim(pool,epoch,token) transfers only caller's funded amount and zeroes it before transfer. Sponsor must deposit exact funding to create credits. The seeded pool has a discretionary epoch-1 tUSDC grant; no trading eligibility proof is claimed. Production preparation deploys rewards disabled.

## Indexing

Index PolicyCreated and AssetSupported from hook; Initialize, Swap and ModifyLiquidity from manager; Trade and PositionChanged from router; Funded and Claimed from vault. Router events explicitly name beneficiaries; generic manager sender may be a router, never assume it is the economic user. Fayn UI pool discovery joins Initialize to onchain policies, filters the deployed hook, and reads balances and liquidity from chain. Token amounts use live decimals. Claims are never enabled from index estimates alone.

The local index is pull-driven by state requests. For a service deployment, run a supervised continuous worker, configure conservative confirmations, monitor lag and retries, and treat RPC data as untrusted until verified. No external hosting has been published.
