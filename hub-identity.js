(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubIdentity=api;})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';

// A binding is a proposal until the controller includes it in an explicit,
// guarded overlay commit. Inspection must never write to either storage key.
const NULL_SOURCE='\u0000toshi-hub-legacy:null\u0000';
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const forbidden=new Set(['__proto__','prototype','constructor']);
const failureMessage='以前のHUBと編集記録の対応を確認できません。番号に基づく編集の表示と保存・同期を停止し、元データと履歴を保持しています。';

function wellFormed(value){
 for(let index=0;index<value.length;index++){
  const code=value.charCodeAt(index);
  if(code>=0xd800&&code<=0xdbff){const next=value.charCodeAt(++index);if(!(next>=0xdc00&&next<=0xdfff))return false;}
  else if(code>=0xdc00&&code<=0xdfff)return false;
 }
 return true;
}

// JSON storage cannot contain accessors, cycles, sparse arrays, inherited data,
// symbols, or non-finite numbers. Refuse such inputs instead of coercing them.
function validateJSON(value,seen=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(Number.isFinite(value))return;throw Error('invalid-number');}
 if(typeof value!=='object'||seen.has(value))throw Error('invalid-json');
 const array=Array.isArray(value);
 if(!array&&!record(value))throw Error('invalid-object');
 if(array&&Object.getPrototypeOf(value)!==Array.prototype)throw Error('invalid-array');
 if(Object.getOwnPropertySymbols(value).length)throw Error('invalid-symbol');
 seen.add(value);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Object.keys(descriptors);
 if(array&&(keys.length!==value.length+1||!keys.every(key=>key==='length'||/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length)))throw Error('invalid-array');
 for(const key of keys){
  if(array&&key==='length')continue;
  const d=descriptors[key];
  if(!own(d,'value')||!d.enumerable)throw Error('invalid-property');
  validateJSON(d.value,seen);
 }
 seen.delete(value);
}

// Compare all JSON data, ignoring object member order. Only the top-level UI
// key on a history value is stripped; every raw-source field still counts.
function signature(value,stripUIKey=false){
 if(value===null||typeof value!=='object')return Object.is(value,-0)?'-0':JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(x=>signature(x)).join(',')+']';
 return '{'+Object.keys(value).filter(key=>!stripUIKey||key!=='_key').sort().map(key=>JSON.stringify(key)+':'+signature(value[key])).join(',')+'}';
}

function patchKey(key,bucket){
 const prefix=bucket==='edits'?'legacy:':'legacy-money:';
 if(key.startsWith(prefix)){
  const suffix=key.slice(prefix.length),index=Number(suffix);
  return /^(0|[1-9]\d*)$/.test(suffix)&&Number.isSafeInteger(index)?{positional:true,index}:null;
 }
 if(forbidden.has(key))return null;
 if(bucket==='edits'&&(/^safe:.+$/.test(key)||/^google:.+:.+$/.test(key)))return {positional:false};
 if(bucket==='moneyEdits'&&/^money:.+$/.test(key))return {positional:false};
 return null;
}

// This is only a display view. Never remove or rewrite a patch in the source
// overlay; stable-ID edits, caches, unknown fields, and history stay available.
function displayWithoutPositions(overlay){
 const view={version:1,items:[],money:[],google:[],history:[],syncedAt:''};
 if(record(overlay))for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(overlay))){
  if(own(d,'value')&&d.enumerable)Object.defineProperty(view,key,{value:d.value,writable:true,enumerable:true,configurable:true});
 }
 for(const key of ['items','money','google','history'])if(!Array.isArray(view[key]))view[key]=[];
 for(const bucket of ['edits','moneyEdits']){
  const filtered={},map=record(view[bucket])?view[bucket]:null;
  if(map)for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(map))){
   const parsed=patchKey(key,bucket);
   if(parsed&&!parsed.positional&&own(d,'value')&&d.enumerable&&record(d.value)){
    try{validateJSON(d.value);filtered[key]=d.value;}catch(_error){/* Unsafe display values stay in the original overlay. */}
   }
  }
  view[bucket]=filtered;
 }
 return view;
}

