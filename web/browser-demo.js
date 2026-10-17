// Public browser simulation ONLY. It never signs or submits blockchain transactions.
const STORAGE_KEY='fayn-browser-demo-v1';
const SCALE=1000000n,MAX=2n**256n-1n;
const ceil=(a,b)=>(a+b-1n)/b;
export function units(value,decimals){
 const text=String(value);if(!/^\d+(\.\d+)?$/.test(text))throw Error('Enter a positive decimal amount');
 const [whole,fraction='']=text.split('.');if(fraction.length>decimals)throw Error(`Asset supports at most ${decimals} decimal places`);
 return BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction+'0'.repeat(decimals)).slice(0,decimals)||'0');
}
export function format(value,decimals){
 const n=BigInt(value),scale=10n**BigInt(decimals),fraction=(n%scale).toString().padStart(decimals,'0').replace(/0+$/,'');
 return (n/scale).toString()+(fraction?'.'+fraction:'');
}
export function feeAt(policy,time){
 if(time<=policy.start)return policy.opening;if(time>=policy.end)return policy.normal;
 return policy.normal+Number(ceil(BigInt(policy.opening-policy.normal)*BigInt(policy.end-time),BigInt(policy.end-policy.start)));
}
const sqrt=n=>{if(n<0n)throw Error('Invalid liquidity');if(n<2n)return n;let x=n,y=(x+1n)/2n;while(y<x){x=y;y=(x+n/x)/2n;}return x;};
function storageDefault(){try{if(globalThis.localStorage)return globalThis.localStorage;}catch{}const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),memoryOnly:true};}
export function createDemoApi({storage=storageDefault(),clock=()=>Date.now(),id=()=>globalThis.crypto.randomUUID()}={}){
 const quotes=new Map();const now=()=>Math.floor(clock()/1000);
 const save=db=>{try{storage.setItem(STORAGE_KEY,JSON.stringify(db));}catch{throw Error('Browser storage is full or unavailable. No simulated action was saved.');}};
 function event(db,name,pool,extra={}){
  const tx='simulation-'+id();db.sequence++;db.events.unshift({id:tx,height:db.sequence,tx,name,simulated:true,data:{poolId:pool,...extra}});db.events=db.events.slice(0,250);return tx;
 }
 function seed(){
  const start=now()-120,a={address:'demo-token-eth',symbol:'tWETH',decimals:18},b={address:'demo-token-usdc',symbol:'tUSDC',decimals:6};
  const reserves=[units('100',18),units('250000',6)],liquidity=sqrt(reserves[0]*reserves[1]);
  const db={version:1,sequence:0,balances:{[a.address]:units('950',18).toString(),[b.address]:units('999874987.5',6).toString()},tokens:{[a.address]:a,[b.address]:b},pools:[{id:'demo-pool-1',addresses:[a.address,b.address],reserves:reserves.map(String),total:liquidity.toString(),owned:(liquidity/2n).toString(),earnings:['0','0'],feeVault:['0','0'],collected:['0','0'],volume:['0','0'],trades:0,revision:0,start,end:start+1800,opening:30000,normal:3000,rebate:'12500000'}],events:[]};
  event(db,'SimulatedPoolCreated','demo-pool-1');event(db,'Funded','demo-pool-1',{epoch:1,amount:'12500000'});return db;
 }
 function read(){
  let saved;try{saved=storage.getItem(STORAGE_KEY);}catch{throw Error('Cannot read demo storage. Enable browser storage or use a fresh tab.');}
  if(!saved){const db=seed();save(db);return db;}
  try{const db=JSON.parse(saved);if(db.version!==1||!Array.isArray(db.pools)||!db.tokens||!db.balances)throw Error();return db;}catch{throw Error('Saved simulation is invalid. Use Reset demo to start again.');}
 }
 function state(db){
  return {mode:'BROWSER SIMULATION · NO BLOCKCHAIN',browserDemo:true,chainId:null,user:'browser-demo-account',session:'browser-demo',storageMode:storage.memoryOnly?'memory':'browser',contracts:{},status:{tip:db.sequence,indexed:db.sequence,confirmations:0,updatedAt:new Date(clock()).toISOString()},events:db.events,rebates:'Simulated sponsor grant only. No blockchain assets or real rewards.',pools:db.pools.map(p=>({id:p.id,name:p.addresses.map(a=>db.tokens[a].symbol).join(' / '),key:null,tokens:p.addresses.map(a=>({...db.tokens[a],balance:format(db.balances[a]||'0',db.tokens[a].decimals),allowance:p.approvals?.[a]?MAX.toString():'0'})),start:p.start,end:p.end,opening:p.opening,normal:p.normal,fee:feeAt(p,now()),now:now(),position:p.owned,activeLiquidity:p.total,volume:p.volume.map((a,i)=>format(a,db.tokens[p.addresses[i]].decimals)),collected:p.collected.map((a,i)=>format(a,db.tokens[p.addresses[i]].decimals)),earnings:p.earnings.map((a,i)=>format(a,db.tokens[p.addresses[i]].decimals)),trades:p.trades,rebate:format(p.rebate,6)}))};
 }
 function calculate(p,direction,exactOutput,amount,fee){
  const input=direction?0:1,output=1-input,x=BigInt(p.reserves[input]),y=BigInt(p.reserves[output]);
  if(x<=0n||y<=0n||amount<=0n)throw Error('Insufficient simulated liquidity or invalid amount');
  let spent,received,charged;
  if(exactOutput){if(amount>=y)throw Error('Requested output exceeds available simulated liquidity');received=amount;spent=ceil(ceil(x*amount,y-amount)*SCALE,SCALE-BigInt(fee));charged=ceil(spent*BigInt(fee),SCALE);}
  else {spent=amount;charged=ceil(spent*BigInt(fee),SCALE);const net=spent-charged;received=y*net/(x+net);}
  if(received<=0n)throw Error('Amount is too small after rounding and fees');
  const spotOut=(spent-charged)*y/x;
  const priceImpact=spotOut>0n?Math.max(0,Number((spotOut-received)*1000000n/spotOut)/10000):null;
  return {spent,received,charged,input,output,priceImpact};
 }
 function quote(db,p,b){
  const direction=b.direction===true,exactOutput=b.exactOutput===true,input=direction?0:1,output=1-input;
  const amount=units(b.amount,db.tokens[p.addresses[exactOutput?output:input]].decimals);
  if(!p.approvals?.[p.addresses[input]])throw Error('Approve the simulated input asset first');
  const fee=feeAt(p,now()),r=calculate(p,direction,exactOutput,amount,fee);
  if(BigInt(db.balances[p.addresses[input]]||'0')<r.spent)throw Error('Insufficient simulated asset balance');
  const tolerance=Number(b.slippage??.5);if(!Number.isFinite(tolerance)||tolerance<.05||tolerance>5)throw Error('Slippage must be 0.05–5%');
  const bps=BigInt(Math.round(tolerance*100)),limit=exactOutput?ceil(r.spent*(10000n+bps),10000n):r.received*(10000n-bps)/10000n;
  const q={id:id(),pool:p.id,direction,exactOutput,amount:amount.toString(),limit:limit.toString(),fee,expiresAt:clock()+45000,deadline:now()+120,revision:p.revision};
  if(quotes.size>500)quotes.clear();quotes.set(q.id,q);
  return {...q,input,output,spent:format(r.spent,db.tokens[p.addresses[input]].decimals),received:format(r.received,db.tokens[p.addresses[output]].decimals),limitFormatted:format(limit,db.tokens[p.addresses[exactOutput?input:output]].decimals),feeAmount:format(r.charged,db.tokens[p.addresses[input]].decimals),priceImpact:r.priceImpact};
 }
 function collect(db,p){
  const fees=p.earnings.map(BigInt);
  for(let i=0;i<2;i++){const a=p.addresses[i];db.balances[a]=(BigInt(db.balances[a])+fees[i]).toString();p.feeVault[i]=(BigInt(p.feeVault[i])-fees[i]).toString();p.collected[i]=(BigInt(p.collected[i])+fees[i]).toString();p.earnings[i]='0';}
  return fees;
 }
 function create(db,b){
  if(db.pools.length>=30)throw Error('Demo supports up to 30 pools. Reset to start over.');
  const symbol=String(b.symbol||'').toUpperCase();if(!/^[A-Z][A-Z0-9]{1,9}$/.test(symbol))throw Error('Symbol must be 2–10 letters/numbers');
  const opening=Math.round(Number(b.opening)*10000),normal=Math.round(Number(b.normal)*10000),duration=Number(b.duration)*60;
  if(![opening,normal,duration].every(Number.isSafeInteger)||normal<100||normal>10000||opening<normal||opening>100000||duration<60||duration>86400)throw Error('Invalid bounded protection policy');
  const price=units(b.price,6);if(price<1n||price>10n**15n)throw Error('Price must be 0.000001–1,000,000,000 tUSDC');
  const liquidity=units(b.liquidity,12);if(liquidity<=0n||liquidity>10n**22n)throw Error('Invalid demo liquidity amount');
  // Full-range reserve approximation with raw token decimals; not v4 tick math.
  const root=sqrt(price*10n**18n),reserve0=ceil(liquidity*10n**18n,root),reserve1=ceil(liquidity*root,10n**18n);
  const address='demo-token-'+id(),quoteAsset='demo-token-usdc',minted=units('1000000000',18);
  if(reserve0>minted||reserve1>BigInt(db.balances[quoteAsset]))throw Error('Insufficient simulated initial assets for this liquidity');
  db.tokens[address]={address,symbol,decimals:18};db.balances[address]=(minted-reserve0).toString();db.balances[quoteAsset]=(BigInt(db.balances[quoteAsset])-reserve1).toString();
  const p={id:'demo-pool-'+id(),addresses:[address,quoteAsset],reserves:[reserve0.toString(),reserve1.toString()],total:liquidity.toString(),owned:liquidity.toString(),earnings:['0','0'],feeVault:['0','0'],collected:['0','0'],volume:['0','0'],trades:0,revision:0,start:now(),end:now()+duration,opening,normal,rebate:'0',approvals:{[address]:true,[quoteAsset]:true}};
  db.pools.unshift(p);return {pool:p.id,tx:event(db,'SimulatedPoolCreated',p.id)};
 }
 function action(path,b){
  if(path==='/api/reset'){const db=seed();quotes.clear();save(db);return {reset:true};}
  const db=read();if(path==='/api/state')return state(db);
  if(path==='/api/create'){const r=create(db,b);save(db);return r;}
  if(path==='/api/quote'){const p=db.pools.find(p=>p.id===b.pool);if(!p)throw Error('Simulated pool not found');return quote(db,p,b);}
  if(path==='/api/swap'){
   const q=quotes.get(b.quote);if(!q||clock()>=q.expiresAt||now()>q.deadline)throw Error('Quote expired or used. Request a fresh quote.');
   quotes.delete(q.id);const p=db.pools.find(p=>p.id===q.pool);if(!p||p.revision!==q.revision)throw Error('Pool changed. Request a fresh quote.');
   const fee=feeAt(p,now());if(fee>q.fee)throw Error('Fee increased. Request a fresh quote.');
   const r=calculate(p,q.direction,q.exactOutput,BigInt(q.amount),fee);
   if(q.exactOutput?r.spent>BigInt(q.limit):r.received<BigInt(q.limit))throw Error('Slippage limit exceeded');
   const a=p.addresses[r.input],z=p.addresses[r.output];if(BigInt(db.balances[a])<r.spent)throw Error('Insufficient simulated balance');
   db.balances[a]=(BigInt(db.balances[a])-r.spent).toString();db.balances[z]=(BigInt(db.balances[z])+r.received).toString();
   p.reserves[r.input]=(BigInt(p.reserves[r.input])+r.spent-r.charged).toString();p.reserves[r.output]=(BigInt(p.reserves[r.output])-r.received).toString();
   p.feeVault[r.input]=(BigInt(p.feeVault[r.input])+r.charged).toString();p.earnings[r.input]=(BigInt(p.earnings[r.input])+r.charged*BigInt(p.owned)/BigInt(p.total)).toString();
   p.volume[r.input]=(BigInt(p.volume[r.input])+r.spent).toString();p.trades++;p.revision++;
   const tx=event(db,'Trade',p.id,{fee,amount0:(r.input===0?-r.spent:r.received).toString(),amount1:(r.input===1?-r.spent:r.received).toString()});save(db);return {tx,simulated:true};
  }
  const p=db.pools.find(p=>p.id===b.pool);if(!p)throw Error('Simulated pool not found');
  if(path==='/api/approve'){const i=Number(b.token);if(!Number.isInteger(i)||i<0||i>1)throw Error('Invalid asset');p.approvals??={};p.approvals[p.addresses[i]]=true;const tx=event(db,'SimulatedApproval',p.id);save(db);return {tx};}
  if(path==='/api/claim'){
   const amount=BigInt(p.rebate);if(amount<=0n)throw Error('Nothing funded and claimable');p.rebate='0';db.balances['demo-token-usdc']=(BigInt(db.balances['demo-token-usdc'])+amount).toString();const tx=event(db,'Claimed',p.id,{epoch:1,amount:amount.toString()});save(db);return {tx};
  }
  if(path==='/api/liquidity'){
   if(!/^-?\d+$/.test(String(b.units)))throw Error('Liquidity must be integer units');
   const change=BigInt(b.units),owned=BigInt(p.owned),total=BigInt(p.total);
   if(change< -owned)throw Error('Cannot withdraw another LP position');
   if(change>0n&&p.addresses.some(a=>!p.approvals?.[a]))throw Error('Approve both simulated assets first');
   const fees=collect(db,p);
   if(change>0n){if(total===0n)throw Error('Empty pool; create a new demo pool');
    const deposits=p.reserves.map(r=>ceil(BigInt(r)*change,total));
    for(let i=0;i<2;i++){const a=p.addresses[i];if(BigInt(db.balances[a])<deposits[i])throw Error('Insufficient simulated balance for liquidity');db.balances[a]=(BigInt(db.balances[a])-deposits[i]).toString();p.reserves[i]=(BigInt(p.reserves[i])+deposits[i]).toString();}
   }else if(change<0n){const remove=-change;for(let i=0;i<2;i++){const a=p.addresses[i],amount=BigInt(p.reserves[i])*remove/total;p.reserves[i]=(BigInt(p.reserves[i])-amount).toString();db.balances[a]=(BigInt(db.balances[a])+amount).toString();}}
   p.owned=(owned+change).toString();p.total=(total+change).toString();p.revision++;
   const tx=event(db,'PositionChanged',p.id,{liquidityDelta:change.toString(),fees0:fees[0].toString(),fees1:fees[1].toString()});save(db);return {tx};
  }
  throw Error('Unsupported simulation action');
 }
 return {async request(url,options={}){
  try{const path=new URL(url,'https://fayn.invalid').pathname;if(path!=='/api/state'&&options.method!=='POST')throw Error('Action requires POST');const body=options.body?JSON.parse(options.body):{};return new Response(JSON.stringify(action(path,body)),{headers:{'Content-Type':'application/json'}});}
  catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}
 }};
}
