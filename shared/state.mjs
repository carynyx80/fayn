import {solidityPackedKeccak256,toBeHex,zeroPadValue} from 'ethers';
// Mirrors pinned v4-core StateLibrary: pools slot 6, liquidity offset 3.
export async function readPoolState(manager,id){
 const slot=solidityPackedKeccak256(['bytes32','bytes32'],[id,zeroPadValue(toBeHex(6),32)]);
 const raw=BigInt(await manager['extsload(bytes32)'](slot));
 const liquidity=BigInt(await manager['extsload(bytes32)'](zeroPadValue(toBeHex(BigInt(slot)+3n),32)))&((1n<<128n)-1n);
 return {sqrtPriceX96:raw&((1n<<160n)-1n),protocolFee:Number((raw>>184n)&0xffffffn),liquidity};
}
export function priceImpact(spent,received,zeroForOne,lpFee,sqrtPrice,protocolFee=0){
 const protocol=zeroForOne?protocolFee&4095:protocolFee>>12;
 const combined=BigInt(protocol+lpFee-Math.floor(protocol*lpFee/1e6));
 const net=spent*(1000000n-combined),q192=1n<<192n,squared=sqrtPrice*sqrtPrice;
 const expected=zeroForOne?net*squared/(1000000n*q192):net*q192/(1000000n*squared);
 return expected>0n?Math.max(0,Number((expected-received)*1000000n/expected)/10000):null;
}
