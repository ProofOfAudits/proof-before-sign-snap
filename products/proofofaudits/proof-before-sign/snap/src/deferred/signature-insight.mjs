// Offline, bounded inspection of declarations only. Never fetch, persist, or
// pass a signature payload to the transaction proof/coverage engine.
const address=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)?value.toLowerCase():null;
const uint=(value,bits=256)=>{
  if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))return null;
  if(!['string','number'].includes(typeof value))return null;
  const text=String(value);
  if(text.length>80||! /^(?:0|[1-9][0-9]*|0x[0-9a-fA-F]+)$/.test(text))return null;
  try{const n=BigInt(text);return n<(1n<<BigInt(bits))?n.toString():null;}catch{return null;}
};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fields=(types,name,expected)=>Array.isArray(types?.[name])&&types[name].length===expected.length&&expected.every(([n,t],i)=>types[name][i]?.name===n&&types[name][i]?.type===t);
const permit=[['owner','address'],['spender','address'],['value','uint256'],['nonce','uint256'],['deadline','uint256']];
const details=[['token','address'],['amount','uint160'],['expiration','uint48'],['nonce','uint48']];
const permitSingle=[['details','PermitDetails'],['spender','address'],['sigDeadline','uint256']];
const permitBatch=[['details','PermitDetails[]'],['spender','address'],['sigDeadline','uint256']];
const unknown=()=>({state:'UNKNOWN',title:'Signature semantics not established',rows:[],warning:'POA cannot establish what authority this signature grants. Review the full wallet request before deciding whether to sign.'});
export function signatureInsight(signature){
  const result=unknown();
  try{
    if(!object(signature))return result;
    if(signature.signatureMethod==='personal_sign')return {...result,title:'Personal message signature',warning:'This message may authorize offchain actions. POA has not verified its meaning or the requesting application.'};
    if(!['eth_signTypedData_v3','eth_signTypedData_v4'].includes(signature.signatureMethod))return result;
    // MetaMask SDK provides an object; do not parse strings or accept legacy v1.
    const data=signature.data;
    if(!object(data)||!object(data.domain)||!object(data.message)||!object(data.types))return result;
    const contract=address(data.domain.verifyingContract),chain=uint(data.domain.chainId);
    if(!contract||!chain||chain==='0')return result;
    const message=data.message,rows=[{label:'Declared chain ID',value:chain},{label:'Declared verifying contract',value:contract}];
    if(data.primaryType==='Permit'&&fields(data.types,'Permit',permit)){
      const owner=address(message.owner),spender=address(message.spender),value=uint(message.value),nonce=uint(message.nonce),deadline=uint(message.deadline);
      if(!owner||owner!==address(signature.from)||!spender||value===null||nonce===null||deadline===null)return result;
      return {...result,title:'Declared ERC-2612 permit (unverified)',rows:[...rows,{label:'Declared owner',value:owner},{label:'Declared spender',value:spender},{label:'Raw allowance amount',value},{label:'Deadline (Unix seconds)',value:deadline}],warning:'If the contract implements this permit, the signature may let the spender use tokens later without another wallet confirmation. Token units, current allowance, nonce validity and contract semantics are unverified.'};
    }
    const single=data.primaryType==='PermitSingle'&&fields(data.types,'PermitSingle',permitSingle);
    const batch=data.primaryType==='PermitBatch'&&fields(data.types,'PermitBatch',permitBatch);
    if((single||batch)&&fields(data.types,'PermitDetails',details)){
      const spender=address(message.spender),deadline=uint(message.sigDeadline),items=single?[message.details]:message.details;
      if(!address(signature.from)||!spender||deadline===null||!Array.isArray(items)||items.length<1||items.length>8)return result;
      for(const item of items){
        if(!object(item))return result;
        const token=address(item.token),amount=uint(item.amount,160),expiration=uint(item.expiration,48),nonce=uint(item.nonce,48);
        if(!token||amount===null||expiration===null||nonce===null)return result;
        rows.push({label:'Declared token',value:token},{label:'Raw allowance amount',value:amount},{label:'Allowance expiration (Unix seconds)',value:expiration});
      }
      return {...result,title:'Declared Permit2 '+(single?'single':'batch')+' allowance (unverified)',rows:[...rows,{label:'Declared spender',value:spender},{label:'Signature deadline (Unix seconds)',value:deadline}],warning:'This signature may authorize later token spending. The verifying contract has not been authenticated as Permit2; token units, existing approvals, nonce validity and allowance effects are unverified.'};
    }
    return result;
  }catch{return result;}
}
