import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
// Lightweight DOM harness exercises actual frontend handlers against the real HTTP API.
// This is not a browser layout/accessibility test.
test('frontend renders every route and invalidates executable quotes on edits',async()=>{
 const base=process.env.FAYN_URL||'http://127.0.0.1:4173',r=await fetch(base+'/api/state'),s=await r.json();assert.equal(r.status,200);
 const nodes=new Map(),handlers={},windows={},get=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',textContent:'',className:'',value:'',disabled:false,focus(){},setSelectionRange(){}});return nodes.get(k);};
 const document={querySelector:get,querySelectorAll:()=>[],addEventListener:(k,v)=>handlers[k]=v};
 const location={hash:'#home'},window={addEventListener:(k,v)=>windows[k]=v,scrollTo(){}};
 const context={document,location,window,console,request:(url,options)=>fetch(base+url,options),setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},FormData:class {constructor(){}*[Symbol.iterator](){yield* Object.entries({symbol:'UIX',opening:'3',normal:'0.3',duration:'30',price:'1',liquidity:'100'});}}};
 vm.runInNewContext(fs.readFileSync('web/app.js','utf8').replace(/^import[^\n]*\n/,''),context,{timeout:5000});
 for(let i=0;i<600&&!get('#app').innerHTML.includes('sidebar');i++)await new Promise(r=>setTimeout(r,50));assert(get('#app').innerHTML.includes('Liquidity that'));
 for(const route of ['explore','positions','rewards','create','integrate','transparency']){location.hash='#'+route;windows.hashchange();assert(get('#app').innerHTML.includes('<main'));assert(!get('#app').innerHTML.includes('NaN'));assert(!get('#app').innerHTML.includes('undefined'));}
 location.hash='#create';windows.hashchange();await handlers.submit({preventDefault(){},target:{id:'createform'}});assert(get('#app').innerHTML.includes('Create local protected pool'));
 const p=s.pools.find(p=>p.tokens.some(t=>t.symbol==='tWETH'));assert(p);location.hash='#pool/'+p.id;windows.hashchange();
 await handlers.click({target:{closest:()=>({dataset:{action:'connect'}})}});
 get('#direction').value=String(p.tokens[0].decimals===18);get('#exact').value='input';get('#amount').value='0.001';get('#slippage').value='0.5';
 await handlers.submit({preventDefault(){},target:{id:'swapform',querySelector:()=>({disabled:false,textContent:''})}});
 assert(get('#quoted').innerHTML.includes('Execute local swap'));assert(get('#quoted').innerHTML.includes('Minimum received'));
 handlers.input({target:{id:'amount'}});assert.equal(get('#quoted').innerHTML,'');
});