const sourceBuckets=['legacy.items','overlay.items','overlay.google','legacy.money','overlay.money'];
const validId=value=>typeof value==='string'&&value.length>0&&value.trim()===value&&!/[\u0000-\u0020\u007f]/.test(value)&&wellFormed(value);
function dataField(value,key){const d=record(value)?Object.getOwnPropertyDescriptor(value,key):null;return d&&own(d,'value')?d.value:undefined;}

function rowIdentity(row,bucket,index){
 if(bucket.endsWith('.money')){
  if(own(row,'safeId')&&!validId(row.safeId))return {valid:false};
  if(bucket==='overlay.money'&&!own(row,'safeId'))return {valid:false};
  return {valid:true,key:bucket==='legacy.money'?'legacy-money:'+index:'money:'+row.safeId,stable:bucket==='overlay.money',alias:own(row,'safeId')?'money:'+row.safeId:null};
 }
 const hasSafe=own(row,'safeId'),hasGoogle=own(row,'googleId')||own(row,'googleCalendarId');
 if(hasSafe&&!validId(row.safeId))return {valid:false};
 if(hasGoogle){
  if(!own(row,'googleId')||!own(row,'googleCalendarId')||!validId(row.googleId)||!validId(row.googleCalendarId))return {valid:false};
  const key='google:'+row.googleCalendarId+':'+row.googleId;
  return {valid:true,key,stable:true,alias:key,tuple:JSON.stringify([row.googleCalendarId,row.googleId])};
 }
 if(bucket==='overlay.google'||row.source==='google')return {valid:false};
 if(hasSafe)return {valid:true,key:'safe:'+row.safeId,stable:true,alias:'safe:'+row.safeId};
 return bucket==='legacy.items'?{valid:true,key:'legacy:'+index,stable:false,alias:null}:{valid:false};
}

// Enumerate original records independently of HubCore.list's Map. Invalid
// entries remain in their original array and are counted, never fabricated.
function inventory(legacy,overlay){
 const entries=[],omitted=[];
 for(const bucket of sourceBuckets){
  const [owner,key]=bucket.split('.'),rows=dataField(owner==='legacy'?legacy:overlay,key);
  if(!Array.isArray(rows))continue;
  let count=0;
  for(let index=0;index<rows.length;index++){
   const d=Object.getOwnPropertyDescriptor(rows,String(index)),row=d&&own(d,'value')?d.value:undefined;
   try{if(!record(row))throw Error('invalid-row');validateJSON(row);}
   catch(_error){count++;continue;}
   entries.push({row,bucket,index,money:key==='money',identity:rowIdentity(row,bucket,index)});
  }
  if(count)omitted.push({code:'undisplayable-records',source:bucket,count});
 }
 return {entries,omitted};
}

function groupsFor(entries,alias=false){
 const groups=new Map();
 for(const entry of entries){
  const key=alias?entry.identity.alias:entry.identity.key;
  if(!entry.identity.valid||!key)continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(entry);
 }
 return groups;
}

function refreshPair(entries){
 return entries.length===2&&entries.some(entry=>entry.bucket==='legacy.items')&&entries.some(entry=>entry.bucket==='overlay.google')&&entries[0].identity.tuple!==undefined&&entries[0].identity.tuple===entries[1].identity.tuple;
}

function inspectRecordIdentities(entries,fail){
 for(const entry of entries)if(!entry.identity.valid)fail('invalid-record-identity',{source:entry.bucket,index:entry.index});
 for(const [key,group]of groupsFor(entries,true)){
  if(group.length>1&&!refreshPair(group))fail('ambiguous-record-identity',{key,count:group.length,sources:[...new Set(group.map(entry=>entry.bucket))]});
 }
}

function stablePatchCompatible(entry,patch){
 if(!record(patch))return false;
 if(own(patch,'_key')&&patch._key!==entry.identity.key)return false;
 // A stable key cannot be turned into a different source/provider identity.
 for(const key of ['safeId','googleId','googleCalendarId'])if(own(patch,key)&&(!own(entry.row,key)||patch[key]!==entry.row[key]))return false;
 const identity=rowIdentity({...entry.row,...patch},entry.bucket,entry.index);
 return identity.valid&&identity.key===entry.identity.key&&identity.tuple===entry.identity.tuple;
}

