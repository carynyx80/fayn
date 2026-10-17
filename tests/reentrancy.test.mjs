import {test} from 'node:test';import assert from 'node:assert/strict';import {MaxUint256,ZeroHash} from 'ethers';import {provider,deploy} from '../shared/chain.mjs';
test('vault blocks token-driven recursive claims and rejects transfer-tax funding atomically',async()=>{
 const s=await provider.getSigner(0),user=await s.getAddress(),token=await deploy('AdversarialToken',s),vault=await deploy('RewardVault',s,[user,true]);
 await(await token.approve(vault.target,MaxUint256)).wait();await(await vault.fund(ZeroHash,1,token.target,token.target,10000)).wait();
 await(await token.arm(vault.target,ZeroHash,false)).wait();await(await token.runClaim()).wait();
 assert.equal(await token.blocked(),true);assert.equal(await token.balanceOf(token.target),10000n);assert.equal(await vault.liabilities(token.target),0n);
 await(await token.arm(vault.target,ZeroHash,true)).wait();const before=await token.balanceOf(user);await assert.rejects(vault.fund.staticCall(ZeroHash,2,user,token.target,1000));assert.equal(await token.balanceOf(user),before);
});
