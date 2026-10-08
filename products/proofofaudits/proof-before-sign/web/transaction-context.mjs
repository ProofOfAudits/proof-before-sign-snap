// Shared wallet/server commitment. Omitted fields remain omitted: provider
// defaults must never be represented as a wallet-supplied execution setting.
export const quantityFields=['gas','gasPrice','maxFeePerGas','maxPriorityFeePerGas','nonce','type','maxFeePerBlobGas'];
const number=v=>{if(typeof v!=='string'||v.length>80||!/^(0x[0-9a-f]+|[0-9]+)$/i.test(v))throw Error('invalid_transaction_quantity');const n=BigInt(v);if(n<0n||n>=2n**256n)throw Error('transaction_quantity_overflow');return n.toString();};
export function normalizedTransaction(tx){
 if(!tx||!/^[1-9][0-9]*$/.test(tx.chainId)||!/^0x[0-9a-f]{40}$/i.test(tx.from)||!/^0x[0-9a-f]{40}$/i.test(tx.to)||typeof tx.data!=='string'||tx.data.length>131074||!/^0x(?:[0-9a-f]{2})*$/i.test(tx.data))throw Error('invalid_transaction');
 if(tx.authorizationList!==undefined)throw Error('authorization_execution_unsupported');
 const out={chainId:tx.chainId,from:tx.from.toLowerCase(),to:tx.to.toLowerCase(),data:tx.data.toLowerCase(),value:number(tx.value)};
 for(const field of quantityFields)if(tx[field]!==undefined)out[field]=number(tx[field]);
 if(out.gas==='0'||out.type!==undefined&&BigInt(out.type)>3n)throw Error('unsupported_transaction_context');
 if(out.gasPrice!==undefined&&(out.maxFeePerGas!==undefined||out.maxPriorityFeePerGas!==undefined))throw Error('conflicting_transaction_fees');
 if(out.maxPriorityFeePerGas!==undefined&&out.maxFeePerGas!==undefined&&BigInt(out.maxPriorityFeePerGas)>BigInt(out.maxFeePerGas))throw Error('invalid_transaction_fees');
 if(tx.accessList!==undefined){
  if(!Array.isArray(tx.accessList)||tx.accessList.length>128)throw Error('invalid_access_list');
  out.accessList=tx.accessList.map(entry=>{if(!entry||Object.keys(entry).some(k=>!['address','storageKeys'].includes(k))||!/^0x[0-9a-f]{40}$/i.test(entry.address)||!Array.isArray(entry.storageKeys)||entry.storageKeys.length>256||entry.storageKeys.some(k=>typeof k!=='string'||!/^0x[0-9a-f]{64}$/i.test(k)))throw Error('invalid_access_list');return {address:entry.address.toLowerCase(),storageKeys:entry.storageKeys.map(k=>k.toLowerCase())};});
 }
 if(tx.blobVersionedHashes!==undefined){if(!Array.isArray(tx.blobVersionedHashes)||tx.blobVersionedHashes.length>16||tx.blobVersionedHashes.some(v=>typeof v!=='string'||!/^0x01[0-9a-f]{62}$/i.test(v)))throw Error('invalid_blob_hashes');out.blobVersionedHashes=tx.blobVersionedHashes.map(v=>v.toLowerCase());}
 return out;
}
// poa.check.v1 `transaction` block: derived from the same normalized commitment.
// Caller address and calldata stay in the exact proof only; the check carries the
// public target, value and selector so feedback/analytics can never retain them.
export function checkTransaction(tx){const out=normalizedTransaction(tx);return {chainId:out.chainId,to:out.to,value:out.value,selector:out.data.length>=10?out.data.slice(0,10):'0x'};}
export function rpcTransaction(tx){const out=normalizedTransaction(tx);delete out.chainId;out.value='0x'+BigInt(out.value).toString(16);for(const field of quantityFields)if(out[field]!==undefined)out[field]='0x'+BigInt(out[field]).toString(16);return out;}
export function walletTransaction(transaction,chainId){
 if(transaction.authorizationList!==undefined||transaction.blobs!==undefined)throw Error('unsupported_transaction_context');
 if(transaction.gasLimit!==undefined&&transaction.gas!==undefined&&number(transaction.gasLimit)!==number(transaction.gas))throw Error('conflicting_transaction_gas');
 if(transaction.input!==undefined&&transaction.data!==undefined&&transaction.input.toLowerCase()!==transaction.data.toLowerCase())throw Error('conflicting_transaction_data');
 const tx={chainId,from:transaction.from,to:transaction.to,value:transaction.value??'0x0',data:transaction.data??transaction.input??'0x'};
 for(const field of [...quantityFields,'accessList','blobVersionedHashes'])if(transaction[field]!==undefined)tx[field]=transaction[field];
 if(tx.gas===undefined&&transaction.gasLimit!==undefined)tx.gas=transaction.gasLimit;
 return normalizedTransaction(tx);
}
