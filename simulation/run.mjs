import fs from 'node:fs';
// Synthetic full-range constant-product proxy, NOT v4 tick math or historical replay.
// One unit gas cost = 0.02 quote tokens per swap. External prices stated per scenario.
const scenarios=['normal','opening speculation','arbitrage','sandwich','volatility shock','order splitting','wallet rotation','wait for expiry','competing venue','rebate farming'];
const fee=t=>t>=1800?.003:.003+.027*(1-t/1800);
function swap(p,amount,buy,f){const r=buy?p.y:p.x,s=buy?p.x:p.y,net=amount*(1-f),out=s*net/(r+net);if(buy){p.y+=amount;p.x-=out;}else{p.x+=amount;p.y-=out;}p.fees+=amount*f*(buy?1:p.external);p.gas+=.02;return out;}
function run(name,protectedPool){
 const p={x:100000,y:100000,fees:0,gas:0,external:1},initial=200000;let traderCost=0,attackerProfit=0,volumeLost=0,spend=0,worstImpact=0,requested=0,executed=0;
 const funded=name==='rebate farming'?25:0;
 if(name==='sandwich'){
  // Exhaustive attacker front-run size scan, victim 1,000 quote, max 2% slippage.
  const base=protectedPool?fee(0):.003,clean=structuredClone(p),expected=swap(clean,1000,true,base);let best={profit:0,size:0};
  for(let size=10;size<=2000;size+=10){const trial=structuredClone(p),acquired=swap(trial,size,true,base),victim=swap(trial,1000,true,base);if(victim<expected*.98)continue;const returned=swap(trial,acquired,false,base),profit=returned-size-.04;if(profit>best.profit)best={profit,size};}
  if(best.size){const acquired=swap(p,best.size,true,base);const output=swap(p,1000,true,base);swap(p,acquired,false,base);traderCost=1000-output;attackerProfit=best.profit;executed=3;}else{const output=swap(p,1000,true,base);traderCost=1000-output;executed=1;}
  requested=executed;
 } else {
  for(let i=0;i<100;i++){
   let t=i*36,amount=80+(i*73%300),buy=i%2===0;
   if(['opening speculation','wallet rotation'].includes(name)){t=i*8;buy=i<70;}
   if(name==='wait for expiry')t=1801+i*5;
   if(name==='volatility shock'&&i>35)p.external=1.5;
   if(name==='arbitrage'){p.external=1+Math.sin(i/10)*.12;const price=p.y/p.x;buy=price<p.external;amount=Math.min(500,Math.abs(price-p.external)*p.x*.2);if(amount<1)continue;}
   const f=protectedPool?fee(t):.003;requested++;
   // Price-sensitive flow may route to a competing baseline venue.
   const willingness=.003+(i%20)*.001;
   if(name==='competing venue'&&f>willingness){volumeLost+=amount;continue;}
   if(name==='rebate farming'){amount=100;buy=i%2===0;}
   const spot=p.y/p.x,beforeValue=buy?amount:amount*p.external;
   let output=0;
   if(name==='order splitting'){for(let j=0;j<10;j++)output+=swap(p,amount/10,buy,f);}else output=swap(p,amount,buy,f);
   const valueOut=buy?output*p.external:output,tradingCost=beforeValue-valueOut;
   traderCost+=tradingCost;executed++;worstImpact=Math.max(worstImpact,buy?1-output/(amount/spot):1-output/(amount*spot));
   if(name==='arbitrage')attackerProfit+=-tradingCost-.02;
   if(name==='rebate farming'){const grant=Math.min(funded-spend,amount*f*.15);spend+=Math.max(0,grant);attackerProfit+=-tradingCost+Math.max(0,grant)-.02;}
  }
 }
 const inventory=p.x*p.external+p.y,hold=100000*p.external+100000;
 return {scenario:name,variant:protectedPool?'Fayn':'Baseline',lpFeeIncome:p.fees,lpInventoryValue:inventory,totalPositionOutcome:inventory-initial,vsHolding:inventory-hold,traderCostIncludingGas:traderCost+p.gas,worstImpactPercent:worstImpact*100,attackerProfit,volumeLost,protocolRevenue:0,rebateSpending:spend,rebateFunding:funded,fundingSufficient:spend<=funded,requested,executed,gas:p.gas};
}
const results=scenarios.flatMap(s=>[run(s,false),run(s,true)]);fs.mkdirSync('simulation/results',{recursive:true});fs.writeFileSync('simulation/results/results.json',JSON.stringify(results,null,2));
const f=n=>n.toFixed(2);let report='# Synthetic economic experiment\n\nReproduce with `npm run simulate`. Deterministic; no random market data or USD pricing. Two independent full-range constant-product proxies start at 100,000 tokens of each asset and price 1. Fees stay in reserves. Baseline 0.3%; Fayn 3% linearly decays to 0.3% over 30 minutes. Each trade costs 0.02 quote units of gas. Fee income is already included in inventory, never added again. Protocol revenue is zero.\n\n| Scenario | Pool | LP fees | Inventory | vs hold | Trader cost + gas | Attacker P&L | Routed away | Rebates / funded |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
for(const r of results)report+=`| ${r.scenario} | ${r.variant} | ${f(r.lpFeeIncome)} | ${f(r.lpInventoryValue)} | ${f(r.vsHolding)} | ${f(r.traderCostIncludingGas)} | ${f(r.attackerProfit)} | ${f(r.volumeLost)} | ${f(r.rebateSpending)} / ${f(r.rebateFunding)} |\n`;
report+='\n## Interpretation and starting parameters\n\nUse 3% → 0.3% over 30 minutes only as a local experiment, not a production recommendation. Higher early fees increase ordinary trader costs too. Waiting eliminates the surcharge. Wallet rotation does not change the policy. Splitting does not evade a time-based fee, but creates more gas expense; integer rounding is modeled in contract tests, not here. Competing venues can reduce volume and fee revenue. Inventory value and loss versus holding can dominate fee income during shocks. No positive LP outcome is guaranteed.\n\nThe sandwich scenario explicitly orders front-run, victim and back-run with a victim 2% minimum-output bound; a grid search chooses profitable attacker size or no attack. It omits private order flow, builders, other arbitrageurs, tick crossing, latency and gas auctions. High fees cannot be claimed to prevent sandwiches from this small model. Arbitrage trades are a heuristic response to a stated external-price path, not optimal agents. Rebate farming uses capped sponsor spending at 15% of fees; this does not establish Sybil resistance. Real rebates remain disabled.\n\n## Limits\n\nSynthetic scenarios only. Constant-product approximation covers full-range reserves, not all v4 integer math or concentrated positions; exact v4 behavior is tested separately on the EVM. Gas is fixed and chain-independent. Order splitting and rotation scenarios use common schedules but are not a calibrated historical counterfactual. Price-sensitive routing is a stated threshold model. Fee changes alter behavior, so historical replay would not establish causal outcomes. No historical dataset, economic validation or production parameter recommendation is claimed. Use results to reject unsupported yield claims and require adversarial review before deployment.\n';
fs.writeFileSync('simulation/results/REPORT.md',report);console.log(report);
