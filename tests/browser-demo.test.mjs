import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDemoApi,units,feeAt} from '../web/browser-demo.js';
function fixture(){const entries=new Map();let time=Date.UTC(2026,9,17,12),n=0;const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};const api=createDemoApi({storage,clock:()=>time,id:()=>`id-${++n}`});
 const call=async(path,body)=>{const r=await api.request('/api/'+path,body?{method:'POST',body:JSON.stringify(body)}:{});return {status:r.status,body:await r.json()};};
 return {api,storage,call,advance:ms=>time+=ms,raw:()=>JSON.parse(entries.get('fayn-browser-demo-v1')),state:async()=>(await call('state')).body};}
const approve=async(f,p)=>{for(let token=0;token<2;token++)assert.equal((await f.call('approve',{pool:p.id,token})).status,200);};
test('hosted mode seeds explicit simulated state and persists across adapter reload',async()=>{
 const f=fixture(),s=await f.state();assert.equal(s.browserDemo,true);assert.equal(s.chainId,null);assert.deepEqual(s.contracts,{});assert.equal(s.pools.length,1);assert.equal(s.pools[0].trades,0);assert.equal(s.pools[0].rebate,'12.5');
 const restored=createDemoApi({storage:f.storage});const r=await restored.request('/api/state');assert.equal((await r.json()).pools[0].id,s.pools[0].id);
});
test('browser fee units, boundary decay and token precision are explicit',()=>{
 const p={start:1000,end:2800,opening:30000,normal:3000};assert.equal(feeAt(p,999),30000);assert.equal(feeAt(p,1000),30000);assert.equal(feeAt(p,1900),16500);assert.equal(feeAt(p,2800),3000);
 assert.equal(units('1.000001',6),1000001n);assert.throws(()=>units('1.0000001',6));assert.throws(()=>units('-1',18));assert.throws(()=>units('1e9',6));
});
test('approval, exact input/output in both directions and conservation of each asset',async()=>{
 const f=fixture(),s=await f.state(),p=s.pools[0];assert.equal((await f.call('quote',{pool:p.id,amount:'0.1',direction:true})).status,400);await approve(f,p);
 const totals=()=>{const d=f.raw(),pool=d.pools[0];return pool.addresses.map((a,i)=>BigInt(d.balances[a])+BigInt(pool.reserves[i])+BigInt(pool.feeVault[i]));};const before=totals();
 for(const direction of [true,false])for(const exactOutput of [false,true]){
  const amount=exactOutput?(direction?'10':'0.001'):(direction?'0.01':'10');
  const q=await f.call('quote',{pool:p.id,amount,direction,exactOutput,slippage:.5});assert.equal(q.status,200,JSON.stringify(q.body));assert(q.body.priceImpact>=0);
  assert.equal(exactOutput?Number(q.body.received):Number(q.body.spent),Number(amount));
  assert.equal((await f.call('swap',{quote:q.body.id})).status,200);assert.equal((await f.call('swap',{quote:q.body.id})).status,400);assert.deepEqual(totals(),before);
 }
 assert.equal((await f.state()).pools[0].trades,4);
});
test('expired, stale and insufficient-balance quotes cannot execute',async()=>{
 const f=fixture(),p=(await f.state()).pools[0];await approve(f,p);
 const body={pool:p.id,amount:'0.1',direction:true,slippage:.5},q=(await f.call('quote',body)).body;
 f.advance(45000);assert.equal((await f.call('swap',{quote:q.id})).status,400);
 const a=(await f.call('quote',body)).body,b=(await f.call('quote',body)).body;assert.equal((await f.call('swap',{quote:a.id})).status,200);assert.equal((await f.call('swap',{quote:b.id})).status,400);
 assert.equal((await f.call('quote',{...body,amount:'100000000000'})).status,400);
 assert.equal((await f.call('quote',{...body,slippage:8})).status,400);
});
test('LP earnings are funded, collect once, and position ownership bounds removal',async()=>{
 const f=fixture(),p=(await f.state()).pools[0];await approve(f,p);const q=(await f.call('quote',{pool:p.id,direction:true,amount:'1'})).body;await f.call('swap',{quote:q.id});
 assert(Number((await f.state()).pools[0].earnings[0])>0);
 const feesBefore=f.raw().pools[0].feeVault.map(BigInt);assert.equal((await f.call('liquidity',{pool:p.id,units:'0'})).status,200);assert((await f.state()).pools[0].earnings.every(v=>Number(v)===0));
 const balances=f.raw().balances;await f.call('liquidity',{pool:p.id,units:'0'});assert.deepEqual(f.raw().balances,balances);assert(BigInt(f.raw().pools[0].feeVault[0])<feesBefore[0]);
 for(const units of ['1000000000000','-1000000000000'])assert.equal((await f.call('liquidity',{pool:p.id,units})).status,200);
 assert.equal((await f.call('liquidity',{pool:p.id,units:'-'+(BigInt(p.position)+1n)})).status,400);
 assert.equal((await f.call('liquidity',{pool:p.id,units:'-'+p.position})).status,200);assert.equal((await f.state()).pools[0].position,'0');
});
test('funded simulated rebate is paid once and unrelated pools have no grants',async()=>{
 const f=fixture(),p=(await f.state()).pools[0],before=BigInt(f.raw().balances['demo-token-usdc']);assert.equal((await f.call('claim',{pool:p.id})).status,200);
 assert.equal(BigInt(f.raw().balances['demo-token-usdc'])-before,12500000n);assert.equal((await f.call('claim',{pool:p.id})).status,400);assert.equal((await f.state()).pools[0].rebate,'0');
});
test('pool creation validates bounds, consumes liquidity and supports new-pool trades',async()=>{
 const f=fixture(),initial=await f.state(),body={symbol:'BITE',opening:3,normal:.3,duration:30,price:'1',liquidity:'100'};
 for(const invalid of [{opening:11},{normal:1.1},{opening:.1},{duration:1441},{symbol:'<img>'},{liquidity:'100000000000000'}])assert.equal((await f.call('create',{...body,...invalid})).status,400);
 const created=await f.call('create',body);assert.equal(created.status,200,JSON.stringify(created.body));const s=await f.state(),p=s.pools.find(p=>p.id===created.body.pool);assert(p);assert.equal(p.rebate,'0');assert.equal(p.fee,30000);assert.equal(s.pools.length,initial.pools.length+1);
 assert.equal((await f.call('claim',{pool:p.id})).status,400);const q=await f.call('quote',{pool:p.id,amount:'1',direction:true});assert.equal(q.status,200);assert.equal((await f.call('swap',{quote:q.body.id})).status,200);
});
test('reset restores an isolated demo; unsupported methods and bad storage fail clearly',async()=>{
 const f=fixture();await f.state();await f.call('claim',{pool:'demo-pool-1'});assert.equal((await f.call('reset',{})).status,200);assert.equal((await f.state()).pools[0].rebate,'12.5');
 assert.equal((await f.call('claim')).status,400);f.storage.setItem('fayn-browser-demo-v1','broken');assert.equal((await f.call('state')).status,400);assert.equal((await f.call('reset',{})).status,200);
});
