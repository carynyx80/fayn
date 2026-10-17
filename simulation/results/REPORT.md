# Synthetic economic experiment

Reproduce with `npm run simulate`. Deterministic; no random market data or USD pricing. Two independent full-range constant-product proxies start at 100,000 tokens of each asset and price 1. Fees stay in reserves. Baseline 0.3%; Fayn 3% linearly decays to 0.3% over 30 minutes. Each trade costs 0.02 quote units of gas. Fee income is already included in inventory, never added again. Protocol revenue is zero.

| Scenario | Pool | LP fees | Inventory | vs hold | Trader cost + gas | Attacker P&L | Routed away | Rebates / funded |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| normal | Baseline | 68.55 | 200073.69 | 73.69 | 75.69 | 0.00 | 0.00 | 0.00 / 0.00 |
| normal | Fayn | 225.11 | 200229.83 | 229.83 | 231.83 | 0.00 | 0.00 | 0.00 / 0.00 |
| opening speculation | Baseline | 68.55 | 200583.16 | 583.16 | 585.16 | 0.00 | 0.00 | 0.00 / 0.00 |
| opening speculation | Fayn | 549.37 | 201041.79 | 1041.79 | 1043.79 | 0.00 | 0.00 | 0.00 / 0.00 |
| arbitrage | Baseline | 108.04 | 194555.29 | 45.73 | -661.22 | 661.22 | 0.00 | 0.00 / 0.00 |
| arbitrage | Fayn | 341.22 | 194779.03 | 269.47 | -432.83 | 432.83 | 0.00 | 0.00 / 0.00 |
| sandwich | Baseline | 9.08 | 200018.56 | 18.56 | 32.61 | 13.95 | 0.00 | 0.00 / 0.00 |
| sandwich | Fayn | 30.00 | 200039.32 | 39.32 | 39.34 | 0.00 | 0.00 | 0.00 / 0.00 |
| volatility shock | Baseline | 79.81 | 249730.07 | -269.93 | 243.60 | 0.00 | 0.00 | 0.00 / 0.00 |
| volatility shock | Fayn | 239.41 | 249929.21 | -70.79 | 402.57 | 0.00 | 0.00 | 0.00 / 0.00 |
| order splitting | Baseline | 68.55 | 200073.77 | 73.77 | 93.77 | 0.00 | 0.00 | 0.00 / 0.00 |
| order splitting | Fayn | 225.11 | 200230.09 | 230.09 | 250.09 | 0.00 | 0.00 | 0.00 / 0.00 |
| wallet rotation | Baseline | 68.55 | 200583.16 | 583.16 | 585.16 | 0.00 | 0.00 | 0.00 / 0.00 |
| wallet rotation | Fayn | 549.37 | 201041.79 | 1041.79 | 1043.79 | 0.00 | 0.00 | 0.00 / 0.00 |
| wait for expiry | Baseline | 68.55 | 200073.69 | 73.69 | 75.69 | 0.00 | 0.00 | 0.00 / 0.00 |
| wait for expiry | Fayn | 68.55 | 200073.69 | 73.69 | 75.69 | 0.00 | 0.00 | 0.00 / 0.00 |
| competing venue | Baseline | 68.55 | 200073.69 | 73.69 | 75.69 | 0.00 | 0.00 | 0.00 / 0.00 |
| competing venue | Fayn | 71.57 | 200071.81 | 71.81 | 73.15 | 0.00 | 7602.00 | 0.00 / 0.00 |
| rebate farming | Baseline | 30.00 | 200029.99 | 29.99 | 31.99 | -27.49 | 0.00 | 4.50 / 25.00 |
| rebate farming | Fayn | 98.85 | 200098.80 | 98.80 | 100.80 | -85.97 | 0.00 | 14.83 / 25.00 |

## Interpretation and starting parameters

Use 3% → 0.3% over 30 minutes only as a local experiment, not a production recommendation. Higher early fees increase ordinary trader costs too. Waiting eliminates the surcharge. Wallet rotation does not change the policy. Splitting does not evade a time-based fee, but creates more gas expense; integer rounding is modeled in contract tests, not here. Competing venues can reduce volume and fee revenue. Inventory value and loss versus holding can dominate fee income during shocks. No positive LP outcome is guaranteed.

The sandwich scenario explicitly orders front-run, victim and back-run with a victim 2% minimum-output bound; a grid search chooses profitable attacker size or no attack. It omits private order flow, builders, other arbitrageurs, tick crossing, latency and gas auctions. High fees cannot be claimed to prevent sandwiches from this small model. Arbitrage trades are a heuristic response to a stated external-price path, not optimal agents. Rebate farming uses capped sponsor spending at 15% of fees; this does not establish Sybil resistance. Real rebates remain disabled.

## Limits

Synthetic scenarios only. Constant-product approximation covers full-range reserves, not all v4 integer math or concentrated positions; exact v4 behavior is tested separately on the EVM. Gas is fixed and chain-independent. Order splitting and rotation scenarios use common schedules but are not a calibrated historical counterfactual. Price-sensitive routing is a stated threshold model. Fee changes alter behavior, so historical replay would not establish causal outcomes. No historical dataset, economic validation or production parameter recommendation is claimed. Use results to reject unsupported yield claims and require adversarial review before deployment.
