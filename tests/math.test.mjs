import {test} from 'node:test';import assert from 'node:assert/strict';import {priceImpact} from '../shared/state.mjs';
test('fee-exclusive spot impact works in both directions and with protocol fee',()=>{
 const q=1n<<96n;assert.equal(priceImpact(1000000n,990000n,true,10000,q),0);assert.equal(priceImpact(1000000n,980100n,true,10000,q),1);assert.equal(priceImpact(1000000n,980100n,false,10000,q),1);
 assert.equal(priceImpact(1000000n,989010n,true,10000,q,1000),0);assert.equal(priceImpact(1n,0n,true,3000,q),null);
});
