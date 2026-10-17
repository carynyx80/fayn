// Explicitly run after deployment; requires explorer API key, not a signing secret.
import fs from 'node:fs';import {Interface} from 'ethers';import {artifact} from '../shared/chain.mjs';
const [name,address,...raw]=process.argv.slice(2);if(!name||!address||!process.env.ETHERSCAN_API_KEY)throw Error('Usage: node scripts/verify-contract.mjs NAME ADDRESS [constructor args] with ETHERSCAN_API_KEY');
const input=JSON.parse(fs.readFileSync('artifacts/compiler-input.json'));
// Resolve all imported source paths recursively into standard JSON for Etherscan.
const visit=(key,content)=>{if(input.sources[key]?.resolved)return;input.sources[key]={content,resolved:true};const re=/import\s+(?:[^";]*from\s*)?["']([^"']+)["']/g;for(const match of content.matchAll(re)){let child=match[1];if(child.startsWith('.')){const path=awaitPath(key,child);child=path;}if(!input.sources[child]){const options=[child,'node_modules/'+child,'node_modules/@uniswap/v4-core/lib/'+child];const file=options.find(p=>fs.existsSync(p));if(!file)throw Error('Missing import '+child);visit(child,fs.readFileSync(file,'utf8'));}}};
function awaitPath(key,child){const segments=(key.slice(0,key.lastIndexOf('/')+1)+child).split('/'),out=[];for(const s of segments){if(s==='..')out.pop();else if(s!=='.')out.push(s);}return out.join('/');}
for(const [key,s] of Object.entries(input.sources))visit(key,s.content);
for(const s of Object.values(input.sources))delete s.resolved;
const args=raw.map(x=>x==='true'?true:x==='false'?false:x);
const form=new URLSearchParams({contractaddress:address,sourceCode:JSON.stringify(input),codeformat:'solidity-standard-json-input',contractname:`contracts/${name}.sol:${name}`,compilerversion:'v0.8.26+commit.8a97fa7a',constructorArguments:new Interface(artifact(name).abi).encodeDeploy(args).slice(2)});
const url=new URL('https://api.etherscan.io/v2/api');url.search=new URLSearchParams({chainid:'11155111',module:'contract',action:'verifysourcecode',apikey:process.env.ETHERSCAN_API_KEY});
const r=await fetch(url,{method:'POST',body:form});console.log(await r.json());
