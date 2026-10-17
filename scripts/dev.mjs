import {spawn} from 'node:child_process';
import fs from 'node:fs';
const children=[];
const run=(args,wait=false)=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,HARDHAT_TELEMETRY_CONSENT:'false'}});children.push(c);c.on('error',reject);if(wait)c.on('exit',code=>code===0?resolve():reject(Error(args.join(' ')+' failed')));else resolve(c);});
const cleanup=()=>{for(const c of children)c.kill();};process.on('SIGINT',()=>{cleanup();process.exit();});process.on('SIGTERM',()=>{cleanup();process.exit();});
try{
 if(!fs.existsSync('artifacts/FaynHook.json'))await run(['scripts/compile.mjs'],true);
 await run(['scripts/chain.mjs']);
 let ready=false;for(let i=0;i<120;i++){try{const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});if((await r.json()).result==='0x7a69'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error('Local chain did not start');
 await run(['scripts/seed.mjs'],true);await run(['services/server.mjs']);
}catch(e){console.error(e);cleanup();process.exit(1);}
