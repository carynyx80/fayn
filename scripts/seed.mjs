import fs from 'node:fs';
import {MaxUint256,parseUnits} from 'ethers';
import {provider,deploy,deployHook,poolId,json,onlyLocal} from '../shared/chain.mjs';
await onlyLocal();
const signer=await provider.getSigner(0),user=await signer.getAddress();
const manager=await deploy('PoolManager',signer,[user]);
const {hook,factory,salt}=await deployHook(signer,await manager.getAddress(),user);
const tokenA=await deploy('DemoToken',signer,['Fayn Test Ether','tWETH',18]);
const tokenB=await deploy('DemoToken',signer,['Fayn Test Dollar','tUSDC',6]);
const tokens=[];
for(const t of [tokenA,tokenB]) {await(await hook.allowAsset(await t.getAddress())).wait();tokens.push({address:await t.getAddress(),symbol:await t.symbol(),decimals:Number(await t.decimals())});}
tokens.sort((a,b)=>BigInt(a.address)<BigInt(b.address)?-1:1);
const router=await deploy('FaynRouter',signer,[await manager.getAddress(),await hook.getAddress()]);
const vault=await deploy('RewardVault',signer,[user,true]);
for(const t of [tokenA,tokenB]) {await(await t.approve(await router.getAddress(),MaxUint256)).wait(); await(await t.approve(await vault.getAddress(),MaxUint256)).wait();}
const key={currency0:tokens[0].address,currency1:tokens[1].address,fee:0x800000,tickSpacing:60,hooks:await hook.getAddress()};
const now=Number((await provider.getBlock('latest')).timestamp);
const start=now+60,end=start+1800;
await(await hook.configure(key,start,end,30_000,3000)).wait();
// Initial price: 2,500 test dollars per test ether, normalized to raw token decimals.
const ratio=tokens[0].decimals===18?2500e-12:1/(2500e-12);
const sqrt=BigInt(Math.floor(Math.sqrt(ratio)*2**96));
await(await manager.initialize(key,sqrt)).wait();
await(await router.modify(key,10n**16n,MaxUint256,MaxUint256,now+3600)).wait();
if(Number((await provider.getBlock('latest')).timestamp)<start)await provider.send('evm_setNextBlockTimestamp',[start]);await provider.send('evm_mine',[]);
// A real seed swap creates observable v4 fee growth and event history.
const direction=tokens[0].decimals===18;
await(await router.swap(key,direction,-parseUnits('0.1',18),0,30_000,start+600)).wait();
await(await vault.fund(poolId(key),1,user,await tokenB.getAddress(),parseUnits('12.5',6))).wait();
const deployment={mode:'local',chainId:31337,createdAt:new Date().toISOString(),manager:await manager.getAddress(),hook:await hook.getAddress(),router:await router.getAddress(),vault:await vault.getAddress(),factory,salt,user,tokens,pools:[{id:poolId(key),name:'tWETH / tUSDC',key,start,end,opening:30000,normal:3000}],rebateToken:await tokenB.getAddress(),epoch:1};
fs.mkdirSync('runtime',{recursive:true});fs.writeFileSync('runtime/deployment.json',json(deployment));
console.log(json(deployment));
