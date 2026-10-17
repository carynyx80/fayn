import network from '../shared/robinhood.json' with {type:'json'};
import {Interface,formatEther,formatUnits,keccak256} from 'ethers';
const abi=new Interface(['function symbol() view returns(string)','function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)']);
export async function robinhoodStatus({fetcher=globalThis.fetch,clock=()=>Date.now(),rpcUrl=process.env.ROBINHOOD_RPC_URL||network.rpcUrl}={}){
 const calls=[];const add=(method,params)=>{calls.push({jsonrpc:'2.0',id:calls.length+1,method,params});return calls.length;};
 const ids={chain:add('eth_chainId',[]),block:add('eth_blockNumber',[]),balance:add('eth_getBalance',[network.operator,'latest']),gas:add('eth_gasPrice',[]),manager:add('eth_getCode',[network.poolManager,'latest'])};
 const assets={};for(const [symbol,token]of Object.entries(network.assets))assets[symbol]={...token,symbolId:add('eth_call',[{to:token.address,data:abi.encodeFunctionData('symbol')},'latest']),decimalsId:add('eth_call',[{to:token.address,data:abi.encodeFunctionData('decimals')},'latest']),balanceId:add('eth_call',[{to:token.address,data:abi.encodeFunctionData('balanceOf',[network.operator])},'latest'])};
 const response=await fetcher(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(calls),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(`Robinhood RPC unavailable (${response.status})`);
 const rows=await response.json();if(!Array.isArray(rows))throw Error('Robinhood RPC did not return a batch');
 const results=new Map(rows.map(r=>[r.id,r]));
 const get=id=>{const r=results.get(id);if(!r||r.error||r.result===undefined)throw Error('Robinhood RPC returned an incomplete or failed read');return r.result;};
 if(BigInt(get(ids.chain))!==4663n)throw Error('RPC returned the wrong chain; mainnet status rejected');
 const managerCode=get(ids.manager);if(!/^0x[0-9a-f]+$/i.test(managerCode)||managerCode==='0x')throw Error('Official PoolManager code not found');
 const tokens={};for(const [symbol,asset]of Object.entries(assets)){
  const actual=abi.decodeFunctionResult('symbol',get(asset.symbolId))[0],decimals=Number(abi.decodeFunctionResult('decimals',get(asset.decimalsId))[0]);
  if(actual!==symbol||decimals!==asset.decimals)throw Error(`Token metadata mismatch for ${symbol}`);
  const raw=abi.decodeFunctionResult('balanceOf',get(asset.balanceId))[0];tokens[symbol]={address:asset.address,decimals,balanceRaw:raw.toString(),balance:formatUnits(raw,decimals)};
 }
 return {mode:'read-only-mainnet',chainId:4663,name:network.name,checkedAt:new Date(clock()).toISOString(),block:Number(BigInt(get(ids.block))),operator:network.operator,explorer:network.explorer,nativeBalanceWei:BigInt(get(ids.balance)).toString(),nativeBalanceEth:formatEther(BigInt(get(ids.balance))),gasPriceWei:BigInt(get(ids.gas)).toString(),tokens,manager:{address:network.poolManager,codeHash:keccak256(managerCode)},deployment:{hook:null,router:null,vault:null,status:'not-deployed',budgetUsd:'2.00',gasCostEstimateUsd:null,gasBudgetVerified:false,initialLiquidityBudget:'0',tradingAvailable:false},limitations:['No Fayn contracts or funded Fayn pool are deployed.','Zero initial liquidity cannot execute a swap.','The $2 gas cap has not been validated against a complete deployment estimate.','Read-only public RPC is rate limited; production needs a supervised provider and indexer.','Wallet signing and independent security review remain required.']};
}
