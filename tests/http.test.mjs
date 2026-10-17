import {test} from 'node:test';import assert from 'node:assert/strict';
import {provider,contract,loadDeployment} from '../shared/chain.mjs';
// Run after `npm run seed` and `npm start`, separately from isolated contract tests.
const base=process.env.FAYN_URL||'http://127.0.0.1:4173';let state;
async function refresh(){const r=await fetch(base+'/api/state');assert.equal(r.status,200,await r.clone().text());return state=await r.json();}
async function post(action,b,token=state.session){const r=await fetch(base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Fayn-Session':token},body:JSON.stringify(b)});return {status:r.status,data:await r.json()};}
test('HTTP UI assets, origin guard, approvals, executable quotes, swaps, LP and claims',async()=>{
 await refresh();assert(state.pools.length>0);const home=await fetch(base);assert.equal(home.status,200);assert((await home.text()).includes('Fayn'));
 for(const file of ['/app.js','/style.css'])assert.equal((await fetch(base+file)).status,200);
 let p=state.pools.find(p=>p.tokens.some(t=>t.symbol==='tWETH'));assert(p);
 if(Number(p.rebate)===0){const d=loadDeployment(),signer=await provider.getSigner(0);await(await contract('RewardVault',d.vault,signer).fund(p.id,1,d.user,d.rebateToken,12500000)).wait();await provider.send('evm_mine',[]);await refresh();}
 assert.equal((await post('swap',{quote:'missing'},'wrong')).status,400);
 const rejected=await fetch(base+'/api/claim',{method:'POST',headers:{'Content-Type':'application/json','X-Fayn-Session':state.session,Origin:'https://evil.example'},body:JSON.stringify({pool:p.id})});assert.equal(rejected.status,400);
 for(let i=0;i<2;i++)assert.equal((await post('approve',{pool:p.id,token:i})).status,200);
 const direction=p.tokens[0].decimals===18;
 for(const exactOutput of [false,true]){
  const amount=exactOutput?'0.001':'0.01';const q=await post('quote',{pool:p.id,direction:exactOutput?!direction:direction,amount,slippage:.5,exactOutput});assert.equal(q.status,200,JSON.stringify(q.data));assert(Number(q.data.spent)>0&&Number(q.data.received)>0);
  const trade=await post('swap',{quote:q.data.id});assert.equal(trade.status,200,JSON.stringify(trade.data));assert.match(trade.data.tx,/^0x[0-9a-f]{64}$/);assert.equal((await post('swap',{quote:q.data.id})).status,400);
 }
 for(const units of ['1000000','-1000000','0']){const r=await post('liquidity',{pool:p.id,units});assert.equal(r.status,200,JSON.stringify(r.data));}
 const claim=await post('claim',{pool:p.id});assert.equal(claim.status,200,JSON.stringify(claim.data));assert.equal((await post('claim',{pool:p.id})).status,400);
 await refresh();p=state.pools.find(x=>x.id===p.id);assert.equal(Number(p.rebate),0);assert(p.trades>=3);assert(state.events.some(e=>e.name==='Claimed'));
 const created=await post('create',{symbol:'E2E',opening:'3',normal:'0.3',duration:'30',price:'1',liquidity:'100'});assert.equal(created.status,200,JSON.stringify(created.data));
 await refresh();assert(state.pools.some(p=>p.id===created.data.pool));
});
