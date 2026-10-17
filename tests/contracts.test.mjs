import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {MaxUint256,ZeroHash} from 'ethers';
import {provider,deploy,deployHook,poolId,contract,onlyLocal} from '../shared/chain.mjs';
let signer,other,user,manager,hook,router,vault,tokens,key,id,start,end;
const tx=async p=>{const t=await p;await t.wait();return t;};
const now=async()=>Number((await provider.getBlock('latest')).timestamp);
before(async()=>{
 await onlyLocal();signer=await provider.getSigner(0);other=await provider.getSigner(1);user=await signer.getAddress();
 manager=await deploy('PoolManager',signer,[user]);({hook}=await deployHook(signer,await manager.getAddress(),user));
 tokens=[await deploy('DemoToken',signer,['Test 6','T6',6]),await deploy('DemoToken',signer,['Test 18','T18',18])];
 tokens.sort((a,b)=>BigInt(a.target)<BigInt(b.target)?-1:1);
 router=await deploy('FaynRouter',signer,[manager.target,hook.target]);vault=await deploy('RewardVault',signer,[user,true]);
 for(const t of tokens){await tx(hook.allowAsset(t.target));await tx(t.approve(router.target,MaxUint256));await tx(t.approve(vault.target,MaxUint256));}
 key={currency0:tokens[0].target,currency1:tokens[1].target,fee:0x800000,tickSpacing:60,hooks:hook.target};id=poolId(key);start=(await now())+100;end=start+1800;
 await tx(hook.configure(key,start,end,30000,3000));
 await assert.rejects(manager.connect(other).initialize.staticCall(key,2n**96n));
 await tx(manager.initialize(key,2n**96n));await tx(router.modify(key,10n**12n,MaxUint256,MaxUint256,start+5000));
});
test('fee boundaries, rounding and 200 reproducible fuzz timestamps',async()=>{
 assert.equal(await hook.feeAt(id,start-1),30000n);assert.equal(await hook.feeAt(id,start),30000n);assert.equal(await hook.feeAt(id,end),3000n);assert.equal(await hook.feeAt(id,end+1),3000n);
 let random=48121,previous=30000n;
 for(let i=0;i<200;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const time=start+random%1801;const expected=3000n+(27000n*BigInt(end-time)+1799n)/1800n;assert.equal(await hook.feeAt(id,time),expected);}
 for(let time=start;time<=end;time+=100){const fee=await hook.feeAt(id,time);assert(fee<=previous && fee>=3000n);previous=fee;}
});
test('configuration authorization, immutable terms, fee/window and asset bounds',async()=>{
 await assert.rejects(hook.connect(other).allowAsset.staticCall(tokens[0].target));
 await assert.rejects(hook.connect(other).configure.staticCall(key,start,end,30000,3000));
 await assert.rejects(hook.configure.staticCall(key,start,end,30000,3000));
 const extra=await deploy('DemoToken',signer,['Bounds fixture','BOUND',18]);await tx(hook.allowAsset(extra.target));
 const ordered=[tokens[0].target,extra.target].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1),fresh={...key,currency0:ordered[0],currency1:ordered[1]};
 for(const [open,base,duration] of [[100001,3000,60],[3000,99,60],[3000,10001,60],[100,3000,60],[3000,3000,86401],[3000,3000,0]])await assert.rejects(hook.configure.staticCall(fresh,(await now())+5,(await now())+5+duration,open,base),e=>e.data?.startsWith(hook.interface.getError('InvalidPolicy').selector));
 await hook.configure.staticCall(fresh,(await now())+5,(await now())+65,100000,100);
 await assert.rejects(hook.allowAsset.staticCall(await other.getAddress()));
 await assert.rejects(router.swap.staticCall({...key,currency0:await other.getAddress()},true,-1000,0,30000,start+1000));
});
test('prestart trading rejects; hook rejects direct callbacks',async()=>{
 await assert.rejects(router.swap.staticCall(key,true,-1000,0,30000,start+1000));
 await assert.rejects(hook.beforeSwap.staticCall(user,key,{zeroForOne:true,amountSpecified:-1000,sqrtPriceLimitX96:4295128740},'0x'));
 await assert.rejects(router.unlockCallback.staticCall('0x'));
 await provider.send('evm_setNextBlockTimestamp',[start]);await provider.send('evm_mine',[]);
});
test('both directions and exact-input/output preserve balances and native LP fees',async()=>{
 for(const direction of [true,false])for(const exactOutput of [false,true]){
  const amount=1000000n,input=direction?0:1,output=1-input;
  const before=await Promise.all(tokens.map(t=>t.balanceOf(user)));
  const managerBefore=await Promise.all(tokens.map(t=>t.balanceOf(manager.target)));
  const delta=await router.swap.staticCall(key,direction,exactOutput?amount:-amount,exactOutput?MaxUint256:0,30000,end+1000);
  assert.equal(exactOutput?delta[output]:-delta[input],amount);
  const receipt=await(await router.swap(key,direction,exactOutput?amount:-amount,exactOutput?MaxUint256:0,30000,end+1000)).wait();
  const event=receipt.logs.map(l=>{try{return router.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='Trade');assert(event);
  for(let i=0;i<2;i++){
   const movement=await tokens[i].balanceOf(user)-before[i];assert.equal(movement,event.args[i===0?'amount0':'amount1']);
   assert.equal((await tokens[i].balanceOf(manager.target))-managerBefore[i],-movement);
   assert.equal(await tokens[i].balanceOf(router.target),0n);
  }
 }
 const earnings=await router.modify.staticCall(key,0,MaxUint256,MaxUint256,end+1000);assert(earnings.some(x=>x>0n));
 await tx(router.modify(key,0,MaxUint256,MaxUint256,end+1000));
 const after=await router.modify.staticCall(key,0,MaxUint256,MaxUint256,end+1000);assert(after.every(x=>x===0n));
});
test('slippage, fee ceilings, deadline, balances and LP ownership fail safely',async()=>{
 await assert.rejects(router.swap.staticCall(key,true,-1000,MaxUint256,30000,end+1000));
 await assert.rejects(router.swap.staticCall(key,true,1000000,1,30000,end+1000));
 await assert.rejects(router.swap.staticCall(key,true,-1000,0,99,end+1000));
 await assert.rejects(router.swap.staticCall(key,true,-1000,0,30000,0));
 await assert.rejects(router.connect(other).modify.staticCall(key,-1,0,0,end+1000));
 await assert.rejects(router.connect(other).swap.staticCall(key,true,-1000000,0,30000,end+1000));
});
test('20 alternating fuzz swaps reconcile wallet/manager token conservation',async()=>{
 let random=91231;const initial=await Promise.all(tokens.map(async t=>(await t.balanceOf(user))+(await t.balanceOf(manager.target))));
 for(let i=0;i<20;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const amount=1000n+BigInt(random%1000000);await tx(router.swap(key,i%2===0,-amount,0,30000,end+1000));
  for(let j=0;j<2;j++){assert.equal((await tokens[j].balanceOf(user))+(await tokens[j].balanceOf(manager.target)),initial[j]);assert.equal(await tokens[j].balanceOf(router.target),0n);}
 }
});
test('liquidity add, collect, partial and full withdrawal preserve ownership',async()=>{
 const old=await router.liquidity(id,user);await tx(router.modify(key,100000n,MaxUint256,MaxUint256,end+1000));assert.equal(await router.liquidity(id,user),old+100000n);
 await tx(router.modify(key,-100000n,0,0,end+1000));assert.equal(await router.liquidity(id,user),old);
 await tx(router.modify(key,-old,0,0,end+1000));assert.equal(await router.liquidity(id,user),0n);
});
test('funding conservation, authorization, duplicate claims and epoch/pool/vault replay',async()=>{
 const token=tokens[0];await assert.rejects(vault.claim.staticCall(id,1,token.target));
 await assert.rejects(vault.connect(other).fund.staticCall(id,1,user,token.target,1000));
 const amount=10000n;await tx(vault.fund(id,1,user,token.target,amount));
 assert.equal(await vault.liabilities(token.target),amount);assert.equal(await token.balanceOf(vault.target),amount);
 await assert.rejects(vault.claim.staticCall(ZeroHash,1,token.target));await assert.rejects(vault.claim.staticCall(id,2,token.target));await assert.rejects(vault.connect(other).claim.staticCall(id,1,token.target));
 const otherVault=await deploy('RewardVault',signer,[user,true]);assert.notEqual(await otherVault.key(id,1,user,token.target),await vault.key(id,1,user,token.target));
 await tx(vault.claim(id,1,token.target));assert.equal(await token.balanceOf(vault.target),0n);assert.equal(await vault.liabilities(token.target),0n);await assert.rejects(vault.claim.staticCall(id,1,token.target));
 const disabled=await deploy('RewardVault',signer,[user,false]);await assert.rejects(disabled.fund.staticCall(id,1,user,token.target,1));
 await assert.rejects(vault.fund.staticCall(id,2,user,token.target,MaxUint256));
});
