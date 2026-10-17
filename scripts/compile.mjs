import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
const sources={};
for(const file of fs.readdirSync('contracts').filter(x=>x.endsWith('.sol'))) sources[`contracts/${file}`]={content:fs.readFileSync(`contracts/${file}`,'utf8')};
// Use the upstream package's canonical prebuilt PoolManager; compile our integration sources.
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const findImports=p=>{for(const file of [p,path.join('node_modules',p),path.join('node_modules/@uniswap/v4-core',p),path.join('node_modules/@uniswap/v4-core/lib',p)])if(fs.existsSync(file))return {contents:fs.readFileSync(file,'utf8')};return {error:`Missing ${p}`};};
const out=JSON.parse(solc.compile(JSON.stringify(input),{import:findImports}));
for(const e of out.errors||[])console.log(e.formattedMessage);
if(out.errors?.some(e=>e.severity==='error'))process.exit(1);
fs.mkdirSync('artifacts',{recursive:true});fs.mkdirSync('shared/abis',{recursive:true});
for(const contracts of Object.values(out.contracts))for(const [name,c]of Object.entries(contracts)){
 if(!c.evm.bytecode.object)continue;
 const a={contractName:name,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object};
 fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify(a,null,2));
 if(['FaynHook','FaynRouter','RewardVault','DemoToken','PoolManager'].includes(name))fs.writeFileSync(`shared/abis/${name}.json`,JSON.stringify(c.abi,null,2));
 console.log(`${name}: ${c.evm.deployedBytecode.object.length/2} runtime bytes`);
}
fs.writeFileSync('artifacts/compiler-input.json',JSON.stringify(input));
const upstream=JSON.parse(fs.readFileSync('node_modules/@uniswap/v4-core/out/PoolManager.sol/PoolManager.json'));
const hex=x=>x.startsWith('0x')?x:'0x'+x;
fs.writeFileSync('artifacts/PoolManager.json',JSON.stringify({contractName:'PoolManager',abi:upstream.abi,bytecode:hex(upstream.bytecode.object),runtime:hex(upstream.deployedBytecode.object)}));
fs.writeFileSync('shared/abis/PoolManager.json',JSON.stringify(upstream.abi,null,2));
console.log('PoolManager: canonical pinned v4-core package artifact');
