import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseUnits,formatUnits,MaxUint256} from 'ethers';
import {provider,contract,loadDeployment,poolId,deploy,json,onlyLocal} from '../shared/chain.mjs';
import {Indexer} from './indexer.mjs';
import {readPoolState,priceImpact} from '../shared/state.mjs';
await onlyLocal();
const d=loadDeployment();
if(await provider.getCode(d.hook)==='0x')throw Error('Deployment absent; run npm run seed');
const signer=await provider.getSigner(0),user=await signer.getAddress();
if(user.toLowerCase()!==d.user.toLowerCase())throw Error('Seed account mismatch');
const router=contract('FaynRouter',d.router,signer),hook=contract('FaynHook',d.hook,signer),manager=contract('PoolManager',d.manager,signer),vault=contract('RewardVault',d.vault,signer);
const indexer=new Indexer(provider,[d.hook,d.router,d.manager,d.vault]);
const session=crypto.randomBytes(32).toString('hex'),quotes=new Map();let sequence=Promise.resolve();
async function catalog(){
 const events=indexer.events(),out=[];
 for(const e of events.filter(e=>e.name==='Initialize'&&e.data.hooks.toLowerCase()===d.hook.toLowerCase())){
  const a=e.data,key={currency0:a.currency0,currency1:a.currency1,fee:Number(a.fee),tickSpacing:Number(a.tickSpacing),hooks:a.hooks};
  const p=await hook.policies(a.id);if(!p.exists)continue;
  const tokens=[];for(const address of [a.currency0,a.currency1]){const t=contract('DemoToken',address),decimals=Number(await t.decimals());tokens.push({address,symbol:await t.symbol(),decimals,balance:formatUnits(await t.balanceOf(user),decimals),allowance:(await t.allowance(user,d.router)).toString()});}
  const now=Number((await provider.getBlock('latest')).timestamp),fee=await hook.feeAt(a.id,now),position=await router.liquidity(a.id,user);let earnings=['0','0'];
  if(position>0){const v=await router.modify.staticCall(key,0,MaxUint256,MaxUint256,now+600);earnings=v.map((x,i)=>formatUnits(x,tokens[i].decimals));}
  const poolState=await readPoolState(manager,a.id),swaps=events.filter(e=>e.name==='Swap'&&e.data.id===a.id);
  const volume=tokens.map((t,i)=>formatUnits(swaps.reduce((sum,e)=>{const delta=BigInt(e.data[`amount${i}`]);return sum+(delta<0n?-delta:0n);},0n),t.decimals));
  const collected=tokens.map((t,i)=>formatUnits(events.filter(e=>e.name==='PositionChanged'&&e.data.poolId===a.id).reduce((sum,e)=>sum+BigInt(e.data[`fees${i}`]),0n),t.decimals));
  out.push({id:a.id,key,tokens,name:tokens.map(x=>x.symbol).join(' / '),start:Number(p.start),end:Number(p.end),opening:Number(p.opening),normal:Number(p.normal),fee:Number(fee),now,position:position.toString(),activeLiquidity:poolState.liquidity.toString(),volume,collected,earnings,trades:swaps.length,rebate:formatUnits(await vault.available(await vault.key(a.id,1,user,d.rebateToken)),6)});
 }return out;
}
async function state(){const status=await indexer.sync();return {mode:'LOCAL EVM · TEST ASSETS',session,user,chainId:31337,contracts:{manager:d.manager,hook:d.hook,router:d.router,vault:d.vault},pools:await catalog(),events:indexer.events().slice(0,100),status,rebates:'Sponsor-funded demonstration only.'};}
function number(v,min,max){const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('Value outside permitted bounds');return n;}
async function action(url,b){
 const pools=await catalog(),p=pools.find(p=>p.id===b.pool),now=Number((await provider.getBlock('latest')).timestamp);
 const confirmed=async tx=>{await tx.wait();await provider.send('evm_mine',[]);return {tx:tx.hash};};
 if(url==='/api/approve'){
  if(!p)throw Error('Pool not found');const token=p.tokens[Number(b.token)];if(!token)throw Error('Asset not found');
  return confirmed(await contract('DemoToken',token.address,signer).approve(d.router,MaxUint256));
 }
 if(url==='/api/quote'){
  if(!p)throw Error('Pool not found');const direction=b.direction===true,exactOutput=b.exactOutput===true,input=direction?0:1,output=1-input;
  const amount=parseUnits(String(b.amount),p.tokens[exactOutput?output:input].decimals);if(amount<=0n)throw Error('Enter a positive amount');
  if(BigInt(p.tokens[input].allowance)===0n)throw Error('Approve the input test asset before requesting an executable quote');
  const delta=await router.swap.staticCall(p.key,direction,exactOutput?amount:-amount,exactOutput?MaxUint256:0,p.fee,now+120);
  const spent=-delta[input],received=delta[output],slippage=BigInt(Math.round(number(b.slippage??0.5,0.05,5)*100));
  const limit=exactOutput?(spent*(10000n+slippage)+9999n)/10000n:received*(10000n-slippage)/10000n,id=crypto.randomUUID();
  const q={id,pool:p.id,key:p.key,direction,amount:(exactOutput?amount:-amount).toString(),limit:limit.toString(),fee:p.fee,deadline:now+120,expiresAt:Date.now()+45000,exactOutput,input,output};
  if(quotes.size>500)quotes.clear();quotes.set(id,q);
  const current=await readPoolState(manager,p.id);
  return {...q,spent:formatUnits(spent,p.tokens[input].decimals),received:formatUnits(received,p.tokens[output].decimals),limitFormatted:formatUnits(limit,p.tokens[exactOutput?input:output].decimals),feeAmount:formatUnits((spent*BigInt(p.fee)+999999n)/1000000n,p.tokens[input].decimals),priceImpact:priceImpact(spent,received,direction,p.fee,current.sqrtPriceX96,current.protocolFee)};
 }
 if(url==='/api/swap'){
  const q=quotes.get(b.quote);if(!q||q.expiresAt<Date.now()||q.deadline<now)throw Error('Quote expired; request a fresh quote');quotes.delete(b.quote);
  return confirmed(await router.swap(q.key,q.direction,q.amount,q.limit,q.fee,q.deadline));
 }
 if(url==='/api/liquidity'){
  if(!p)throw Error('Pool not found');const change=BigInt(b.units);if(change<0n && -change>BigInt(p.position))throw Error('Insufficient owned liquidity');
  const expected=await router.modify.staticCall(p.key,change,change<0n?0:MaxUint256,change<0n?0:MaxUint256,now+120);
  const limits=expected.map(x=>change<0n?(x>0n?x*995n/1000n:0n):(x<0n?(-x*1005n+999n)/1000n:0n));
  return confirmed(await router.modify(p.key,change,limits[0],limits[1],now+120));
 }
 if(url==='/api/claim'){if(!p)throw Error('Pool not found');return confirmed(await vault.claim(p.id,1,d.rebateToken));}
 if(url==='/api/create'){
  const symbol=String(b.symbol||'').toUpperCase();if(!/^[A-Z][A-Z0-9]{1,9}$/.test(symbol))throw Error('Symbol must be 2–10 letters/numbers');
  const opening=Math.round(number(b.opening,0.01,10)*10000),normal=Math.round(number(b.normal,0.01,1)*10000),duration=Math.round(number(b.duration,1,1440)*60);
  if(opening<normal)throw Error('Opening fee must be at least the normal fee');
  const price=number(b.price,0.000001,1e9),units=parseUnits(String(b.liquidity),12);if(units<=0n||units>10n**22n)throw Error('Liquidity out of demo bounds');
  const token=await deploy('DemoToken',signer,[`Fayn Demo ${symbol}`,symbol,18]),address=await token.getAddress();
  await(await hook.allowAsset(address)).wait();await(await token.approve(d.router,MaxUint256)).wait();await(await contract('DemoToken',d.rebateToken,signer).approve(d.router,MaxUint256)).wait();
  const ordered=[{address,decimals:18},{address:d.rebateToken,decimals:6}].sort((a,b)=>BigInt(a.address)<BigInt(b.address)?-1:1);
  const key={currency0:ordered[0].address,currency1:ordered[1].address,fee:0x800000,tickSpacing:60,hooks:d.hook};
  const timestamp=Number((await provider.getBlock('latest')).timestamp),start=timestamp+60,end=start+duration;
  await(await hook.configure(key,start,end,opening,normal)).wait();
  const ratio=ordered[0].decimals===18?price*1e-12:1/(price*1e-12);
  await(await manager.initialize(key,BigInt(Math.floor(Math.sqrt(ratio)*2**96)))).wait();
  const tx=await router.modify(key,units,MaxUint256,MaxUint256,timestamp+600);await tx.wait();
  if(Number((await provider.getBlock('latest')).timestamp)<start)await provider.send('evm_setNextBlockTimestamp',[start]);
  await provider.send('evm_mine',[]);
  return {tx:tx.hash,pool:poolId(key)};
 }
 throw Error('Unknown action');
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
 try{
  const url=new URL(req.url,'http://localhost');
  if(!['127.0.0.1','localhost'].includes((req.headers.host||'').split(':')[0])){res.writeHead(403);return res.end('Local host only');}
  if(req.method==='GET'&&url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');return res.end(json(await state()));}
  if(req.method==='POST'&&url.pathname.startsWith('/api/')){
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('Origin rejected');
   if(req.headers['x-fayn-session']!==session||!req.headers['content-type']?.startsWith('application/json'))throw Error('Session or content type rejected');
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Request too large');}
   const b=JSON.parse(raw),job=sequence.then(()=>action(url.pathname,b));sequence=job.catch(()=>{});
   res.setHeader('Content-Type','application/json');return res.end(json(await job));
  }
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  const file=path.resolve('web','.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(path.resolve('web')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(json({error:e.info?.error?.message||e.error?.message||e.shortMessage||e.message}));}
});
const port=Number(process.env.PORT||4173);
server.on('error',e=>{console.error(`Fayn cannot bind port ${port}: ${e.message}. Set PORT to an available loopback port.`);process.exit(1);});
server.listen(port,process.env.BIND_ADDRESS||'127.0.0.1',()=>console.log(`Fayn local application: http://127.0.0.1:${port}`));
