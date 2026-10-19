/* PAPA HUB 1.2.21: generated from unchanged ordered source files. */

;/* Source: hub-install.js */
try {
(function () {
  'use strict';
  const button = document.getElementById('hubInstall');
  const status = document.getElementById('hubInstallStatus');
  if (!button || !status) return;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let offer = null, pending = false, installed = false;
  function render(message) {
    button.disabled = pending || installed || standalone.matches || !offer;
    status.textContent = standalone.matches
      ? 'PAPA HUBはアプリの画面で開いています。'
      : message;
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (installed || standalone.matches) return;
    offer = event;
    render('このボタンからChromeのインストール確認を開けます。');
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    offer = null;
    render('Chromeからインストール完了の通知を受け取りました。ホーム画面にPAPA HUBがあるか確認してください。');
  });
  standalone.addEventListener('change', () => render('この画面ではまだインストールを開始できません。ショートカットから引き続き使えます。'));
  button.addEventListener('click', async () => {
    if (button.disabled || !offer || pending) return;
    const current = offer;
    offer = null;
    pending = true;
    render('Chromeの確認画面でインストールを選んでください。');
    let message;
    try {
      await current.prompt();
      const choice = await current.userChoice;
      message = choice && choice.outcome === 'accepted'
        ? 'インストールを受け付けました。完了の通知を待っています。ホーム画面への追加はまだ未確認です。'
        : 'インストールは見送りました。HUBはこの画面で引き続き使えます。';
    } catch (_) {
      message = 'インストールを開始できませんでした。HUBはこの画面で引き続き使えます。';
    } finally {
      pending = false;
      if (!installed) render(offer ? 'このボタンからChromeのインストール確認を開けます。' : message);
    }
  });
  render(status.textContent);
}());

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: config.js */
// Public browser OAuth client identifier, unchanged from the existing app. This is not a secret.
const GOOGLE_CLIENT_ID="766726293537-1e4kdsqmoit29rbvh559fnmha3q0s6up.apps.googleusercontent.com";


;/* Source: hub-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STORAGE='toshi_hub_safe_v1',LEGACY='toshi_v5';
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
const time=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const addDays=(value,n)=>{const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
function parseLegacy(raw){if(raw===null)return {items:[],money:[]};const value=JSON.parse(raw);if(!value||typeof value!=='object'||!Array.isArray(value.items)||!Array.isArray(value.money))throw Error('以前のHUBの保存形式を確認できません。元データは保持しています。');return value;}
function parseOverlay(raw){if(raw===null)return {version:1,items:[],edits:{},money:[],moneyEdits:{},google:[],history:[],syncedAt:''};const value=JSON.parse(raw);if(!value||value.version!==1||!['items','money','google','history'].every(k=>Array.isArray(value[k]))||!value.edits||!value.moneyEdits)throw Error('HUBの保存形式を確認できません。元データは保持しています。');return value;}
function key(x,index){return x.googleId&&x.googleCalendarId?'google:'+x.googleCalendarId+':'+x.googleId:x.safeId?'safe:'+x.safeId:'legacy:'+index;}
function list(legacy,overlay){const rows=new Map(),completed=new Map(),providerIdentity=x=>JSON.stringify([x.googleCalendarId,x.googleId]);const remember=x=>{if(x?.source==='google'&&typeof x.googleId==='string'&&x.googleId&&typeof x.googleCalendarId==='string'&&x.googleCalendarId&&x.done===true){const k=providerIdentity(x),prior=completed.get(k);if(!prior||String(x.completedAt||x.completedDate||'')>String(prior.completedAt||prior.completedDate||''))completed.set(k,x);}};legacy.items.forEach((x,i)=>{rows.set(key(x,i),{...x,_key:key(x,i)});remember(x);});overlay.items.forEach(x=>rows.set(key(x),{...x,_key:key(x)}));overlay.google.forEach(x=>rows.set(key(x),{...x,_key:key(x)}));for(const h of overlay.history||[])if(['previous-google','previous-item'].includes(h?.kind))remember(h.value);for(const [k,patch]of Object.entries(overlay.edits)){if(rows.has(k))rows.set(k,{...rows.get(k),...patch,_key:k});}for(const [k,row]of rows){const saved=completed.get(providerIdentity(row)),patch=overlay.edits[k];if(saved&&row.source==='google'&&['todo','task'].includes(row.type)&&row.done===false&&patch?.completionDecision!=='reopened'&&!(patch&&Object.hasOwn(patch,'done')&&patch.done===false)){rows.set(k,{...row,done:true,completedDate:saved.completedDate||'',completedAt:saved.completedAt||'',completionConflict:true});}}return [...rows.values()];}
function money(legacy,overlay){return [...legacy.money.map((x,i)=>({...x,_key:'legacy-money:'+i})),...overlay.money.map(x=>({...x,_key:'money:'+x.safeId}))].map(x=>({...x,...overlay.moneyEdits[x._key],_key:x._key}));}
function deadline(x){return x.type==='todo'?(x.deadlineDate||(x.source!=='google'?x.end:'')||''):'';}
function workStart(x){return x.scheduledDate||x.start||deadline(x)||'';}
function span(x,date){if(x.cancelled)return false;const start=x.type==='event'?x.date:workStart(x),end=x.type==='event'?(x.endDate||start):(deadline(x)||start);return !!start&&start<=date&&date>=''&&date<=(end||start);}
function zoned(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return date.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})+'T'+date.toLocaleTimeString('sv-SE',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}
// Read-only compatibility: only named, validated private metadata can supply a
// deadline or legacy range. Google event dates and title prefixes never do so.
function googleWorkMetadata(p,type){
 const result={start:'',deadlineDate:'',deadlineTime:'',diaryEntryId:'',metadataWarnings:[]};
 if(!['todo','task'].includes(type))return result;
 const warnings=result.metadataWarnings,has=k=>Object.prototype.hasOwnProperty.call(p,k),present=k=>has(k)&&p[k]!=='';
 if(present('toshiHubDiaryEntryId')){
  if(typeof p.toshiHubDiaryEntryId==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(p.toshiHubDiaryEntryId))result.diaryEntryId=p.toshiHubDiaryEntryId;
  else warnings.push('日記の関連IDを確認できません。');
 }
 // An explicit task classification overrides stale ToDo metadata.
 if(type!=='todo')return result;
 if(present('toshiHubStart')){
  if(day(p.toshiHubStart))result.start=p.toshiHubStart;
  else warnings.push('旧ToDoの開始日を確認できません。');
 }
 const oldEnd=has('toshiHubEnd')&&day(p.toshiHubEnd)?p.toshiHubEnd:'';
 if(present('toshiHubEnd')&&!oldEnd)warnings.push('旧ToDoの期限日を確認できません。');
 if(has('toshiHubDeadlineDate')){
  if(day(p.toshiHubDeadlineDate)){
   result.deadlineDate=p.toshiHubDeadlineDate;
   if(oldEnd&&oldEnd!==result.deadlineDate)warnings.push('新旧の期限日が異なるため、明示された新しい期限日を表示しています。');
  }else if(p.toshiHubDeadlineDate===''){
   if(oldEnd)warnings.push('新しい期限日が空欄のため、旧期限日は補完していません。');
  }else warnings.push('新しい期限日を確認できないため、旧期限日は補完していません。');
 }else result.deadlineDate=oldEnd;
 if(present('toshiHubDeadlineTime')){
  if(time(p.toshiHubDeadlineTime))result.deadlineTime=p.toshiHubDeadlineTime;
  else warnings.push('ToDoの期限時刻を確認できません。');
 }
 if(result.start&&result.deadlineDate&&result.start>result.deadlineDate)warnings.push('ToDoの開始日が期限日より後です。日付を確認してください。');
 if(result.deadlineTime&&!result.deadlineDate)warnings.push('期限時刻はありますが、期限日を確認できません。');
 return result;
}
function fromGoogle(event,calendar){
 const p=event.extendedProperties?.private||{},title=event.summary||'(タイトルなし)',prefix=calendar.summary==='TASK'?/^(✅\s*)?【(ToDo|タスク)】\s*/.exec(title):null;
 const type=prefix?(prefix[2]==='ToDo'?'todo':'task'):['todo','task'].includes(p.toshiHubType)?p.toshiHubType:'event';
 const allDay=!!event.start?.date,start=event.start?.date||zoned(event.start?.dateTime)||'',end=event.end?.date||zoned(event.end?.dateTime)||start,startDate=start.slice(0,10),endDate=end.slice(0,10),time=allDay?'':start.slice(11,16),endTime=allDay?'':end.slice(11,16);
 const last=allDay&&day(endDate)?addDays(endDate,-1):endTime==='00:00'&&endDate>startDate?addDays(endDate,-1):endDate;
 const metadata=googleWorkMetadata(p,type);
 return {title:prefix?title.slice(prefix[0].length):title,type,project:type==='event'?(calendar.primary?'TOSHI':calendar.summary):(p.toshiHubProject||'TASK'),date:startDate,endDate:last||startDate,scheduledDate:metadata.start||startDate,time,endTime,allDay,done:type!=='event'&&(!!prefix?.[1]||p.toshiHubDone==='true'),...metadata,completedDate:p.toshiHubCompletedDate||'',completedAt:p.toshiHubCompletedAt||'',source:'google',googleVersion:{etag:typeof event.etag==='string'&&event.etag?event.etag:null,updated:typeof event.updated==='string'?event.updated:null,sequence:Number.isSafeInteger(event.sequence)&&event.sequence>=0?event.sequence:null},googleId:event.id,googleCalendarId:calendar.id,googleUrl:event.htmlLink||'',googleDescription:event.description||'',googleOrganizerId:event.organizer?.email||'',externalTodo:!!prefix,hubTodo:type!=='event',cancelled:event.status==='cancelled'};
}
function mergeGoogle(legacy,overlay,incoming,calendars,from,to){const next=structuredClone(overlay),received=new Set(incoming.map(x=>key(x))),targets=new Set(calendars.map(c=>c.id)),map=new Map(next.google.map(x=>[key(x),x]));for(const row of list(legacy,overlay)){if(row.source!=='google')continue;const k=row._key,inRange=row.date<=to&&(row.endDate||row.date)>=from;if(received.has(k)){if(next.edits[k])delete next.edits[k].googleUnverified;}else if(inRange||!targets.has(row.googleCalendarId)){next.edits[k]={...next.edits[k],googleUnverified:true};}}for(const row of incoming)map.set(key(row),row);next.google=[...map.values()];return next;}

