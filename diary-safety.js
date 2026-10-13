/* Read-only diary snapshot. This module does not write to or delete storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DiarySafety=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const DATABASE='toshi_diary_v1';
function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);}
function base64ToBytes(text){const binary=atob(text);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
async function packValue(value){
 if(value instanceof Blob){const blob={type:'blob',mime:value.type,bytes:bytesToBase64(new Uint8Array(await value.arrayBuffer()))};if(typeof File!=='undefined'&&value instanceof File){blob.name=value.name;blob.lastModified=value.lastModified;}return blob;}
 if(value===undefined)return {type:'undefined'};
 if(value instanceof Date)return {type:'date',value:value.toISOString()};
 if(value instanceof ArrayBuffer)return {type:'array-buffer',bytes:bytesToBase64(new Uint8Array(value))};
 if(ArrayBuffer.isView(value))throw Error('未対応のバイナリ形式です。元データは変更していません。');
 if(Array.isArray(value)){if(Object.keys(value).some(key=>!(/^(0|[1-9][0-9]*)$/.test(key))||Number(key)>=value.length))throw Error('未対応の配列形式です。元データは変更していません。');for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw Error('未対応の配列形式です。元データは変更していません。');return {type:'array',value:await Promise.all(value.map(packValue))};}
 if(value&&typeof value==='object'){const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw Error('未対応の保存形式です。元データは変更していません。');return {type:'object',nullPrototype:proto===null,value:await Promise.all(Object.entries(value).map(async([k,v])=>[k,await packValue(v)]))};}
 if(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0)))return {type:'special-number',value:Number.isNaN(value)?'NaN':value===Infinity?'Infinity':value===-Infinity?'-Infinity':'-0'};
 if(value===null||['string','boolean','number'].includes(typeof value))return {type:'scalar',value};
 throw Error('未対応のデータ形式です。元データは変更していません。');
}
function unpackValue(node){
 if(!node||typeof node!=='object')throw Error('Invalid archive record');
 switch(node.type){
  case 'undefined':return undefined;
  case 'scalar':return node.value;
  case 'special-number':if(!['NaN','Infinity','-Infinity','-0'].includes(node.value))throw Error('Invalid numeric value');return Number(node.value);
  case 'date':return new Date(node.value);
  case 'array-buffer':return base64ToBytes(node.bytes).buffer;
  case 'blob':{const bytes=base64ToBytes(node.bytes);return typeof File!=='undefined'&&Object.hasOwn(node,'name')?new File([bytes],node.name,{type:node.mime,lastModified:node.lastModified}):new Blob([bytes],{type:node.mime});}
  case 'array':return node.value.map(unpackValue);
  case 'object':{const result=node.nullPrototype?Object.create(null):{};for(const[k,v]of node.value)Object.defineProperty(result,k,{value:unpackValue(v),enumerable:true,writable:true,configurable:true});return result;}
  default:throw Error('Unsupported archive node');
 }
}

async function capture(indexedDB,origin){
 const empty=()=>({format:'toshi-diary-safety-backup',version:1,database:DATABASE,sourceOrigin:origin,createdAt:new Date().toISOString(),stores:[]});
 if(typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(x=>x.name===DATABASE))return empty();
 const raw=await new Promise((resolve,reject)=>{
  const request=indexedDB.open(DATABASE);let missing=false;
  request.onupgradeneeded=()=>{missing=true;request.transaction.abort();};
  request.onerror=()=>missing?resolve([]):reject(request.error||Error('日記の読み取りに失敗しました'));
  request.onblocked=()=>reject(Error('他のHUB画面を閉じてから開き直してください'));
  request.onsuccess=()=>{
   const db=request.result,names=['revisions','meta'];
   if(names.some(name=>!db.objectStoreNames.contains(name))){db.close();reject(Error('日記の保存構造を確認できません。元データは変更していません。'));return;}
   try{
    const tx=db.transaction(names,'readonly');
    const results=names.map(name=>{const s=tx.objectStore(name);return {name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,records:s.getAll(),keys:s.getAllKeys()};});
    tx.oncomplete=()=>{db.close();resolve(results.map(r=>({...r,records:r.records.result,keys:r.keys.result})));};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('日記の読み取りが中断されました'));};
   }catch(error){db.close();reject(error);}
  };
 });
 const snapshot=empty();snapshot.stores=await Promise.all(raw.map(async s=>({...s,records:await packValue(s.records),keys:await packValue(s.keys)})));return snapshot;
}
function rows(snapshot,name){const store=snapshot.stores.find(s=>s.name===name);return store?unpackValue(store.records):[];}
function hasData(snapshot){return snapshot.stores.some(s=>unpackValue(s.records).length>0);}
function sameData(a,b){return a?.format==='toshi-diary-safety-backup'&&b?.format===a.format&&a.version===1&&b.version===1&&a.database===DATABASE&&b.database===DATABASE&&a.sourceOrigin===b.sourceOrigin&&JSON.stringify(a.stores)===JSON.stringify(b.stores);}
return {DATABASE,capture,rows,hasData,sameData,packValue,unpackValue};
});
