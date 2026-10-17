import {DatabaseSync} from 'node:sqlite';
import {Interface} from 'ethers';
import fs from 'node:fs';
import {artifact,json} from '../shared/chain.mjs';
export class Indexer {
 constructor(provider,addresses,file='runtime/events.sqlite',confirmations=1){
  fs.mkdirSync('runtime',{recursive:true});this.provider=provider;this.addresses=addresses;this.confirmations=confirmations;
  this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS blocks(height INTEGER PRIMARY KEY,hash TEXT); CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,height INTEGER,tx TEXT,name TEXT,data TEXT);');
  this.interfaces=['FaynHook','FaynRouter','RewardVault','PoolManager'].map(n=>new Interface(artifact(n).abi));this.updatedAt=null;
 }
 async retry(fn){for(let i=0;;i++){try{return await fn();}catch(e){if(i>=4)throw e;await new Promise(r=>setTimeout(r,Math.min(250*2**i,4000)));}}}
 async sync(){
  let last=this.db.prepare('SELECT * FROM blocks ORDER BY height DESC LIMIT 1').get();
  while(last){const b=await this.retry(()=>this.provider.getBlock(last.height));if(b?.hash===last.hash)break;
   this.db.exec('BEGIN');try{this.db.prepare('DELETE FROM events WHERE height>=?').run(last.height);this.db.prepare('DELETE FROM blocks WHERE height>=?').run(last.height);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
   last=this.db.prepare('SELECT * FROM blocks ORDER BY height DESC LIMIT 1').get();
  }
  const tip=await this.provider.getBlockNumber(),target=tip-this.confirmations;
  for(let from=last?last.height+1:0;from<=target;from+=100){const to=Math.min(from+99,target);
   const logs=await this.retry(()=>this.provider.getLogs({address:this.addresses,fromBlock:from,toBlock:to}));
   const blocks=[];for(let h=from;h<=to;h++)blocks.push(await this.retry(()=>this.provider.getBlock(h)));
   for(let i=1;i<blocks.length;i++)if(blocks[i].parentHash!==blocks[i-1].hash)throw Error('Reorg during batch; retry');
   if(last && blocks[0].parentHash!==last.hash)throw Error('Reorg at checkpoint; retry');
   for(const l of logs)if(blocks[l.blockNumber-from]?.hash!==l.blockHash)throw Error('Log/block hash mismatch');
   this.db.exec('BEGIN');try{
    for(const b of blocks)this.db.prepare('INSERT OR REPLACE INTO blocks VALUES(?,?)').run(b.number,b.hash);
    for(const log of logs){let decoded;for(const abi of this.interfaces){try{decoded=abi.parseLog(log);if(decoded)break;}catch{}}
     if(!decoded)continue;const data={};for(let i=0;i<decoded.fragment.inputs.length;i++)data[decoded.fragment.inputs[i].name]=decoded.args[i];
     this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)').run(`${log.blockHash}:${log.transactionHash}:${log.index}`,log.blockNumber,log.transactionHash,decoded.name,json(data));
    }this.db.exec('COMMIT');
   }catch(e){this.db.exec('ROLLBACK');throw e;}
   last={height:blocks.at(-1).number,hash:blocks.at(-1).hash};
  }
  this.updatedAt=new Date().toISOString();return {tip,indexed:target,confirmations:this.confirmations,updatedAt:this.updatedAt};
 }
 events(){return this.db.prepare('SELECT * FROM events ORDER BY height DESC,id').all().map(r=>({...r,data:JSON.parse(r.data)}));}
 close(){this.db.close();}
}