function completionPatch(event,done,at){const p=event.extendedProperties?.private||{},title=event.summary||'',prefix=/^(✅\s*)?【(ToDo|タスク)】\s*/.exec(title),type=prefix?(prefix[2]==='ToDo'?'todo':'task'):p.toshiHubType;if(!['todo','task'].includes(type))throw Error('Google側の分類が予定に変更されています。同期して確認してください。');return {...prefix?{summary:(done?'✅':'')+title.replace(/^✅\s*/,'')}: {},extendedProperties:{private:{...p,toshiHubType:type,toshiHubDone:String(done),toshiHubCompletedAt:done?at:'',toshiHubCompletedDate:done?new Date(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}):''}}};}
// With a previous record, validate changed inputs without rewriting or forcing
// repairs to untouched legacy fields. New records still require explicit dates.
function validateItem(x,previous=null){
 const changed=k=>!previous||x.type!==previous.type||x[k]!==previous[k],anyChanged=keys=>keys.some(changed);
 if(changed('title')&&(typeof x.title!=='string'||!x.title.trim()||x.title.length>300))throw Error('件名を300文字以内で入力してください');
 if(!['event','todo','task'].includes(x.type))throw Error('種類を選んでください');
 if(x.type==='event'&&changed('date')&&!day(x.date))throw Error('予定日を入力してください');
 if(x.type==='todo'&&((!previous||x.type!==previous.type)?!day(x.deadlineDate):anyChanged(['deadlineDate','end'])&&!day(deadline(x))))throw Error('ToDoの期限日を明示入力してください');
 if(x.type==='task'&&changed('deadlineDate')&&x.deadlineDate)throw Error('タスクに期限は付けません');
 for(const k of ['date','endDate','scheduledDate','deadlineDate','start','end'])if(changed(k)&&x[k]!==undefined&&x[k]!==''&&!day(x[k]))throw Error('日付を確認してください');
 for(const k of ['time','endTime','deadlineTime'])if(changed(k)&&x[k]!==undefined&&x[k]!==''&&!time(x[k]))throw Error('時刻を確認してください（00:00〜23:59）');
 if(anyChanged(['date','endDate'])&&x.endDate&&x.date&&x.endDate<x.date)throw Error('終了日は開始日以降にしてください');
 if(x.type==='event'&&anyChanged(['date','endDate','time','endTime','allDay'])){
  if(x.endTime&&!x.time)throw Error('終了時刻には開始時刻も入力してください');
  if(x.time&&x.endTime&&(x.endDate||x.date)===x.date&&x.endTime<x.time)throw Error('終了時刻は開始時刻以降にしてください');
  if(x.allDay&&(x.time||x.endTime))throw Error('終日の予定には時刻を付けません');
 }
 if(x.type==='todo'&&anyChanged(['scheduledDate','start','deadlineDate','end'])&&workStart(x)&&deadline(x)&&workStart(x)>deadline(x))throw Error('ToDoの開始日は期限日以前にしてください');
 return x;
}
return {STORAGE,LEGACY,day,time,addDays,parseLegacy,parseOverlay,key,list,money,deadline,workStart,span,fromGoogle,mergeGoogle,completionPatch,validateItem};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-identity.js */
try {
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

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-calendar.js */
try {
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hub-core.js'));
  else root.HubCalendar = factory(root.HubCore);
})(typeof globalThis === 'object' ? globalThis : this, function (C) {
  'use strict';

  // Pure projections of caller-supplied records. No clock, storage, network,
  // recurrence generation, record rewriting, or date-to-deadline inference.
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const day = value => typeof value === 'string' && C.day(value);
  const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const visible = row => record(row) && !row.cancelled && !row.linkedGoogleKey;

  function requireDay(date) {
    if (!day(date)) throw RangeError('A valid YYYY-MM-DD date is required');
  }

  function shifted(date, amount) {
    const result = C.addDays(date, amount);
    if (!day(result)) throw RangeError('Calendar date range is outside supported YYYY-MM-DD dates');
    return result;
  }

  function stableKey(row, index, kind) {
    if (typeof row._key === 'string' && row._key) return row._key;
    if (typeof row.stable_key === 'string' && row.stable_key) return row.stable_key;
    return kind === 'money' ? (row.safeId ? 'money:' + row.safeId : 'legacy-money:' + index) : C.key(row, index);
  }

  function calendarDays(anchor, view = 'month') {
    requireDay(anchor);
    if (!['month', 'week'].includes(view)) throw RangeError('Calendar view must be month or week');
    const first = view === 'month' ? anchor.slice(0, 8) + '01' : anchor;
    const start = shifted(first, -new Date(first + 'T00:00:00Z').getUTCDay());
    return Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => shifted(start, index));
  }

  function coversDay(row, date) {
    if (!['event', 'todo', 'task'].includes(row.type)) return false;
    const deadline = C.deadline(row);
    const start = row.type === 'event' ? row.date : (C.workStart ? C.workStart(row) : row.scheduledDate || row.start || deadline);
    const end = row.type === 'event' ? row.endDate || start : deadline || start;
    return day(start) && day(end) && start <= end && C.span(row, date);
  }

  function amountValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
  }

  function amountLabel(value) {
    const amount = amountValue(value);
    return amount === null ? '金額要確認' : '¥' + amount.toLocaleString('ja-JP');
  }

  function itemTimeLabel(row) {
    if (row.type === 'todo' && day(C.deadline(row)) && time(row.deadlineTime)) return '期限 ' + row.deadlineTime;
    if (row.allDay) return '終日';
    if (time(row.time)) return row.time + (time(row.endTime) ? '〜' + row.endTime : '');
    return row.type === 'todo' ? 'ToDo' : row.type === 'task' ? 'タスク' : '時刻なし';
  }

  function sortTime(row) {
    if (row.entry_kind === 'item' && row.allDay) return ['00:00', 0];
    if (time(row.time)) return [row.time, 1];
    if (row.entry_kind === 'item' && row.type === 'todo' && day(C.deadline(row)) && time(row.deadlineTime)) return [row.deadlineTime, 1];
    return ['24:00', 2];
  }

  function entryOrder(a, b) {
    const A = sortTime(a), B = sortTime(b);
    return compare(A[0], B[0]) || A[1] - B[1] || compare(a.stable_key, b.stable_key) || compare(a.entry_kind, b.entry_kind);
  }

  /**
   * Every visible matching item and dated money row, including completed rows.
   * Source fields are preserved. Additions are stable_key, entry_kind,
   * calendar_date and time_label; money also adds amount_value, amount_label,
   * and direction_label. Unknown/blank amounts remain null, never zero.
   * Persisted _key values are preferred. Legacy fallbacks use the original
   * input index, matching HubCore's legacy identity contract.
   */
  function entries(items, money, date) {
    if (!Array.isArray(items) || !Array.isArray(money)) throw TypeError('Calendar entries require item and money arrays');
    requireDay(date);
    const result = [];
    items.forEach((row, index) => {
      if (!visible(row) || !coversDay(row, date)) return;
      result.push({ ...row, stable_key: stableKey(row, index, 'item'), entry_kind: 'item', calendar_date: date, time_label: itemTimeLabel(row) });
    });
    money.forEach((row, index) => {
      if (!visible(row) || !day(row.date) || row.date !== date) return;
      const value = amountValue(row.amount);
      result.push({
        ...row, stable_key: stableKey(row, index, 'money'), entry_kind: 'money', calendar_date: date,
        time_label: time(row.time) ? row.time : '時刻なし', amount_value: value,
        amount_label: amountLabel(value),
        direction_label: row.kind === 'income' ? '入金' : row.kind === 'payment' ? '支払' : '区分要確認'
      });
    });
    return result.sort(entryOrder);
  }

  /**
   * Original period tabs use deadlines, not scheduled dates. "week" preserves
   * the old inclusive today-through-today+7 interval (eight calendar dates).
   * "none" means no declared deadline; scheduled tasks still belong there.
   * Todo/task distinctions are retained. Today comes first, then nearest dates. Invalid nonempty
   * deadline strings stay visible under all, never disguised as "no deadline".
   */
  function workRows(items, filters = {}, today) {
    if (!Array.isArray(items)) throw TypeError('Work rows require an item array');
    if (!record(filters)) throw TypeError('Work filters must be an object');
    const { period = 'all', type = 'all', done = 'all' } = filters;
    if (!['all', 'today', 'week', 'none'].includes(period) || !['all', 'todo', 'task'].includes(type) || !['all', 'open', 'done'].includes(done)) {
      throw RangeError('Invalid work filter');
    }
    if (today !== undefined || period === 'today' || period === 'week') requireDay(today);
    const last = period === 'week' ? shifted(today, 7) : '';
    const rows = [];
    items.forEach((row, index) => {
      if (!visible(row) || !['todo', 'task'].includes(row.type) || (type !== 'all' && row.type !== type)) return;
      if ((done === 'open' && row.done) || (done === 'done' && !row.done)) return;
      const deadline = C.deadline(row);
      if (period === 'none' && deadline) return;
      if (period === 'today' && (!day(deadline) || deadline !== today)) return;
      if (period === 'week' && (!day(deadline) || deadline < today || deadline > last)) return;
      rows.push({ ...row, stable_key: stableKey(row, index, 'item') });
    });
    if (today !== undefined) {
      const base = Date.parse(today + 'T00:00:00Z');
      const indexed = rows.map((row, index) => {
        const deadline = C.deadline(row);
        const start = C.workStart(row);
        const date = day(deadline) ? deadline : !deadline && day(start) ? start : '';
        const offset = date ? Date.parse(date + 'T00:00:00Z') - base : Infinity;
        return { row, index, offset, distance: Math.abs(offset) };
      });
      indexed.sort((a, b) => a.distance - b.distance || (a.offset >= 0 ? 0 : 1) - (b.offset >= 0 ? 0 : 1) || a.index - b.index);
      return indexed.map(x => x.row);
    }
    return rows;
  }

  return { calendarDays, entries, workRows, amountValue, amountLabel };
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-holidays.js */
try {
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HubHolidays = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // Static public date facts from the Cabinet Office CSV. No holiday algorithm,
  // equinox approximation, online fetch, or extrapolation outside this range.
  // Dates and names are transcribed from the source below, checked 2026-10-14.
  const coverage = Object.freeze({
    firstYear: 1955, lastYear: 2027, checkedOn: '2026-10-14',
    sourceURL: 'https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html',
    csvURL: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv',
    count: 1067,
    attribution: '出典：内閣府「国民の祝日」公表CSV（1955〜2027年、2026-10-14確認）を加工'
  });
  const byYear = {
    "1955": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-24,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1956": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1957": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1958": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1959": "01-01,元日;01-15,成人の日;03-21,春分の日;04-10,結婚の儀;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-24,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1960": "01-01,元日;01-15,成人の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1961": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1962": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1963": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-24,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1964": "01-01,元日;01-15,成人の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1965": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "1966": "01-01,元日;01-15,成人の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1967": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-24,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1968": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1969": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1970": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1971": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-24,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1972": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1973": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;04-30,休日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;09-24,休日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1974": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;05-06,休日;09-15,敬老の日;09-16,休日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日",
    "1975": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-24,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日",
    "1976": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;10-11,休日;11-03,文化の日;11-23,勤労感謝の日",
    "1977": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1978": "01-01,元日;01-02,休日;01-15,成人の日;01-16,休日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1979": "01-01,元日;01-15,成人の日;02-11,建国記念の日;02-12,休日;03-21,春分の日;04-29,天皇誕生日;04-30,休日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-24,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1980": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日",
    "1981": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1982": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;03-22,休日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;10-11,休日;11-03,文化の日;11-23,勤労感謝の日",
    "1983": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1984": "01-01,元日;01-02,休日;01-15,成人の日;01-16,休日;02-11,建国記念の日;03-20,春分の日;04-29,天皇誕生日;04-30,休日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;09-24,休日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1985": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;05-06,休日;09-15,敬老の日;09-16,休日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日",
    "1986": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日",
    "1987": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,天皇誕生日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1988": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;03-21,休日;04-29,天皇誕生日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日",
    "1989": "01-01,元日;01-02,休日;01-15,成人の日;01-16,休日;02-11,建国記念の日;02-24,大喪の礼;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1990": "01-01,元日;01-15,成人の日;02-11,建国記念の日;02-12,休日;03-21,春分の日;04-29,みどりの日;04-30,休日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;09-24,休日;10-10,体育の日;11-03,文化の日;11-12,即位礼正殿の儀;11-23,勤労感謝の日;12-23,天皇誕生日;12-24,休日",
    "1991": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;05-06,休日;09-15,敬老の日;09-16,休日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1992": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1993": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;06-09,結婚の儀;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;10-11,休日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1994": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1995": "01-01,元日;01-02,休日;01-15,成人の日;01-16,休日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1996": "01-01,元日;01-15,成人の日;02-11,建国記念の日;02-12,休日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;05-06,休日;07-20,海の日;09-15,敬老の日;09-16,休日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1997": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-05,こどもの日;07-20,海の日;07-21,休日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日;12-23,天皇誕生日",
    "1998": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-20,海の日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "1999": "01-01,元日;01-15,成人の日;02-11,建国記念の日;03-21,春分の日;03-22,休日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-20,海の日;09-15,敬老の日;09-23,秋分の日;10-10,体育の日;10-11,休日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2000": "01-01,元日;01-10,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-20,海の日;09-15,敬老の日;09-23,秋分の日;10-09,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2001": "01-01,元日;01-08,成人の日;02-11,建国記念の日;02-12,休日;03-20,春分の日;04-29,みどりの日;04-30,休日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-20,海の日;09-15,敬老の日;09-23,秋分の日;09-24,休日;10-08,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日;12-24,休日",
    "2002": "01-01,元日;01-14,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;05-06,休日;07-20,海の日;09-15,敬老の日;09-16,休日;09-23,秋分の日;10-14,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2003": "01-01,元日;01-13,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-05,こどもの日;07-21,海の日;09-15,敬老の日;09-23,秋分の日;10-13,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日;12-23,天皇誕生日",
    "2004": "01-01,元日;01-12,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-19,海の日;09-20,敬老の日;09-23,秋分の日;10-11,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2005": "01-01,元日;01-10,成人の日;02-11,建国記念の日;03-20,春分の日;03-21,休日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-18,海の日;09-19,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2006": "01-01,元日;01-02,休日;01-09,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,みどりの日;05-03,憲法記念日;05-04,休日;05-05,こどもの日;07-17,海の日;09-18,敬老の日;09-23,秋分の日;10-09,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2007": "01-01,元日;01-08,成人の日;02-11,建国記念の日;02-12,休日;03-21,春分の日;04-29,昭和の日;04-30,休日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-16,海の日;09-17,敬老の日;09-23,秋分の日;09-24,休日;10-08,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日;12-24,休日",
    "2008": "01-01,元日;01-14,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-21,海の日;09-15,敬老の日;09-23,秋分の日;10-13,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日;12-23,天皇誕生日",
    "2009": "01-01,元日;01-12,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-20,海の日;09-21,敬老の日;09-22,休日;09-23,秋分の日;10-12,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2010": "01-01,元日;01-11,成人の日;02-11,建国記念の日;03-21,春分の日;03-22,休日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-19,海の日;09-20,敬老の日;09-23,秋分の日;10-11,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2011": "01-01,元日;01-10,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-18,海の日;09-19,敬老の日;09-23,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2012": "01-01,元日;01-02,休日;01-09,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,昭和の日;04-30,休日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-16,海の日;09-17,敬老の日;09-22,秋分の日;10-08,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日;12-24,休日",
    "2013": "01-01,元日;01-14,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-15,海の日;09-16,敬老の日;09-23,秋分の日;10-14,体育の日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2014": "01-01,元日;01-13,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-21,海の日;09-15,敬老の日;09-23,秋分の日;10-13,体育の日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日;12-23,天皇誕生日",
    "2015": "01-01,元日;01-12,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-20,海の日;09-21,敬老の日;09-22,休日;09-23,秋分の日;10-12,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2016": "01-01,元日;01-11,成人の日;02-11,建国記念の日;03-20,春分の日;03-21,休日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-18,海の日;08-11,山の日;09-19,敬老の日;09-22,秋分の日;10-10,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2017": "01-01,元日;01-02,休日;01-09,成人の日;02-11,建国記念の日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-17,海の日;08-11,山の日;09-18,敬老の日;09-23,秋分の日;10-09,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日",
    "2018": "01-01,元日;01-08,成人の日;02-11,建国記念の日;02-12,休日;03-21,春分の日;04-29,昭和の日;04-30,休日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-16,海の日;08-11,山の日;09-17,敬老の日;09-23,秋分の日;09-24,休日;10-08,体育の日;11-03,文化の日;11-23,勤労感謝の日;12-23,天皇誕生日;12-24,休日",
    "2019": "01-01,元日;01-14,成人の日;02-11,建国記念の日;03-21,春分の日;04-29,昭和の日;04-30,休日;05-01,休日（祝日扱い）;05-02,休日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-15,海の日;08-11,山の日;08-12,休日;09-16,敬老の日;09-23,秋分の日;10-14,体育の日（スポーツの日）;10-22,休日（祝日扱い）;11-03,文化の日;11-04,休日;11-23,勤労感謝の日",
    "2020": "01-01,元日;01-13,成人の日;02-11,建国記念の日;02-23,天皇誕生日;02-24,休日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-23,海の日;07-24,スポーツの日;08-10,山の日;09-21,敬老の日;09-22,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "2021": "01-01,元日;01-11,成人の日;02-11,建国記念の日;02-23,天皇誕生日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-22,海の日;07-23,スポーツの日;08-08,山の日;08-09,休日;09-20,敬老の日;09-23,秋分の日;11-03,文化の日;11-23,勤労感謝の日",
    "2022": "01-01,元日;01-10,成人の日;02-11,建国記念の日;02-23,天皇誕生日;03-21,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-18,海の日;08-11,山の日;09-19,敬老の日;09-23,秋分の日;10-10,スポーツの日;11-03,文化の日;11-23,勤労感謝の日",
    "2023": "01-01,元日;01-02,休日;01-09,成人の日;02-11,建国記念の日;02-23,天皇誕生日;03-21,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-17,海の日;08-11,山の日;09-18,敬老の日;09-23,秋分の日;10-09,スポーツの日;11-03,文化の日;11-23,勤労感謝の日",
    "2024": "01-01,元日;01-08,成人の日;02-11,建国記念の日;02-12,休日;02-23,天皇誕生日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-15,海の日;08-11,山の日;08-12,休日;09-16,敬老の日;09-22,秋分の日;09-23,休日;10-14,スポーツの日;11-03,文化の日;11-04,休日;11-23,勤労感謝の日",
    "2025": "01-01,元日;01-13,成人の日;02-11,建国記念の日;02-23,天皇誕生日;02-24,休日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-21,海の日;08-11,山の日;09-15,敬老の日;09-23,秋分の日;10-13,スポーツの日;11-03,文化の日;11-23,勤労感謝の日;11-24,休日",
    "2026": "01-01,元日;01-12,成人の日;02-11,建国記念の日;02-23,天皇誕生日;03-20,春分の日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;05-06,休日;07-20,海の日;08-11,山の日;09-21,敬老の日;09-22,休日;09-23,秋分の日;10-12,スポーツの日;11-03,文化の日;11-23,勤労感謝の日",
    "2027": "01-01,元日;01-11,成人の日;02-11,建国記念の日;02-23,天皇誕生日;03-21,春分の日;03-22,休日;04-29,昭和の日;05-03,憲法記念日;05-04,みどりの日;05-05,こどもの日;07-19,海の日;08-11,山の日;09-20,敬老の日;09-23,秋分の日;10-11,スポーツの日;11-03,文化の日;11-23,勤労感謝の日",
  };
  const names = new Map();
  for (const [year, entries] of Object.entries(byYear)) {
    for (const entry of entries.split(';')) {
      const [date, name] = entry.split(',');
      names.set(year + '-' + date, name);
    }
  }

  function covered(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const value = new Date(date + 'T00:00:00Z');
    return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date && Number(date.slice(0, 4)) >= coverage.firstYear && Number(date.slice(0, 4)) <= coverage.lastYear;
  }

  // null signals unavailable data, distinct from a known ordinary day.
  const isHoliday = date => covered(date) ? names.has(date) : null;
  const name = date => covered(date) ? names.get(date) || '' : null;
  function dates(year) {
    if (!Number.isInteger(year) || year < coverage.firstYear || year > coverage.lastYear) return null;
    return byYear[String(year)].split(';').map(entry => year + '-' + entry.split(',')[0]);
  }
  return { coverage, covered, isHoliday, name, dates };
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: diary-core.js */
try {
/* Append-only private journal protocol, shared by HUB and the Nami connector. */
(function(root){
 'use strict';
 const keys=['revisionId','entryId','parents','date','title','body','people','golfGood','golfImprove','golfNext','createdAt','updatedAt','source','deviceId'];
 const headers=['revision_id','entry_id','parent_revision_ids','event_date','title','body','people','golf_good','golf_improve','golf_next','created_at','updated_at','source','device_id'];
 const idPattern=/^[A-Za-z0-9_-]{8,100}$/;
 function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
 function validate(record){
  if(!record||typeof record!=='object')throw Error('日記データの形式が違います');
  const r={};
  for(const k of keys){if(k==='parents')continue;if(typeof record[k]!=='string')throw Error('日記の項目が不足しています：'+k);r[k]=record[k];}
  if(!idPattern.test(r.revisionId)||!idPattern.test(r.entryId)||!idPattern.test(r.deviceId))throw Error('日記IDの形式が違います');
  if(!Array.isArray(record.parents)||record.parents.length>100||record.parents.some(p=>typeof p!=='string'||!idPattern.test(p)||p===r.revisionId))throw Error('編集履歴の形式が違います');
  r.parents=[...new Set(record.parents)].sort();
  if(!validDate(r.date))throw Error('出来事の日付を確認してください');
  for(const k of ['createdAt','updatedAt'])if(!/^\d{4}-\d{2}-\d{2}T/.test(r[k])||!Number.isFinite(Date.parse(r[k])))throw Error('入力・更新日時の形式が違います');
  if(Date.parse(r.updatedAt)<Date.parse(r.createdAt))throw Error('更新日時が入力日時より前です');
  for(const k of ['title','body','people','golfGood','golfImprove','golfNext'])if(r[k].length>(k==='title'?300:k==='people'?1000:20000))throw Error('日記の文字数が上限を超えています');
  if(r.source.length>60||![r.title,r.body,r.golfGood,r.golfImprove,r.golfNext].some(v=>v.trim()))throw Error('一言でも入力してください');
  return Object.fromEntries(keys.map(k=>[k,r[k]]));
 }
 function canonical(r){return JSON.stringify(validate(r));}
 function merge(...groups){
  const records=new Map();
  for(const group of groups){if(!Array.isArray(group))throw Error('日記一覧の形式が違います');for(const raw of group){const r=validate(raw),old=records.get(r.revisionId);if(old&&canonical(old)!==canonical(r))throw Error('同じ履歴IDに違う内容があります。元の記録を保持し、同期を停止しました');records.set(r.revisionId,r);}}
  // Validate lineage without relying on device clocks or last-write-wins.
  const remaining=new Map(),children=new Map(),queue=[];
  for(const r of records.values()){
   remaining.set(r.revisionId,r.parents.length);if(!r.parents.length)queue.push(r.revisionId);
   for(const id of r.parents){const p=records.get(id);if(!p||p.entryId!==r.entryId)throw Error('親の編集履歴が不足しています。バックアップ全体を復元してください');if(!children.has(id))children.set(id,[]);children.get(id).push(r.revisionId);}
  }
  for(let i=0;i<queue.length;i++)for(const id of children.get(queue[i])||[]){remaining.set(id,remaining.get(id)-1);if(remaining.get(id)===0)queue.push(id);}
  if(queue.length!==records.size)throw Error('編集履歴が循環しています');
  return [...records.values()];
 }
 function heads(records){const superseded=new Set(records.flatMap(r=>r.parents));return records.filter(r=>!superseded.has(r.revisionId));}
 function conflicts(records){const groups=new Map();for(const r of heads(records)){if(!groups.has(r.entryId))groups.set(r.entryId,[]);groups.get(r.entryId).push(r);}return [...groups.values()].filter(g=>g.length>1);}
 function toRow(raw){const r=validate(raw);return keys.map(k=>k==='parents'?JSON.stringify(r.parents):r[k]);}
 function fromRows(rows){
  if(!Array.isArray(rows)||headers.some((h,i)=>rows[0]?.[i]!==h))throw Error('日記台帳の列構成が違います。専用台帳を選んでください');
  return rows.slice(1).filter(row=>row.some(v=>v!==''&&v!=null)).map((row,i)=>{try{if(row.some(v=>v!=null&&typeof v!=='string'))throw Error('文字列以外の項目');const r=Object.fromEntries(keys.map((k,j)=>[k,k==='parents'?JSON.parse(row[j]||'[]'):row[j]||'']));return validate(r);}catch(e){throw Error('台帳'+(i+2)+'行目：'+e.message);}});
 }
 function create(fields,{base=null,parents=null,deviceId,now=new Date().toISOString(),source='hub',uuid=()=>crypto.randomUUID()}={}){
  return validate({revisionId:uuid(),entryId:base?.entryId||uuid(),parents:parents|| (base?[base.revisionId]:[]),date:fields.date,title:fields.title||'',body:fields.body||'',people:fields.people||'',golfGood:fields.golfGood||'',golfImprove:fields.golfImprove||'',golfNext:fields.golfNext||'',createdAt:base?.createdAt||now,updatedAt:Date.parse(now)<Date.parse(base?.createdAt||now)?base.createdAt:now,source,deviceId});
 }
 function search(records,{month='',query='',ascending=false}={}){const q=query.normalize('NFKC').toLocaleLowerCase();return heads(records).filter(r=>(!month||r.date.slice(0,7)===month)&&(!q||[r.title,r.body,r.people,r.golfGood,r.golfImprove,r.golfNext].join('\n').normalize('NFKC').toLocaleLowerCase().includes(q))).sort((a,b)=>(ascending?1:-1)*a.date.localeCompare(b.date)||b.updatedAt.localeCompare(a.updatedAt));}
 function backup(records,draft=null){return {format:'toshi-hub-diary',schemaVersion:1,exportedAt:new Date().toISOString(),revisions:merge(records),draft};}
 function restore(value){if(value?.format!=='toshi-hub-diary'||value.schemaVersion!==1||!Array.isArray(value.revisions))throw Error('HUB日記のバックアップではありません');return merge(value.revisions);}
 function related(items,date){return {events:items.filter(x=>x.type==='event'&&x.date<=date&&(x.endDate||x.date)>=date),completed:items.filter(x=>x.type==='todo'&&x.done&&x.completedDate===date),unknown:items.filter(x=>x.type==='todo'&&x.done&&!x.completedDate&&(x.end||x.start||x.date)===date)};}
 const api={keys,headers,validDate,validate,canonical,merge,heads,conflicts,toRow,fromRows,create,search,backup,restore,related};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ToshiDiaryCore=api;
})(typeof globalThis==='object'?globalThis:this);


} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: diary-store.js */
try {
(function(root){
 'use strict';
 class DiaryStore{
  constructor(name='toshi_diary_v1'){this.name=name;this.db=null;}
  async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const q=indexedDB.open(this.name,1);q.onupgradeneeded=()=>{q.result.createObjectStore('revisions',{keyPath:'revisionId'});q.result.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('日記の保存領域が他の画面で使用中です'));});this.db.onversionchange=()=>{this.db.close();this.db=null;};return this;}
  async state(){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readonly'),a=tx.objectStore('revisions').getAll(),b=tx.objectStore('meta').getAll();tx.oncomplete=()=>{try{resolve({revisions:ToshiDiaryCore.merge(a.result),meta:Object.fromEntries(b.result.map(x=>[x.key,x.value]))});}catch(e){reject(e);}};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('日記の読み取りを中断しました'));});}
  async commit(incoming=[],metadata={}){
   await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readwrite'),store=tx.objectStore('revisions'),q=store.getAll();let failure=null;
    q.onsuccess=()=>{try{const merged=ToshiDiaryCore.merge(q.result,incoming),existing=new Set(q.result.map(r=>r.revisionId));for(const r of merged)if(!existing.has(r.revisionId))store.add(r);for(const [key,value] of Object.entries(metadata))tx.objectStore('meta').put({key,value});}catch(e){failure=e;tx.abort();}};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||Error('日記を保存できませんでした'));
   });
  }
 }
 root.ToshiDiaryStore=DiaryStore;
})(globalThis);


} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: diary-safety.js */
try {
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

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-safety.js */
try {
(function(root){
'use strict';
const keys=storage=>{const result=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&key.startsWith('toshi_'))result.push(key);}return result.sort();};
function localSnapshot(storage){return keys(storage).map(key=>[key,storage.getItem(key)]);}
async function capture(){const local=localSnapshot(localStorage),diary=await DiarySafety.capture(indexedDB,location.origin);if(JSON.stringify(local)!==JSON.stringify(localSnapshot(localStorage)))throw Error('他の画面でHUBが更新されました。閉じてからやり直してください。');return {format:'toshi-hub-safety-backup',version:1,sourceOrigin:location.origin,createdAt:new Date().toISOString(),localStorage:local,diary};}
function same(a,b){return a?.format==='toshi-hub-safety-backup'&&b?.format===a.format&&a.version===1&&b.version===1&&a.sourceOrigin===b.sourceOrigin&&JSON.stringify(a.localStorage)===JSON.stringify(b.localStorage)&&DiarySafety.sameData(a.diary,b.diary);}
const hasData=s=>s.localStorage.some(([k,v])=>!['toshi_hub_safe_gate_v1','toshi_diary_clean_app_ready_v1'].includes(k)&&v!==null)||DiarySafety.hasData(s.diary);
root.HubSafety={capture,same,hasData,localSnapshot};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-google.js */
try {
(function(root){
'use strict';
const SCOPE='https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
let token='',expires=0,client=null,pending=null,tokenScopes='';
function covers(actual,required){const set=new Set(String(actual||'').split(/\s+/));return required.split(/\s+/).every(scope=>set.has(scope));}
function authorize(required=SCOPE){
 if(token&&Date.now()<expires&&covers(tokenScopes,required))return Promise.resolve();
 if(pending)return pending;
 if(!root.google?.accounts?.oauth2)return Promise.reject(Object.assign(Error('Google認証を読み込めません。通信を確認して再度お試しください。'),{code:'GOOGLE_AUTH_UNAVAILABLE'}));
 const request=new Promise((resolve,reject)=>{const fail=e=>reject(Object.assign(Error(e?.message||'Google接続を完了していません。端末のデータは保持しています。'),{code:e?.type==='popup_failed_to_open'?'GOOGLE_POPUP_BLOCKED':e?.type==='popup_closed'?'GOOGLE_POPUP_CLOSED':'GOOGLE_AUTH_FAILED'}));
  try{client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:required,callback:r=>{
   if(r.error){reject(Object.assign(Error('Google認証: '+r.error),{code:r.error==='access_denied'?'GOOGLE_ACCESS_DENIED':r.error==='invalid_scope'?'GOOGLE_INVALID_SCOPE':'GOOGLE_AUTH_FAILED'}));return;}
   if(typeof r.access_token!=='string'||!r.access_token){reject(Object.assign(Error('Google接続の応答を確認できません'),{code:'GOOGLE_AUTH_RESPONSE_INVALID'}));return;}
   token=r.access_token;expires=Date.now()+(Math.max(0,(Number(r.expires_in)||3600)-60))*1000;tokenScopes=typeof r.scope==='string'?r.scope:required===SCOPE?SCOPE:'';resolve();
  },error_callback:fail});client.requestAccessToken({prompt:required===SCOPE?'':'select_account'});}catch(e){fail(e);}
 });
 pending=request;request.then(()=>{if(pending===request)pending=null;},()=>{if(pending===request)pending=null;});return request;
}
async function connectForSync({calendar=true,diary=false,proof=false}={}){
 const diaryScope=root.HubDiarySync?.SCOPE;
 if(diary&&diaryScope!=='https://www.googleapis.com/auth/spreadsheets')throw Error('日記同期の接続設定を確認できません');
 const required=[calendar?SCOPE:'',diary?diaryScope:'',proof?'https://www.googleapis.com/auth/drive.file':''].filter(Boolean).join(' ');
 if(!required)throw Error('同期できる項目がありません');
 await authorize(required);return {access_token:token,expiresAt:expires,scope:tokenScopes};
}
async function api(path,options={}){if(!token)throw Error('Googleに接続してください');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const response=await fetch('https://www.googleapis.com/calendar/v3/'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});if(!response.ok){if(response.status===401){token='';expires=0;}const error=Error('Google HTTP '+response.status+(response.status===401?'。もう一度接続してください':''));error.status=response.status;throw error;}return response.status===204?{}:response.json();}finally{clearTimeout(timer);}}
async function calendars(){let page='',items=[];do{const value=await api('users/me/calendarList?maxResults=250'+(page?'&pageToken='+encodeURIComponent(page):''));items.push(...(value.items||[]));page=value.nextPageToken||'';}while(page);return items.filter(c=>c.primary||['TOSHI','CPG','TASK','Trip','GOLF','誕生日','Anniversary'].includes(c.summary));}
const base=x=>'calendars/'+encodeURIComponent(x.googleCalendarId)+'/events/'+encodeURIComponent(x.googleId);
async function read(from,to){
 await authorize();const targets=await calendars(),parts=targets.map(()=>[]);let next=0,failed=false;
 // Different calendars are independent reads. Keep pagination within each
 // calendar ordered, cap concurrent requests, and settle every worker before
 // a failure returns so no late read can overlap a retry or partial commit.
 const worker=async()=>{while(!failed&&next<targets.length){const index=next++,calendar=targets[index];try{let page='';do{const query=new URLSearchParams({timeZone:'Asia/Tokyo',singleEvents:'true',orderBy:'startTime',maxResults:'2500',timeMin:from+'T00:00:00+09:00',timeMax:to+'T00:00:00+09:00'});if(page)query.set('pageToken',page);const value=await api('calendars/'+encodeURIComponent(calendar.id)+'/events?'+query);parts[index].push(...(value.items||[]).filter(e=>e.start&&e.status!=='cancelled').map(e=>HubCore.fromGoogle(e,calendar)));page=value.nextPageToken||'';}while(page&&!failed);}catch(error){failed=true;throw error;}}};
 const results=await Promise.allSettled(Array.from({length:Math.min(3,targets.length)},worker));const rejected=results.find(x=>x.status==='rejected');if(rejected)throw rejected.reason;
 return {rows:parts.flat(),calendars:targets};
}
async function complete(item,done){await authorize();const latest=await api(base(item)),patch=HubCore.completionPatch(latest,done,new Date().toISOString());await api(base(item),{method:'PATCH',headers:{'Content-Type':'application/json',...latest.etag?{'If-Match':latest.etag}:{}},body:JSON.stringify(patch)});const result=await api(base(item));return HubCore.fromGoogle(result,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project});}
async function publish(item){await authorize();const available=await calendars(),calendar=available.find(c=>c.summary==='TASK'&&['writer','owner'].includes(c.accessRole));if(!calendar)throw Error('書き込みできるTASKカレンダーが見つかりません');const date=item.type==='todo'?item.deadlineDate:item.scheduledDate;if(!HubCore.day(date))throw Error('日付のないタスクはこの端末に保持します');const id='hub'+item.safeId.replace(/-/g,'').toLowerCase(),body={id,summary:(item.done?'✅':'')+(item.type==='todo'?'【ToDo】':'【タスク】')+item.title,start:{date},end:{date:HubCore.addDays(date,1)},extendedProperties:{private:{toshiHubType:item.type,toshiHubProject:item.project||'TASK',toshiHubDeadlineDate:item.type==='todo'?item.deadlineDate:'',toshiHubDone:String(!!item.done),toshiHubCompletedAt:item.completedAt||'',toshiHubCompletedDate:item.completedDate||'',toshiHubSafeId:item.safeId,toshiHubDiaryEntryId:item.diaryEntryId||'',toshiHubStart:item.start||item.scheduledDate||'',toshiHubEnd:item.type==='todo'?item.deadlineDate:'',toshiHubDeadlineTime:item.deadlineTime||''}}},path='calendars/'+encodeURIComponent(calendar.id)+'/events';try{await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(error){if(error.status!==409)throw error;const existing=await api(path+'/'+id);if(existing.extendedProperties?.private?.toshiHubSafeId!==item.safeId)throw Error('Googleの予定IDが重複しました。登録は中止しました。');}const confirmed=await api(path+'/'+id);if(confirmed.status==='cancelled')throw Error('同じ作業はGoogleで削除されています。端末の記録を保持しました。Google側を確認してください。');if(confirmed.summary!==body.summary||confirmed.start?.date!==body.start.date||confirmed.end?.date!==body.end.date||Object.entries(body.extendedProperties.private).some(([key,value])=>confirmed.extendedProperties?.private?.[key]!==value))throw Error('同じ作業がGoogleにありますが、端末の最新内容と一致しません。端末の記録を保持しました。Google側を確認してください。');return HubCore.fromGoogle(confirmed,calendar);}
async function connectForProof(){const scope='https://www.googleapis.com/auth/drive.file';await authorize(scope);return {access_token:token,expiresAt:expires,scope:tokenScopes};}
function currentProofGrant(){if(!token||Date.now()>=expires||!covers(tokenScopes,'https://www.googleapis.com/auth/drive.file'))throw Object.assign(Error('DRIVE_AUTH_REQUIRED'),{code:'DRIVE_AUTH_REQUIRED'});return {access_token:token,expiresAt:expires,scope:tokenScopes};}
root.HubGoogle={SCOPE,read,complete,publish,connectForSync,connectForProof,currentProofGrant};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: diary.js */
try {
(function(){
 'use strict';
 const C=ToshiDiaryCore,store=new ToshiDiaryStore(),el=id=>document.getElementById(id);
 const fields={date:'diaryDate',title:'diaryTitle',body:'diaryBody',people:'diaryPeople',golfGood:'diaryGolfGood',golfImprove:'diaryGolfImprove',golfNext:'diaryGolfNext'};
 let state={revisions:[],meta:{}},ready=false,editing=null,editParents=null,token='',expires=0,client=null,syncing=false,authorizing=false,saving=false,draftTimer=null,draftGeneration=0,writeQueue=Promise.resolve(),problem='';
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('toshi_diary_changed_v1'):null;
 const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const sheetId=value=>/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/.exec(value.trim())?.[1]||'';
 function text(tag,value,className=''){const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;}
 function button(label,handler,className=''){const b=text('button',label,className);b.type='button';b.onclick=()=>Promise.resolve(handler()).catch(showError);return b;}
 function readFields(){return Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,el(id).value]));}
 function dirty(){const v=readFields();return editing?Object.keys(fields).some(k=>v[k]!==editing[k]):Object.keys(fields).some(k=>k!=='date'&&v[k].trim());}
 function write(records=[],meta={}){const p=writeQueue.catch(()=>{}).then(()=>store.commit(records,meta));writeQueue=p;return p;}
 async function reload(){state=await store.state();renderList();renderRelated();renderState();}
 function showError(e){problem=e.message||String(e);el('diaryFormStatus').textContent='処理できませんでした：'+problem;renderState();}
 function renderState(){
  const configured=!!state.meta.sheet,known=new Set(state.meta['remote:'+state.meta.sheet]?.ids||[]),pending=state.revisions.filter(r=>!known.has(r.revisionId)).length;
  const remote=state.meta['remote:'+state.meta.sheet],conflictCount=C.conflicts(state.revisions).length;
  let msg=!ready?'端末の保存領域を確認中':!configured?'端末保存のみ｜台帳未設定・Google未接続':authorizing?'Google接続の確認待ち｜端末の記録は保持しています':syncing?'Google同期中｜端末の記録は保持しています':pending?'端末保存済み｜Google未同期の履歴 '+pending+'件':remote?'端末保存済み｜前回のGoogle照合済み':'端末保存のみ｜Google未同期';
  if(configured&&!syncing)msg+='｜'+(token&&Date.now()<expires?'Google接続中':'Google未接続');
  if(remote)msg+='\n前回同期：'+new Date(remote.at).toLocaleString('ja-JP')+'（その時点の確認）';
  if(conflictCount)msg+='\n同時編集 '+conflictCount+'件：両方を保持。内容を見て統合できます。';
  if(problem)msg+='\n'+problem;
  msg+='\nナミ：Googleへ同期した記録は台帳URLで共有可能。未同期の端末内記録はアクセス不可。';
  el('diaryState').textContent=msg;
  for(const id of ['diarySave','diarySync','diarySetSheet','diaryDisconnect','diaryBackup','diaryRestore','diaryNew'])el(id).disabled=!ready||saving||((syncing||authorizing)&&['diarySync','diarySetSheet','diaryDisconnect'].includes(id));
 }
 function setForm(record=null,parents=null){
  editing=record;editParents=parents;
  const values=record||{date:today()};for(const [k,id] of Object.entries(fields))el(id).value=values[k]||'';
  el('diaryEditorTitle').textContent=record?'ダイアリーを追記・編集':'今日のひとこと';
  el('diaryEditMeta').textContent=record?'入力 '+new Date(record.createdAt).toLocaleString('ja-JP')+'｜更新 '+new Date(record.updatedAt).toLocaleString('ja-JP')+'｜出来事の日付とは別に保持':'';
  el('diaryExtras').open=!!(record&&(record.people||record.golfGood||record.golfImprove||record.golfNext));
  el('diaryDraftStatus').textContent='';el('diaryFormStatus').textContent='';renderRelated();
 }
 async function startNew(){if(dirty()&&!confirm('書きかけの内容を閉じて、新しく書きますか？'))return;clearTimeout(draftTimer);draftGeneration++;setForm();await write([],{draft:null});}
 function queueDraft(){
  if(!ready||saving)return;const generation=++draftGeneration;clearTimeout(draftTimer);
  draftTimer=setTimeout(async()=>{const draft={fields:readFields(),baseRevisionId:editing?.revisionId||null,parents:editParents,at:new Date().toISOString()};try{await write([],{draft});if(generation===draftGeneration)el('diaryDraftStatus').textContent='書きかけをこの端末に保存済み（ダイアリー未登録・未共有）';}catch(e){el('diaryDraftStatus').textContent='書きかけを保存できません。入力欄は残しています：'+e.message;}},500);
 }
 async function saveDiary(e){
  e.preventDefault();if(!ready||saving)return;if(editing&&!dirty()&&!editParents){el('diaryFormStatus').textContent='変更はありません。保存済みのダイアリーを保持しています。';return;}
  let record;try{record=C.create(readFields(),{base:editing,parents:editParents,deviceId:state.meta.deviceId});}catch(error){showError(error);return;}
  saving=true;clearTimeout(draftTimer);draftGeneration++;el('diaryFormStatus').textContent='端末へ保存中…';renderState();
  for(const id of Object.values(fields))el(id).disabled=true;
  try{await write([record],{draft:null});await reload();setForm(record);el('diaryFormStatus').textContent='この端末に保存しました。Google共有は同期後に完了します。';problem='';channel?.postMessage('changed');}
  catch(error){showError(error);}finally{saving=false;for(const id of Object.values(fields))el(id).disabled=false;renderState();}
 }
 async function edit(record,resolve=false){
  if(dirty()&&!confirm('書きかけを閉じて、このダイアリーを編集しますか？'))return;
  clearTimeout(draftTimer);draftGeneration++;
  const alternatives=C.heads(state.revisions).filter(r=>r.entryId===record.entryId);
  setForm(record,resolve?alternatives.map(r=>r.revisionId):null);
  if(resolve){el('diaryBody').value=alternatives.map(r=>'【同時編集の内容】\n'+shareText(r)).join('\n\n');el('diaryFormStatus').textContent='両方の内容を確認・整理して保存してください。元の文章は編集履歴に残ります。';}
  queueDraft();el('diaryEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function shareText(r){return [r.date+' '+(r.title||'ダイアリー'),r.body,r.people&&'一緒にいた人：'+r.people,r.golfGood&&'よかった点：'+r.golfGood,r.golfImprove&&'反省点：'+r.golfImprove,r.golfNext&&'次回試すこと：'+r.golfNext].filter(Boolean).join('\n');}
 async function copyToNami(record,container){
  const value=shareText(record);try{await navigator.clipboard.writeText(value);container.append(text('p','コピーしました。ナミの会話に貼ってください。自動送信はしていません。','muted'));}catch{const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.rows=5;container.append(text('p','コピーできませんでした。下の文章を選択して会話に貼ってください。','muted'),area);area.select();}
 }
 function renderList(){
  const rows=el('diaryRows');rows.replaceChildren();
  const list=C.search(state.revisions,{month:el('diaryMonth').value,query:el('diarySearch').value,ascending:el('diaryOrder').value==='asc'}),heads=C.heads(state.revisions),counts=new Map();heads.forEach(r=>counts.set(r.entryId,(counts.get(r.entryId)||0)+1));
  if(globalThis.CustomEvent)queueMicrotask(()=>document.dispatchEvent(new CustomEvent('hub-diary-records',{detail:{records:state.revisions}})));
  el('diaryCount').textContent=list.length+'件表示｜全体 '+new Set(heads.map(r=>r.entryId)).size+'件｜過去の編集履歴も保持';
  if(!list.length)rows.append(text('p','該当するダイアリーはありません。','muted'));
  let previousMonth='';
  for(const r of list){
   if(r.date.slice(0,7)!==previousMonth){previousMonth=r.date.slice(0,7);rows.append(text('h3',previousMonth.replace('-','年')+'月'));}
   const item=document.createElement('article'),conflict=counts.get(r.entryId)>1;item.className='diary-entry'+(conflict?' diary-conflict':'');item.dataset.diaryEntry=r.entryId;
   item.append(text('div',r.date+'｜'+(r.source==='nami'?'ナミから追加':'ダイアリー'),'muted'),text('h3',r.title||'ひとこと'),text('div',r.body,'diary-text'));
   for(const [label,k] of [['一緒にいた人','people'],['よかった点','golfGood'],['反省点','golfImprove'],['次回試すこと','golfNext']])if(r[k])item.append(text('p',label+'\n'+r[k],'diary-text'));
   const ack=new Set(state.meta['remote:'+state.meta.sheet]?.ids||[]);item.append(text('div','入力 '+new Date(r.createdAt).toLocaleString('ja-JP')+'｜更新 '+new Date(r.updatedAt).toLocaleString('ja-JP')+'｜'+(ack.has(r.revisionId)?'前回Google照合済み':'端末のみ・未同期'),'muted'));
   if(conflict)item.append(text('p','同時編集あり。どちらの文章も残っています。','diary-warning'));
   const actions=document.createElement('div');actions.className='diary-buttons';actions.append(button('追記・編集',()=>edit(r),'primary'),button('ナミへコピー',()=>copyToNami(r,item)));
   if(conflict)actions.append(button('両方を見て統合',()=>edit(r,true)));
   item.append(actions);
   const versions=state.revisions.filter(x=>x.entryId===r.entryId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
   const history=document.createElement('details');history.className='diary-history';history.append(text('summary','編集履歴 '+versions.length+'件（原文を保持）'));
   for(const version of versions){const d=document.createElement('div');d.append(text('p',new Date(version.updatedAt).toLocaleString('ja-JP')+'｜'+version.source,'muted'),text('div',shareText(version),'diary-text'));history.append(d);}
   item.append(history);rows.append(item);
  }
 }
 function renderRelated(){}
 async function setSheet(){
  if(syncing)return;const id=sheetId(el('diarySheetUrl').value);if(!id){showError(Error('Googleダイアリー台帳のURLを入力してください'));return;}
  if(state.meta.sheet&&state.meta.sheet!==id&&!confirm('同期先を変更しますか？\nhttps://docs.google.com/spreadsheets/d/'+id+'/edit\n端末のダイアリーは残り、次回同期時に新しい台帳へも追加されます。'))return;
  await write([],{sheet:id});token='';expires=0;problem='';await reload();
 }
 async function api(path,options={}){
  if(!token||Date.now()>=expires){token='';throw Error('Google未接続です。もう一度「Googleでダイアリーを同期」を押してください');}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  let response;try{response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers},cache:'no-store'});}catch(error){throw Error(error.name==='AbortError'?'通信が時間切れになりました。記録は保持しています。次回同期で送信済みか確認します':'通信できません。端末の記録は保持しています');}finally{clearTimeout(timer);}
  const body=await response.json().catch(()=>({}));if(!response.ok){if(response.status===401){token='';expires=0;}throw Error('Google HTTP '+response.status+'：'+(body.error?.message||'台帳の権限・Sheets APIの有効化を確認してください'));}return body;
 }
 async function readRemote(id){
  const metadata=await api(encodeURIComponent(id)+'?fields=sheets.properties'),properties=metadata.sheets?.find(s=>s.properties.title==='日記履歴')?.properties;
  if(!properties)throw Error('「日記履歴」タブがありません。専用台帳を選んでください');
  if(properties.gridProperties.rowCount>100000)throw Error('ダイアリー台帳が大きいため同期を停止しました。端末記録は保持しています');
  const values=[];for(let row=1;row<=properties.gridProperties.rowCount;row+=500){const range="'日記履歴'!A"+row+':N'+Math.min(row+499,properties.gridProperties.rowCount),j=await api(encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE');values.push(...(j.values||[]));}
  return C.fromRows(values);
 }
 async function synchronize(){
  if(syncing||!ready)return {ok:false,message:'ダイアリーは準備中または同期中です'};const id=state.meta.sheet;if(!id){showError(Error('先に自分のダイアリー台帳を設定してください'));return {ok:false,message:'ダイアリー台帳が未設定です'};}
  const evidence={fetch:'not_attempted',save:'not_attempted',readback:'not_attempted',sheetId:id,revisionIds:[]};syncing=true;problem='';renderState();
  try{
   const remote=await readRemote(id);evidence.fetch='success';await write(remote);await reload();
   const remoteMap=new Map(remote.map(r=>[r.revisionId,r])),pending=state.revisions.filter(r=>!remoteMap.has(r.revisionId));
   for(let offset=0;offset<pending.length;offset+=20){const batch=pending.slice(offset,offset+20);await api(encodeURIComponent(id)+'/values/'+encodeURIComponent("'日記履歴'!A:N")+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({majorDimension:'ROWS',values:batch.map(C.toRow)})});}
   const verified=await readRemote(id),verifiedMap=new Map(verified.map(r=>[r.revisionId,r]));
   for(const r of pending)if(!verifiedMap.has(r.revisionId)||C.canonical(r)!==C.canonical(verifiedMap.get(r.revisionId)))throw Error('Googleへの保存を確認できません。端末の記録は保持し、未同期のままにします');
   await write(verified,{['remote:'+id]:{at:new Date().toISOString(),ids:[...verifiedMap.keys()]}});evidence.save='success';await reload();const disk=new Map(state.revisions.map(r=>[r.revisionId,r]));for(const r of verified)if(!disk.has(r.revisionId)||C.canonical(disk.get(r.revisionId))!==C.canonical(r))throw Error('端末のダイアリーの読み戻しが一致しません');evidence.readback='success';evidence.verifiedAt=new Date().toISOString();evidence.revisionIds=verified.map(r=>r.revisionId);channel?.postMessage('changed');return {ok:true,message:'ダイアリーの同期・読み取り照合が完了しました',evidence};
  }catch(error){if(evidence.fetch!=='success')evidence.fetch='failed';else if(evidence.save!=='success')evidence.save='failed';else evidence.readback='failed';problem='同期失敗・未確認：'+error.message;try{await reload();}catch{} return {ok:false,message:problem,evidence};}
  finally{syncing=false;renderState();}
 }
 function connect(){
  if(!ready||syncing||authorizing)return;if(!state.meta.sheet){showError(Error('先に自分のダイアリー台帳を設定してください'));return;}
  if(token&&Date.now()<expires){synchronize();return;}
  if(!window.google?.accounts?.oauth2){showError(Error('Google接続を読み込めません。通信を確認してHUBを開き直してください'));return;}
  authorizing=true;problem='';renderState();
  try{client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/spreadsheets',callback:response=>{authorizing=false;if(response.error){showError(Error('Google接続失敗：'+response.error));return;}token=response.access_token;expires=Date.now()+Math.max(0,(Number(response.expires_in)||3600)-60)*1000;synchronize();},error_callback:()=>{authorizing=false;showError(Error('Google接続を完了していません。ダイアリーは端末に保持しています'));}});
  client.requestAccessToken({prompt:'select_account'});}catch(error){authorizing=false;showError(error);}
 }
 async function backup(){
  const current=await store.state(),blob=new Blob([JSON.stringify(C.backup(current.revisions,current.meta.draft||null),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='toshi-diary-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);el('diaryBackupStatus').textContent='バックアップのダウンロードを開始しました。端末にファイルが保存されたことを確認してください。';
 }
 async function restore(file){
  if(!file)return;try{if(file.size>64*1024*1024)throw Error('64MB以下のバックアップを選んでください');const value=JSON.parse(await file.text()),safety=value?.format==='toshi-diary-safety-backup';if(safety&&(value.version!==1||value.database!==DiarySafety.DATABASE||!Array.isArray(value.stores)))throw Error('安全バックアップの形式が違います');const records=safety?C.merge(DiarySafety.rows(value,'revisions')):C.restore(value);if(!confirm('ダイアリーの編集履歴 '+records.length+'件を今ある記録と照合して復元します。既存のダイアリーは削除しません。続けますか？'))return;await write(records);await reload();channel?.postMessage('changed');el('diaryBackupStatus').textContent='復元しました。Googleへの反映はダイアリーを同期してください。';if(safety)el('diaryBackupStatus').textContent+=' 台帳設定・書きかけは元ファイルに保持しています（現在の設定・入力は上書きしません）。';if(value.draft?.fields)el('diaryBackupStatus').textContent+=' バックアップの書きかけは元ファイルに保持しています（現在の入力は上書きしません）。';}catch(error){el('diaryBackupStatus').textContent='復元できませんでした。既存の記録は保持しています：'+error.message;}finally{el('diaryRestore').value='';}
 }
 async function init(){
  try{await store.open();state=await store.state();if(!state.meta.deviceId){await write([],{deviceId:crypto.randomUUID()});state=await store.state();}
   const params=new URLSearchParams(location.hash.slice(1)),id=params.get('diarySheet');
   if(id&&/^[A-Za-z0-9_-]{20,}$/.test(id)){if(confirm('このリンクのダイアリー台帳へ同期先を設定しますか？\nhttps://docs.google.com/spreadsheets/d/'+id+'/edit\n次に同期すると、この端末のダイアリーと全編集履歴をこの台帳へ追加します。'))await write([],{sheet:id});params.delete('diarySheet');history.replaceState(null,'',location.pathname+location.search+(params.size?'#'+params.toString():''));}
   ready=true;await reload();el('diarySheetUrl').value=state.meta.sheet?'https://docs.google.com/spreadsheets/d/'+state.meta.sheet+'/edit':'';setForm();
   const draft=state.meta.draft;if(draft?.fields){const base=state.revisions.find(r=>r.revisionId===draft.baseRevisionId)||null;setForm(base,draft.parents||null);for(const [k,field] of Object.entries(fields))if(typeof draft.fields[k]==='string')el(field).value=draft.fields[k];el('diaryDraftStatus').textContent='この端末の書きかけを復元しました（ダイアリー未登録・未共有）';renderRelated();}
   renderState();
  }catch(error){ready=false;problem='ダイアリーの保存領域を開けません：'+error.message+'。保存済みデータは削除していません。';renderState();}
 }
 globalThis.HubDiarySync={SCOPE:'https://www.googleapis.com/auth/spreadsheets',state:()=>({ready,configured:!!state.meta.sheet,busy:syncing||authorizing||saving}),syncWithGrant:async grant=>{
  if(!ready||syncing||authorizing||saving)return {ok:false,message:'ダイアリーは準備中または処理中です'};
  if(!state.meta.sheet)return {ok:false,message:'ダイアリー台帳が未設定です。ダイアリー画面で設定してください'};
  if(!grant||typeof grant.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes('https://www.googleapis.com/auth/spreadsheets'))return {ok:false,message:'ダイアリーのGoogle接続を確認できません。端末の記録は保持しています'};
  token=grant.access_token;expires=grant.expiresAt;return synchronize();
 }};
 el('diaryForm').onsubmit=saveDiary;el('diaryNew').onclick=()=>startNew().catch(showError);
 for(const id of Object.values(fields))el(id).addEventListener('input',()=>{queueDraft();if(id==='diaryDate')renderRelated();});
 ['diaryMonth','diaryOrder'].forEach(id=>el(id).onchange=renderList);el('diarySearch').oninput=renderList;
 el('diaryAllMonths').onclick=()=>{el('diaryMonth').value='';renderList();};
 el('diarySetSheet').onclick=()=>setSheet().catch(showError);el('diarySync').onclick=connect;
 el('diaryOpenSheet').onclick=()=>{if(state.meta.sheet)window.open('https://docs.google.com/spreadsheets/d/'+state.meta.sheet+'/edit','_blank','noopener,noreferrer');else showError(Error('先に台帳URLを設定してください'));};
 el('diaryDisconnect').onclick=()=>{if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';expires=0;problem='';renderState();};
 el('diaryBackup').onclick=()=>backup().catch(showError);el('diaryRestore').onchange=e=>restore(e.target.files[0]);
 channel&&(channel.onmessage=()=>{if(ready)reload().catch(showError);});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)reload().catch(showError);});
 document.addEventListener('click',e=>{if(e.target.closest('[data-go="diary"]')&&ready)reload().catch(showError);});
 document.addEventListener('diary-activate',()=>{init();},{once:true});
})();


} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-gantt.js */
try {
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hub-core.js'):root.HubCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubGantt=api;})(typeof globalThis==='object'?globalThis:this,function(C){
'use strict';
// Read-only projection. Dates are displayed, never normalized back into saved records.
function model(items,today,project='all'){
 if(!C.day(today))throw Error('表示開始日を確認してください');
 const days=Array.from({length:14},(_,i)=>C.addDays(today,i)),last=days[13];let undated=0,invalid=0;const matches=[];
 for(const item of items){
  if(item.done||item.cancelled||item.linkedGoogleKey||!['event','todo'].includes(item.type)||(project!=='all'&&item.project!==project))continue;
  let start='',end='',description='',warning='',deadline='',scheduled='',separate=false;
  if(item.type==='event'){
   start=item.date||'';end=item.endDate||start;
   if(!start){undated++;continue;}if(!C.day(start)||!C.day(end)||end<start){invalid++;continue;}
   description=(start===end?start:start+' 〜 '+end)+(item.allDay?'｜終日':item.time?'｜'+item.time:'');
  }else{
   const rawScheduled=item.scheduledDate||item.start||'',rawDeadline=C.deadline(item);
   if((rawScheduled&&!C.day(rawScheduled))||(rawDeadline&&!C.day(rawDeadline))){invalid++;continue;}
   scheduled=rawScheduled;deadline=rawDeadline;
   if(!scheduled&&!deadline){undated++;continue;}
   start=scheduled||deadline;end=deadline||scheduled;
   description=(scheduled?'実施 '+scheduled+'｜':'')+(deadline?'期限 '+deadline:'期限 未設定');
   if(start>end){separate=true;warning='実施予定日が期限より後です';[start,end]=[end,start];}
  }
  const cells=days.map(date=>({date,active:separate?(date===scheduled||date===deadline):(date>=start&&date<=end),deadline:!!deadline&&date===deadline}));
  if(!cells.some(c=>c.active))continue;
  if(item.googleUnverified)warning+=(warning?'。':'')+'今回のGoogle取得で未確認';
  matches.push({item,start,end,description,warning,cells});
 }
 matches.sort((a,b)=>a.start.localeCompare(b.start));
 return {from:today,to:last,days,rows:matches.slice(0,20),total:matches.length,hidden:Math.max(0,matches.length-20),undated,invalid};
}
return {model};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-home.js */
try {
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hub-core.js'));
  else root.HubHome = factory(root.HubCore);
})(typeof globalThis === 'object' ? globalThis : this, function (C) {
  'use strict';

  // This module only projects supplied records. It never reads the clock or app state.
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isDay = value => typeof value === 'string' && C.day(value);
  const isTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function amountValue(value) {
    // Blank, missing, boolean, formatted or otherwise ambiguous values need review.
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
  }

  function coversDay(item, date) {
    if (!['event', 'todo', 'task'].includes(item.type)) return false;
    // HubCore.deadline respects an explicit ToDo deadline or a legacy local end.
    // A scheduled date is never converted into a deadline, including for Google.
    const deadline = C.deadline(item);
    const start = item.type === 'event' ? item.date : item.scheduledDate || item.start || deadline;
    const end = item.type === 'event' ? item.endDate || start : deadline || start;
    return isDay(start) && isDay(end) && start <= end && C.span(item, date);
  }

  function timelineTime(item) {
    if (item.allDay) return '00:00';
    if (isTime(item.time)) return item.time;
    return isTime(item.deadlineTime) ? item.deadlineTime : '23:59';
  }

  function cashOrder(a, b) {
    return compare(a.date, b.date) || compare(isTime(a.time) ? a.time : '', isTime(b.time) ? b.time : '');
  }

  function cashSection(rows) {
    let income = 0, payment = 0, invalidIncome = false, invalidPayment = false;
    let invalidAmountCount = 0, invalidKindCount = 0;
    for (const row of rows) {
      if (row.amountValue === null) invalidAmountCount += 1;
      if (row.kind === 'income') {
        if (row.amountValue === null) invalidIncome = true;
        else income += row.amountValue;
      } else if (row.kind === 'payment') {
        if (row.amountValue === null) invalidPayment = true;
        else payment += row.amountValue;
      } else invalidKindCount += 1;
    }
    const sumOverflow = !Number.isFinite(income) || !Number.isFinite(payment) || !Number.isFinite(income - payment);
    income = invalidIncome || invalidKindCount || !Number.isFinite(income) ? null : income;
    payment = invalidPayment || invalidKindCount || !Number.isFinite(payment) ? null : payment;
    const net = income === null || payment === null || !Number.isFinite(income - payment) ? null : income - payment;
    return {
      rows, income, payment, net, invalidAmountCount, invalidKindCount, sumOverflow,
      needsConfirmation: invalidAmountCount > 0 || invalidKindCount > 0 || sumOverflow
    };
  }

  /**
   * Read-only home projection of the existing merged item and money arrays.
   * Dates use the caller's explicit local day; the ten-day window includes today.
   * Cash totals are null when their contributing data is untrustworthy. A real
   * zero remains 0. Original row fields are preserved; cash rows add amountValue.
   */
  function project(items, money, today) {
    if (!C || typeof C.span !== 'function' || typeof C.deadline !== 'function') throw Error('HubCore is required');
    if (!Array.isArray(items) || !Array.isArray(money)) throw TypeError('Home projection requires item and money arrays');
    if (!isDay(today)) throw RangeError('Home projection requires an explicit valid YYYY-MM-DD today');
    const endDate = C.addDays(today, 9);
    if (!isDay(endDate)) throw RangeError('Home projection date range is not supported');
    const month = today.slice(0, 7);
    const visibleItems = items.filter(item => isRecord(item) && !item.cancelled && !item.linkedGoogleKey);
    const todayRows = visibleItems.filter(item => coversDay(item, today))
      .map(item => ({ ...item }))
      .sort((a, b) => compare(timelineTime(a), timelineTime(b)));
    const outstanding = money.filter(row => isRecord(row) && !row.done && !row.cancelled)
      .map(row => ({ ...row, amountValue: amountValue(row.amount) }));
    const dated = outstanding.filter(row => isDay(row.date)).sort(cashOrder);
    const nextDate = dated.find(row => row.date > endDate)?.date || '';
    return {
      today, month, todayRows, todayCount: todayRows.length,
      incompleteWorkCount: visibleItems.filter(item => ['todo', 'task'].includes(item.type) && !item.done).length,
      monthCash: cashSection(dated.filter(row => row.date.slice(0, 7) === month)),
      cashAhead: { ...cashSection(dated.filter(row => row.date >= today && row.date <= endDate)), startDate: today, endDate },
      nextCash: { ...cashSection(nextDate ? dated.filter(row => row.date === nextDate) : []), date: nextDate },
      invalidAmountCount: outstanding.filter(row => row.amountValue === null).length,
      invalidDateCount: outstanding.filter(row => !isDay(row.date)).length,
      invalidKindCount: outstanding.filter(row => !['income', 'payment'].includes(row.kind)).length
    };
  }

  return { project };
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-persistence.js */
try {
/* Overflow snapshots are append-only. A small pointer is published only after a verified write. */
(function(root){
 'use strict';
 const NAME='toshi_hub_overlay_v1',FORMAT='toshi-hub-overlay-pointer';
 const hash=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 function pointer(raw){if(!raw)return null;let v;try{v=JSON.parse(raw);}catch{return null;}if(v?.format!==FORMAT)return null;if(v.version!==1||typeof v.id!=='string'||!v.id||!/^([a-f0-9]{64})$/.test(v.hash))throw Error('予定の保存先を確認できません。元データは保持しています');return v;}
 async function open(write=false){if(!write&&typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(x=>x.name===NAME))return null;return new Promise((resolve,reject)=>{const q=indexedDB.open(NAME,1);let absent=false;q.onupgradeneeded=()=>{if(write)q.result.createObjectStore('snapshots',{keyPath:'id'});else{absent=true;q.transaction.abort();}};q.onsuccess=()=>resolve(q.result);q.onerror=()=>absent?resolve(null):reject(q.error);q.onblocked=()=>reject(Error('別のHUB画面が保存領域を使用しています。閉じて再試行してください'));});}
 async function capture(){const db=await open();if(!db)return {format:'toshi-hub-overlay-archive',version:1,exists:false,records:[]};try{if([...db.objectStoreNames].join(',')!=='snapshots')throw Error('追加保存領域の構造を確認できません');const records=await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').getAll();tx.oncomplete=()=>resolve(q.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('予定のバックアップに失敗しました'));});return {format:'toshi-hub-overlay-archive',version:1,exists:true,records};}finally{db.close();}}
 async function load(raw){const p=pointer(raw);if(!p)return raw;const db=await open();if(!db)throw Error('大容量の予定保存領域が見つかりません。元データを保持して停止しました');try{const row=await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get(p.id);tx.oncomplete=()=>resolve(q.result);tx.onerror=tx.onabort=()=>reject(tx.error);});if(!row||typeof row.raw!=='string'||row.hash!==p.hash||await hash(row.raw)!==p.hash)throw Error('予定の保存内容を照合できません。元データは保持しています');return row.raw;}finally{db.close();}}
 async function save(raw,expected,storage,key,verify=()=>{}){const id=crypto.randomUUID(),sum=await hash(raw),at=new Date().toISOString(),previous=!pointer(expected)&&expected?{id:crypto.randomUUID(),raw:expected,hash:await hash(expected),at,kind:'previous-local-overlay'}:null;verify();if(storage.getItem(key)!==expected)throw Error('別の画面で記録が変わりました。保存を停止しました');const db=await open(true);try{await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots');if(previous)s.add(previous);s.add({id,raw,hash:sum,at,kind:'overlay'});tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('大容量の予定を保存できません。以前の記録は保持しています'));});}finally{db.close();}const next=JSON.stringify({format:FORMAT,version:1,id,hash:sum});if(await load(next)!==raw)throw Error('予定の保存を照合できません');verify();if(storage.getItem(key)!==expected)throw Error('保存中に別の画面で記録が変わりました。以前の表示を保持しています');storage.setItem(key,next);return next;}
 function guardAction(container,handler){let pending=false;return async function(e){if(pending){e?.preventDefault();return;}pending=true;container.dataset.saving='true';const controls=[...container.querySelectorAll('input,textarea,select,button')],before=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);try{return await handler.call(this,e);}finally{pending=false;delete container.dataset.saving;controls.forEach((x,i)=>x.disabled=x.hasAttribute('data-write')?!root.HubApp?.canWrite():before[i]);}};}
 function guardForm(form){form.onsubmit=guardAction(form,form.onsubmit);const dialog=form.closest('dialog');if(dialog)dialog.addEventListener('cancel',e=>{if(form.dataset.saving==='true'){e.preventDefault();e.stopImmediatePropagation();}},true);}
 const original=HubSafety;
 root.HubSafety={...original,capture:async()=>{const first=await original.capture(),overlaySnapshots=await capture(),again=await original.capture(),last=await capture();if(!original.same(first,again)||JSON.stringify(overlaySnapshots)!==JSON.stringify(last))throw Error('バックアップ中に予定が変わりました。再度保存してください');for(const [key,raw]of first.localStorage)if(key==='toshi_hub_safe_v1'&&pointer(raw))await load(raw);return {...first,overlaySnapshots};},same:(a,b)=>original.same(a,b)&&JSON.stringify(a.overlaySnapshots)===JSON.stringify(b.overlaySnapshots),hasData:s=>original.hasData(s)||!!s.overlaySnapshots?.records?.length};
 root.HubPersistence={NAME,pointer,load,save,capture,guardForm,guardAction};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-assets.js */
try {
/* Existing databases are discovered and read; only the new archive is writable. */
(function(root){
 'use strict';
 const NAME='toshi_assets_safe_v1',names=['toshi_board','toshi_receipts',NAME];
 async function existing(name){if(typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(x=>x.name===name))return null;return new Promise((resolve,reject)=>{const q=indexedDB.open(name);let absent=false;q.onupgradeneeded=()=>{absent=true;q.transaction.abort();};q.onerror=()=>absent?resolve(null):reject(q.error);q.onblocked=()=>reject(Error('他の画面で資料・領収書を使用中です。画面を閉じてください'));q.onsuccess=()=>resolve(q.result);});}
 async function captureOne(name){const db=await existing(name);if(!db)return {name,exists:false};try{const stores=[...db.objectStoreNames];if(!stores.length)return {name,exists:true,version:db.version,stores:[]};const raw=await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readonly'),jobs=stores.map(name=>{const s=tx.objectStore(name);return {name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:[...s.indexNames].map(n=>{const i=s.index(n);return {name:n,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};}),records:s.getAll(),keys:s.getAllKeys()};});tx.oncomplete=()=>resolve(jobs.map(j=>({...j,records:j.records.result,keys:j.keys.result})));tx.onerror=tx.onabort=()=>reject(tx.error||Error('画像の保全を中断しました'));});return {name,exists:true,version:db.version,stores:await Promise.all(raw.map(async s=>({...s,records:await DiarySafety.packValue(s.records),keys:await DiarySafety.packValue(s.keys)})))};}finally{db.close();}}
 async function capture(){return {format:'toshi-assets-archive',version:1,databases:await Promise.all(names.map(captureOne))};}
 function validate(snapshot){if(snapshot?.format!=='toshi-assets-archive'||snapshot.version!==1||!Array.isArray(snapshot.databases)||snapshot.databases.length>10)throw Error('画像・資料バックアップの形式が違います');const seen=new Set();for(const db of snapshot.databases){if(!names.includes(db.name)||seen.has(db.name)||typeof db.exists!=='boolean')throw Error('保存領域を確認できません');seen.add(db.name);if(db.exists){if(!Array.isArray(db.stores))throw Error('保存構造を確認できません');const stores=new Set();for(const s of db.stores){if(typeof s.name!=='string'||stores.has(s.name))throw Error('保存領域が重複しています');stores.add(s.name);const keys=DiarySafety.unpackValue(s.keys),rows=DiarySafety.unpackValue(s.records);if(!Array.isArray(rows)||!Array.isArray(keys)||rows.length!==keys.length)throw Error('画像と保存キーが一致しません');}}}if(names.some(n=>!seen.has(n)))throw Error('画像・資料の保存領域が不足しています');return snapshot;}
 async function digest(value){const data=await DiarySafety.packValue(value),bytes=new TextEncoder().encode(JSON.stringify(data)),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function entries(kind){const old=await captureOne(kind==='board'?'toshi_board':'toshi_receipts'),out=[];if(old.exists){const s=old.stores.find(x=>x.name==='entries');if(s){const rows=DiarySafety.unpackValue(s.records),keys=DiarySafety.unpackValue(s.keys);for(let i=0;i<rows.length;i++){const hash=await digest(rows[i]);out.push({id:'legacy-'+old.name+'-'+await digest([keys[i],hash]),kind,payload:rows[i],origin:{database:old.name,key:keys[i],hash},legacy:true});}}}const own=await captureOne(NAME);let hidden=new Set();if(own.exists){const s=own.stores.find(x=>x.name==='records');if(s)for(const row of DiarySafety.unpackValue(s.records).sort((a,b)=>(a.order||0)-(b.order||0))){if(row.action==='hide')hidden.add(row.target);else if(row.action==='show')hidden.delete(row.target);else if(row.kind===kind&&row.payload&&!out.some(x=>x.id===row.id||row.origin&&x.origin&&JSON.stringify(x.origin)===JSON.stringify(row.origin)))out.push(row);}}return {visible:out.filter(r=>!hidden.has(r.id)),all:out,hidden};}
 async function writable(){return new Promise((resolve,reject)=>{const q=indexedDB.open(NAME,1);q.onupgradeneeded=()=>q.result.createObjectStore('records',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('資料の保存領域が使用中です'));});}
 async function append(records){HubApp.checkWrite();if(!HubApp.assetReady())throw Error('画像を含む安全バックアップの確認が必要です');const key=r=>({kind:r.kind,payload:r.payload,action:r.action,target:r.target,origin:r.origin}),incoming=[];for(const r of records){if(!r||typeof r.id!=='string'||!['board','receipt'].includes(r.kind)||(!r.payload&&!['hide','show'].includes(r.action)))throw Error('追加する画像記録の形式が違います');incoming.push({...r,fingerprint:await digest(key(r))});}const before=await captureOne(NAME);if(before.exists){const rows=before.stores.find(x=>x.name==='records');if(rows)for(const r of DiarySafety.unpackValue(rows.records))if(!r.fingerprint||r.fingerprint!==await digest(key(r)))throw Error('保存済みの画像履歴の一致を確認できません。元データは保持しています');}const db=await writable();try{HubApp.checkWrite();await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),s=tx.objectStore('records'),q=s.getAll();let failure;q.onsuccess=()=>{try{const current=new Map(q.result.map(r=>[r.id,r]));let order=q.result.reduce((n,r)=>Math.max(n,r.order||0),0);for(const r of incoming){const old=current.get(r.id);if(old){if(old.fingerprint!==r.fingerprint)throw Error('同じ画像IDに異なる内容があります。復元を停止しました');}else{s.add({...r,order:++order});current.set(r.id,r);}}}catch(e){failure=e;tx.abort();}};tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error||Error('画像を保存できません。入力を保持しています'));});}finally{db.close();}window.dispatchEvent(new Event('hub-assets-changed'));}

 async function add(kind,payload){const row={id:'asset-'+crypto.randomUUID(),kind,payload,createdAt:new Date().toISOString()};await append([row]);return row;}
 async function visibility(row,hide){if(!confirm(hide?'一覧からどけますか？元の画像・記録は履歴と保存領域に残します。':'この記録を一覧へ戻しますか？'))return;await append([{id:'visibility-'+crypto.randomUUID(),kind:row.kind,action:hide?'hide':'show',target:row.id,createdAt:new Date().toISOString()}]);}
 async function restore(snapshot){validate(snapshot);for(const db of snapshot.databases){if(db.exists&&db.stores.some(s=>s.name!==(db.name===NAME?'records':'entries')&&DiarySafety.unpackValue(s.records).length))throw Error('未対応の追加保存領域があります。画像復元は実行していません。完全バックアップを保持してください');}const records=[];for(const db of snapshot.databases){if(!db.exists)continue;for(const s of db.stores){const rows=DiarySafety.unpackValue(s.records),keys=DiarySafety.unpackValue(s.keys);if(db.name===NAME&&s.name==='records'){for(const r of rows.sort((a,b)=>(a.order||0)-(b.order||0))){if(!r||typeof r.id!=='string'||!['board','receipt'].includes(r.kind))throw Error('復元する画像記録の形式が違います');records.push(r);}continue;}if(s.name!=='entries')continue;const kind=db.name==='toshi_board'?'board':'receipt',current=await entries(kind),present=new Set(current.all.map(r=>r.origin&&JSON.stringify(r.origin)));for(let i=0;i<rows.length;i++){const origin={database:db.name,key:keys[i],hash:await digest(rows[i])};if(present.has(JSON.stringify(origin)))continue;records.push({id:'legacy-'+db.name+'-'+await digest([keys[i],origin.hash]),kind,payload:rows[i],origin,createdAt:new Date().toISOString(),restored:true});}}}await append(records);return records.length;}
 const original=HubSafety;
 root.HubSafety={...original,capture:async()=>{const first=await original.capture(),assets=await capture(),again=await original.capture(),verify=await capture();if(!original.same(first,again)||JSON.stringify(assets)!==JSON.stringify(verify))throw Error('バックアップ中に保存内容が変わりました。再度確認してください');return {...first,assets};},same:(a,b)=>original.same(a,b)&&a.assets?.format==='toshi-assets-archive'&&JSON.stringify(a.assets)===JSON.stringify(b.assets),hasData:s=>original.hasData(s)||s.assets?.databases?.some(d=>d.exists&&d.stores.some(st=>DiarySafety.unpackValue(st.records).length))};
 root.HubAssets={NAME,existing,capture,validate,entries,digest,add,append,visibility,restore};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-export.js */
try {
(function(root){
 'use strict';
 function filename(value,fallback='file'){return String(value||fallback).replace(/[\\/\x00-\x1f:]/g,'_').replace(/^\.+/,'_').slice(0,150)||fallback;}
 function csv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename(name);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
 async function zip(files){const chunks=[],central=[];let offset=0;for(let i=0;i<files.length;i++){const file=files[i],name=new TextEncoder().encode(filename(file.name,'file-'+i)),bytes=new Uint8Array(await file.blob.arrayBuffer());if(bytes.length>0xffffffff||offset+bytes.length>0xffffffff)throw Error('ZIPのサイズ上限を超えています');const header=new Uint8Array(30+name.length),h=new DataView(header.buffer),sum=crc(bytes);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,sum,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);const c=new Uint8Array(46+name.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,sum,true);v.setUint32(20,bytes.length,true);v.setUint32(24,bytes.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);c.set(name,46);chunks.push(header,bytes);central.push(c);offset+=header.length+bytes.length;}if(files.length>65535)throw Error('ZIPの件数上限を超えています');const length=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
 function safeURL(value){try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
 function photoURL(value){try{const url=new URL(String(value));return url.protocol==='https:'&&url.hostname==='drive.google.com'?url.href:'';}catch{return '';}}
 root.HubExport={filename,csv,download,zip,safeURL,photoURL};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoney=api;})(globalThis,function(){
 'use strict';
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 function validate(x){if(!x||typeof x.title!=='string'||!x.title.trim()||x.title.length>300||!day(x.date)||!['income','payment'].includes(x.kind)||typeof x.amount!=='number'||!Number.isSafeInteger(x.amount)||x.amount<0)throw Error('件名・日付・入出金区分・0以上の整数金額を確認してください');if(x.time&&!(typeof x.time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.time)))throw Error('時刻を確認してください');return x;}
 function edit(before,values,initial){const out={...before},base={title:'valid',date:'2020-01-01',kind:'payment',amount:0,time:''};for(const field of ['kind','title','amount','date','time']){if(values[field]===initial[field])continue;if(field==='amount'&&!values.amount.trim())throw Error('金額を入力してください');const value=field==='amount'?Number(values[field]):field==='title'?values[field].trim():values[field];validate({...base,[field]:value});out[field]=value;}return out;}
 function patch(value){const result={...value};for(const key of ['safeId','googleId','googleCalendarId'])delete result[key];return result;}
 function signature(x){return JSON.stringify([x.kind,x.date,x.title,Number(x.amount)]);}
 function model(rows,month){const selected=rows.filter(x=>typeof x.date==='string'&&x.date.slice(0,7)===month).sort((a,b)=>Number(!!a.done)-Number(!!b.done)||a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')),income=selected.filter(x=>x.kind==='income'),payment=selected.filter(x=>x.kind==='payment');const sum=a=>a.filter(x=>!x.done).reduce((n,x)=>Number.isFinite(n)&&typeof x.amount==='number'&&Number.isSafeInteger(x.amount)?n+x.amount:NaN,0);return {income,payment,other:rows.filter(x=>!day(x.date)||x.date.slice(0,7)===month&&!['income','payment'].includes(x.kind)),incomeTotal:sum(income),paymentTotal:sum(payment)};}
 function planImport(value,existing){const rows=Array.isArray(value)?value:value?.money;if(!Array.isArray(rows)||rows.length>10000)throw Error('10,000件以下のmoney配列を指定してください');const signatures=new Set(existing.map(signature)),ids=new Set(existing.filter(x=>typeof x.importId==='string'&&x.importId).map(x=>x.importId)),add=[],skip=[],update=[],updatedKeys=new Set();for(let i=0;i<rows.length;i++){const x=validate(rows[i]);if(x.done!==undefined&&typeof x.done!=='boolean')throw Error('完了状態はtrueまたはfalseで指定してください');if(x.importId!==undefined&&(typeof x.importId!=='string'||!x.importId||x.importId.length>300))throw Error('取込IDを確認してください');if(signatures.has(signature(x))||x.importId&&ids.has(x.importId)){skip.push(i);continue;}if(x.recurringCode!==undefined&&(typeof x.recurringCode!=='string'||!x.recurringCode||x.recurringCode.length>300))throw Error('定期項目コードを確認してください');const matches=x.recurringCode?existing.filter(r=>r.recurringCode===x.recurringCode&&r.kind===x.kind&&String(r.date||'').slice(0,7)===x.date.slice(0,7)):[];if(matches.length>1)throw Error('同じ月・定期項目コードに複数の記録があります。個別に編集してください');if(matches.length===1){const before=matches[0];for(const field of ['safeId','googleId','googleCalendarId','_key'])if(Object.hasOwn(x,field)&&x[field]!==before[field])throw Error('取込で既存の記録IDを変更できません');if(!before._key||updatedKeys.has(before._key))throw Error('更新する定期項目の対応が重複または不明です');updatedKeys.add(before._key);update.push({before,after:{...before,...x,_key:before._key}});signatures.add(signature(x));if(x.importId)ids.add(x.importId);continue;}signatures.add(signature(x));if(x.importId)ids.add(x.importId);add.push({...x,done:!!x.done});}return {add,skip,update};}
 return {validate,edit,patch,signature,model,planImport};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-receipts.js */
try {
(function(root){
 'use strict';
 const id=value=>/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(value.trim())?.[1]||'';
 const day=value=>{if(typeof value==='number'&&Number.isFinite(value))return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);return HubCore.day(String(value))?String(value):'';};
 function photo(formula){const m=/^=HYPERLINK\("([^"]+)"/i.exec(formula||'');return m?HubExport.photoURL(m[1]):HubExport.photoURL(formula||'');}
 let token='',expires=0,pending=false;
 async function api(path){if(!token||Date.now()>=expires){token='';throw Error('台帳へ未接続です。Googleで台帳を確認してください');}const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45000);try{const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+path,{headers:{Authorization:'Bearer '+token},signal:abort.signal,cache:'no-store'});if(!response.ok){if(response.status===401)token='';throw Error('Google台帳 HTTP '+response.status+'。アカウント・台帳の権限とSheets APIを確認してください');}return response.json();}finally{clearTimeout(timer);}}
 async function read(url){const sheet=id(url);if(!sheet)throw Error('Google台帳のURLを確認してください');if(!token||Date.now()>=expires){if(pending)throw Error('Google接続を確認中です');if(!root.google?.accounts?.oauth2)throw Error('Google接続を読み込めません。安全確認後に通信を確認してください');pending=true;try{await new Promise((resolve,reject)=>{const client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',callback:r=>{if(r.error)return reject(Error('台帳接続失敗：'+r.error));token=r.access_token;expires=Date.now()+Math.max(0,(Number(r.expires_in)||3600)-60)*1000;resolve();},error_callback:()=>reject(Error('Google台帳への接続を完了していません'))});client.requestAccessToken({prompt:'select_account'});});}finally{pending=false;}}
 const metadata=await api(sheet+'?fields=sheets.properties'),tab=metadata.sheets?.find(s=>s.properties.title==='台帳')?.properties;if(!tab||tab.gridProperties.columnCount<19)throw Error('19列の「台帳」タブを確認できません');if(tab.gridProperties.rowCount>100000)throw Error('台帳が100,000行を超えています。全件取得を停止しました。前の表示は保持します');
 const rows=[];for(let start=1;start<=tab.gridProperties.rowCount;start+=500){const range=encodeURIComponent("'台帳'!A"+start+':S'+Math.min(start+499,tab.gridProperties.rowCount)),[values,formulas]=await Promise.all([api(sheet+'/values/'+range+'?valueRenderOption=UNFORMATTED_VALUE'),api(sheet+'/values/'+range+'?valueRenderOption=FORMULA')]);for(let n=0;n<(values.values||[]).length;n++){const v=values.values[n]||[];if(start===1&&n===0){if(v[0]!=='No'||v[18]!=='写真ファイル名')throw Error('台帳の列構成が違います');continue;}if(!v.some(x=>x!==''&&x!=null))continue;rows.push({row:start+n,no:v[0],date:day(v[1]),company:String(v[2]||''),account:String(v[3]||''),vendor:String(v[4]||''),purpose:String(v[5]||''),amount:typeof v[6]==='number'?v[6]:null,state:String(v[17]||''),photo:photo(formulas.values?.[n]?.[18])});}}
 return {rows,at:new Date().toISOString()};
 }
 root.HubReceipts={id,day,photo,read};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-ocr.js */
try {
(function(root){
 'use strict';
 function parse(text){const lines=String(text).normalize('NFKC').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),dateMatch=lines.join('\n').match(/(20\d{2})[年\/.-]\s*(\d{1,2})[月\/.-]\s*(\d{1,2})/),date=dateMatch?[dateMatch[1],dateMatch[2].padStart(2,'0'),dateMatch[3].padStart(2,'0')].join('-'):'';let amount=null;for(const line of lines){if(!/合計|総額|お買上|TOTAL/i.test(line)||/小計|税|お預|釣/.test(line))continue;const numbers=line.match(/\d[\d,]*(?:\.\d+)?/g)||[];const n=Number(numbers.at(-1)?.replace(/,/g,''));if(Number.isSafeInteger(n)&&n>0)amount=n;}
 return {date:root.HubCore?.day(date)?date:'',amount,text:String(text)};}
 let loading;
 function load(){if(root.Tesseract)return Promise.resolve();if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>{loading=null;s.remove();reject(Error('読取エンジンを取得できません。通信を確認してください'));};document.head.append(s);});return loading;}
 async function recognize(image,progress){await load();let worker;try{worker=await Tesseract.createWorker('jpn+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0',langPath:'https://tessdata.projectnaptha.com/4.0.0',logger:m=>{if(m.status==='recognizing text')progress(Math.round((m.progress||0)*100));}});const result=await worker.recognize(image);return parse(result.data.text);}finally{if(worker)await worker.terminate();}}
 root.HubOCR={parse,recognize};
 document.addEventListener('DOMContentLoaded',()=>{const button=document.getElementById('featureReceiptOCR'),status=document.getElementById('featureReceiptOCRStatus');if(!button)return;button.onclick=async()=>{const image=root.HubFeatures.receiptImage();if(!image){status.textContent='先に写真を選んでください';return;}const before=['featureReceiptDate','featureReceiptAmount'].map(id=>document.getElementById(id).value);button.disabled=true;status.textContent='端末内で読取中。初回はエンジン・辞書を取得します…';try{const result=await root.HubOCR.recognize(image,n=>status.textContent='端末内で読取中 '+n+'%');if(root.HubFeatures.receiptImage()!==image)throw Error('読取中に写真が変わりました。もう一度実行してください');const unchanged=['featureReceiptDate','featureReceiptAmount'].every((id,i)=>document.getElementById(id).value===before[i]);if(unchanged)root.HubFeatures.applyReceipt(result.date,'',result.amount);status.textContent='読取候補です。金額・日付を原本と照合してください。保存はまだ完了していません。';const pre=document.createElement('pre');pre.textContent=result.text;if(!unchanged)status.append(document.createTextNode('読取中に入力が変わったため、候補の自動入力は行いませんでした。'));status.append(pre);}catch(e){status.textContent='読取失敗：'+e.message+'。写真・入力は保持しています。';}finally{button.disabled=false;}};});
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-features.js */
try {
(function(){
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(cls)x.className=cls;return x;},today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 function fail(e,id='hubFeatureStatus'){const x=$(id)||$('hubStatus');x.textContent=e.message||String(e);}
 function button(title,work,write=false){const x=make('button',title);x.type='button';if(write){x.dataset.write='';x.disabled=!globalThis.HubApp?.canWrite();}x.onclick=()=>Promise.resolve(work()).catch(e=>fail(e));return x;}
 const addHTML=(parent,html)=>{const t=document.createElement('template');t.innerHTML=html;parent.append(t.content);};
 addHTML($('money'),`<div class="card feature-money"><div class="calhead"><h2>入出金を管理</h2><button id="featureMoneyNew" type="button" data-write disabled>＋追加</button></div><div class="actions"><button id="featureMoneyPrev" type="button">前月</button><button id="featureMoneyNext" type="button">翌月</button><button id="featureMoneyImport" type="button" data-write disabled>ナミからJSON取込</button></div><div class="moneygrid"><div class="moneybox">未消込の入金<b id="featureIncomeTotal"></b></div><div class="moneybox">未消込の支払<b id="featurePaymentTotal"></b></div></div><h3>入金</h3><div id="featureIncomeRows"></div><h3>支払</h3><div id="featurePaymentRows"></div><h3>日付・区分の確認が必要な記録</h3><div id="featureOtherMoneyRows"></div></div>`);
 addHTML($('home'),`<div class="home-feature-links"><button type="button" id="featureBoardHome" class="board-action">ワンタイムボードを開く ›</button><button type="button" id="featureReceiptHome" class="board-action">領収書管理を開く ›</button></div>`);
 addHTML(document.querySelector('main'),`<p id="hubFeatureStatus" class="muted" role="status"></p><section id="board" class="panel" hidden><div class="card"><div class="calhead"><h2>ワンタイムボード</h2><button type="button" data-feature-home>ホーム</button></div><form id="featureBoardForm"><label>種類<select id="featureBoardType"><option value="url">Webリンク</option><option value="note">メモ</option><option value="file">PDF・画像・Word・Excel</option></select></label><label>見出し<input id="featureBoardTitle" maxlength="300" required></label><div class="actions"><input id="featureBoardQuery" placeholder="Googleで資料を探す"><button type="button" id="featureBoardSearch">検索</button></div><label id="featureBoardURLLabel">資料のURL<input id="featureBoardURL" type="url"></label><label id="featureBoardTextLabel" hidden>メモ<textarea id="featureBoardText" rows="4"></textarea></label><label id="featureBoardFileLabel" hidden>ファイル<input id="featureBoardFile" type="file" accept="application/pdf,image/png,image/jpeg,image/gif,image/webp,image/avif,.doc,.docx,.xls,.xlsx"></label><button type="submit" data-write disabled class="board-action">ボードに追加</button></form><input id="featureBoardFilter" type="search" placeholder="資料名・メモを検索"><label><input type="checkbox" id="featureBoardHidden">どけた資料も表示</label><div id="featureBoardRows"></div><p id="featureBoardStatus" role="status"></p></div></section>
 <section id="receipts" class="panel" hidden><div class="card"><h2>Driveの領収書台帳</h2><label>本人の台帳URL<input type="url" id="featureReceiptSheet"></label><div class="actions"><button type="button" id="featureReceiptConnect">Googleで台帳を確認</button><button type="button" id="featureReceiptOpen">台帳を開く</button><button type="button" id="featureReceiptSet" data-write disabled>台帳を設定</button></div><p id="featureReceiptDriveStatus" role="status">Google台帳未読込</p><div class="twocol"><label>月<input type="month" id="featureReceiptMonth"></label><label>会社<select id="featureReceiptCompany"><option value="">すべて</option><option>CP</option><option>CPY</option><option>AT</option><option>個人（不動産）</option><option>要確認</option></select></label></div><div id="featureReceiptDriveSummary"></div><div id="featureReceiptDriveRows"></div></div>
 <div class="card"><h2>領収書写真・端末保存</h2><p class="muted">以前の写真は元の保存領域から読み取り表示します。新しい写真・台帳は別の保護領域に保存し、Google Driveへ自動送信しません。</p><form id="featureReceiptForm"><div class="twocol"><label>写真を撮る<input type="file" id="featureReceiptCamera" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label>写真を選ぶ<input type="file" id="featureReceiptFile" accept="image/jpeg,image/png,image/webp"></label></div><div id="featureReceiptPreview"></div><button type="button" id="featureReceiptOCR">写真から自動読取</button><p id="featureReceiptOCRStatus" role="status"></p><details><summary>ナミの読取結果を貼る</summary><textarea id="featureReceiptNami" placeholder="日付｜支払先｜金額"></textarea><button type="button" id="featureReceiptApply">候補入力</button></details><div class="twocol"><label>会社<select id="featureReceiptNewCompany" required><option value="">選択</option><option>CP</option><option>CPY</option><option>AT</option></select></label><label>利用日<input type="date" id="featureReceiptDate" required></label></div><label>金額<input type="number" id="featureReceiptAmount" min="1" step="1" required></label><label>支払先<input id="featureReceiptVendor" required maxlength="100"></label><label>内容<input id="featureReceiptPurpose" required maxlength="150"></label><div class="twocol"><label>支払方法<select id="featureReceiptPayment"><option value="">未指定</option><option>現金</option><option>法人カード</option><option>個人カード</option><option>振込</option><option>その他</option></select></label><label>勘定科目<input id="featureReceiptAccount" maxlength="60"></label></div><label>備考<input id="featureReceiptNote" maxlength="200"></label><button class="board-action" data-write disabled>領収書を保存</button></form><p id="featureReceiptStatus" role="status"></p><div id="featureReceiptLocalSummary"></div><div class="actions"><button type="button" id="featureReceiptCSV">台帳CSVを保存</button><button type="button" id="featureReceiptZIP">台帳と写真をZIP保存</button></div><label><input type="checkbox" id="featureReceiptHidden">どけた領収書も表示</label><div id="featureReceiptLocalRows"></div></div></section>
 <details class="card" id="featureArchiveCard"><summary>資料・領収書の画像バックアップ・復元</summary><p class="muted">画像・資料・メモ・元の保存キーを含めて保全します。復元は別の保護領域への追加のみで、旧領域を上書きしません。</p><button type="button" id="featureArchiveDownload">画像を含む完全バックアップ</button><label>画像・資料のバックアップから復元<input type="file" id="featureArchiveRestore" accept="application/json,.json" data-write disabled></label><p id="featureArchiveStatus" role="status"></p></details>`);
 addHTML(document.body,`<dialog id="featureMoneyDialog"><form id="featureMoneyForm"><div class="calhead"><h2>入出金を登録</h2><button type="button" id="featureMoneyClose">閉じる</button></div><label>区分<select id="featureMoneyKind"><option value="income">入金</option><option value="payment">支払</option></select></label><label>件名<input id="featureMoneyTitle" required maxlength="300"></label><label>金額<input type="number" id="featureMoneyAmount" required min="0" step="1"></label><label>日付<input type="date" id="featureMoneyDate" required></label><label>時刻（任意）<input type="time" id="featureMoneyTime"></label><p id="featureMoneyError" role="status"></p><button class="board-action" data-write disabled>端末に保存</button></form></dialog><dialog id="featureImportDialog"><h2>ナミから資金繰り取込</h2><textarea id="featureImportText" rows="8" placeholder="money配列のJSON"></textarea><div class="actions"><button type="button" id="featureImportCheck">取込前に確認</button><button type="button" id="featureImportCommit" data-write disabled>確認した内容を取込</button><button type="button" id="featureImportClose">閉じる</button></div><p id="featureImportStatus" role="status"></p></dialog><dialog id="featureViewer"><div class="calhead"><h2 id="featureViewTitle"></h2><button type="button" id="featureViewClose">閉じる</button></div><div id="featureViewBody"></div></dialog>`);
 $('home').querySelector('.home-links').after($('home').querySelector('.home-feature-links'));
 addHTML($('work'),'<details class="card"><summary>どけた予定・作業を戻す</summary><div id="featureArchivedItems"></div></details>');
 function archivedItems(){if(!globalThis.HubApp||HubApp.panel()!=='work')return;const rows=$('featureArchivedItems');rows.replaceChildren();for(const item of HubApp.allItems().filter(x=>x.cancelled)){rows.append(make('p',item.title||'件名なし'),button('一覧へ戻す',()=>HubApp.archiveItem(item,false),true));}}
 window.addEventListener('hub-render',archivedItems);
 const viewerURLs=[];
 function viewClose(){for(const url of viewerURLs)URL.revokeObjectURL(url);viewerURLs.length=0;$('featureViewer').close();$('featureViewBody').replaceChildren();}
 function view(record){viewClose();const r=record.payload||{},content=$('featureViewBody');$('featureViewTitle').textContent=r.title||r.vendor||'原本';const blob=r.blob||r.image;
  if(r.type==='note')content.append(make('div',r.text||'','feature-note'));
  else if(blob instanceof Blob){const url=URL.createObjectURL(blob);viewerURLs.push(url);if(['image/png','image/jpeg','image/gif','image/webp','image/avif'].includes(blob.type)){const image=make('img');image.src=url;image.alt=r.title||'領収書の原本';image.className='feature-image';content.append(image);}else if(blob.type==='application/pdf'){const frame=make('iframe');frame.src=url;frame.title='PDFの原本';frame.setAttribute('sandbox','');frame.className='feature-pdf';content.append(frame);}else content.append(make('p','この形式は対応アプリで開いてください。保存した原本は変更していません。'));content.append(button('原本を保存',()=>HubExport.download(blob,r.fileName||r.id||'original')));}
  else{const url=HubExport.safeURL(r.url);if(url){const link=make('a','元の資料を開く');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';content.append(link);}else content.append(make('p','元のURL・画像の形式を確認できません。元データは保管しています。'));}
  $('featureViewer').showModal();
 }
 $('featureViewClose').onclick=viewClose;$('featureViewer').addEventListener('cancel',e=>{e.preventDefault();viewClose();});
 let moneyEditing=null,moneyInitial='',importPlan=null,importBefore='';
 function moneyForm(row=null){HubApp.checkWrite();moneyEditing=row;$('featureMoneyKind').value=row?.kind||'payment';$('featureMoneyTitle').value=row?.title||'';$('featureMoneyAmount').value=row?.amount??'';$('featureMoneyDate').value=row?.date||today();$('featureMoneyTime').value=row?.time||'';$('featureMoneyError').textContent='';for(const id of ['featureMoneyDate','featureMoneyAmount'])$(id).required=!row||!!$(id).value;moneyInitial=moneyValues();$('featureMoneyDialog').showModal();}
 function moneyValues(){return JSON.stringify(['featureMoneyKind','featureMoneyTitle','featureMoneyAmount','featureMoneyDate','featureMoneyTime'].map(id=>$(id).value));}
 function moneyClose(){if(moneyValues()!==moneyInitial&&!confirm('未保存の入力を閉じますか？'))return;$('featureMoneyDialog').close();}
 $('featureMoneyNew').onclick=()=>{try{moneyForm();}catch(e){fail(e);}};$('featureMoneyClose').onclick=moneyClose;$('featureMoneyDialog').addEventListener('cancel',e=>{e.preventDefault();moneyClose();});
 $('featureMoneyForm').onsubmit=async e=>{e.preventDefault();try{const fields=['kind','title','amount','date','time'],values=Object.fromEntries(fields.map((key,i)=>[key,JSON.parse(moneyValues())[i]])),initial=Object.fromEntries(fields.map((key,i)=>[key,JSON.parse(moneyInitial)[i]])),x=moneyEditing?HubMoney.edit(moneyEditing,values,initial):HubMoney.validate({...values,title:values.title.trim(),amount:Number(values.amount)});const pendingSave=HubApp.commit('money-save',next=>{if(moneyEditing){next.history.push({kind:'previous-money',at:new Date().toISOString(),value:moneyEditing});next.moneyEdits[moneyEditing._key]={...next.moneyEdits[moneyEditing._key],...HubMoney.patch(x),_key:moneyEditing._key};}else{delete x._key;x.safeId=crypto.randomUUID();x.done=false;next.money.push(x);}});if(pendingSave)await pendingSave;$('featureMoneyDialog').close();fail(Error('入出金を端末の保護領域へ保存しました'));}catch(error){fail(error,'featureMoneyError');}};
 function money(){if(!globalThis.HubApp)return;const model=HubMoney.model(HubApp.money(),$('hubMoneyMonth').value),amount=n=>Number.isFinite(n)?'¥'+n.toLocaleString('ja-JP'):'要確認';$('featureIncomeTotal').textContent=amount(model.incomeTotal);$('featurePaymentTotal').textContent=amount(model.paymentTotal);for(const [id,rows] of [['featureIncomeRows',model.income],['featurePaymentRows',model.payment],['featureOtherMoneyRows',model.other]]){const container=$(id);container.replaceChildren();if(!rows.length)container.append(make('p','この月の記録はありません','muted'));for(const r of rows){const row=make('article',undefined,'hub-row'+(r.done?' done':'')),content=make('div');content.append(make('b',r.title||'件名なし'),make('p',(r.date||'日付不明')+'｜'+amount(r.amount)+'｜'+(r.done?'消込済み':'未消込')+(r.settledDate?'｜消込日 '+r.settledDate:''),'muted'));const actions=make('div',undefined,'row-actions');actions.append(button(r.done?'完了を取り消す':'完了にする',async()=>{if(!confirm((r.done?'完了を取り消す':'完了にする')+'：'+r.title+' '+amount(r.amount)+' でよいですか？'))return;const pendingSave=HubApp.commit('money-complete',next=>{next.history.push({kind:'previous-money',at:new Date().toISOString(),value:r});next.moneyEdits[r._key]={...next.moneyEdits[r._key],done:!r.done};});if(pendingSave)await pendingSave;},true),button('編集',()=>moneyForm(r),true));content.append(actions);row.append(content);container.append(row);}}}
 for(const [id,n] of [['featureMoneyPrev',-1],['featureMoneyNext',1]])$(id).onclick=()=>{const d=new Date($('hubMoneyMonth').value+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);$('hubMoneyMonth').value=d.toISOString().slice(0,7);HubApp.render();};
 $('featureMoneyImport').onclick=()=>{$('featureImportStatus').textContent='';importPlan=null;$('featureImportDialog').showModal();};$('featureImportClose').onclick=()=>$('featureImportDialog').close();
 $('featureImportText').oninput=()=>{importPlan=null;$('featureImportStatus').textContent='内容が変わりました。取込前の確認をやり直してください';};
 $('featureImportCheck').onclick=()=>{try{importPlan=HubMoney.planImport(JSON.parse($('featureImportText').value),HubApp.money());importBefore=JSON.stringify(HubApp.money());$('featureImportStatus').textContent='追加 '+importPlan.add.length+'件、定期項目更新 '+importPlan.update.length+'件、重複または一致候補 '+importPlan.skip.length+'件は追加しません。定期項目の更新は明示されたコード・月の一致だけで行い、前の内容を履歴に残します。';}catch(e){importPlan=null;fail(e,'featureImportStatus');}};
 $('featureImportCommit').onclick=async()=>{try{if(!importPlan||JSON.stringify(HubApp.money())!==importBefore)throw Error('取込前の確認をやり直してください');if(!confirm('確認した '+importPlan.add.length+'件を追加し、定期項目 '+importPlan.update.length+'件を履歴付きで更新しますか？'))return;const pendingSave=HubApp.commit('money-import',next=>{for(const x of importPlan.add){const copy={...x,safeId:crypto.randomUUID()};delete copy._key;next.money.push(copy);}for(const pair of importPlan.update){next.history.push({kind:'previous-money',at:new Date().toISOString(),value:pair.before});next.moneyEdits[pair.before._key]={...next.moneyEdits[pair.before._key],...HubMoney.patch(pair.after)};}});if(pendingSave)await pendingSave;$('featureImportDialog').close();fail(Error('取込完了。追加 '+importPlan.add.length+'件、重複候補 '+importPlan.skip.length+'件は保持してスキップ'));importPlan=null;}catch(e){fail(e,'featureImportStatus');}};
 $('featureBoardHome').onclick=()=>HubApp.navigate('board');$('featureReceiptHome').onclick=()=>HubApp.navigate('receipts');document.querySelectorAll('[data-feature-home]').forEach(x=>x.onclick=()=>HubApp.navigate('home'));
 function boardMode(){const type=$('featureBoardType').value;for(const [id,t] of [['featureBoardURLLabel','url'],['featureBoardTextLabel','note'],['featureBoardFileLabel','file']])$(id).hidden=type!==t;}
 $('featureBoardType').onchange=boardMode;boardMode();$('featureBoardSearch').onclick=()=>{const q=$('featureBoardQuery').value.trim();if(q)window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener,noreferrer');};
 async function board(){try{const data=await HubAssets.entries('board'),all=$('featureBoardHidden').checked?data.all:data.visible,q=$('featureBoardFilter').value.toLocaleLowerCase(),rows=$('featureBoardRows');rows.replaceChildren();for(const r of all.filter(r=>[r.payload?.title,r.payload?.text].join('\n').toLocaleLowerCase().includes(q))){const item=make('article',undefined,'hub-row'),x=r.payload||{};item.append(button((x.type==='note'?'メモ｜':x.type==='file'?'ファイル｜':'リンク｜')+(x.title||'見出しなし'),()=>view(r)),button(data.hidden.has(r.id)?'一覧に戻す':'どける',()=>HubAssets.visibility(r,!data.hidden.has(r.id)),true));if(r.legacy)item.append(make('span','以前の保存記録','muted'));rows.append(item);}if(!all.length)rows.append(make('p','保存済み資料はありません','muted'));}catch(e){fail(e,'featureBoardStatus');}}
 $('featureBoardFilter').oninput=board;$('featureBoardHidden').onchange=board;
 $('featureBoardForm').onsubmit=async e=>{e.preventDefault();try{const type=$('featureBoardType').value,payload={type,title:$('featureBoardTitle').value.trim()};if(!payload.title)throw Error('見出しを入力してください');if(type==='url'){payload.url=HubExport.safeURL($('featureBoardURL').value);if(!payload.url)throw Error('http/httpsの資料URLを入力してください');}else if(type==='note'){payload.text=$('featureBoardText').value;if(!payload.text.trim())throw Error('メモを入力してください');}else{const file=$('featureBoardFile').files[0];if(!file||file.size>15*1024*1024||!(/\.(pdf|png|jpe?g|gif|webp|avif|docx?|xlsx?)$/i.test(file.name)))throw Error('15MB以下のPDF・画像・Word・Excelを選んでください');payload.blob=file;payload.mime=file.type;payload.fileName=file.name;}await HubAssets.add('board',payload);$('featureBoardForm').reset();boardMode();await board();$('featureBoardStatus').textContent='保護領域へ保存しました。旧資料・画像は変更していません。';}catch(error){fail(error,'featureBoardStatus');}};
 let drive=null,receiptImage=null,previewURL=null;
 async function receipts(){if(!globalThis.HubApp)return;const sheet=HubApp.overlay().receiptSheetUrl||localStorage.getItem('toshi_receipt_sheet_url')||'';if(!$('featureReceiptSheet').value)$('featureReceiptSheet').value=sheet;const month=$('featureReceiptMonth').value,company=$('featureReceiptCompany').value;if(drive){const rows=drive.rows.filter(r=>(!month||r.date.slice(0,7)===month)&&(!company||r.company===company));$('featureReceiptDriveSummary').textContent=rows.length+'件｜原本リンクあり '+rows.filter(r=>r.photo).length+'件｜原本リンクなし '+rows.filter(r=>!r.photo).length+'件｜前回読込 '+new Date(drive.at).toLocaleString('ja-JP');$('featureReceiptDriveRows').replaceChildren();for(const r of rows){const wrap=make('article',undefined,'hub-row');wrap.append(make('p',(r.date||'日付要確認')+'｜'+r.company+'｜'+r.vendor+'｜'+(r.amount===null?'金額要確認':r.amount.toLocaleString()+'円')),make('p',r.purpose,'muted'));if(r.photo){const link=make('a','Driveの原本を開く');link.href=r.photo;link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);}else wrap.append(make('p','原本リンクなし','diary-warning'));$('featureReceiptDriveRows').append(wrap);}}
  const data=await HubAssets.entries('receipt'),items=($('featureReceiptHidden').checked?data.all:data.visible).filter(r=>(!month||String(r.payload?.date||'').slice(0,7)===month)&&(!company||r.payload?.company===company));$('featureReceiptLocalSummary').textContent='端末 '+items.length+'件｜Googleへ自動送信しません';$('featureReceiptLocalRows').replaceChildren();for(const r of items){const x=r.payload||{},row=make('article',undefined,'hub-row');row.append(make('p',(x.date||'日付不明')+'｜'+(x.company||'未分類')+'｜'+(x.vendor||'支払先不明')+'｜'+String(x.amount??'金額不明')+'円'),button('写真を見る・保存',()=>view(r)),button(data.hidden.has(r.id)?'一覧に戻す':'どける',()=>HubAssets.visibility(r,!data.hidden.has(r.id)),true));$('featureReceiptLocalRows').append(row);}
 }
 for(const id of ['featureReceiptMonth','featureReceiptCompany','featureReceiptHidden'])$(id).onchange=()=>receipts().catch(e=>fail(e,'featureReceiptStatus'));
 $('featureReceiptConnect').onclick=async()=>{const b=$('featureReceiptConnect');if(b.disabled)return;b.disabled=true;$('featureReceiptDriveStatus').textContent='Google台帳を確認中…';try{drive=await HubReceipts.read($('featureReceiptSheet').value);await receipts();$('featureReceiptDriveStatus').textContent='Google台帳を全取得範囲で読み込みました。台帳は変更していません。';}catch(e){$('featureReceiptDriveStatus').textContent='読込失敗：'+e.message+(drive?'。前回読込の表示を保持しています（最新確認は未完了）':'。Google台帳は未確認です');}finally{b.disabled=false;}};
 $('featureReceiptOpen').onclick=()=>{const id=HubReceipts.id($('featureReceiptSheet').value);if(id)window.open('https://docs.google.com/spreadsheets/d/'+id+'/edit','_blank','noopener,noreferrer');else fail(Error('台帳URLを入力してください'));};$('featureReceiptSet').onclick=async()=>{try{const url=$('featureReceiptSheet').value.trim();if(!HubReceipts.id(url))throw Error('台帳URLを確認してください');const pendingSave=HubApp.commit('receipt-settings',next=>{next.receiptSheetUrl=url;});if(pendingSave)await pendingSave;$('featureReceiptDriveStatus').textContent='台帳の設定を保存しました。Googleはまだ読み込んでいません。';}catch(e){fail(e,'featureReceiptDriveStatus');}};
 function selectImage(input){const file=input.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){fail(Error('20MB以下のJPEG・PNG・WebPを選んでください'),'featureReceiptStatus');return;}receiptImage=file;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);const image=make('img');image.src=previewURL;image.className='feature-image';image.alt='選んだ領収書';$('featureReceiptPreview').replaceChildren(image);$('featureReceiptStatus').textContent='写真はまだ未保存です。内容を確認して保存してください。';}
 $('featureReceiptCamera').onchange=e=>selectImage(e.target);$('featureReceiptFile').onchange=e=>selectImage(e.target);
 function applyReceipt(date,vendor,amount){if(HubCore.day(date))$('featureReceiptDate').value=date;if(vendor)$('featureReceiptVendor').value=vendor;if(Number.isSafeInteger(Number(amount))&&Number(amount)>0)$('featureReceiptAmount').value=String(Number(amount));}
 $('featureReceiptApply').onclick=()=>{const parts=$('featureReceiptNami').value.trim().split(/[｜|]/);if(parts.length!==3||!HubCore.day(parts[0])||!Number.isSafeInteger(Number(parts[2].replace(/[,円¥￥\s]/g,'')))){fail(Error('日付｜支払先｜金額の形式で入力してください'),'featureReceiptStatus');return;}applyReceipt(parts[0],parts[1],parts[2].replace(/[,円¥￥\s]/g,''));$('featureReceiptStatus').textContent='候補を入力しました。写真と照合して保存してください。';};
 $('featureReceiptForm').onsubmit=async e=>{e.preventDefault();try{const payload={id:'receipt-'+crypto.randomUUID(),company:$('featureReceiptNewCompany').value,date:$('featureReceiptDate').value,amount:Number($('featureReceiptAmount').value),vendor:$('featureReceiptVendor').value.trim(),purpose:$('featureReceiptPurpose').value.trim(),payment:$('featureReceiptPayment').value,account:$('featureReceiptAccount').value,note:$('featureReceiptNote').value,image:receiptImage,imageType:receiptImage?.type||'',createdAt:new Date().toISOString()};if(!receiptImage||!HubCore.day(payload.date)||!payload.company||!payload.vendor||!payload.purpose||!Number.isSafeInteger(payload.amount)||payload.amount<=0)throw Error('写真・会社・日付・金額・支払先・内容を確認してください');await HubAssets.add('receipt',payload);$('featureReceiptForm').reset();receiptImage=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('featureReceiptPreview').replaceChildren();$('featureReceiptStatus').textContent='写真と台帳を端末に保存しました。Googleへは送信していません。';await receipts();}catch(error){fail(error,'featureReceiptStatus');}};
 async function receiptExport(zip){const data=await HubAssets.entries('receipt'),month=$('featureReceiptMonth').value,company=$('featureReceiptCompany').value,rows=data.visible.filter(r=>(!month||String(r.payload?.date||'').slice(0,7)===month)&&(!company||r.payload?.company===company)),matrix=[['記録ID','利用日','会社','支払先','内容','金額','支払方法','勘定科目','備考','写真ファイル']];const files=[];for(let n=0;n<rows.length;n++){const x=rows[n].payload,ext=x.image?.type==='image/png'?'.png':x.image?.type==='image/webp'?'.webp':x.image?.type==='image/jpeg'?'.jpg':'.bin',name='receipt-'+String(n+1).padStart(4,'0')+ext;matrix.push([x.id||rows[n].id,x.date,x.company,x.vendor,x.purpose,x.amount,x.payment,x.account,x.note,x.image instanceof Blob?name:'原本画像なし']);if(x.image instanceof Blob)files.push({name,blob:x.image});}const csv=new Blob([HubExport.csv(matrix)],{type:'text/csv;charset=utf-8'});if(zip){files.unshift({name:'台帳.csv',blob:csv});HubExport.download(await HubExport.zip(files),'領収書-'+(month||'全期間')+'.zip');}else HubExport.download(csv,'領収書-'+(month||'全期間')+'.csv');$('featureReceiptStatus').textContent='ダウンロードを開始しました。端末にファイルが保存されたか確認してください。';}
 $('featureReceiptCSV').onclick=()=>receiptExport(false).catch(e=>fail(e,'featureReceiptStatus'));$('featureReceiptZIP').onclick=()=>receiptExport(true).catch(e=>fail(e,'featureReceiptStatus'));
 $('featureArchiveDownload').onclick=async()=>{try{HubExport.download(new Blob([JSON.stringify(await HubSafety.capture())],{type:'application/json'}),'toshi-hub-complete-backup.json');$('featureArchiveStatus').textContent='画像を含むバックアップのダウンロードを開始しました。';}catch(e){fail(e,'featureArchiveStatus');}};
 $('featureArchiveRestore').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw Error('256MB以下のバックアップを選んでください');const value=JSON.parse(await file.text());if(value.format!=='toshi-hub-safety-backup'||value.version!==1||value.sourceOrigin!==location.origin)throw Error('同じ保存オリジンのHUB完全バックアップを選んでください');HubAssets.validate(value.assets);if(!confirm('資料・領収書の画像を保護領域へ追加復元します。旧保存領域は上書きしません。続けますか？'))return;const count=await HubAssets.restore(value.assets);$('featureArchiveStatus').textContent='画像・資料 '+count+'件を照合して復元しました。旧領域は変更していません。';await refresh();}catch(error){fail(error,'featureArchiveStatus');}finally{e.target.value='';}};
 async function refresh(){if(!globalThis.HubApp)return;const p=HubApp.panel();if(p==='board')await board();if(p==='receipts')await receipts();}
 window.addEventListener('hub-panel',()=>refresh().catch(e=>fail(e)));window.addEventListener('hub-assets-changed',()=>refresh().catch(e=>fail(e)));
 $('featureReceiptMonth').value=today().slice(0,7);$('featureReceiptDate').value=today();
 function serializeForm(id){const form=$(id),handler=form.onsubmit;let pending=false;form.onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;const controls=[...form.querySelectorAll('input,textarea,select,button')],states=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);try{await handler(e);}finally{pending=false;controls.forEach((x,i)=>x.disabled=x.hasAttribute('data-write')?!HubApp.canWrite():states[i]);}};}
 serializeForm('featureBoardForm');serializeForm('featureReceiptForm');
 if(globalThis.HubPersistence){HubPersistence.guardForm($('featureMoneyForm'));$('featureImportCommit').onclick=HubPersistence.guardAction($('featureImportDialog'),$('featureImportCommit').onclick);$('featureImportDialog').addEventListener('cancel',e=>{if($('featureImportDialog').dataset.saving==='true'){e.preventDefault();e.stopImmediatePropagation();}},true);}
 globalThis.HubFeatures={money,refresh,moneyForm,applyReceipt,receiptImage:()=>receiptImage};
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-diary-links.js */
try {
(function(){
 'use strict';
 const $=id=>document.getElementById(id),node=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 let records=[];
 const box=node('details'),summary=node('summary','この日の予定・完了作業を参照'),rows=node('div');box.append(summary,node('p','予定を実施済みとは判断しません。完了日が分からない作業は分けて表示します。'),rows);$('diaryEditor').append(box);
 function related(){rows.replaceChildren();if(!globalThis.HubApp)return;const date=$('diaryDate').value;if(!HubCore.day(date))return;const items=HubApp.items(),events=items.filter(x=>x.type==='event'&&HubCore.span(x,date)),done=items.filter(x=>['todo','task'].includes(x.type)&&x.done&&x.completedDate===date),unknown=items.filter(x=>['todo','task'].includes(x.type)&&x.done&&!HubCore.day(x.completedDate)&&(HubCore.deadline(x)||HubCore.workStart(x))===date);for(const [label,list] of [['予定（実施したかは未確認）',events],['完了日として保存された作業',done],['実施日不明の完了作業',unknown]]){if(!list.length)continue;rows.append(node('h4',label));for(const item of list){const row=node('p',(item.time?item.time+' ':'')+item.title);rows.append(row);}}if(!events.length&&!done.length&&!unknown.length)rows.append(node('p','保存済みの予定・作業にこの日の関連記録はありません。'));}
 function addTaskForm(r,item){if(item.querySelector('.diary-task-convert'))return;const form=node('form');form.className='diary-task-convert';const title=node('input'),type=node('select'),date=node('input'),project=node('select'),status=node('p');title.required=true;title.maxLength=300;title.value=(r.golfNext||r.title||r.body||'').split('\n')[0].slice(0,300);for(const [value,label] of [['todo','ToDo（期限あり）'],['task','タスク（期限なし）']]){const option=node('option',label);option.value=value;type.append(option);}date.type='date';date.value=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});date.required=true;type.onchange=()=>{date.required=type.value==='todo';};for(const p of ['TASK','TOSHI','CPG','Trip','GOLF'])project.append(node('option',p));if(r.golfNext)project.value='GOLF';const label=(name,input)=>{const l=node('label',name);l.append(input);return l;};form.append(node('p','元のダイアリー・履歴は残します。Googleへの登録は自動で行いません。'),label('種類',type),label('作業名',title),label('期限／実施予定日（タスクは空欄でも可）',date),label('分類',project));const save=node('button','この内容で作業を登録'),cancel=node('button','閉じる');save.type='submit';save.dataset.write='';save.disabled=!HubApp.canWrite();cancel.type='button';cancel.onclick=()=>form.remove();form.append(save,cancel,status);form.onsubmit=async e=>{e.preventDefault();try{const x=HubCore.validateItem({safeId:crypto.randomUUID(),type:type.value,title:title.value.trim(),project:project.value,done:false,deadlineDate:type.value==='todo'?date.value:'',scheduledDate:type.value==='task'?date.value:'',diaryEntryId:r.entryId});const pendingSave=HubApp.commit('diary-to-work',next=>{next.items.push(x);});if(pendingSave)await pendingSave;save.disabled=true;form.replaceChildren(node('p','作業を端末に登録しました。Googleへは未登録です。元のダイアリーは残っています。'));}catch(error){status.textContent='登録できません：'+error.message;}};if(globalThis.HubPersistence)HubPersistence.guardForm(form);item.append(form);}
 function renderLinks(){if(!globalThis.HubApp||HubApp.panel()!=='diary')return;const articles=[...$('diaryRows').querySelectorAll('article.diary-entry')],heads=ToshiDiaryCore.search(records,{month:$('diaryMonth').value,query:$('diarySearch').value,ascending:$('diaryOrder').value==='asc'});for(let i=0;i<articles.length;i++){const item=articles[i],r=heads[i];if(!r||item.querySelector('[data-diary-convert]'))continue;const button=node('button','タスクにする');button.type='button';button.dataset.diaryConvert='';button.dataset.write='';button.disabled=!HubApp.canWrite();button.onclick=()=>addTaskForm(r,item);item.querySelector('.diary-buttons')?.append(button);}related();}
 $('diaryDate').addEventListener('input',related);window.addEventListener('hub-render',renderLinks);
 document.addEventListener('hub-diary-records',e=>{records=e.detail.records;renderLinks();});
 new MutationObserver(()=>renderLinks()).observe($('diaryRows'),{childList:true});
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub.js */
try {
(function(){
'use strict';
const C=HubCore,K=HubCalendar,$=id=>document.getElementById(id),today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),marker='toshi_hub_complete_gate_v1';
let legacy,overlay,legacyRaw,overlayRaw,ready=false,blocked=false,busy=false,saving=false,snapshot=null,verified=false,selected=today(),anchor=today(),panel='home',editing=null,editorInitial='',diaryStarted=false,identity=null,viewOverlay=null,workPeriod='all',editorSnapshot=null;
const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(cls)el.className=cls;return el;};
function button(label,fn,write=false){const el=node('button',label);el.type='button';if(write){el.dataset.write='';el.disabled=!ready||blocked||!identity?.ok||busy;}el.onclick=()=>Promise.resolve(fn()).catch(error=>status(error.message));return el;}
function status(text){$('hubStatus').textContent=text;}
function controls(){document.querySelectorAll('[data-write]').forEach(el=>el.disabled=!ready||blocked||!identity?.ok||busy||saving||el.dataset.unverified==='true');$('hubContinue').disabled=!verified||blocked;}
function read(){legacyRaw=localStorage.getItem(C.LEGACY);overlayRaw=localStorage.getItem(C.STORAGE);legacy=C.parseLegacy(legacyRaw);if(overlayRaw&&JSON.parse(overlayRaw).format==='toshi-hub-overlay-pointer'){if(!globalThis.HubPersistence)throw Error('大容量の予定保存機能を読み込めません。再読み込みしてください。記録は保持しています');return HubPersistence.load(overlayRaw).then(raw=>{overlay=C.parseOverlay(raw);});}overlay=C.parseOverlay(overlayRaw);}
function checkWrite(skipSaving=false){if(!identity?.ok)throw Error(identity?.message||'記録の対応を確認できません。元データを保持しています。');if(saving&&!skipSaving)throw Error('保存中です。完了を待ってください');if(!ready||blocked)throw Error('安全バックアップを確認してから編集してください');if(localStorage.getItem(C.LEGACY)!==legacyRaw||localStorage.getItem(C.STORAGE)!==overlayRaw){blocked=true;controls();throw Error('他のHUB画面でデータが更新されました。入力を控え、他の画面を閉じてから再読み込みしてください。');}}
function commit(kind,update){checkWrite();const next=structuredClone(overlay);next.legacyBinding={...identity.binding};update(next);next.history.push({at:new Date().toISOString(),kind});const raw=JSON.stringify(next);const apply=saved=>{rememberNewWork(kind,next);overlayRaw=saved;overlay=next;viewOverlay=next;render();};const persist=()=>{saving=true;controls();return HubPersistence.save(raw,overlayRaw,localStorage,C.STORAGE,()=>checkWrite(true)).then(apply).finally(()=>{saving=false;controls();});};if(globalThis.HubPersistence?.pointer(overlayRaw))return persist();try{localStorage.setItem(C.STORAGE,raw);}catch(error){if(error.name==='QuotaExceededError'&&globalThis.HubPersistence)return persist();throw error;}apply(raw);}
async function archiveItem(item,hide){checkWrite();if(!confirm(hide?'一覧からどけますか？元の予定・作業と履歴は残します。Google側は変更しません。':'この予定・作業を一覧へ戻しますか？'))return;const pendingSave=commit(hide?'item-hide':'item-show',next=>{next.history.push({kind:'previous-item',at:new Date().toISOString(),value:item});next.edits[item._key]={...next.edits[item._key],cancelled:hide};});if(pendingSave)await pendingSave;}
function items(){return renderingItems||(identity?.displayItems||C.list(legacy,viewOverlay||overlay)).filter(x=>!x.linkedGoogleKey&&!x.cancelled);}
function moneyItems(){return renderingMoney||identity?.displayMoney||C.money(legacy,viewOverlay||overlay);}
let renderingAllItems=null,renderingItems=null,renderingMoney=null;
function withViewData(work){if(renderingItems!==null)return work();try{renderingAllItems=identity?.displayItems||C.list(legacy,viewOverlay||overlay);renderingItems=renderingAllItems.filter(x=>!x.linkedGoogleKey&&!x.cancelled);renderingMoney=identity?.displayMoney||C.money(legacy,viewOverlay||overlay);return work();}finally{renderingAllItems=null;renderingItems=null;renderingMoney=null;}}
const newWorkKeys=new Map();let focusedWorkKey='',syncNewWorkKeys=[];
function rememberNewWork(kind,next){if(!['save-item','google-sync'].includes(kind))return;const known=new Set(C.list(legacy,viewOverlay||overlay).map(x=>x._key));const incoming=kind==='google-sync'?next.google:next.items;if(kind==='google-sync')syncNewWorkKeys=[];for(const row of incoming){const key=C.key(row);if(['todo','task'].includes(row.type)&&!row.cancelled&&!row.linkedGoogleKey&&!known.has(key)){newWorkKeys.set(key,kind==='google-sync'?'sync':'local');if(kind==='google-sync')syncNewWorkKeys.push(key);}}}
function renderNewWorkNotice(){const all=items(),recent=all.filter(x=>['todo','task'].includes(x.type)&&newWorkKeys.has(x._key));$('hubNewWorkNotice').hidden=!recent.length;$('hubNewWorkCount').textContent='今回の起動中に追加・同期した作業 '+recent.length+'件';$('hubSyncNewWorkJump').hidden=!all.some(x=>syncNewWorkKeys.includes(x._key));}
function revealWork(key){const item=items().find(x=>x._key===key&&['todo','task'].includes(x.type));if(!item)return;workPeriod='all';$('hubWorkFilter').value='all';$('hubDoneFilter').value=item.done?'all':'open';focusedWorkKey=key;renderWork();navigate('work');const focus=()=>{if(panel!=='work'||focusedWorkKey!==key)return;const row=Array.from($('hubWorkRows').children).find(x=>x.dataset?.itemKey===key);if(!row)return;row.setAttribute('tabindex','-1');row.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});row.focus?.({preventScroll:true});};if(window.requestAnimationFrame)window.requestAnimationFrame(focus);else setTimeout(focus,0);}
function revealNewWork(syncOnly){const keys=syncOnly?new Set(syncNewWorkKeys):newWorkKeys;const target=K.workRows(items(),{},today()).find(x=>keys.has(x.stable_key));if(target)revealWork(target.stable_key);else status('追加・同期した作業は現在の一覧にありません。元の記録は保持しています。');}
const knownProjects=new Set(['TOSHI','CPG','TASK','Trip','GOLF','誕生日','Anniversary']);
function projectTag(item){const tag=node('span',item.project||'未分類','catbadge');if(knownProjects.has(item.project))tag.dataset.project=item.project;return tag;}
function itemRow(item){
 const row=node('article',undefined,'hub-row'+(item.done?' done':''));row.dataset.itemKey=item._key;if(newWorkKeys.has(item._key))row.className+=' new-work';if(item._key===focusedWorkKey)row.className+=' work-highlight';if(knownProjects.has(item.project))row.dataset.project=item.project;
 if(['todo','task'].includes(item.type)){const check=button(item.done?'✓':'○',()=>toggle(item),true);check.className='check';if(item.googleUnverified){check.disabled=true;check.dataset.unverified='true';}check.setAttribute('aria-label',(item.done?'未完了に戻す: ':'完了にする: ')+item.title);row.append(check);}
 else row.append(node('div',item.allDay?'終日':item.time||'時刻なし','hub-time'));
 const content=node('div',undefined,'hub-row-content');if(newWorkKeys.has(item._key))content.append(node('span',newWorkKeys.get(item._key)==='sync'?'同期で追加':'今回追加','hub-new-work-badge'));content.append(node('div',item.title||'(件名なし)','hub-title'));
 const timing=item.type==='todo'?'期限 '+(C.deadline(item)||'未設定')+(item.deadlineTime?' '+item.deadlineTime:'')+(C.workStart(item)&&C.workStart(item)!==C.deadline(item)?'｜開始 '+C.workStart(item):''):item.type==='task'?'期限なし'+(item.scheduledDate?'｜実施 '+item.scheduledDate:''):(item.time&&item.endTime?item.time+'〜'+item.endTime:'')+(item.endDate&&item.endDate!==item.date?'｜終了 '+item.endDate:'');
 const meta=node('div',undefined,'muted');meta.append(projectTag(item),node('span',' '+timing+(item.source==='google'?'｜Google':'｜端末')));content.append(meta);
 if(item.completionCorrection)content.append(node('p','本人確認で完了を補正。'+(item.completedDate?'実施日 '+item.completedDate:'実施日は不明のまま保持')+'。Google側は変更していません。','muted'));
 if(item.completionConflict)content.append(node('p','端末に残る過去の完了記録を保持しています。Googleの未完了表示と不一致です。実施日は補っていません。','diary-warning'));
 if(item.googleUnverified)content.append(node('p','今回のGoogle取得で未確認。削除・移動・アカウント変更の可能性があります。','diary-warning'));
 if(Array.isArray(item.metadataWarnings)&&item.metadataWarnings.length)content.append(node('p',item.metadataWarnings.filter(x=>typeof x==='string').join(' '),'diary-warning')); 
 const actions=node('div',undefined,'row-actions');
 if(item.source==='google'){if(/^https:\/\/(calendar\.google\.com|www\.google\.com\/calendar)(\/|\?|$)/.test(item.googleUrl||'')){const a=node('a','Googleで開く');a.href=item.googleUrl;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}}
 else{actions.append(button('編集',()=>openEditor(item),true));if(item.safeId&&['todo','task'].includes(item.type)&&(C.deadline(item)||item.scheduledDate))actions.append(button('Googleへ登録',()=>publish(item),true));}
 actions.append(button('一覧からどける',()=>archiveItem(item,true),true));content.append(actions);if(item._viewOrigin)content.append(node('div','確認用：'+item._viewOrigin,'muted'));row.append(content);return row;
}
function moneyViewRow(entry){const row=node('article',undefined,'hub-row cash-entry'+(entry.kind==='income'?' cash-income':entry.kind==='payment'?' cash-payment':'')+(entry.done?' done':'')),content=node('div',undefined,'hub-row-content');row.append(node('div',entry.time||'日付','hub-time'));content.append(node('span',entry.kind==='income'?'入金':entry.kind==='payment'?'出金':'区分要確認','cash-kind'),node('div',entry.title||'(件名なし)','hub-title'),node('div',(entry.date||'日付未確認')+'｜'+(entry.amount_label||K.amountLabel(entry.amount))+(entry.estimate?'｜見込':'')+(entry.done?'｜消込済み':''),'muted'));if(entry._viewOrigin)content.append(node('div','確認用：'+entry._viewOrigin,'muted'));row.append(content);return row;}
const unverified=x=>x.source==='google'&&x.googleUnverified===true;
function calendarRows(date,money=moneyItems()){const all=K.entries(items(),money,date);return {main:all.filter(x=>!unverified(x)),pending:all.filter(unverified)};}
function appendUnverified(container,rows){const pending=rows.filter(unverified);if(!pending.length)return;const box=node('details',undefined,'hub-unverified');box.append(node('summary','Google未確認の保存済み記録 '+pending.length+'件'),node('p','今回の取得で確認できなかった記録です。通常一覧と分けて保管しています。元の記録は削除していません。','muted'));for(const entry of pending)box.append(calendarEntry(entry));container.append(box);}
function calendarEntry(entry){if(entry.entry_kind==='money')return moneyViewRow(entry);const item=items().find(x=>x._key===entry.stable_key);return item?itemRow(item):node('p','記録の対応を確認できません','muted');}
function renderSelected(){return withViewData(buildSelected);}
function buildSelected(){const {main:rows,pending}=calendarRows(selected),container=$('hubSelectedRows');$('hubSelectedTitle').textContent=selected+' の予定';container.replaceChildren();if(!rows.length)container.append(node('p',pending.length?'未確認の保存済み記録があります。下の別枠から開けます。':'予定・入出金はありません','empty'));else rows.forEach(x=>container.append(calendarEntry(x)));appendUnverified(container,pending);}
function renderCalendar(){return withViewData(buildCalendar);}
function buildCalendar(){
 const container=$('hubCalendar'),mode=$('hubView').value==='week'?'week':'month',days=K.calendarDays(anchor,mode),money=moneyItems();container.replaceChildren();$('hubMonth').value=anchor.slice(0,7);$('hubYear').value=anchor.slice(0,4);$('hubMonthNumber').value=String(Number(anchor.slice(5,7)));
 $('calendar').className='panel '+(mode==='month'?'month-mode':'week-mode');$('hubMonthView').setAttribute('aria-pressed',String(mode==='month'));$('hubWeekView').setAttribute('aria-pressed',String(mode==='week'));$('hubToday').textContent=mode==='month'?'今月':'今日';
 $('hubPeriod').textContent=mode==='month'?Number(anchor.slice(0,4))+'年'+Number(anchor.slice(5,7))+'月':days[0]+' 〜 '+days[6];
 const holidayKnown=HubHolidays.isHoliday(anchor)!==null;$('hubHolidayNotice').textContent=holidayKnown?'':anchor.slice(0,4)+'年の祝日データは未収録です。';
 if(mode==='month'){
  const grid=node('div',undefined,'hub-grid cal');for(const label of ['日','月','火','水','木','金','土'])grid.append(node('div',label,'hub-weekday dow'));
  for(const date of days){const {main:entries,pending}=calendarRows(date,money),dow=new Date(date+'T12:00:00Z').getUTCDay(),holiday=HubHolidays.isHoliday(date)===true,cell=button('',()=>{selected=date;renderCalendar();});
   cell.className='hub-cell day month-day'+(date===today()?' today':'')+(date===selected?' month-selected':'')+(dow===0?' sun':dow===6?' sat':'')+(holiday?' holiday':'')+(date.slice(0,7)!==anchor.slice(0,7)?' muted-day':'');cell.setAttribute('aria-label',date+' '+entries.length+'件'+(pending.length?'｜未確認 '+pending.length+'件':'')+(holiday?' '+HubHolidays.name(date):''));cell.setAttribute('aria-pressed',String(date===selected));cell.append(node('span',String(Number(date.slice(-2))),'daynum month-date'));
   const group=node('span',undefined,'month-events');for(const entry of entries){const line=node('span',undefined,'month-event'+(entry.entry_kind==='money'?' month-money':'')+(entry.done?' month-done':''));if(knownProjects.has(entry.project))line.dataset.project=entry.project;line.append(node('span',entry.time_label||'','month-time'),node('span',(entry.title||'(件名なし)')+(entry.entry_kind==='money'?' '+entry.amount_label:''),'month-title'));group.append(line);}cell.append(group);if(pending.length)cell.append(node('span','未確認 '+pending.length+'件','month-unverified'));grid.append(cell);
  }container.append(grid);
 }else for(const date of days){const dow=new Date(date+'T12:00:00Z').getUTCDay(),holiday=HubHolidays.isHoliday(date)===true,day=node('div',undefined,'hub-day weekrow'+(date===today()?' today todayweek':'')+(dow===0?' sun':dow===6?' sat':'')+(holiday?' holiday':''));const choose=button(date+'（'+['日','月','火','水','木','金','土'][dow]+'）'+(holiday?' '+HubHolidays.name(date):''),()=>{selected=date;renderSelected();});choose.className='weekdate';day.append(choose);const {main:rows,pending}=calendarRows(date,money);if(!rows.length)day.append(node('div',pending.length?'未確認の保存済み記録あり':'予定なし','empty'));else rows.forEach(x=>day.append(calendarEntry(x)));appendUnverified(day,pending);container.append(day);}
 renderSelected();
}
function renderWork(){return withViewData(buildWork);}
function buildWork(){const container=$('hubWorkRows');container.replaceChildren();const rows=K.workRows(items(),{period:workPeriod,type:$('hubWorkFilter').value,done:$('hubDoneFilter').value},today());document.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.period===workPeriod)));$('hubWorkPeriodNotice').textContent=workPeriod==='week'?'今日から7日後までの明示された期限を表示します。':workPeriod==='none'?'期限なしのタスクと、期限がまだ明示されていないToDoです。':'';if(!rows.length)container.append(node('p','該当する作業はありません','empty'));rows.forEach(x=>container.append(itemRow(items().find(item=>item._key===x.stable_key)||x)));renderNewWorkNotice();}
function renderMoney(){if(globalThis.HubFeatures){HubFeatures.money();return;}const container=$('hubMoneyRows');container.replaceChildren();const rows=moneyItems().filter(x=>typeof x.date==='string'&&x.date.slice(0,7)===$('hubMoneyMonth').value);if(!rows.length)container.append(node('p','この月の保存済み入出金はありません','empty'));for(const x of rows){const row=node('article',undefined,'hub-row'+(x.done?' done':'')),content=node('div');content.append(node('div',x.title||'(件名なし)','hub-title'),node('div',(x.date||'')+'｜'+(x.kind==='income'?'入金':x.kind==='payment'?'出金':'区分要確認')+' '+K.amountLabel(x.amount)+'｜'+(x.done?'消込済み':'未消込'),'muted'));row.append(content);container.append(row);}}

function viewGoogleLink(container,item){if(item.source==='google'&&/^https:\/\/(calendar\.google\.com|www\.google\.com\/calendar)(\/|\?|$)/.test(item.googleUrl||'')){const a=node('a','Googleで開く');a.href=item.googleUrl;a.target='_blank';a.rel='noopener noreferrer';const actions=node('div',undefined,'row-actions');actions.append(a);container.append(actions);}}
const yen=value=>value===null?'要確認':'¥'+Number(value).toLocaleString('ja-JP');
function cashSummary(prefix,section){for(const [suffix,key]of [['Income','income'],['Payment','payment'],['Net','net']])$('home'+prefix+suffix).textContent=yen(section[key]);$('home'+prefix+'Notice').textContent=section.needsConfirmation?'金額・入出金区分を確認できない記録があります。集計は要確認です。':'';}
function cashRows(container,rows){container.replaceChildren();if(!rows.length){container.append(node('p','保存済みの未消込記録はありません','empty'));return;}for(const x of rows)container.append(moneyViewRow(x));}
function renderHome(){const h=HubHome.project(items(),moneyItems(),today());h.todayRows=h.todayRows.filter(x=>!unverified(x));h.todayCount=h.todayRows.length;$('homeTodayCount').textContent=h.todayCount+'件';$('homeWorkCount').textContent=h.incompleteWorkCount+'件';$('homeMoneyTitle').textContent=h.month.replace('-','年')+'月の未消込';cashSummary('Month',h.monthCash);cashSummary('Ahead',h.cashAhead);$('homeCashPeriod').textContent=h.cashAhead.startDate+' 〜 '+h.cashAhead.endDate;$('homeTodayRows').replaceChildren();if(h.todayRows.length)h.todayRows.forEach(x=>$('homeTodayRows').append(itemRow(x)));else $('homeTodayRows').append(node('p','今日の保存済み予定はありません','empty'));appendUnverified($('homeTodayRows'),calendarRows(today(),[]).pending);cashRows($('homeCashRows'),h.cashAhead.rows);$('homeNextCash').hidden=!h.nextCash.rows.length;cashRows($('homeNextRows'),h.nextCash.rows);$('homeDataNotice').textContent=h.invalidDateCount?'日付を確認できない入出金 '+h.invalidDateCount+'件は日付別集計に含めていません。元の記録は保持されています。':'';}
function renderGantt(){const model=HubGantt.model(items(),today(),$('hubGanttProject').value||'all'),table=$('hubGanttTable');table.replaceChildren();$('hubGanttPeriod').textContent=model.from+' 〜 '+model.to+'｜'+model.total+'件';$('hubGanttNotice').textContent=[model.hidden?'先頭20件を表示。残り'+model.hidden+'件は分類で絞り込んでください。':'',model.undated?'日付未設定 '+model.undated+'件は表示できません。':'',model.invalid?'日付要確認 '+model.invalid+'件は表示できません。':''].filter(Boolean).join(' ');$('hubGanttEmpty').hidden=!!model.rows.length;const head=node('thead'),headRow=node('tr'),nameHead=node('th','予定・ToDo');nameHead.setAttribute('scope','col');headRow.append(nameHead);for(const date of model.days){const th=node('th',Number(date.slice(5,7))+'/'+Number(date.slice(8)));th.setAttribute('scope','col');th.setAttribute('title',date);headRow.append(th);}head.append(headRow);table.append(head);const body=node('tbody');for(const entry of model.rows){const row=node('tr'),label=node('th');label.setAttribute('scope','row');label.append(node('div',entry.item.title||'(件名なし)'),node('div',(entry.item.project||'')+'｜'+entry.description,'muted'));if(entry.warning)label.append(node('div',entry.warning,'muted'));viewGoogleLink(label,entry.item);row.append(label);for(const cell of entry.cells){const td=node('td');td.setAttribute('aria-label',cell.date+(cell.active?(cell.deadline?' 期限':' 予定あり'):' 予定なし'));if(cell.active){const bar=node('div',undefined,'hub-gantt-bar');if(['TOSHI','CPG','TASK','Trip','GOLF','誕生日','Anniversary'].includes(entry.item.project))bar.dataset.project=entry.item.project;bar.dataset.deadline=String(cell.deadline);bar.setAttribute('aria-hidden','true');td.append(bar);}row.append(td);}body.append(row);}table.append(body);}
// Hidden panels are projected when opened, using the current verified records.
function render(){return withViewData(()=>{const draw={home:renderHome,calendar:renderCalendar,work:renderWork,money:renderMoney,gantt:renderGantt}[panel];if(draw)draw();renderNewWorkNotice();controls();if(globalThis.HubFeatures)window.dispatchEvent(new Event('hub-render'));});}
function navigate(name,record=true){if(!['home','calendar','work','gantt','diary','money','board','receipts'].includes(name))name='home';panel=name;$('hubQuickAdd').hidden=!ready||blocked||!identity?.ok||!['home','calendar','work','gantt'].includes(name);$('hubQuickAdd').setAttribute('aria-label',name==='work'?'作業を追加':'予定を追加');document.querySelectorAll('.panel').forEach(el=>el.hidden=el.id!==name||(name==='diary'&&!ready));$('diaryLocked').hidden=!(name==='diary'&&!ready);document.querySelectorAll('[data-panel]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.panel===name)));if(identity)render();if(globalThis.HubFeatures){$('featureArchiveCard').hidden=!['board','receipts'].includes(name);window.dispatchEvent(new Event('hub-panel'));}if(record&&location.hash!=='#'+name)history.pushState(null,'','#'+name);}
function fieldMode(){const type=$('hubType').value;$('hubEventFields').hidden=type!=='event';$('hubTodoFields').hidden=type!=='todo';$('hubDeadlineField').hidden=type!=='todo';$('hubScheduleField').hidden=type!=='task';$('hubDate').required=type==='event'&&(!editing||editing.type!=='event');$('hubDeadline').required=type==='todo'&&(!editing||editing.type!=='todo');$('hubEventTimes').hidden=$('hubAllDay').checked;}
const editorFields=['hubType','hubProject','hubTitle','hubDate','hubEndDate','hubAllDay','hubTime','hubEndTime','hubTodoStart','hubDeadline','hubDeadlineTime','hubScheduled'];
function editorState(){return Object.fromEntries(editorFields.map(id=>[id,id==='hubAllDay'?!!$(id).checked:$(id).value]));}
function editorValues(){return JSON.stringify(editorState());}
function openEditor(item=null,type='event'){checkWrite();editing=item;const x=item||{};$('hubForm').reset();$('hubEditorTitle').textContent=item?'編集':'追加';$('hubType').value=x.type||type;$('hubProject').value=x.project||(['todo','task'].includes(type)?'TASK':'TOSHI');$('hubTitle').value=x.title||'';$('hubDate').value=x.date||selected;$('hubEndDate').value=x.endDate||x.date||selected;$('hubTime').value=x.time||'';$('hubEndTime').value=x.endTime||'';$('hubAllDay').checked=x.allDay===true||(!item&&!x.time);$('hubTodoStart').value=C.workStart(x)||'';$('hubDeadline').value=C.deadline(x);$('hubDeadlineTime').value=x.deadlineTime||'';$('hubScheduled').value=x.scheduledDate||x.start||'';$('hubFormStatus').textContent='';$('hubEditNotice').textContent=item?'変更していない日付・時刻・関連情報は、そのまま保持します。':'';fieldMode();editorSnapshot=editorState();editorInitial=editorValues();$('hubEditor').showModal();}
function editorItem(){const fields=editorState(),type=fields.hubType,next={...(editing||{})},changed=id=>!editing||fields.hubType!==editing.type||fields[id]!==editorSnapshot[id];next.safeId=editing?.safeId||crypto.randomUUID();next.type=type;if(changed('hubTitle'))next.title=fields.hubTitle.trim();if(changed('hubProject'))next.project=fields.hubProject;if(!editing)next.done=false;
 if(type==='event'){for(const [id,key]of [['hubDate','date'],['hubEndDate','endDate'],['hubTime','time'],['hubEndTime','endTime'],['hubAllDay','allDay']])if(changed(id))next[key]=fields[id];if(changed('hubAllDay')&&fields.hubAllDay){next.time='';next.endTime='';}}
 if(type==='todo'){if(changed('hubTodoStart')){next.start=fields.hubTodoStart;next.scheduledDate=fields.hubTodoStart;}if(changed('hubDeadline')){next.deadlineDate=fields.hubDeadline;next.end=fields.hubDeadline;}if(changed('hubDeadlineTime'))next.deadlineTime=fields.hubDeadlineTime;}
 if(type==='task'&&changed('hubScheduled')){next.scheduledDate=fields.hubScheduled;next.start=fields.hubScheduled;}
 if(editing&&type!==editing.type){if(type!=='event'){next.date='';next.endDate='';next.time='';next.endTime='';next.allDay=false;}if(type!=='todo'){next.deadlineDate='';next.end='';next.deadlineTime='';}if(type==='event'){next.start='';next.scheduledDate='';}}
 delete next._key;return C.validateItem(next,editing||undefined);
}
function closeEditor(){if(editorValues()!==editorInitial&&!confirm('入力を閉じますか？未保存の内容は保存されません。'))return;$('hubEditor').close();}
async function toggle(item){checkWrite();if(item.googleUnverified)throw Error('Google側の最新状態を確認できないため、完了状態は変更できません。');if(busy)return;const done=!item.done;if(item.source==='google'){if(!confirm('Googleの作業「'+item.title+'」を'+(done?'完了':'未完了')+'にしますか？'))return;busy=true;controls();try{const result=await HubGoogle.complete(item,done);const pendingSave=commit('google-complete',next=>{const old=next.google.find(x=>C.key(x)===item._key);next.history.push({at:new Date().toISOString(),kind:'previous-google',value:old||item});next.google=next.google.filter(x=>C.key(x)!==item._key);next.google.push(result);delete next.edits[item._key];if(!done)next.edits[item._key]={completionDecision:'reopened'};});if(pendingSave)await pendingSave;status('Googleの最新の件名・分類を保ち、完了状態を照合しました。');}catch(error){status('Googleへの反映を確認できません：'+error.message+'。再同期して確認してください。');}finally{busy=false;controls();}return;}
 const pendingSave=commit('completion',next=>{next.history.push({at:new Date().toISOString(),kind:'previous-item',value:item});next.edits[item._key]={...next.edits[item._key],done,completedDate:done?today():'',completedAt:done?new Date().toISOString():''};});if(pendingSave)await pendingSave;status('端末の作業を'+(done?'完了':'未完了')+'にしました。');}
async function publish(item){checkWrite();if(busy)return;if(!confirm('この作業の件名・日付・完了状態を、接続するGoogleアカウントのTASKカレンダーへ登録しますか？'))return;busy=true;controls();try{const result=await HubGoogle.publish(item);const pendingSave=commit('google-publish',next=>{next.google=next.google.filter(x=>C.key(x)!==C.key(result));next.google.push(result);next.edits[item._key]={...next.edits[item._key],linkedGoogleKey:C.key(result)};});if(pendingSave)await pendingSave;status('GoogleのTASKカレンダーへの登録を読み取り確認しました。');}catch(error){status('Googleへの登録を確認できません：'+error.message+'。端末の記録は残っています。同じ行から再試行できます。');}finally{busy=false;controls();}}
async function verifyCalendarReadback(){const expected=JSON.stringify(overlay),pointer=overlayRaw,stored=localStorage.getItem(C.STORAGE);if(stored!==pointer)throw Error('予定の保存先の読み戻しが一致しません');const payload=globalThis.HubPersistence?await HubPersistence.load(stored):stored;if(payload!==expected)throw Error('予定の保存内容の読み戻しが一致しません');checkWrite();}
async function sync(){checkWrite();if(busy)return;const from=$('hubSyncFrom').value,to=$('hubSyncTo').value;if(!C.day(from)||!C.day(to)||from>to)throw Error('取得開始日と終了日を確認してください');const evidence={fetch:'not_attempted',save:'not_attempted',readback:'not_attempted',events:[]};busy=true;controls();$('hubSyncStatus').textContent='Googleカレンダーを読み込み中…';try{const result=await HubGoogle.read(from,C.addDays(to,1));evidence.fetch='success';evidence.events=result.rows.map(x=>({calendarId:x.googleCalendarId,eventId:x.googleId,...(x.googleVersion||{}),localOverride:false}));const pendingSave=commit('google-sync',next=>{const incomingByKey=new Map(result.rows.map(x=>[C.key(x),x]));for(const old of next.google){const incoming=incomingByKey.get(C.key(old));if(incoming&&JSON.stringify(old)!==JSON.stringify(incoming))next.history.push({at:new Date().toISOString(),kind:'previous-google',value:old});}const merged=C.mergeGoogle(legacy,next,result.rows,result.calendars,from,to);next.google=merged.google;next.edits=merged.edits;next.syncedAt=new Date().toISOString();next.syncRange={from,to};});if(pendingSave)await pendingSave;evidence.save='success';await verifyCalendarReadback();evidence.readback='success';evidence.verifiedAt=new Date().toISOString();for(const row of evidence.events)row.localOverride=!!Object.keys(overlay.edits['google:'+row.calendarId+':'+row.eventId]||{}).length;$('hubSyncStatus').textContent='同期完了：'+result.rows.length+'件｜'+new Date().toLocaleString('ja-JP')+'。取得範囲にない保存済み記録も保持しています。';}catch(error){if(evidence.fetch!=='success')evidence.fetch='failed';else if(evidence.save!=='success')evidence.save='failed';else evidence.readback='failed';$('hubSyncStatus').textContent='同期を完了できませんでした：'+error.message+'。保存済みの予定を保持しています。';}finally{busy=false;controls();}return {ok:evidence.readback==='success',message:$('hubSyncStatus').textContent,evidence};}
function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});if(blob.size>256*1024*1024)throw Error('256MBを超えるため自動保存できません。元データは保持しています。');const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function activate(remember){if(ready||blocked)return;if(remember){if(!verified)return;const current=await HubSafety.capture();if(!HubSafety.same(snapshot,current)){snapshot=current;verified=false;$('hubContinue').disabled=true;$('hubBackupSteps').hidden=false;throw Error('確認中にデータが更新されました。もう一度バックアップを保存してください。');}localStorage.setItem(marker,'1');}ready=true;$('hubGate').hidden=true;controls();navigate(panel,false);const script=node('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onerror=()=>status('Google認証を読み込めません。保存済みの記録は表示できます。');document.head.append(script);if(!diaryStarted){diaryStarted=true;document.dispatchEvent(new Event('diary-activate'));}status('');}
$('hubForm').onsubmit=async e=>{e.preventDefault();try{checkWrite();const x=editorItem();const pendingSave=commit('save-item',next=>{if(editing){next.history.push({at:new Date().toISOString(),kind:'previous-item',value:editing});next.edits[editing._key]={...next.edits[editing._key],...x};}else next.items.push(x);});if(pendingSave)await pendingSave;$('hubEditor').close();status('この端末に保存しました。Googleにはまだ送信していません。');if(!editing&&['todo','task'].includes(x.type))revealWork(C.key(x));}catch(error){$('hubFormStatus').textContent='保存できません：'+error.message;}};
$('hubType').onchange=fieldMode;$('hubAllDay').onchange=fieldMode;$('hubClose').onclick=closeEditor;$('hubEditor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});$('hubNewEvent').onclick=()=>openEditor(null,'event');$('hubNewWork').onclick=()=>openEditor(null,'todo');$('hubQuickAdd').onclick=()=>openEditor(null,panel==='work'?'todo':'event');
$('hubNewWorkJump').onclick=()=>revealNewWork(false);$('hubSyncNewWorkJump').onclick=()=>revealNewWork(true);
$('hubGanttProject').onchange=renderGantt;document.querySelectorAll('[data-period]').forEach(el=>el.onclick=()=>{workPeriod=el.dataset.period;renderWork();});document.querySelectorAll('[data-home-go]').forEach(el=>el.onclick=()=>navigate(el.dataset.homeGo));
for(const id of ['hubView','hubWorkFilter','hubDoneFilter','hubMoneyMonth'])$(id).onchange=render;$('hubMonth').onchange=()=>{if($('hubMonth').value){anchor=$('hubMonth').value+'-01';renderCalendar();}};
$('hubMonthView').onclick=()=>{$('hubView').value='month';renderCalendar();};$('hubWeekView').onclick=()=>{$('hubView').value='week';renderCalendar();};for(const id of ['hubYear','hubMonthNumber'])$(id).onchange=()=>{const key=$('hubYear').value+'-'+String($('hubMonthNumber').value).padStart(2,'0')+'-01';if(C.day(key)){anchor=selected=key;renderCalendar();}};
for(const [id,step]of [['hubPrev',-1],['hubNext',1]])$(id).onclick=()=>{if($('hubView').value==='month'){const date=new Date(anchor.slice(0,7)+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+step);anchor=date.toISOString().slice(0,10);}else anchor=C.addDays(anchor,step*7);renderCalendar();};$('hubToday').onclick=()=>{anchor=selected=today();renderCalendar();};$('hubSync').onclick=()=>sync().catch(error=>status(error.message));
document.querySelectorAll('[data-panel]').forEach(el=>el.onclick=()=>navigate(el.dataset.panel));window.addEventListener('popstate',()=>navigate(location.hash.slice(1),false));window.addEventListener('storage',e=>{if(e.key===C.LEGACY||e.key===C.STORAGE){blocked=true;controls();status('他のHUB画面でデータが変わりました。入力を控え、他の画面を閉じて再読み込みしてください。');}});
$('hubDownload').onclick=async()=>{try{$('hubDownload').disabled=true;verified=false;controls();snapshot=await HubSafety.capture();download(snapshot,'toshi-hub-safety-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');$('hubVerify').disabled=false;$('hubVerify').value='';$('hubSafetyStatus').textContent='保存したバックアップを選び、内容を確認してください。';}catch(error){$('hubSafetyStatus').textContent=error.message;}finally{$('hubDownload').disabled=false;}};
$('hubVerify').onchange=async e=>{verified=false;try{const file=e.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw Error('256MB以下のファイルを選んでください');const value=JSON.parse(await file.text());if(!HubSafety.same(snapshot,value))throw Error('いま保存したバックアップと一致しません');verified=true;$('hubSafetyStatus').textContent='バックアップの内容が一致しました。編集と同期を有効にできます。';}catch(error){$('hubSafetyStatus').textContent=error.message;}controls();};$('hubContinue').onclick=()=>activate(true).catch(error=>{$('hubSafetyStatus').textContent=error.message;});
globalThis.HubApp={syncCalendar:async()=>{if(busy||saving)return {ok:false,message:"予定・ToDoの処理中です。完了を待ってください"};return sync();},items,archiveItem,allItems:()=>renderingAllItems||identity?.displayItems||C.list(legacy,viewOverlay||overlay),money:moneyItems,overlay:()=>structuredClone(overlay),checkWrite,commit,navigate,openEditor,render,panel:()=>panel,assetReady:()=>ready&&localStorage.getItem(marker)==='1',canWrite:()=>ready&&!blocked&&!!identity?.ok&&!busy&&!saving};
if(globalThis.HubPersistence)HubPersistence.guardForm($('hubForm'));
(async()=>{try{const reading=read();if(reading)await reading;identity=await HubIdentity.inspect(legacyRaw,legacy,overlay);viewOverlay=identity.displayOverlay;$('hubIdentityStatus').hidden=identity.ok;$('hubIdentityStatus').textContent=identity.message||'';$('hubTodayLabel').textContent=new Date(today()+'T12:00:00Z').toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'long'});for(let year=1900;year<=new Date().getFullYear()+100;year++){const option=node('option',String(year));option.value=String(year);$('hubYear').append(option);}for(let month=1;month<=12;month++){const option=node('option',month+'月');option.value=String(month);$('hubMonthNumber').append(option);}$('hubMoneyMonth').value=today().slice(0,7);$('hubSyncFrom').value=localStorage.getItem('toshi_google_sync_from_v1')||'2020-01-01';$('hubSyncTo').value=C.addDays(today(),100);$('hubSyncStatus').textContent=overlay.syncedAt?'前回同期 '+new Date(overlay.syncedAt).toLocaleString('ja-JP'):'Google未接続。端末の保存済み予定を表示しています。';if(localStorage.getItem(marker)==='1'){panel=location.hash.slice(1)||'home';await activate(false);return;}navigate(location.hash.slice(1)||'home',false);snapshot=await HubSafety.capture();verified=!HubSafety.hasData(snapshot);$('hubBackupSteps').hidden=verified;$('hubSafetyStatus').textContent=verified?'このブラウザに既存のHUB記録はありません。編集と同期を有効にして始められます。':'保存済みデータを読み取り表示しています。編集・同期の前に安全バックアップを保存してください。';controls();}catch(error){blocked=true;controls();$('hubSafetyStatus').textContent='確認できません：'+error.message;}})();
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-recovery-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubRecovery=api;})(globalThis,function(){
 'use strict';
 const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const text=x=>typeof x==='string'&&!!x&&x.length<=1000;
 const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 function fields(x,allowed){if(!record(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('補正ファイルの形式を確認してください');}
 function plan(value,items,money,origin){
  fields(value,['format','version','sourceOrigin','basis','operations']);
  if(value.format!=='toshi-hub-status-correction'||value.version!==1||value.sourceOrigin!==origin||value.basis!=='user-confirmed'||!Array.isArray(value.operations)||!value.operations.length||value.operations.length>100)throw Error('このHUB用の本人確認済み補正ファイルを選んでください');
  const changes=[],skipped=[],seen=new Set();
  for(const op of value.operations){
   fields(op,['kind','target','expected','completedDate']);
   if(!['work','money'].includes(op.kind)||!record(op.expected)||!(op.completedDate===''||day(op.completedDate)))throw Error('項目の種類・実施日を確認してください');
   let matches;
   if(op.kind==='work'){
    fields(op.target,['googleCalendarId','googleId']);fields(op.expected,['title','date']);
    if(!text(op.target.googleCalendarId)||!text(op.target.googleId)||!text(op.expected.title)||!day(op.expected.date))throw Error('作業のID・件名・予定日を確認してください');
    matches=items.filter(x=>x.source==='google'&&x.googleCalendarId===op.target.googleCalendarId&&x.googleId===op.target.googleId);
   }else{
    fields(op.target,['importId']);fields(op.expected,['title','date','kind','amount']);
    if(!text(op.target.importId)||!text(op.expected.title)||!day(op.expected.date)||!['income','payment'].includes(op.expected.kind)||!Number.isSafeInteger(op.expected.amount)||op.expected.amount<0||!day(op.completedDate))throw Error('入出金の取込ID・件名・金額・消込日を確認してください');
    matches=money.filter(x=>x.importId===op.target.importId);
   }
   if(matches.length!==1)throw Error('対応する記録がないか複数あります。全項目の補正を停止しました');
   const row=matches[0];
   if(!text(row._key)||row.cancelled||op.kind==='work'&&!['todo','task'].includes(row.type))throw Error('対応する記録が作業ではないか、非表示です。全項目の補正を停止しました');
   if(Object.entries(op.expected).some(([k,v])=>row[k]!==v))throw Error('記録の件名・日付・金額が変わっています。全項目の補正を停止しました');
   const identity=JSON.stringify([op.kind,row._key]);if(seen.has(identity))throw Error('同じ記録が重複指定されています');seen.add(identity);
   const dateField=op.kind==='work'?'completedDate':'settledDate';
   if(row[dateField]&&row[dateField]!==op.completedDate)throw Error('既存の実施日・消込日と食い違います。上書きせず停止しました');
   if(op.kind==='work'&&row.completedAt&&!row.completedDate)throw Error('完了日時が残っています。実施日を確認してから補正してください');
   if(row.done===true&&(row[dateField]||'')===op.completedDate){skipped.push({kind:op.kind,before:row});continue;}
   changes.push({kind:op.kind,before:structuredClone(row),completedDate:op.completedDate});
  }
  return {changes,skipped};
 }
 function apply(next,plan,at){
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw Error('補正の更新日時を確認してください');
  for(const c of plan.changes){
   const old=c.before,key=old._key;
   next.history.push({kind:c.kind==='work'?'previous-item':'previous-money',at,value:structuredClone(old)});
   if(c.kind==='work')next.edits[key]={...next.edits[key],done:true,completedDate:c.completedDate,completedAt:old.completedAt||'',completionDecision:'restored',completionCorrection:{basis:'user-confirmed',recordedAt:at}};
   else next.moneyEdits[key]={...next.moneyEdits[key],done:true,settledDate:c.completedDate,settlementCorrection:{basis:'user-confirmed',recordedAt:at}};
  }
 }
 return {plan,apply};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-recovery.js */
try {
(function(){
 'use strict';
 const $=id=>document.getElementById(id),card=$('hubRecoveryCard');
 if(!card||!globalThis.HubRecovery||!globalThis.HubApp)return;
 let fileValue=null,preview=null,before='';
 const snapshot=()=>JSON.stringify([HubApp.allItems(),HubApp.money()]);
 function disable(){preview=null;$('hubRecoveryApply').disabled=true;$('hubRecoveryApply').dataset.unverified='true';}
 function status(message){$('hubRecoveryStatus').textContent=message;}
 function clear(){disable();fileValue=null;before='';$('hubRecoveryPreview').replaceChildren();}
 function prepare(value){
   HubApp.checkWrite();
   const result=HubRecovery.plan(value,HubApp.allItems(),HubApp.money(),location.origin);
   for(const c of result.changes){const line=document.createElement('p');line.textContent=c.before.title+' → '+(c.kind==='work'?'完了（実施日 '+(c.completedDate||'不明')+'）':'消込済み（'+c.completedDate+'）');$('hubRecoveryPreview').append(line);}
   fileValue=value;preview=result;before=snapshot();
   $('hubRecoveryApply').dataset.unverified=String(!result.changes.length);
   $('hubRecoveryApply').disabled=!result.changes.length||!HubApp.canWrite();
   status('補正 '+result.changes.length+'件、一致済み '+result.skipped.length+'件。まだ保存していません。Googleは変更しません。');
 }
 $('hubRecoveryFile').onchange=async e=>{
  clear();
  try{
   HubApp.checkWrite();const file=e.target.files[0];if(!file)return;
   if(file.size>1024*1024)throw Error('1MB以下の補正ファイルを選んでください');
   prepare(JSON.parse(await file.text()));
  }catch(e){disable();status(e.message);}
 };
 $('hubRecoveryText').addEventListener('input',()=>{clear();status('貼り付けた内容を確認してください。まだ保存していません。');});
 $('hubRecoveryPaste').onclick=()=>{
  clear();
  try{const text=$('hubRecoveryText').value;if(!text.trim()||text.length>100000)throw Error('補正内容を貼り付けてください（100,000文字以下）');prepare(JSON.parse(text));}
  catch(e){disable();status(e instanceof SyntaxError?'補正内容を最初から最後までコピーして貼り付けてください。':e.message);}
 };
 $('hubRecoveryApply').onclick=async()=>{
  try{
   HubApp.checkWrite();if(!preview||!preview.changes.length||snapshot()!==before)throw Error('記録が変わったか確認内容がありません。補正内容をもう一度確認してください');
   if(!confirm('表示した '+preview.changes.length+'件を本人確認による補正として端末へ保存しますか？Googleは変更しません。'))return;
   HubApp.checkWrite();if(snapshot()!==before)throw Error('確認中に記録が変わりました。選び直してください');
   const checked=HubRecovery.plan(fileValue,HubApp.allItems(),HubApp.money(),location.origin);
   const pending=HubApp.commit('user-confirmed-status-correction',next=>HubRecovery.apply(next,checked,new Date().toISOString()));
   if(pending)await pending;
   const check=HubRecovery.plan(fileValue,HubApp.allItems(),HubApp.money(),location.origin);
   if(check.changes.length)throw Error('保存の照合ができません。保存済み記録を確認してください');
   status(checked.changes.length+'件を端末へ保存し、状態を照合しました。Googleには未反映です。別端末へは自動共有されません。');disable();
  }catch(e){status(e.message);}
 };
 if(globalThis.HubPersistence){for(const [id,event]of [['hubRecoveryFile','onchange'],['hubRecoveryPaste','onclick'],['hubRecoveryApply','onclick']]){const guarded=HubPersistence.guardAction(card,$(id)[event]);$(id)[event]=async function(e){try{return await guarded.call(this,e);}finally{$('hubRecoveryApply').disabled=!preview?.changes.length||!HubApp.canWrite();}};}}
}());

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-sync-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubSyncCore=api;})(globalThis,function(){
 'use strict';
 function create(){
  let running=null;
  function run({jobs,authorize,onChange=()=>{},concurrent=false}){
   if(running)return running;
   const states=jobs.map(job=>({key:job.key,label:job.label,status:job.eligible?'waiting':'skipped',message:job.eligible?'待機中':job.reason}));
   const emit=()=>onChange(states.map(x=>({...x})));
   const execute=async()=>{
    emit();const eligible=jobs.filter(x=>x.eligible);
    if(!eligible.length)return states;
    let grant;
    try{grant=await authorize(eligible);}catch(error){for(const s of states)if(s.status==='waiting'){s.status='failed';s.message='Google接続未完了：'+error.message;}emit();return states;}
    const allowed=new Set(String(grant?.scope||'').split(/\s+/));
    const perform=async i=>{
     const job=jobs[i],s=states[i];if(!job.eligible)return;
     if(!job.scopes.every(scope=>allowed.has(scope))){s.status='failed';s.message='必要なGoogle接続を確認できません。端末の記録は保持しています';emit();return;}
     s.status='running';s.message='同期中…';emit();
     try{const result=await job.sync(grant);s.evidence=result?.evidence||null;s.status=result?.ok===true?'success':'failed';s.message=result?.message||(s.status==='success'?'同期完了':'同期を確認できません。記録は保持しています');}
     catch(error){s.status='failed';s.message='同期失敗・未確認：'+error.message;}
     emit();
    };
    if(concurrent)await Promise.all(jobs.map((_,i)=>perform(i)));else for(let i=0;i<jobs.length;i++)await perform(i);
    return states;
   };
   const current=execute();running=current;current.then(()=>{if(running===current)running=null},()=>{if(running===current)running=null});return current;
  }
  return {run,active:()=>!!running};
 }
 return {create};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-proof-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubProofCore=api;})(globalThis,function(){
 'use strict';
 const phase=x=>['success','failed','not_attempted'].includes(x)?x:'not_attempted';
 const text=(x,max=1024)=>typeof x==='string'&&x.length>0&&x.length<=max?x:null;
 const stamp=x=>text(x,40)&&Number.isFinite(Date.parse(x))?x:null;
 const version=x=>({etag:text(x?.etag),updated:stamp(x?.updated),sequence:Number.isSafeInteger(x?.sequence)&&x.sequence>=0?x.sequence:null});
 const canonical=x=>JSON.stringify(x===null||typeof x!=='object'?x:Array.isArray(x)?x.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])));
 function evidence(value,key){
  const v=value||{},fetch=phase(v.fetch),save=phase(v.save),readback=phase(v.readback);
  if(save==='success'&&fetch!=='success'||readback==='success'&&save!=='success')throw Error('Invalid verification phases');
  const result={fetch,save,readback,verifiedAt:stamp(v.verifiedAt)};
  if(readback==='success'&&!result.verifiedAt)throw Error('Missing readback time');
  if(key==='calendar'){
   result.events=(Array.isArray(v.events)?v.events:[]).map(x=>{
    const calendarId=text(x?.calendarId),eventId=text(x?.eventId);if(!calendarId||!eventId)throw Error('Missing event identity');
    return {calendarId,eventId,...version(x),localOverride:x.localOverride===true};
   });
   const keys=result.events.map(x=>JSON.stringify([x.calendarId,x.eventId]));if(new Set(keys).size!==keys.length)throw Error('Ambiguous event identity');
  }else{
   result.sheetId=text(v.sheetId);result.revisionIds=(Array.isArray(v.revisionIds)?v.revisionIds:[]).map(x=>{if(!text(x))throw Error('Missing revision identity');return x;});
   if(new Set(result.revisionIds).size!==result.revisionIds.length)throw Error('Ambiguous revision identity');
  }
  return result;
 }
 function make({attemptId,device,sequence,appVersion,startedAt,finishedAt,states}){
  if(!text(attemptId,100)||!text(device?.id,100)||!['Flip8','Fold8'].includes(device?.name)||!Number.isSafeInteger(sequence)||sequence<1||!text(appVersion,30)||!stamp(startedAt)||!stamp(finishedAt)||Date.parse(finishedAt)<Date.parse(startedAt))throw Error('Invalid attempt identity or time');
  const jobs=['calendar','diary'].map(key=>{
   const s=states?.find(x=>x.key===key),status=['success','failed','skipped'].includes(s?.status)?s.status:'failed';
   return {key,status,...evidence(s?.evidence??s,key)};
  });
  if(jobs.some(x=>x.verifiedAt&&(Date.parse(x.verifiedAt)<Date.parse(startedAt)||Date.parse(x.verifiedAt)>Date.parse(finishedAt))))throw Error('Readback time is outside the attempt');
  return {format:'papa-hub-sync-proof',version:1,attemptId,device:{id:device.id,name:device.name},sequence,appVersion,startedAt,finishedAt,jobs,
   localSaveVerified:jobs.every(x=>x.status==='success'&&x.fetch==='success'&&x.save==='success'&&x.readback==='success'),
   googleVersionComparison:'unconfirmed',screenConfirmation:'not_checked'};
 }
 function validate(value){
  const made=make({...value,states:value?.jobs});
  if(canonical(made)!==canonical(value))throw Error('Unexpected or inconsistent proof fields');return made;
 }
 // Missing independent versions never match, including null compared to null.
 function compare(record,{deviceId,notBefore,now,maxAgeMs=30*60*1000,events,revisions,sheetId}={}){
  const unknown=reason=>({status:'HUB未確認',reason,screen:'未確認'});let r;try{r=validate(record);}catch{return unknown('invalid_record');}
  if(!text(deviceId)||r.device.id!==deviceId)return unknown('different_device');
  if(!stamp(notBefore)||!stamp(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||Date.parse(r.startedAt)<Date.parse(notBefore)||Date.parse(r.finishedAt)>Date.parse(now)||Date.parse(now)-Date.parse(r.finishedAt)>maxAgeMs)return unknown('old_or_unverifiable_time');
  if(!r.localSaveVerified)return unknown('partial_or_failed');
  const calendar=r.jobs.find(x=>x.key==='calendar'),diary=r.jobs.find(x=>x.key==='diary');
  if(!Array.isArray(events)||!Array.isArray(revisions)||!text(sheetId)||sheetId!==diary.sheetId)return unknown('independent_source_missing');
  const index=new Map(calendar.events.map(x=>[JSON.stringify([x.calendarId,x.eventId]),x]));
  const seen=new Set();for(const event of events){const key=JSON.stringify([event?.calendarId,event?.eventId]),saved=index.get(key);
   if(seen.has(key)||!text(event?.calendarId)||!text(event?.eventId)||!text(event?.etag)||!text(saved?.etag)||saved.etag!==event.etag||saved.localOverride)return unknown('version_missing_changed_or_overridden');seen.add(key);
  }
  const local=new Set(diary.revisionIds);if(revisions.some(id=>!text(id)||!local.has(id)))return unknown('revision_missing');
  if(events.length===0&&revisions.length===0)return unknown('no_verification_target');
  return {status:'指定記録の端末保存を確認',reason:'independent_versions_match',at:r.finishedAt,screen:'未確認'};
 }
 return {make,validate,compare,evidence,canonical};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-proof-store.js */
try {
(function(root){
 'use strict';
 const NAME='papa_hub_sync_proof_v1';
 class ProofStore{
  constructor(idb=root.indexedDB){this.idb=idb;}
  async open(create=false){
   if(!create&&typeof this.idb.databases==='function'&&!(await this.idb.databases()).some(x=>x.name===NAME))return null;
   return new Promise((resolve,reject)=>{const q=this.idb.open(NAME,1);let absent=false;
    q.onupgradeneeded=()=>{if(!create){absent=true;q.transaction.abort();return;}for(const name of ['settings','attempts','delivery'])q.result.createObjectStore(name,{keyPath:'id'});};
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>absent?resolve(null):reject(q.error);q.onblocked=()=>reject(Error('確認記録の保存領域を開けません'));
   });
  }
  async transaction(names,mode,work,create=false){const db=await this.open(create);if(!db)return null;try{return await new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let value,error;
   const fail=e=>{error=e;tx.abort();};try{work(tx,x=>{value=x},fail);}catch(e){fail(e);}
   tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(error||tx.error||Error('確認記録を保存できません'));
  });}finally{db.close();}}
  async settings(){return await this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('device');q.onsuccess=()=>done(q.result||null);})||null;}
  async register(name){
   if(!['Flip8','Fold8'].includes(name))throw Error('この端末を選択してください');
   const row=await this.transaction(['settings'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('settings'),q=s.get('device');q.onsuccess=()=>{if(q.result){if(q.result.name!==name){fail(Error('登録済みの端末名は変更できません。別端末の記録と混在させません'));return;}done(q.result);return;}const value={id:'device',deviceId:crypto.randomUUID(),name,sequence:0};s.add(value);done(value);};},true);
   if(JSON.stringify(await this.settings())!==JSON.stringify(row))throw Error('端末登録の読み戻しを確認できません');return row;
  }
  async begin(appVersion){return this.transaction(['settings','attempts'],'readwrite',(tx,done)=>{const s=tx.objectStore('settings'),q=s.get('device');q.onsuccess=()=>{const device=q.result;if(!device){done(null);return;}device.sequence++;s.put(device);const attempt={id:crypto.randomUUID(),device:{id:device.deviceId,name:device.name},sequence:device.sequence,appVersion,startedAt:new Date().toISOString(),record:null};tx.objectStore('attempts').add(attempt);done(attempt);};});}
  async finish(attempt,states){const record=HubProofCore.make({attemptId:attempt.id,device:attempt.device,sequence:attempt.sequence,appVersion:attempt.appVersion,startedAt:attempt.startedAt,finishedAt:new Date().toISOString(),states});
   await this.transaction(['attempts'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('attempts'),q=s.get(attempt.id);q.onsuccess=()=>{const before=q.result;if(!before||before.device.id!==record.device.id||before.startedAt!==record.startedAt||before.sequence!==record.sequence){fail(Error('確認記録の対応が変わりました'));return;}if(before.record&&HubProofCore.canonical(before.record)!==HubProofCore.canonical(record)){fail(Error('確定済みの確認記録は変更しません'));return;}s.put({...before,record});done();};});
   const saved=await this.get(attempt.id);if(HubProofCore.canonical(saved?.record)!==HubProofCore.canonical(record))throw Error('確認記録の読み戻しが一致しません');return record;
  }
  async get(id){return this.transaction(['attempts'],'readonly',(tx,done)=>{const q=tx.objectStore('attempts').get(id);q.onsuccess=()=>done(q.result||null);});}
  async rows(){return await this.transaction(['attempts'],'readonly',(tx,done)=>{const q=tx.objectStore('attempts').getAll();q.onsuccess=()=>done(q.result.sort((a,b)=>b.sequence-a.sequence));})||[];}
  async testTarget(){return this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('flip8-test');q.onsuccess=()=>done(q.result||null);});}
  async reserveTest(attemptId){
   const value=await this.transaction(['settings','attempts'],'readwrite',(tx,done,fail)=>{
    const settings=tx.objectStore('settings'),d=settings.get('device');d.onsuccess=()=>{const device=d.result;if(device?.name!=='Flip8'){fail(Error('送信テストはFlip8だけで行います'));return;}
     const q=tx.objectStore('attempts').get(attemptId);q.onsuccess=()=>{const record=q.result?.record;try{HubProofCore.validate(record);}catch{fail(Error('確定した確認記録がありません'));return;}
      if(record.device.id!==device.deviceId||record.device.name!=='Flip8'||!record.localSaveVerified){fail(Error('このFlip8の保存確認済み記録を選んでください'));return;}
      const existing=settings.get('flip8-test');existing.onsuccess=()=>{if(existing.result){if(existing.result.attemptId!==attemptId||existing.result.deviceId!==device.deviceId){fail(Error('テストは選択済みの1件だけです。同じ記録から再試行してください'));return;}done(existing.result);return;}
       const target={id:'flip8-test',attemptId,deviceId:device.deviceId};settings.add(target);done(target);
      };
     };
    };
   });
   if(!value||JSON.stringify(await this.testTarget())!==JSON.stringify(value))throw Error('送信対象の読み戻しを確認できません');return value;
  }
  async continuous(){return this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('continuous');q.onsuccess=()=>done(q.result||null);});}
  async setContinuous(enabled,expectedDevice){
   const value=await this.transaction(['settings','delivery'],'readwrite',(tx,done,fail)=>{
    const s=tx.objectStore('settings'),q=s.get('device');q.onsuccess=()=>{const d=q.result;if(d?.name!=='Flip8'||d.deviceId!==expectedDevice){fail(Error('継続送信はこのFlip8だけで設定します'));return;}
     const save=()=>{const row={id:'continuous',version:1,deviceId:d.deviceId,enabled:enabled===true,afterSequence:d.sequence,changedAt:new Date().toISOString(),epoch:crypto.randomUUID()};s.put(row);done(row);};
     if(enabled!==true){save();return;}
     const t=s.get('flip8-test');t.onsuccess=()=>{if(t.result?.deviceId!==d.deviceId){fail(Error('先に1件の送信テストを確認してください'));return;}
      const sent=tx.objectStore('delivery').get(t.result.attemptId);sent.onsuccess=()=>{if(sent.result?.state!=='confirmed'){fail(Error('先に1件の送信テストを確認してください'));return;}save();};
     };
    };
   });
   if(JSON.stringify(await this.continuous())!==JSON.stringify(value))throw Error('継続送信の設定を読み戻せません');return value;
  }
  async delivery(id,patch){return this.transaction(['delivery'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('delivery'),q=s.get(id);q.onsuccess=()=>{if(q.result?.fileId&&patch.fileId&&q.result.fileId!==patch.fileId){fail(Error('送信先の予約IDは変更しません'));return;}const value={...(q.result||{id}),...patch,id};s.put(value);done(value);};});}
  async reserveFile(id,candidate){return this.transaction(['delivery'],'readwrite',(tx,done)=>{const s=tx.objectStore('delivery'),q=s.get(id);q.onsuccess=()=>{if(q.result?.fileId){done(q.result.fileId);return;}s.put({...(q.result||{id}),fileId:candidate,state:'pending'});done(candidate);};});}
  async deliveryState(id){return this.transaction(['delivery'],'readonly',(tx,done)=>{const q=tx.objectStore('delivery').get(id);q.onsuccess=()=>done(q.result||null);});}
 }
 root.HubProofStore=ProofStore;
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-proof-drive.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubProofDrive=api;})(globalThis,function(){
 'use strict';
 const SCOPE='https://www.googleapis.com/auth/drive.file',FOLDER='PAPA HUB 同期確認',TAG='papa-hub-sync-proof-v1';
 const CODES=new Set(['TRANSMISSION_NOT_APPROVED','DIFFERENT_DEVICE','FLIP8_TEST_ONLY','DRIVE_AUTH_REQUIRED','DRIVE_NETWORK_UNCONFIRMED','DRIVE_HTTP_ERROR','DRIVE_RESPONSE_INVALID','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE','GOOGLE_AUTH_UNAVAILABLE','GOOGLE_POPUP_BLOCKED','GOOGLE_POPUP_CLOSED','GOOGLE_AUTH_FAILED','GOOGLE_ACCESS_DENIED','GOOGLE_INVALID_SCOPE','GOOGLE_AUTH_RESPONSE_INVALID']);
 const STAGES={LOCAL:'端末内の確認',AUTH:'Google接続',FOLDER_SEARCH:'保存先の検索',FOLDER_ID:'保存先の準備',FOLDER_READ:'保存先の確認',FOLDER_CREATE:'保存先の作成',FOLDER_VERIFY:'保存先の非公開確認',RECORD_ID:'確認記録の準備',RECORD_READ:'確認記録の照合',RECORD_UPLOAD:'確認記録の送信',RECORD_VERIFY:'送信後の読み戻し',DRIVE:'Driveへの接続'};
 const REASONS=new Set(['SERVICE_DISABLED','accessNotConfigured','insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT','PERMISSION_DENIED','forbidden','appNotAuthorizedToFile','rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','storageQuotaExceeded','quotaExceeded','badRequest','invalid','notFound','authError']);
 function diagnostic(error,fallback='DRIVE'){
  return {code:CODES.has(error?.code)?error.code:'UNCONFIRMED',stage:Object.hasOwn(STAGES,error?.stage)?error.stage:Object.hasOwn(STAGES,fallback)?fallback:'DRIVE',status:Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:null,reason:REASONS.has(error?.reason)?error.reason:null};
 }
 function describe(error,fallback){
  const d=diagnostic(error,fallback);let message='送信テストを完了したか確認できません。';
  if(d.reason==='SERVICE_DISABLED'||d.reason==='accessNotConfigured')message='Google側でDrive APIが有効になっていません。接続設定の確認が必要です。';
  else if(['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(d.reason)||d.code==='DRIVE_AUTH_REQUIRED')message='確認記録を保存するためのGoogle権限を確認できません。';
  else if(d.code==='GOOGLE_POPUP_BLOCKED')message='Googleの接続画面がブラウザに止められました。';
  else if(d.code==='GOOGLE_POPUP_CLOSED')message='Googleの接続画面が閉じられ、接続を完了できませんでした。';
  else if(d.code==='GOOGLE_ACCESS_DENIED')message='Googleの接続が許可されていません。';
  else if(d.code==='GOOGLE_AUTH_UNAVAILABLE')message='Googleの認証機能を読み込めていません。';
  else if(d.code==='GOOGLE_INVALID_SCOPE')message='Googleの権限要求が受け付けられませんでした。接続設定の確認が必要です。';
  else if(d.code==='FOLDER_NOT_PRIVATE')message='本人だけの非公開フォルダと確認できません。';
  else if(d.code==='FOLDER_AMBIGUOUS')message='専用フォルダが複数あるため、保存先を確定できません。';
  else if(d.code==='DRIVE_NETWORK_UNCONFIRMED')message='Driveとの通信を確認できません。';
  else if(d.status===403)message='Google側でこの操作が許可されませんでした。';
  else if(d.status===401)message='Google接続の有効期限を確認できません。';
  return {diagnostic:d,message,detail:'止まった段階：'+STAGES[d.stage]+'。確認コード：'+[d.stage,d.code,d.status?'HTTP'+d.status:null,d.reason].filter(Boolean).join(' / ')};
 }
 async function responseReason(response){
  // Only provider enums are retained. Never expose raw messages, request URLs,
  // resource names, tokens, stack traces or arbitrary response fields.
  try{const value=await response.json(),error=value?.error;
   const reasons=[...(Array.isArray(error?.details)?error.details.slice(0,20).map(x=>x?.reason):[]),...(Array.isArray(error?.errors)?error.errors.slice(0,20).map(x=>x?.reason):[]),error?.status];
   return reasons.find(x=>REASONS.has(x))||null;
  }catch{return null;}
 }
 function create({approved,authorize,store,core,fetch:request=globalThis.fetch,beforeRequest=async()=>true}){
  const running=new Map();
  const failure=(code,status,stage,reason)=>Object.assign(Error(code),{code,status,stage,reason});
  function send(record){
   // Approval is checked before auth, database changes or any network request.
   if(approved()!==true)return Promise.reject(failure('TRANSMISSION_NOT_APPROVED'));
   core.validate(record);if(running.has(record.attemptId))return running.get(record.attemptId);
   const work=execute(record);running.set(record.attemptId,work);work.finally(()=>running.delete(record.attemptId)).catch(()=>{});return work;
  }
  async function session(){
   if(approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
   let grant;try{grant=await authorize();}catch(error){throw failure(CODES.has(error?.code)?error.code:'GOOGLE_AUTH_FAILED',undefined,'AUTH');}
   if(typeof grant?.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes(SCOPE))throw failure('DRIVE_AUTH_REQUIRED',undefined,'AUTH');
   const api=async(path,options={},stage='DRIVE')=>{
    if(approved()!==true||await beforeRequest()!==true||approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
    try{let r;try{r=await request('https://www.googleapis.com/'+path,{...options,cache:'no-store',signal:c.signal,headers:{...options.headers,Authorization:'Bearer '+grant.access_token}});}catch{throw failure('DRIVE_NETWORK_UNCONFIRMED',undefined,stage);}
     if(!r.ok)throw failure('DRIVE_HTTP_ERROR',r.status,stage,await responseReason(r));try{return await r.json();}catch{throw failure('DRIVE_RESPONSE_INVALID',undefined,stage);}
    }finally{clearTimeout(timer);}
   };
   return api;
  }
  const privateFile=(f,type)=>!!f&&f.mimeType===type&&f.ownedByMe===true&&f.shared===false&&f.trashed!==true&&Array.isArray(f.permissions)&&f.permissions.length===1&&f.permissions[0].type==='user'&&f.permissions[0].role==='owner';
  const fields='id,name,mimeType,ownedByMe,shared,trashed,permissions(type,role),parents,appProperties';
  async function discover(api){
   const matches=[];let page='';do{const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='papaHubProof' and value='"+TAG+"' }";
    const list=await api('drive/v3/files?'+new URLSearchParams({q,spaces:'drive',fields:'nextPageToken,files(id)',pageSize:'100',...(page?{pageToken:page}:{})}),{},'FOLDER_SEARCH');matches.push(...(list.files||[]));page=list.nextPageToken||'';
   }while(page);
   if(matches.length>1)throw failure('FOLDER_AMBIGUOUS',undefined,'FOLDER_SEARCH');return matches[0]?.id||null;
  }
  async function setup(){
   if(approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
   const device=await store.settings();if(device?.name!=='Flip8')throw failure('FLIP8_TEST_ONLY');
   const api=await session();let folder=(await store.deliveryState('folder'))?.fileId;
   if(!folder){const found=await discover(api);let candidate=found;
    if(!candidate){const generated=await api('drive/v3/files/generateIds?count=1&space=drive&type=files',{},'FOLDER_ID');candidate=generated.ids?.[0];if(typeof candidate!=='string'||!candidate)throw failure('FILE_ID_MISSING',undefined,'FOLDER_ID');}
    folder=await store.reserveFile('folder',candidate);
   }
   if(typeof folder!=='string'||!folder)throw failure('FOLDER_INVALID');
   const read=()=>api('drive/v3/files/'+encodeURIComponent(folder)+'?fields='+encodeURIComponent(fields),{},'FOLDER_READ');let fm;
   try{fm=await read();}catch(e){if(e.status!==404)throw e;
    // Only this explicit setup step may create a folder. A pre-reserved ID
    // makes uncertain completion/retries and concurrent tabs idempotent.
    try{await api('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:folder,name:FOLDER,mimeType:'application/vnd.google-apps.folder',parents:['root'],appProperties:{papaHubProof:TAG}})},'FOLDER_CREATE');}catch(error){if(error.status!==409)throw error;}
    fm=await read();
   }
   if(fm.id!==folder||fm.name!==FOLDER||!privateFile(fm,'application/vnd.google-apps.folder')||fm.appProperties?.papaHubProof!==TAG)throw failure('FOLDER_NOT_PRIVATE',undefined,'FOLDER_VERIFY');
   await store.delivery('folder',{fileId:folder,state:'confirmed'});if((await store.deliveryState('folder'))?.fileId!==folder)throw failure('LOCAL_DELIVERY_READBACK_FAILED');
   return {ok:true,folderId:folder};
  }
  async function execute(record){
   const device=await store.settings();if(device?.deviceId!==record.device.id)throw failure('DIFFERENT_DEVICE');
   const api=await session();
   const meta=(id,stage)=>api('drive/v3/files/'+encodeURIComponent(id)+'?fields='+encodeURIComponent(fields),{},stage);
   try{
    let folder=(await store.deliveryState('folder'))?.fileId;
    if(!folder){folder=await discover(api);
     // Folder setup is a separate, explicitly approved, single-device step.
     // A retry never creates a destination implicitly (including across devices).
     if(!folder)throw failure('FOLDER_NOT_CONFIGURED');
    }
    if(typeof folder!=='string'||!folder)throw failure('FOLDER_INVALID');
    const fm=await meta(folder,'FOLDER_READ');if(!privateFile(fm,'application/vnd.google-apps.folder')||fm.appProperties?.papaHubProof!==TAG)throw failure('FOLDER_NOT_PRIVATE',undefined,'FOLDER_VERIFY');await store.delivery('folder',{fileId:folder});
    let delivery=await store.deliveryState(record.attemptId),id=delivery?.fileId;
    if(!id){const generated=await api('drive/v3/files/generateIds?count=1&space=drive&type=files',{},'RECORD_ID');const candidate=generated.ids?.[0];if(typeof candidate!=='string'||!candidate)throw failure('FILE_ID_MISSING',undefined,'RECORD_ID');id=await store.reserveFile(record.attemptId,candidate);if((await store.deliveryState(record.attemptId))?.fileId!==id)throw failure('LOCAL_DELIVERY_READBACK_FAILED',undefined,'LOCAL');}
    async function existing(){try{const m=await meta(id,'RECORD_READ');if(!privateFile(m,'application/json')||!m.parents?.includes(folder)||m.appProperties?.attemptId!==record.attemptId||m.appProperties?.deviceId!==record.device.id||m.appProperties?.papaHubProof!==TAG)throw failure('REMOTE_RECORD_IDENTITY_MISMATCH',undefined,'RECORD_READ');const actual=await api('drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{},'RECORD_VERIFY');core.validate(actual);if(core.canonical(actual)!==core.canonical(record))throw failure('REMOTE_RECORD_READBACK_MISMATCH',undefined,'RECORD_VERIFY');return true;}catch(e){if(e.status===404)return false;throw e;}}
    if(!await existing()){
     const boundary='papa_hub_'+crypto.randomUUID(),metadata={id,name:'PAPA-HUB-'+record.device.name+'-'+record.attemptId+'.json',mimeType:'application/json',parents:[folder],appProperties:{papaHubProof:TAG,attemptId:record.attemptId,deviceId:record.device.id}};
     const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(record)+'\r\n--'+boundary+'--\r\n';
     if(new TextEncoder().encode(body).length>4*1024*1024)throw failure('RECORD_TOO_LARGE');
     try{await api('upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body},'RECORD_UPLOAD');}catch(e){if(e.status!==409)throw e;}
     if(!await existing())throw failure('REMOTE_RECORD_NOT_FOUND');
    }
    await store.delivery(record.attemptId,{fileId:id,state:'confirmed',confirmedAt:new Date().toISOString(),errorCode:null});
    return {ok:true,fileId:id};
   }catch(e){await store.delivery(record.attemptId,{state:'pending',errorCode:['TRANSMISSION_NOT_APPROVED','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE'].includes(e.code)?e.code:'DRIVE_SEND_UNCONFIRMED'}).catch(()=>{});throw e;}
  }
  return {send,setup};
 }
 return {SCOPE,FOLDER,create,diagnostic,describe};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-proof-continuous.js */
try {
(function(){
 'use strict';
 const store=new HubProofStore(),$=id=>document.getElementById(id);
 let policy=null,device=null,enabling=false,reviewed=null,stopped=false;
 const runs=new Map();
 function valid(p,d){return p?.version===1&&p.enabled===true&&p.deviceId===d?.deviceId&&d.name==='Flip8'&&Number.isSafeInteger(p.afterSequence)&&p.afterSequence>=0&&typeof p.epoch==='string'&&p.epoch.length>0;}
 const enabled=()=>!stopped&&valid(policy,device);
 async function load(){const [p,d]=await Promise.all([store.continuous(),store.settings()]);policy=p;device=d;return enabled();}
 function controls(){const ok=$('hubProofContinuousAgree').checked&&!enabling&&!!reviewed&&HubApp.canWrite();$('hubProofContinuousEnable').disabled=!ok;$('hubProofContinuousEnable').dataset.unverified=String(!ok);$('hubProofContinuousCancel').disabled=enabling;$('hubProofContinuousAgree').disabled=enabling;}
 async function refresh(){
  if(!HubApp.assetReady())return;
  try{await load();const target=await store.testTarget(),sent=target&&await store.deliveryState(target.attemptId),canReview=device?.name==='Flip8'&&target?.deviceId===device.deviceId&&sent?.state==='confirmed';
   $('hubProofContinuousState').textContent=enabled()?'このFlip8の継続送信：ON。次のまとめ同期から送信します。ナミの読取り・Google最新版との一致・画面表示は別確認です。':'継続送信：OFF。Flip8の1件の送信テストとナミの読取り確認後に設定できます。';
   for(const [id,allow] of [['hubProofContinuousReview',canReview&&!enabled()&&!enabling],['hubProofContinuousOff',enabled()]]){const b=$(id);b.disabled=!allow||!HubApp.canWrite();b.dataset.unverified=String(!allow);}
   document.querySelector('#hubProofSettings > summary').textContent='端末別の同期確認記録（自動送信'+(enabled()?'ON：Flip8':'OFF')+'）';
  }catch{policy=null;$('hubProofContinuousState').textContent='継続送信の設定を確認できないため送信しません。';}
 }
 async function permitted(epoch){if(stopped||!HubApp.canWrite()||!HubApp.assetReady())return false;const [p,d]=await Promise.all([store.continuous(),store.settings()]);return valid(p,d)&&p.epoch===epoch;}
 async function send(record,{interactive=false}={}){
  if(runs.has(record.attemptId))return runs.get(record.attemptId);
  const run=(async()=>{
   try{
    HubProofCore.validate(record);if(!await load()||record.device.id!==device.deviceId||record.device.name!=='Flip8'||record.sequence<=policy.afterSequence)return {ok:false};
    const epoch=policy.epoch;if(!await permitted(epoch))return {ok:false};
    const row=await store.get(record.attemptId);if(HubProofCore.canonical(row?.record)!==HubProofCore.canonical(record))throw Error('LOCAL_RECORD_CHANGED');
    const transport=HubProofDrive.create({approved:()=>enabled()&&policy.epoch===epoch&&HubApp.canWrite(),beforeRequest:()=>permitted(epoch),authorize:()=>interactive?HubGoogle.connectForProof():HubGoogle.currentProofGrant(),store,core:HubProofCore});
    const result=await transport.send(record);$('hubProofStatus').textContent='同期番号 '+record.sequence+' の確認記録をDriveに保存し、読み戻しを確認しました。ナミの読取り・Google最新版との一致・画面表示は未確認です。';return result;
   }catch(error){
    const problem=HubProofDrive.describe(error,'LOCAL');$('hubProofStatus').textContent='同期番号 '+record.sequence+' の記録送信は未確認です。'+problem.message+' '+problem.detail+'。確認記録は端末に保持しています。再送できます。';return {ok:false};
   }
  })();runs.set(record.attemptId,run);run.finally(()=>{runs.delete(record.attemptId);void globalThis.HubProof?.refresh();});return run;
 }
 function decorate(box,row,delivery){
  if(!enabled()||!row.record||row.device?.id!==device.deviceId||row.sequence<=policy.afterSequence||delivery?.state==='confirmed')return;
  const button=document.createElement('button');button.type='button';button.textContent='この確認記録を再送';button.dataset.proofRetry=row.id;button.dataset.write='';button.disabled=!HubApp.canWrite()||runs.has(row.id);button.dataset.unverified=String(runs.has(row.id));button.onclick=()=>send(row.record,{interactive:true});box.append(button);
 }
 $('hubProofContinuousReview').onclick=async()=>{try{HubApp.checkWrite();await load();const t=await store.testTarget(),r=t&&await store.get(t.attemptId),sent=t&&await store.deliveryState(t.attemptId);if(device?.name!=='Flip8'||r?.record?.device.id!==device.deviceId||sent?.state!=='confirmed')throw Error('TEST_REQUIRED');reviewed={deviceId:device.deviceId,record:HubProofCore.validate(r.record)};$('hubProofContinuousAgree').checked=false;$('hubProofContinuousStatus').textContent='まだ継続送信はONになっていません。';controls();$('hubProofContinuousDialog').showModal();}catch{$('hubProofContinuousState').textContent='先にこのFlip8の1件の送信テストを確認してください。';}};
 $('hubProofContinuousForm').onsubmit=async e=>{
  e.preventDefault();if(enabling||!reviewed||!$('hubProofContinuousAgree').checked)return;
  const consent=reviewed;enabling=true;controls();
  try{HubApp.checkWrite();const d=await store.settings();if(d?.deviceId!==consent.deviceId||d.name!=='Flip8')throw Error('DIFFERENT_DEVICE');
   // Verify the existing private destination and original test again. This
   // activation never creates a folder, new proof or broader permission.
   const transport=HubProofDrive.create({approved:()=>enabling&&HubApp.canWrite(),authorize:()=>HubGoogle.connectForProof(),store,core:HubProofCore});
   const result=await transport.send(consent.record);if(!result.ok)throw Error('TEST_UNCONFIRMED');HubApp.checkWrite();stopped=false;await store.setContinuous(true,consent.deviceId);await load();
   $('hubProofContinuousStatus').textContent='このFlip8の継続送信をONにしました。これからのまとめ同期で作る記録が対象です。過去分は自動送信しません。';reviewed=null;
  }catch(error){const p=HubProofDrive.describe(error,'LOCAL');$('hubProofContinuousStatus').textContent='継続送信の有効化は未確認です。'+p.message+' '+p.detail;}
  finally{enabling=false;$('hubProofContinuousAgree').checked=false;controls();await globalThis.HubProof?.refresh();}
 };
 $('hubProofContinuousAgree').onchange=controls;
 $('hubProofContinuousCancel').onclick=()=>{if(!enabling){reviewed=null;$('hubProofContinuousDialog').close();}};
 $('hubProofContinuousDialog').addEventListener('cancel',e=>{if(enabling)e.preventDefault();else reviewed=null;});
 $('hubProofContinuousOff').onclick=async()=>{stopped=true;try{HubApp.checkWrite();const d=await store.settings();await store.setContinuous(false,d?.deviceId);$('hubProofStatus').textContent='このFlip8の継続送信をOFFにしました。すでに送信した記録と端末データは保持しています。';}catch{$('hubProofStatus').textContent='この画面からの送信を止めました。OFF設定の保存は未確認です。';}await globalThis.HubProof?.refresh();};
 globalThis.HubProofContinuous={load,refresh,send,decorate,enabled};
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-proof.js */
try {
(function(){
 'use strict';
 const VERSION='1.2.21',store=new HubProofStore(),$=id=>document.getElementById(id);
 // Consent stays in memory for one explicitly selected Flip8 record only.
 // No persisted setting, restored backup or ordinary sync enables delivery.
 let selected=null,activeConsent=null,transport=null,sending=false,refreshSerial=0;
 const message=s=>{$('hubProofStatus').textContent=s;};
 const fileUrl=id=>'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';
 function permitted(){if(!activeConsent)return false;try{HubApp.checkWrite();return true;}catch{return false;}}
 function testControls(){const disabled=sending||!selected||!$('hubProofTestAgree').checked||!HubApp.canWrite();$('hubProofTestSend').disabled=disabled;$('hubProofTestSend').dataset.unverified=String(disabled);$('hubProofTestCancel').disabled=sending;$('hubProofTestAgree').disabled=sending;}
 async function refresh(){
  const serial=++refreshSerial;
  if(!HubApp.assetReady()){message('端末の安全確認を終えてから登録できます。自動送信はOFFです。');return;}
  try{await HubProofContinuous.refresh();const device=await store.settings(),target=await store.testTarget();$('hubProofDeviceStatus').textContent=device?'この端末：'+device.name+'｜識別番号 '+device.deviceId:'この端末は未登録です。Flip8とFold8はそれぞれの端末で登録してください。';
   $('hubProofDevice').disabled=!!device||!HubApp.canWrite();if(device)$('hubProofDevice').value=device.name;
   const rows=await store.rows(),shown=rows.slice(0,5),pinned=rows.find(r=>r.id===target?.attemptId);if(pinned&&!shown.includes(pinned))shown.push(pinned);
   if(HubProofContinuous.enabled()){const policy=await store.continuous();for(const row of rows){if(row.record&&row.device.id===policy.deviceId&&row.sequence>policy.afterSequence&&!shown.includes(row)&&(await store.deliveryState(row.id))?.state!=='confirmed')shown.push(row);}}
   const container=document.createDocumentFragment();for(const row of shown){
    const box=document.createElement('article'),label=document.createElement('p');let record;try{record=row.record&&HubProofCore.validate(row.record);}catch{}
    label.textContent=row.device.name+'｜同期番号 '+row.sequence+'｜'+row.startedAt+'｜'+(!record?'途中終了または確認記録未確定':record.localSaveVerified?'端末への保存・読み戻し確認済み':'保存未確認・部分失敗');box.append(label);
    const delivery=await store.deliveryState(row.id),confirmed=delivery?.state==='confirmed',state=document.createElement('p');state.textContent='Google版との独立照合：HUB未確認／画面表示：未確認／自動送信：'+(HubProofContinuous.enabled()?'ON：Flip8':'OFF')+'／Driveへの記録保存：'+(confirmed?'保存・読み戻し確認済み':delivery?.state==='pending'?'未確認・同じ記録で再試行できます':'未送信')+'／ナミの読取り：未確認';box.append(state);
    if(record){const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='確認記録の内容';pre.textContent=JSON.stringify(record,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);box.append(detail);
     if(device?.name==='Flip8'&&record.device.id===device.deviceId&&record.localSaveVerified&&(!target||target.attemptId===row.id)&&!confirmed){
      const button=document.createElement('button');button.type='button';button.textContent=target?'同じ1件の送信テストを確認':'この1件の送信テストを確認';button.dataset.proofTest=row.id;button.dataset.write='';button.dataset.unverified=String(sending);button.disabled=sending||!HubApp.canWrite();button.onclick=()=>prepareTest(row.id).catch(()=>message('送信対象を確認できません。予定・ダイアリーは保持しています。'));box.append(button);
     }
     if(confirmed&&delivery.fileId){const link=document.createElement('a');link.href=fileUrl(delivery.fileId);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Driveの確認記録を開く';box.append(link);
      const hint=document.createElement('p');hint.textContent='ナミには下の内容をコピーして伝えてください。ナミが実際に読めたかは別に確認します。';box.append(hint);
      const note=document.createElement('textarea');note.readOnly=true;note.rows=6;note.setAttribute('aria-label','ナミへ伝える確認記録');note.value=record.device.name+'（識別番号 '+record.device.id+'）の同期番号 '+record.sequence+' の確認記録を読めるか確認してください。同期開始：'+record.startedAt+'。\n'+fileUrl(delivery.fileId)+'\nGoogle最新版との一致・画面表示は未確認。自動送信は'+(HubProofContinuous.enabled()?'このFlip8のみONです。':'OFFです。');box.append(note);
     }
    }HubProofContinuous.decorate(box,row,delivery);container.append(box);
   }
   if(device?.name==='Fold8'){const info=document.createElement('p');info.textContent='今回はFlip8の1件だけを送信テストします。Fold8は自動送信OFFのまま、ナミの読取り確認後に進めます。';container.append(info);}
   if(serial===refreshSerial)$('hubProofRows').replaceChildren(container);
  }catch{message('確認記録の保存領域を読み取れません。予定・ダイアリーの記録は保持しています。');}
 }
 async function begin(){try{if(!HubApp.assetReady())return null;await HubProofContinuous.load();const attempt=await store.begin(VERSION);if(!attempt)message('この端末が未登録のため確認記録は作成しません。自動送信はOFFです。');return attempt;}catch{message('確認記録の作成を開始できません。通常の同期結果とは別に、HUB未確認として扱います。');return null;}}
 async function finish(attempt,states){if(!attempt)return;try{const record=await store.finish(attempt,states);message((record.localSaveVerified?'端末への保存・読み戻しを確認しました。':'保存未確認または部分失敗の記録を残しました。')+' Google版との独立照合・画面表示は未確認です。');if($('hubProofSettings').open)await refresh();if(HubProofContinuous.enabled())void HubProofContinuous.send(record);}catch{message('確認記録の保存・読み戻しを確認できません。HUB未確認です。予定・ダイアリーの同期結果は上の表示で確認してください。');}}
 async function prepareTest(id){
  if(sending)return;HubApp.checkWrite();const device=await store.settings(),row=await store.get(id),target=await store.testTarget();
  const record=HubProofCore.validate(row?.record);if(device?.name!=='Flip8'||record.device.id!==device.deviceId||!record.localSaveVerified||target&&target.attemptId!==id)throw Error('送信対象を確認できません');
  selected=record;$('hubProofTestTarget').textContent='Flip8｜同期番号 '+record.sequence+'｜同期開始 '+record.startedAt+'｜識別番号 '+record.device.id;
  $('hubProofTestJson').textContent=JSON.stringify(record,null,2);$('hubProofTestStatus').textContent='まだGoogleへの追加接続・送信は行っていません。';$('hubProofTestAgree').checked=false;testControls();$('hubProofTestDialog').showModal();
 }
 async function resend(id){
  if(!permitted()||activeConsent.attemptId!==id){message('確認画面で了承したFlip8の1件だけ送信できます。自動送信はOFFです。');return {ok:false};}
  const row=await store.get(id);if(!row?.record||row.record.device.id!==activeConsent.deviceId||HubProofCore.canonical(row.record)!==activeConsent.canonical)throw Error('送信対象を確認できません');
  await transport.setup();return transport.send(row.record);
 }
 $('hubProofTestForm').onsubmit=async e=>{
  e.preventDefault();if(sending||!selected||!$('hubProofTestAgree').checked)return;
  try{HubApp.checkWrite();sending=true;testControls();const target=await store.reserveTest(selected.attemptId);
   activeConsent={attemptId:target.attemptId,deviceId:target.deviceId,canonical:HubProofCore.canonical(selected)};transport=HubProofDrive.create({approved:permitted,authorize:()=>HubGoogle.connectForProof(),store,core:HubProofCore});
   $('hubProofTestStatus').textContent='Googleへの接続と、非公開の保存先・この1件の保存を確認しています…';
   const result=await resend(selected.attemptId);if(!result.ok)throw Error('TEST_NOT_CONFIRMED');
   $('hubProofTestStatus').textContent='この1件をDriveに保存し、読み戻しの一致を確認しました。閉じるとナミへ伝えるリンクが表示されます。自動送信はOFFです。';message('Flip8の1件をDriveへ保存・読み戻し確認済み。ナミの読取り・Google最新版との一致・画面表示は未確認です。');selected=null;
  }catch(e){
   const problem=HubProofDrive.describe(e,'LOCAL');
   $('hubProofTestStatus').textContent=problem.message+' '+problem.detail+'。予定・ダイアリーは保持しています。閉じて、同じ1件から再試行できます。自動送信はOFFです。';message($('hubProofTestStatus').textContent);
  }finally{activeConsent=null;transport=null;sending=false;$('hubProofTestAgree').checked=false;testControls();await refresh();}
 };
 $('hubProofTestAgree').onchange=testControls;
 $('hubProofTestCancel').onclick=()=>{if(!sending){selected=null;$('hubProofTestDialog').close();}};
 $('hubProofTestDialog').addEventListener('cancel',e=>{if(sending)e.preventDefault();else selected=null;});
 $('hubProofRegister').onclick=async()=>{try{HubApp.checkWrite();await store.register($('hubProofDevice').value);message('この端末を登録しました。自動送信はOFFのままです。');await refresh();}catch(e){message(e.message);}};
 $('hubProofSettings').addEventListener('toggle',()=>{if($('hubProofSettings').open)refresh();});
 globalThis.HubProof={begin,finish,resend,refresh,transmissionApproved:()=>HubProofContinuous.enabled()};
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-sync.js */
try {
(function(){
 'use strict';
 if(!globalThis.HubSyncCore||!globalThis.HubApp)return;
 const buttons=[...document.querySelectorAll('[data-sync-all]')],box=document.getElementById('hubSyncAllStatus'),runner=HubSyncCore.create();
 let active=false,proofAttempt=null,proofStates=[];
 const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 function show(states){proofStates=states;box.hidden=false;box.replaceChildren(text('h2','Googleまとめ同期'));for(const s of states)box.append(text('p',s.label+'：'+s.message));if(states.length&&states.every(x=>x.status==='success'))box.append(text('p','予定・ToDo・ダイアリーの同期が完了しました。'));else if(states.some(x=>x.status==='failed'||x.status==='skipped')&&!states.some(x=>x.status==='running'||x.status==='waiting'))box.append(text('p','未完了の項目があります。表示を確認して、もう一度同期してください。'));if(globalThis.HubProof)box.append(text('p','ナミ向け確認記録：'+(HubProof.transmissionApproved()?'このFlip8では同期後に送信します。結果はホームで確認してください。':'自動送信OFF。結果はホームで確認できます。')+'Google最新版との一致・画面表示は未確認です。'));}
 function lock(){for(const button of buttons){button.dataset.unverified=String(active);button.disabled=active||!HubApp.canWrite();}}
 async function syncAll(){
  if(active)return;
  active=true;lock();
  try{
   HubApp.checkWrite();proofStates=[];proofAttempt=globalThis.HubProof?await HubProof.begin():null;const diary=globalThis.HubDiarySync?.state();
   const from=document.getElementById('hubSyncFrom').value,to=document.getElementById('hubSyncTo').value;
   const calendarEligible=HubCore.day(from)&&HubCore.day(to)&&from<=to;
   const diaryEligible=!!diary?.ready&&!!diary.configured&&!diary.busy;
   await runner.run({concurrent:true,jobs:[
    {key:'calendar',label:'予定・ToDo',eligible:calendarEligible,reason:'同期する期間を確認してください',scopes:HubGoogle.SCOPE.split(/\s+/),sync:()=>HubApp.syncCalendar()},
    {key:'diary',label:'ダイアリー',eligible:diaryEligible,reason:!diary?.ready?'保存領域の準備中です。完了後にもう一度同期してください':!diary.configured?'台帳未設定です。ダイアリー画面で設定してください':'ダイアリーの処理中です。完了を待ってください',scopes:[globalThis.HubDiarySync?.SCOPE||''],sync:grant=>HubDiarySync.syncWithGrant(grant)}
   ],authorize:eligible=>HubGoogle.connectForSync({calendar:eligible.some(x=>x.key==='calendar'),diary:eligible.some(x=>x.key==='diary'),proof:globalThis.HubProof?.transmissionApproved()===true}),onChange:show});
  }catch(error){show([{key:'all',label:'同期開始',status:'failed',message:error.message}]);}
  finally{if(globalThis.HubProof)await HubProof.finish(proofAttempt,proofStates);proofAttempt=null;active=false;lock();}
 }
 for(const button of buttons)button.onclick=syncAll;
 for(const id of ['hubSync','diarySync']){const button=document.getElementById(id),original=button.onclick;button.onclick=function(e){if(!active)return original?.call(this,e);};}
 globalThis.HubSyncAll={sync:syncAll,active:()=>active};
}());

} catch (error) { setTimeout(function () { throw error; }, 0); }
