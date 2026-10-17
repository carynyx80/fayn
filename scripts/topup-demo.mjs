import {provider,contract,loadDeployment,onlyLocal} from '../shared/chain.mjs';
await onlyLocal();const d=loadDeployment(),s=await provider.getSigner(0),v=contract('RewardVault',d.vault,s);
await(await v.fund(d.pools[0].id,1,d.user,d.rebateToken,12500000)).wait();await provider.send('evm_mine',[]);console.log('Funded an additional local 12.5 tUSDC demo grant.');
