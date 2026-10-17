// Generates unsigned deployment transactions only. Never sends or accepts a private key.
import fs from 'node:fs';
import {JsonRpcProvider,ContractFactory,Interface,getCreateAddress,getCreate2Address,keccak256,zeroPadValue,toBeHex,isAddress} from 'ethers';
import {artifact,json} from '../shared/chain.mjs';
const [deployer,operator]=process.argv.slice(2);
if(!isAddress(deployer)||!isAddress(operator)||!process.env.SEPOLIA_RPC_URL)throw Error('Usage: SEPOLIA_RPC_URL set; node scripts/prepare-testnet.mjs DEPLOYER MULTISIG_OPERATOR');
const rpc=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);if((await rpc.getNetwork()).chainId!==11155111n)throw Error('Sepolia only');
const network=JSON.parse(fs.readFileSync('shared/networks.json')).sepolia;
const managerCode=await rpc.getCode(network.poolManager);if(managerCode==='0x')throw Error('No PoolManager code at official address');
const nonce=await rpc.getTransactionCount(deployer,'pending');
const code=async(name,args)=>{const a=artifact(name);return(await new ContractFactory(a.abi,a.bytecode).getDeployTransaction(...args)).data;};
const factory=getCreateAddress({from:deployer,nonce}),hookInit=await code('FaynHook',[network.poolManager,operator]);const initHash=keccak256(hookInit);let salt,hook;
for(let i=0;i<2_000_000;i++){salt=zeroPadValue(toBeHex(i),32);hook=getCreate2Address(factory,salt,initHash);if((BigInt(hook)&16383n)===8320n)break;hook=null;}
if(!hook)throw Error('Salt search exhausted');
const router=getCreateAddress({from:deployer,nonce:nonce+2}),vault=getCreateAddress({from:deployer,nonce:nonce+3});
const transactions=[{nonce,data:await code('Create2Factory',[])},{nonce:nonce+1,to:factory,data:new Interface(artifact('Create2Factory').abi).encodeFunctionData('deploy',[salt,hookInit])},{nonce:nonce+2,data:await code('FaynRouter',[network.poolManager,hook])},{nonce:nonce+3,data:await code('RewardVault',[operator,false])}].map(t=>({...t,chainId:11155111,from:deployer,value:'0x0'}));
const plan={warning:'UNSIGNED. Review, estimate, sign via secure wallet, broadcast ONLY with authorization. Regenerate if deployer nonce changes.',manager:network.poolManager,managerCodeHash:keccak256(managerCode),factory,hook,router,vault,salt,operator,rebatesEnabled:false,transactions,verification:[{contract:'Create2Factory',address:factory,args:[]},{contract:'FaynHook',address:hook,args:[network.poolManager,operator]},{contract:'FaynRouter',address:router,args:[network.poolManager,hook]},{contract:'RewardVault',address:vault,args:[operator,false]}]};
fs.mkdirSync('runtime',{recursive:true});fs.writeFileSync('runtime/sepolia-unsigned.json',json(plan));console.log(json(plan));
