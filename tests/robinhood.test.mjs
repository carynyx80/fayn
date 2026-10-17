import {test} from 'node:test';import assert from 'node:assert/strict';import {Interface} from 'ethers';
import {robinhoodStatus} from '../services/robinhood-status.mjs';import handler from '../api/robinhood.mjs';
const abi=new Interface(['function symbol() view returns(string)','function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)']);
function fixture({chain='0x1237',badToken=false,missing=false}={}){
 return async(url,options)=>{const requests=JSON.parse(options.body);const result=requests.map(q=>{let value;
  if(q.method==='eth_chainId')value=chain;else if(q.method==='eth_blockNumber')value='0x64';else if(q.method==='eth_gasPrice')value='0x1312d00';else if(q.method==='eth_getBalance')value='0x38d7ea4c68000';else if(q.method==='eth_getCode')value='0x60006000';
  else {const decoded=abi.parseTransaction(q.params[0]),weth=q.params[0].to.toLowerCase().startsWith('0x0bd7');value=decoded.name==='symbol'?abi.encodeFunctionResult('symbol',[badToken?'FAKE':weth?'WETH':'USDG']):decoded.name==='decimals'?abi.encodeFunctionResult('decimals',[weth?18:6]):abi.encodeFunctionResult('balanceOf',[0]);}
  return {jsonrpc:'2.0',id:q.id,result:value};});return new Response(JSON.stringify(missing?result.slice(0,-1):result));};
}
test('read-only Robinhood status validates chain, canonical tokens, balances and non-live release status',async()=>{
 const s=await robinhoodStatus({fetcher:fixture(),clock:()=>100000});assert.equal(s.chainId,4663);assert.equal(s.mode,'read-only-mainnet');assert.equal(s.tokens.WETH.decimals,18);assert.equal(s.tokens.USDG.decimals,6);assert.equal(s.deployment.status,'not-deployed');assert.equal(s.deployment.tradingAvailable,false);assert.equal(s.deployment.gasBudgetVerified,false);assert.equal(s.deployment.initialLiquidityBudget,'0');
});
test('wrong chains, fake tokens, incomplete batches and RPC failures are rejected',async()=>{
 await assert.rejects(robinhoodStatus({fetcher:fixture({chain:'0x1'})}),/wrong chain/);await assert.rejects(robinhoodStatus({fetcher:fixture({badToken:true})}),/metadata mismatch/);await assert.rejects(robinhoodStatus({fetcher:fixture({missing:true})}),/incomplete/);await assert.rejects(robinhoodStatus({fetcher:async()=>new Response('',{status:429})}),/429/);
});
test('Vercel mainnet status endpoint forbids transaction/POST operations without touching RPC',async()=>{
 const headers={};let output;const res={setHeader:(k,v)=>headers[k]=v,end:body=>{output=JSON.parse(body);}};await handler({method:'POST'},res);assert.equal(res.statusCode,405);assert.equal(headers.Allow,'GET');assert(output.error.includes('Read-only'));
});
