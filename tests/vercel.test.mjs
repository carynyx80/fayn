import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createDemoApi} from '../web/browser-demo.js';
test('Vercel build serves only static assets and explicitly selects browser simulation',()=>{
 const cfg=JSON.parse(fs.readFileSync('vercel.json'));assert.equal(cfg.framework,null);assert.equal(cfg.outputDirectory,'dist');assert.equal(cfg.buildCommand,'npm run build');
 for(const file of ['index.html','app.js','style.css','client-api.js','browser-demo.js','runtime-config.js'])assert(fs.existsSync('dist/'+file));
 assert(fs.readFileSync('dist/runtime-config.js','utf8').includes("mode:'browser-demo'"));
 assert(fs.readFileSync('web/runtime-config.js','utf8').includes("mode:'local-evm'"));
 for(const file of fs.readdirSync('dist'))assert(file==='fonts'||/\.(html|js|css|svg|txt)$/.test(file));assert(!fs.existsSync('dist/api'));assert(!fs.existsSync('dist/.env'));assert(!fs.existsSync('dist/runtime'));
 assert(cfg.headers[0].headers.some(h=>h.key==='Content-Security-Policy'));
});
test('built hosted UI renders all routes, reviews a policy, quotes and executes a simulated swap',async()=>{
 const items=new Map(),nodes=new Map(),events={},windowEvents={};const api=createDemoApi({storage:{getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)}});
 const get=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',textContent:'',className:'',value:'',disabled:false,focus(){},setSelectionRange(){}});return nodes.get(k);};
 const document={querySelector:get,querySelectorAll:()=>[],addEventListener:(k,v)=>events[k]=v};const location={hash:'#home'},window={addEventListener:(k,v)=>windowEvents[k]=v,scrollTo(){}};
 const context={document,location,window,console,request:api.request,setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},FormData:class{*[Symbol.iterator](){yield* Object.entries({symbol:'WEB',opening:'3',normal:'0.3',duration:'30',price:'1',liquidity:'100'});}}};
 vm.runInNewContext(fs.readFileSync('dist/app.js','utf8').replace(/^import[^\n]*\n/,''),context,{timeout:5000});
 for(let i=0;i<30&&!get('#app').innerHTML.includes('sidebar');i++)await new Promise(r=>setTimeout(r,0));assert(get('#app').innerHTML.includes('Browser simulation.'));
 for(const route of ['home','explore','positions','activity','rewards','create','integrate','transparency']){location.hash='#'+route;windowEvents.hashchange();const html=get('#app').innerHTML;assert(html.includes('BROWSER DEMO'));assert(!html.includes('NaN'));assert(!html.includes('undefined'));assert(!html.includes('Real local-chain events'));assert(!html.includes('Local EVM connected'));}
 location.hash='#activity';windowEvents.hashchange();assert(get('#app').innerHTML.includes('Export filtered CSV'));assert(get('#app').innerHTML.includes('2 matching events'));
 get('#activity-pool').value='';get('#activity-type').value='Funded';get('#activity-search').value='';await events.submit({preventDefault(){},target:{id:'activityform'}});assert(get('#app').innerHTML.includes('1 matching events'));assert(!get('#app').innerHTML.includes('<td>SimulatedPoolCreated</td>'));
 const link=get('#app').innerHTML.match(/href="(data:text\/csv[^"]*)"/)[1],csv=decodeURIComponent(link.split(',').slice(1).join(','));assert(csv.includes('browser simulation'));assert(csv.includes('Funded'));assert(!csv.includes('SimulatedPoolCreated'));assert(csv.includes('raw_event_data'));
 get('#activity-search').value='no-such-transaction';await events.submit({preventDefault(){},target:{id:'activityform'}});assert(get('#app').innerHTML.includes('No events match'));await events.click({target:{closest:()=>({dataset:{action:'activity-clear'}})}});assert(get('#app').innerHTML.includes('2 matching events'));
 assert.equal(context.csvCell('=SUM(A1)'),String.fromCharCode(34,39)+'=SUM(A1)'+String.fromCharCode(34));assert.equal(context.csvCell('a"b,c'),'"a""b,c"');
 vm.runInNewContext("state.events=Array.from({length:30},(_,i)=>({name:'PagedEvent',height:i,tx:'event-'+i,data:{poolId:state.pools[0].id}}));render();",context);assert(get('#app').innerHTML.includes('page 1 of 2'));assert(!get('#app').innerHTML.includes('event-29</td>'));
 await events.click({target:{closest:()=>({dataset:{action:'activity-next'}})}});assert(get('#app').innerHTML.includes('page 2 of 2'));assert(get('#app').innerHTML.includes('event-29</td>'));await vm.runInNewContext('load()',context);
 location.hash='#create';windowEvents.hashchange();await events.submit({preventDefault(){},target:{id:'createform'}});assert(get('#app').innerHTML.includes('Create simulated pool'));
 await events.click({target:{closest:()=>({dataset:{action:'connect'}})}});
 const s=await(await api.request('/api/state')).json(),p=s.pools[0];location.hash='#pool/'+p.id;windowEvents.hashchange();
 await events.click({target:{closest:()=>({dataset:{action:'approve',token:'0'}})}});
 get('#direction').value='true';get('#exact').value='input';get('#amount').value='0.1';get('#slippage').value='0.5';
 await events.submit({preventDefault(){},target:{id:'swapform',querySelector:()=>({})}});assert(get('#quoted').innerHTML.includes('Execute simulated swap'));assert(!get('#quoted').innerHTML.includes('actual v4 execution'));
 await events.click({target:{closest:()=>({dataset:{action:'swap'}})}});assert.equal((await(await api.request('/api/state')).json()).pools[0].trades,1);assert(get('#notice').textContent.includes('Simulated'));
 await events.click({target:{closest:()=>({dataset:{action:'reset'}})}});assert.equal((await(await api.request('/api/state')).json()).pools[0].trades,0);
});
