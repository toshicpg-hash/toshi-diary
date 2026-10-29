/* Read-only, incremental PAPA HUB export. No app startup, Google, storage writes or restore. */
(function(root){
'use strict';
const encoder=new TextEncoder(),PART=48*1024,BUFFER=64*1024;
const known=['toshi_diary_v1','toshi_hub_overlay_v1','toshi_board','toshi_receipts','toshi_assets_safe_v1','papa_hub_money_v1'];
const owned=name=>/^toshi_|^papa_hub_/.test(name);
const json=x=>{const s=JSON.stringify(x);if(s===undefined)throw Error('保存項目をJSONに変換できません');return s;};
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
const bytes64=b=>{let s='';for(let n=0;n<b.length;n+=8192)s+=String.fromCharCode(...b.subarray(n,n+8192));return btoa(s);};
async function* binary64(blob){for(let n=0;n<blob.size;n+=PART){yield bytes64(new Uint8Array(await blob.slice(n,n+PART).arrayBuffer()));}}
// Produces the existing DiarySafety typed format without holding an entire base64 image.
async function* packed(v){
 if(v instanceof Blob){yield '{"type":"blob","mime":'+json(v.type)+',"bytes":"';yield* binary64(v);yield '"';if(typeof File!=='undefined'&&v instanceof File)yield ',"name":'+json(v.name)+',"lastModified":'+json(v.lastModified);yield '}';return;}
 if(v===undefined){yield '{"type":"undefined"}';return;}
 if(v instanceof Date){yield '{"type":"date","value":'+json(v.toISOString())+'}';return;}
 if(v instanceof ArrayBuffer){yield '{"type":"array-buffer","bytes":"';yield* binary64(new Blob([v]));yield '"}';return;}
 if(ArrayBuffer.isView(v))throw Error('未対応のバイナリ形式があるため保存を止めました。元データは変更していません');
 if(Array.isArray(v)){
  if(Object.keys(v).some(k=>!(/^(0|[1-9][0-9]*)$/.test(k))||Number(k)>=v.length))throw Error('未対応の配列形式があります');
  yield '{"type":"array","value":[';for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))throw Error('未対応の配列形式があります');if(i)yield ',';yield* packed(v[i]);}yield ']}';return;
 }
 if(v&&typeof v==='object'){
  const p=Object.getPrototypeOf(v);if(p!==Object.prototype&&p!==null)throw Error('未対応の保存形式があります');
  yield '{"type":"object","nullPrototype":'+json(p===null)+',"value":[';let i=0;for(const[k,x]of Object.entries(v)){if(i++)yield ',';yield '['+json(k)+',';yield* packed(x);yield ']';}yield ']}';return;
 }
 if(typeof v==='number'&&(!Number.isFinite(v)||Object.is(v,-0))){yield '{"type":"special-number","value":'+json(Number.isNaN(v)?'NaN':v===Infinity?'Infinity':v===-Infinity?'-Infinity':'-0')+'}';return;}
 if(v===null||['string','boolean','number'].includes(typeof v)){yield '{"type":"scalar","value":'+json(v)+'}';return;}
 throw Error('未対応のデータ形式があります。元データは変更していません');
}
// SHA-256 per bounded chunk, chained in order. Used for the second read, not as an app revision ID.
async function checksum(parts,consume=()=>{}){
 let previous=new Uint8Array(32),length=0,buffer='';
 const digest=async text=>{const b=encoder.encode(text),input=new Uint8Array(previous.length+b.length);input.set(previous);input.set(b,previous.length);previous=new Uint8Array(await crypto.subtle.digest('SHA-256',input));length+=b.length;consume(text);};
 for await(const text of parts){buffer+=text;while(buffer.length>=BUFFER){let end=BUFFER;if(/[\uD800-\uDBFF]/.test(buffer[end-1]))end--;await digest(buffer.slice(0,end));buffer=buffer.slice(end);}}
 if(buffer)await digest(buffer);
 return {hash:Array.from(previous,x=>x.toString(16).padStart(2,'0')).join(''),length};
}
class Writer{
 constructor(){this.parts=[];this.pending='';this.bytes=0;}
 add(s){this.pending+=s;if(this.pending.length>=BUFFER)this.flush();}
 flush(){if(this.pending){const b=new Blob([this.pending]);this.parts.push(b);this.bytes+=b.size;this.pending='';}}
 finish(){this.flush();return new Blob(this.parts,{type:'application/json'});}
}
function localSnapshot(storage){const out=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&owned(k))out.push([k,storage.getItem(k)]);}return out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);}
async function databases(idb){if(typeof idb.databases!=='function')throw Error('このブラウザでは保存領域を安全に確認できません。PAPA HUBを使うChromeで開いてください');return (await idb.databases()).filter(x=>owned(x.name)).map(x=>({name:x.name,version:x.version})).sort((a,b)=>a.name.localeCompare(b.name));}
async function openExisting(idb,name){return new Promise((resolve,reject)=>{const q=idb.open(name);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=()=>reject(Error('保存領域が変わりました。バックアップを中止しました'));q.onblocked=()=>reject(Error('他のHUB画面を閉じてから試してください'));q.onsuccess=()=>resolve(q.result);});}
function describe(db){return {name:db.name,exists:true,version:db.version,stores:[...db.objectStoreNames].map(name=>{const s=db.transaction(name,'readonly').objectStore(name);return {name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:[...s.indexNames].map(k=>{const i=s.index(k);return {name:k,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};})};})};}
async function keysOf(db,name){return new Promise((resolve,reject)=>{const t=db.transaction(name,'readonly'),q=t.objectStore(name).getAllKeys();t.oncomplete=()=>resolve(q.result);t.onerror=t.onabort=()=>reject(t.error||Error('保存キーを読み取れません'));});}
async function valueOf(db,name,key){return new Promise((resolve,reject)=>{const t=db.transaction(name,'readonly'),s=t.objectStore(name),q=s.get(key),count=s.count(key);t.oncomplete=()=>count.result===1?resolve(q.result):reject(Error('保存中に記録が変わりました。元データは保持しています'));t.onerror=t.onabort=()=>reject(t.error||Error('記録を読み取れません'));});}
async function rawFingerprint(value){return checksum(packed(value));}
function stableKeys(keys){return checksum(packed(keys));}
async function capture({idb=root.indexedDB,storage=root.localStorage,origin=root.location.origin,device,onProgress=()=>{}}={}){
 if(!['Flip','Fold'].includes(device))throw Error('端末名を選んでください');
 const started=new Date().toISOString(),local=localSnapshot(storage),list=await databases(idb),plans=[],writer=new Writer();
 const progress=async message=>{await onProgress(message);await yieldUI();};
 const assertLocal=()=>{if(json(local)!==json(localSnapshot(storage)))throw Error('保存中にHUBの記録が変わりました。他のHUB画面を閉じて試してください');};
 let diaryEntries=new Set(),diaryRevisions=0,diaryDraft=false,blobs=0,blobBytes=0;
 // Discovery uses readonly transactions and rejects creation/upgrades of absent databases.
 for(const entry of list){const db=await openExisting(idb,entry.name);try{const d=describe(db);if(d.version!==entry.version)throw Error('保存構造が変わりました');for(const s of d.stores){s.keys=await keysOf(db,s.name);s.keyCheck=await stableKeys(s.keys);s.checks=[];}plans.push(d);}finally{db.close();}}
 const diary=plans.find(d=>d.name==='toshi_diary_v1');if(!diary||!diary.stores.find(s=>s.name==='revisions')?.keys.length)throw Error('このブラウザに日記が見つかりません。PAPA HUBを使っているChromeで開いてください。空のバックアップは作成していません');
 const countBinary=v=>{if(v instanceof Blob){blobs++;blobBytes+=v.size;}else if(Array.isArray(v))v.forEach(countBinary);else if(v&&typeof v==='object'&&!(v instanceof Date)&&!(v instanceof ArrayBuffer))Object.values(v).forEach(countBinary);};
 const writeStore=async(db,s,normalRecords=false)=>{
  const {keys,keyCheck,checks,indexes,...rest}=s,info=db.name==='toshi_diary_v1'?rest:{...rest,indexes};writer.add('{');let i=0;for(const[k,v]of Object.entries(info)){if(i++)writer.add(',');writer.add(json(k)+':'+json(v));}writer.add(',"records":'+(normalRecords?'[':'{"type":"array","value":['));
  for(let n=0;n<keys.length;n++){
   assertLocal();await progress('読み取り中：'+db.name+' / '+s.name+' '+(n+1)+' / '+keys.length);
   const value=await valueOf(db,s.name,keys[n]);if(n)writer.add(',');countBinary(value);
   if(db.name==='toshi_diary_v1'&&s.name==='revisions'){diaryRevisions++;if(typeof value?.entryId==='string')diaryEntries.add(value.entryId);}
   if(db.name==='toshi_diary_v1'&&s.name==='meta'&&value?.key==='draft'&&value.value)diaryDraft=true;
   if(normalRecords){writer.add(json(value));checks.push(await rawFingerprint(value));}else checks.push(await checksum(packed(value),text=>writer.add(text)));
   writer.flush();
  }
  writer.add(normalRecords?']':']}');if(!normalRecords){writer.add(',"keys":');await checksum(packed(keys),t=>writer.add(t));}writer.add('}');
 };
 const writeDatabase=async name=>{const d=plans.find(x=>x.name===name);if(!d){writer.add(json({name,exists:false}));return;}const db=await openExisting(idb,name);try{writer.add('{"name":'+json(name)+',"exists":true,"version":'+d.version+',"stores":[');for(let i=0;i<d.stores.length;i++){if(i)writer.add(',');await writeStore(db,d.stores[i]);}writer.add(']}');}finally{db.close();}};
 try{
  writer.add('{"format":"toshi-hub-safety-backup","version":1,"sourceOrigin":'+json(origin)+',"createdAt":'+json(started)+',"captureMethod":"incremental-readonly-v1","deviceLabel":'+json(device)+',"localStorage":');
  const regular=local.filter(([k])=>k.startsWith('toshi_')),extra=local.filter(([k])=>!k.startsWith('toshi_'));writer.add(json(regular));writer.add(',"extraLocalStorage":'+json(extra));
  writer.add(',"diary":{"format":"toshi-diary-safety-backup","version":1,"database":"toshi_diary_v1","sourceOrigin":'+json(origin)+',"createdAt":'+json(started)+',"stores":[');
  let db=await openExisting(idb,diary.name);try{const stores=[...diary.stores].sort((a,b)=>{const rank=n=>n==='revisions'?0:n==='meta'?1:2;return rank(a.name)-rank(b.name)});for(let i=0;i<stores.length;i++){if(i)writer.add(',');await writeStore(db,stores[i]);}}finally{db.close();}writer.add(']}');
  const overlay=plans.find(x=>x.name==='toshi_hub_overlay_v1');writer.add(',"overlaySnapshots":{"format":"toshi-hub-overlay-archive","version":1,"exists":'+json(!!overlay)+',"records":');
  if(overlay){if(overlay.stores.length!==1||overlay.stores[0].name!=='snapshots')throw Error('予定の保存構造が想定と異なります。元データは保持しています');db=await openExisting(idb,overlay.name);try{
   writer.add('[');const s=overlay.stores[0];for(let i=0;i<s.keys.length;i++){await progress('予定の編集履歴を保存中 '+(i+1)+' / '+s.keys.length);const v=await valueOf(db,s.name,s.keys[i]);if(i)writer.add(',');writer.add(json(v));writer.flush();s.checks.push(await rawFingerprint(v));}writer.add(']');
  }finally{db.close();}}else writer.add('[]');writer.add('}');
  writer.add(',"assets":{"format":"toshi-assets-archive","version":1,"databases":[');for(let i=0;i<3;i++){if(i)writer.add(',');await writeDatabase(['toshi_board','toshi_receipts','toshi_assets_safe_v1'][i]);}writer.add(']}');
  const additional=plans.filter(x=>!known.includes(x.name));writer.add(',"additionalDatabases":[');for(let i=0;i<additional.length;i++){if(i)writer.add(',');await writeDatabase(additional[i].name);}writer.add(']');
  // A second bounded read detects edits/removal/addition while exporting; no last-write-wins.
  await progress('保存内容の一致を確認中…');
  if(json(list)!==json(await databases(idb)))throw Error('保存中に保存領域が変わりました');
  for(const d of plans){const db=await openExisting(idb,d.name);try{if(json(describe(db))!==json({name:d.name,exists:d.exists,version:d.version,stores:d.stores.map(({keys,keyCheck,checks,...info})=>info)}))throw Error('保存中に保存構造が変わりました');for(const s of d.stores){const keys=await keysOf(db,s.name);if(json(await stableKeys(keys))!==json(s.keyCheck))throw Error('保存中に記録が追加・削除されました');for(let n=0;n<keys.length;n++){await progress('照合中：'+d.name+' / '+s.name+' '+(n+1)+' / '+keys.length);const check=await rawFingerprint(await valueOf(db,s.name,keys[n]));if(json(check)!==json(s.checks[n]))throw Error('保存中に記録の内容が変わりました');}}}finally{db.close();}}
  assertLocal();if(json(list)!==json(await databases(idb)))throw Error('照合中に保存領域が変わりました');
  const summary={diaryEntries:diaryEntries.size,diaryRevisions,diaryDraft,blobs,blobBytes,databases:plans.length};writer.add(',"captureSummary":'+json(summary)+',"verifiedAt":'+json(new Date().toISOString())+'}');
  const blob=writer.finish();return {blob,summary,device,filename:'PAPA-HUB-'+device+'-complete-'+started.replace(/[:.]/g,'-')+'.json'};
 }catch(e){writer.parts.length=0;writer.pending='';throw e;}
}
root.PapaBackup={capture,packed,checksum,Writer};
if(typeof document!=='undefined'){
 let running=false,url=null;const $=id=>document.getElementById(id);
 async function run(device){if(running)return;running=true;$('flip').disabled=$('fold').disabled=true;$('download').hidden=$('saveNote').hidden=true;$('summary').textContent='';if(url){URL.revokeObjectURL(url);url=null;}
  try{const result=await capture({device,onProgress:t=>$('progress').textContent=t});url=URL.createObjectURL(result.blob);const a=$('download');a.href=url;a.download=result.filename;a.textContent=device+'のバックアップを保存する（'+Math.ceil(result.blob.size/1024/1024)+' MB）';a.hidden=false;$('saveNote').hidden=false;$('summary').textContent='日記 '+result.summary.diaryEntries+'件・編集履歴 '+result.summary.diaryRevisions+'件・画像等 '+result.summary.blobs+'件';$('progress').textContent='ファイルを作成し、元データとの一致を確認しました。下の青いボタンを押して保存してください。';}
  catch(e){$('progress').textContent='バックアップ未完了：'+e.message;}
  finally{running=false;$('flip').disabled=$('fold').disabled=false;}
 }
 $('flip').onclick=()=>run('Flip');$('fold').onclick=()=>run('Fold');
}
})(globalThis);
