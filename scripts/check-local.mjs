import {spawn} from 'node:child_process';import fs from 'node:fs';
fs.mkdirSync('runtime/checks',{recursive:true});const children=[];
const run=(args,name,wait=true)=>new Promise((resolve,reject)=>{
 const fd=fs.openSync(`runtime/checks/${name}.log`,'w');const child=spawn(process.execPath,args,{stdio:['ignore',fd,fd],env:{...process.env,FAYN_URL:'http://127.0.0.1:4173'}});children.push(child);child.on('error',reject);
 if(wait)child.on('exit',code=>{fs.closeSync(fd);console.log(`${name}: ${code===0?'PASS':'FAIL'} (runtime/checks/${name}.log)`);code===0?resolve():reject(Error(`${name} failed; inspect log`));});else resolve(child);
});
const waitFor=async(url,body)=>{for(let i=0;i<240;i++){try{const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error(`Server did not start: ${url}`);};
const cleanup=()=>{for(const c of children)if(c.exitCode===null)c.kill();};process.on('SIGINT',()=>{cleanup();process.exit(130);});
try{
 if(!process.argv.includes('--use-existing-chain')){
  try{await fetch('http://127.0.0.1:8545');throw Error('Existing RPC on 8545; stop it before isolated rehearsal or explicitly pass --use-existing-chain');}catch(e){if(e.message.includes('Existing RPC'))throw e;}
  await run(['scripts/chain.mjs'],'chain',false);
 }
 await waitFor('http://127.0.0.1:8545',{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]});
 const network=await(await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})})).json();if(network.result!=='0x7a69')throw Error('Rehearsal requires local chain 31337');
 await run(['--test','--test-concurrency=1','tests/contracts.test.mjs','tests/indexer.test.mjs','tests/math.test.mjs','tests/reentrancy.test.mjs'],'contracts-indexer');
 await run(['scripts/seed.mjs'],'seed');await run(['services/server.mjs'],'server',false);await waitFor('http://127.0.0.1:4173/api/state');
 await run(['--test','--test-concurrency=1','tests/http.test.mjs','tests/frontend.test.mjs'],'http-frontend');await run(['services/monitor.mjs'],'monitor');await run(['simulation/run.mjs'],'simulation');
 console.log('Local rehearsal passed. Owned service children are being stopped; an explicitly reused chain remains running. Start npm run dev for interactive use.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{cleanup();}
