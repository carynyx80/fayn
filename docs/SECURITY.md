# Security review and release gates

Status: experimental, unaudited. Internal source review and passing tests are not an independent audit. No mainnet deployment, funds, production fee collection, or automatic rebates are authorized.

## Threats and bounded powers

* Transaction ordering: fees can change across blocks; quote fee ceilings and deadlines prevent worse fee acceptance through this router. Slippage remains user-selected; sandwiches within it remain possible. No fair-ordering guarantee. Public initialization is blocked; operator transaction bundles and chain-specific ordering still matter.
* Flash loans and just-in-time liquidity: v4 permits flash accounting and transient state. Full-range LP ownership remains isolated; active liquidity can change fee allocation. Sponsor grants use no volume heuristic. No resistance to JIT fee capture is claimed.
* Assets: only reviewed ERC20s; fee-on-transfer, rebase, malicious balanceOf and arbitrary callback behavior unsupported. SafeERC20 and settlement balance checks reduce, but do not eliminate, token risk. Hook operator can make unsafe future allowlist decisions. Allowlisting is additive and cannot change existing terms.
* Administration: immutable operator can configure future policies and initialize them; no upgrades or emergency pause. Compromised operator cannot rewrite prior policy or seize LP positions, but may create unsafe future pools. Use a multisig after review. There are no mutable material parameters needing a timelock in this version.
* Rewards: sponsor discretion is explicit. No publisher or Merkle mechanism. All grants require actual funding; contract has no rescue/admin withdrawal. Taxed payout tokens can underpay beneficiaries, so reviewed assets only. Rebates disabled in testnet preparation.
* Router: external entry points use ReentrancyGuard; callback requires PoolManager; wallet salt and ledger prevent other users withdrawing. No tx.origin or router identity used for classification. Cross-router aggregation is compatible at hook level but FaynRouter is not a general Universal Router replacement.
* Oracles: none used. UI has no USD oracles. Initial demo price uses approximate Number conversion and must be replaced with audited integer encoding for production.
* Backend: unlocked local signer is intentionally insecure for valuable assets. Loopback, origin/session checks and 31337 gate are basic isolation. Never expose Hardhat RPC or application port publicly. No real wallet signing, HTTPS auth, multi-user isolation or production process supervision is delivered.
* Indexer: canonical hash checks and replay cannot make a dishonest RPC trustworthy. Verify important state through independent RPC providers. The local demo has one confirmation; testnet needs a reviewed policy and alerts. Current index polling occurs when the app requests state, not a continuously managed daemon.

## Rebate abuse assessment

Wash trading and self-trading can manufacture volume. Wallet rotation/Sybils break per-wallet caps. Router senders do not establish economic trader identity. Flash-funded trades and boundary bursts can game epochs. The synthetic capped rebate experiment does not validate a production policy. Grants here are deliberate funded demo credits; no grant derives from volume, age or transaction count. Real trader rebates remain off. A future mechanism needs independent economic and adversarial review before activation.

## Required before production

- [ ] Independent audit of hook, router, vault and end-to-end integration.
- [ ] Chain-specific fork tests with protocol-fee configurations and third-party routers/aggregators.
- [ ] External wallet signing, network switching, allowance management and reviewed testnet UX.
- [ ] Foundry fuzz/invariant campaign, symbolic/static analysis and adversarial token coverage.
- [ ] Audited integer initial-price encoding and liquidity/token amount previews.
- [ ] Contract verification, bytecode/address attestation and multisig deployment rehearsals.
- [ ] Automatic fee reconciliation, monitored RPC/indexer workers, price-impact calculation and accurate pool liquidity/volume metrics.
- [ ] Backup/restore drills, rate limiting, independent RPC validation and secrets management.
- [ ] Validated economic parameters; no claim that launch fees identify or prevent all MEV.
- [ ] If ever enabled, rigorously reviewed rebate abuse policy with funded caps.

Tests and tool availability are listed in TEST-RESULTS.md after execution. Slither and Foundry are not installed in this environment; absence is not a pass.