function failureProjection(legacy,overlay,diagnostics){
 const displayOverlay=displayWithoutPositions(overlay),{entries,omitted}=inventory(legacy,overlay),groups=groupsFor(entries),aliases=groupsFor(entries,true),displayItems=[],displayMoney=[];
 for(const diagnostic of omitted)diagnostics.push(diagnostic);
 for(const entry of entries){
  const {row,bucket,index,money,identity}=entry,group=identity.valid?groups.get(identity.key):null;
  const aliasGroup=identity.alias?aliases.get(identity.alias):null;
  const unique=identity.valid&&group?.length===1&&(!aliasGroup||aliasGroup.length===1);
  const key=unique?identity.key:'view-only:'+bucket+':'+index;
  let patch=null;
  if(unique&&identity.stable){
   const candidate=displayOverlay[money?'moneyEdits':'edits'][identity.key];
   if(candidate&&stablePatchCompatible(entry,candidate))patch=candidate;
  }
  const projected={...row,...patch,_key:key,_viewOrigin:bucket,_viewOnly:true};
  (money?displayMoney:displayItems).push(projected);
 }
 const omittedCount=omitted.reduce((sum,entry)=>sum+entry.count,0);
 return {displayOverlay,displayItems,displayMoney,omittedCount};
}

async function defaultDigest(input){
 if(!root.crypto?.subtle||typeof root.TextEncoder!=='function')throw Error('crypto-unavailable');
 const bytes=new root.TextEncoder().encode(input),hash=await root.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/**
 * Inspect a parsed source and overlay without changing either one.
 * options.digest is a test seam: async (exactInputString) => 64 hex characters.
 * Returned displayOverlay shares immutable data with overlay; it is never a
 * persistence candidate. The controller must commit from the original overlay.
 */
async function inspect(legacyRaw,legacy,overlay,options={}){
 const diagnostics=[],fail=(code,detail={})=>diagnostics.push({code,...detail});
 const result=binding=>{
  if(binding)return {ok:true,binding,message:'',displayOverlay:overlay,diagnostics};
  const view=failureProjection(legacy,overlay,diagnostics);
  const message=failureMessage+' 確認のため元記録と保存済み更新を分けて表示する場合があります。'+(view.omittedCount?' 形式を確認できない'+view.omittedCount+'件は表示できません。元の保存データは保持しています。':'');
  return {ok:false,binding:null,message,...view,diagnostics};
 };
 try{
  if(legacyRaw!==null&&typeof legacyRaw!=='string'){fail('invalid-source-bytes');return result(null);}
  // UTF-8 replaces lone surrogates. Reject them rather than let two different
  // source strings acquire the same encoded digest input.
  if(legacyRaw!==null&&!wellFormed(legacyRaw)){fail('invalid-source-unicode');return result(null);}
  validateJSON(legacy);
  if(!record(legacy)||!['items','money'].every(key=>own(legacy,key)&&Array.isArray(legacy[key])&&legacy[key].every(record))){fail('invalid-legacy-shape');return result(null);}
  const parsed=legacyRaw===null?{items:[],money:[]}:JSON.parse(legacyRaw);
  if(signature(parsed)!==signature(legacy)){fail('source-data-mismatch');return result(null);}
 }catch(_error){fail('invalid-legacy-data');return result(null);}
 try{
  validateJSON(overlay);
  if(!record(overlay)||!own(overlay,'version')||overlay.version!==1||!['items','money','google','history'].every(key=>own(overlay,key)&&Array.isArray(overlay[key]))||!['edits','moneyEdits'].every(key=>own(overlay,key)&&record(overlay[key]))||!['items','money','google'].every(key=>overlay[key].every(record))){fail('invalid-overlay-shape');return result(null);}
 }catch(_error){fail('invalid-overlay-data');return result(null);}

 const records=inventory(legacy,overlay).entries,recordGroups=groupsFor(records),aliases=groupsFor(records,true),positionalAliases=new Map();
 inspectRecordIdentities(records,fail);

 const positions=[];
 for(const bucket of ['edits','moneyEdits'])for(const [key,patch]of Object.entries(overlay[bucket])){
  const parsed=patchKey(key,bucket);
  if(!parsed||!record(patch)){fail('invalid-patch',{bucket,key});continue;}
  if(!parsed.positional){
   for(const entry of recordGroups.get(key)||[])if(!stablePatchCompatible(entry,patch))fail('patch-identity-mismatch',{bucket,key});
   continue;
  }
  const rows=bucket==='edits'?legacy.items:legacy.money,row=rows[parsed.index];
  if(parsed.index>=rows.length||bucket==='edits'&&(row.safeId||row.googleId&&row.googleCalendarId)){fail('invalid-position',{bucket,key});continue;}
  if(own(patch,'googleId')||own(patch,'googleCalendarId')||own(patch,'_key')&&patch._key!==key)fail('patch-identity-mismatch',{bucket,key});
  if(own(patch,'safeId')){
   if(!validId(patch.safeId))fail('patch-identity-mismatch',{bucket,key});
   else{
    const alias=(bucket==='edits'?'safe:':'money:')+patch.safeId;
    const targets=aliases.get(alias)||[];
    if(targets.some(entry=>entry.identity.key!==key)||positionalAliases.has(alias)&&positionalAliases.get(alias)!==key)fail('ambiguous-patch-identity',{bucket,key});
    positionalAliases.set(alias,key);
   }
  }
  positions.push({bucket,key,index:parsed.index,row,rows,kind:bucket==='edits'?'previous-item':'previous-money'});
 }
 if(diagnostics.length)return result(null);

 let sha256;
 try{
  const digest=own(options,'digest')?options.digest:defaultDigest;
  if(typeof digest!=='function')throw Error('invalid-digest');
  sha256=await digest(legacyRaw===null?NULL_SOURCE:legacyRaw);
  if(typeof sha256!=='string'||!/^[a-f\d]{64}$/i.test(sha256))throw Error('invalid-digest');
  sha256=sha256.toLowerCase();
 }catch(_error){fail('digest-unavailable');return result(null);}

 if(own(overlay,'legacyBinding')){
  const binding=overlay.legacyBinding;
  if(!record(binding)||!own(binding,'version')||!own(binding,'sha256')||binding.version!==1||typeof binding.sha256!=='string'||!/^[a-f\d]{64}$/i.test(binding.sha256)){fail('invalid-binding');return result(null);}
  if(binding.sha256.toLowerCase()!==sha256){fail('source-binding-mismatch');return result(null);}
  return result({...binding});
 }

 // Old positional edits have no byte-level proof yet. Require their first
 // retained pre-edit value to match the current raw row uniquely. Do not search
 // another index, choose a later matching revision, or assign replacement IDs.
 for(const bucket of ['edits','moneyEdits']){
  const selected=positions.filter(position=>position.bucket===bucket);
  if(!selected.length)continue;
  const {rows,kind}=selected[0],rowSignatures=rows.map(row=>signature(row)),counts=new Map(),firstHistory=new Map(),historyKeys=new Map();
  for(const value of rowSignatures)counts.set(value,(counts.get(value)||0)+1);
  for(const entry of overlay.history){
   if(!record(entry)||!own(entry,'kind')||entry.kind!==kind||!own(entry,'value')||!record(entry.value)||!own(entry.value,'_key')||typeof entry.value._key!=='string'||!patchKey(entry.value._key,bucket)?.positional)continue;
   const key=entry.value._key,value=signature(entry.value,true);
   if(!firstHistory.has(key))firstHistory.set(key,value);
   if(!historyKeys.has(value))historyKeys.set(value,new Set());
   historyKeys.get(value).add(key);
  }
  for(const {key,index}of selected){
   if(!firstHistory.has(key)){fail('missing-history',{bucket,key});continue;}
   const value=rowSignatures[index];
   if(value!==firstHistory.get(key)){fail('history-mismatch',{bucket,key});continue;}
   if(counts.get(value)>1||historyKeys.get(value).size>1)fail('ambiguous-history',{bucket,key});
  }
 }
 if(diagnostics.length)return result(null);
 return result({version:1,sha256});
}

return {inspect};
});
