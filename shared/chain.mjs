import fs from 'node:fs';
import {JsonRpcProvider,Contract,ContractFactory,AbiCoder,keccak256,getCreate2Address,toBeHex,zeroPadValue} from 'ethers';
export const provider=new JsonRpcProvider(process.env.RPC_URL||'http://127.0.0.1:8545',undefined,{cacheTimeout:-1});
provider.pollingInterval=100;
export const artifact=name=>JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
export const contract=(name,address,runner=provider)=>new Contract(address,artifact(name).abi,runner);
export const deploy=async(name,signer,args=[])=>{const a=artifact(name);const c=await new ContractFactory(a.abi,a.bytecode,signer).deploy(...args);await c.waitForDeployment();return c;};
export async function deployHook(signer,manager,operator){
 const factory=await deploy('Create2Factory',signer);
 const a=artifact('FaynHook');
 const init=(await new ContractFactory(a.abi,a.bytecode,signer).getDeployTransaction(manager,operator)).data;
 const hash=keccak256(init); let salt,address;
 for(let i=0;i<2_000_000;i++) { salt=zeroPadValue(toBeHex(i),32); address=getCreate2Address(await factory.getAddress(),salt,hash); if((BigInt(address)&16383n)===8320n)break;address=null; }
 if(!address)throw Error('CREATE2 salt search exhausted');
 await(await factory.deploy(salt,init)).wait();
 return {hook:contract('FaynHook',address,signer),factory:await factory.getAddress(),salt,init};
}
export const poolId=key=>keccak256(AbiCoder.defaultAbiCoder().encode(['tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'],[key]));
export const loadDeployment=()=>JSON.parse(fs.readFileSync('runtime/deployment.json'));
export const json=(v)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
export async function onlyLocal(){if((await provider.getNetwork()).chainId!==31337n)throw Error('Local signing requires chain 31337');}
