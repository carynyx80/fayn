import {test} from 'node:test';import assert from 'node:assert/strict';
import {Interface} from 'ethers';import {Indexer} from '../services/indexer.mjs';import {artifact} from '../shared/chain.mjs';
import fs from 'node:fs';
test('persistent checkpoints are idempotent; reorg rolls back and replays canonical events',async()=>{
 const abi=new Interface(artifact('FaynHook').abi),id='0x'+'11'.repeat(32);const encoded=abi.encodeEventLog(abi.getEvent('AssetSupported'),['0x'+'22'.repeat(20)]);
 let fork='a',calls=0;const hash=h=>'0x'+(h===0?'00':fork==='a'?'aa':'bb').repeat(32);
 const provider={getBlockNumber:async()=>3,getBlock:async h=>({number:h,hash:hash(h),parentHash:hash(Math.max(0,h-1))}),getLogs:async()=>{calls++;return [{blockNumber:1,blockHash:hash(1),transactionHash:id,index:0,topics:encoded.topics,data:encoded.data}];}};
 const ix=new Indexer(provider,[] ,':memory:',1);await ix.sync();assert.equal(ix.events().length,1);await ix.sync();assert.equal(ix.events().length,1);assert.equal(calls,1);
 fork='b';await ix.sync();assert.equal(ix.events().length,1);assert(ix.events()[0].id.includes('bb'.repeat(32)));assert.equal(calls,2);ix.close();
});
test('confirmation cutoff and retry behavior',async()=>{
 let attempts=0;const hash='0x'+'00'.repeat(32),p={getBlockNumber:async()=>1,getBlock:async h=>({number:h,hash,parentHash:hash}),getLogs:async()=>{if(attempts++===0)throw Error('429');return [];}};
 const ix=new Indexer(p,[],':memory:',1);const status=await ix.sync();assert.equal(status.indexed,0);assert.equal(attempts,2);ix.close();
});
test('disk checkpoint survives a process-style reopen without duplicate backfill',async()=>{
 fs.mkdirSync('runtime',{recursive:true});const dir=fs.mkdtempSync('runtime/checkpoint-'),file=dir+'/index.sqlite';let calls=0;
 const p={getBlockNumber:async()=>1,getBlock:async h=>({number:h,hash:'0x'+'00'.repeat(32),parentHash:'0x'+'00'.repeat(32)}),getLogs:async()=>{calls++;return [];}};
 let ix=new Indexer(p,[],file,1);await ix.sync();ix.close();ix=new Indexer(p,[],file,1);await ix.sync();assert.equal(calls,1);ix.close();
});
