/* PAPA HUB 1.2.38: generated from unchanged ordered source files. */

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
 const metadata=googleWorkMetadata(p,type);metadata.classificationWarnings=[];if(type!=='event'){if(!prefix)metadata.classificationWarnings.push('件名の分類目印がありません。対象ID：'+event.id+'。既存項目は自動補正しません。');if(prefix&&p.toshiHubType&&p.toshiHubType!==type)metadata.classificationWarnings.push('件名と分類情報が不一致です。対象ID：'+event.id+'。更新時に対象を確認してください。');if(!['true','false'].includes(p.toshiHubDone))metadata.classificationWarnings.push('完了状態の保存情報を確認できません。旧件名の表示を保持しています。対象ID：'+event.id);else if(!!prefix?.[1]!== (p.toshiHubDone==='true'))metadata.classificationWarnings.push('件名の完了目印と保存情報が不一致です。対象ID：'+event.id);}
 return {title:prefix?title.slice(prefix[0].length):title,type,project:type==='event'?(calendar.primary?'TOSHI':calendar.summary):(p.toshiHubProject||'TASK'),date:startDate,endDate:last||startDate,scheduledDate:metadata.start||startDate,time,endTime,allDay,done:type!=='event'&&(['true','false'].includes(p.toshiHubDone)?p.toshiHubDone==='true':!!prefix?.[1]),...metadata,completedDate:p.toshiHubCompletedDate||'',completedAt:p.toshiHubCompletedAt||'',source:'google',googleVersion:{etag:typeof event.etag==='string'&&event.etag?event.etag:null,updated:typeof event.updated==='string'?event.updated:null,sequence:Number.isSafeInteger(event.sequence)&&event.sequence>=0?event.sequence:null},googleId:event.id,googleCalendarId:calendar.id,googleUrl:event.htmlLink||'',googleDescription:event.description||'',googleOrganizerId:event.organizer?.email||'',externalTodo:!!prefix,hubTodo:type!=='event',cancelled:event.status==='cancelled'};
}
function mergeGoogle(legacy,overlay,incoming,calendars,from,to){const next=structuredClone(overlay),received=new Set(incoming.map(x=>key(x))),targets=new Set(calendars.map(c=>c.id)),map=new Map(next.google.map(x=>[key(x),x])),priorRows=list(legacy,overlay),priorByKey=new Map(priorRows.map(x=>[x._key,x]));for(const row of priorRows){if(row.source!=='google')continue;const k=row._key,inRange=row.date<=to&&(row.endDate||row.date)>=from;if(received.has(k)){if(next.edits[k])delete next.edits[k].googleUnverified;}else if(inRange||!targets.has(row.googleCalendarId)){next.edits[k]={...next.edits[k],googleUnverified:true};}}for(const row of incoming){const prior=map.get(key(row))||priorByKey.get(key(row));if(row.type==='event'&&(prior?.workClassificationLost||['todo','task'].includes(prior?.type)))map.set(key(row),{...row,workClassificationLost:true,classificationWarnings:[...(row.classificationWarnings||[]),'以前の作業の分類目印が見つかりません。対象ID：'+row.googleId+'。通常予定として保持し、自動でToDoに戻していません。']});else map.set(key(row),row);}next.google=[...map.values()];return next;}

function googleWorkTitle(title,type,done){if(!['todo','task'].includes(type)||typeof done!=='boolean')throw Error('作業の分類・完了状態を確認してください');const name=String(title||'').replace(/^(?:✅\s*)?【(?:ToDo|タスク)】\s*/,'').replace(/^✅\s*/,'');return (done?'✅':'')+(type==='todo'?'【ToDo】':'【タスク】')+name;}
function completionPatch(event,done,at,completedDate){const p=event.extendedProperties?.private||{},title=event.summary||'',prefix=/^(✅\s*)?【(ToDo|タスク)】\s*/.exec(title),type=prefix?(prefix[2]==='ToDo'?'todo':'task'):p.toshiHubType;if(!['todo','task'].includes(type))throw Error('Google側の分類が予定に変更されています。対象ID：'+event.id+'。同期して確認してください。');if(typeof done!=='boolean'||!Number.isFinite(Date.parse(at)))throw Error('完了操作の値を確認できません');const wasDone=['true','false'].includes(p.toshiHubDone)?p.toshiHubDone==='true':!!prefix?.[1],actual=completedDate===undefined||completedDate===''&&wasDone&&day(p.toshiHubCompletedDate)?(wasDone?p.toshiHubCompletedDate||'':''):completedDate;if(actual!==''&&!day(actual))throw Error('実施日はYYYY-MM-DDか空欄で指定してください');return {summary:googleWorkTitle(title,type,done),extendedProperties:{private:{...p,toshiHubType:type,toshiHubDone:String(done),toshiHubCompletedAt:done?(wasDone&&p.toshiHubCompletedAt||at):'',toshiHubCompletedDate:done?actual:''}}};}
function deadlinePatch(event,calendar,date,{alignStart=false}={}){
 const row=fromGoogle(event,calendar),p=event.extendedProperties?.private||{};
 if(typeof alignStart!=='boolean'||!day(date)||row.type!=='todo'||row.done||row.cancelled||p.toshiHubType&&p.toshiHubType!=='todo'||p.toshiHubDone!==undefined&&!['true','false'].includes(p.toshiHubDone))throw Error('未完了ToDoの分類・日付を確認できないため変更していません');
 if(alignStart&&!day(row.date))throw Error('Google予定日を確認できません');
 validateItem({...row,...(alignStart?{start:row.date,scheduledDate:row.date}:{}),deadlineDate:date,end:date},row);
 return {extendedProperties:{private:{...p,toshiHubDeadlineDate:date,toshiHubEnd:date,...(alignStart?{toshiHubStart:row.date}:{})}}};
}
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
return {STORAGE,LEGACY,day,time,addDays,parseLegacy,parseOverlay,key,list,money,deadline,workStart,span,fromGoogle,mergeGoogle,googleWorkTitle,completionPatch,deadlinePatch,validateItem};
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
    if (!['month', 'week', 'day'].includes(view)) throw RangeError('Calendar view must be month, week or day');
    if (view === 'day') return [anchor];
    const first = view === 'month' ? anchor.slice(0, 8) + '01' : anchor;
    const start = shifted(first, -new Date(first + 'T00:00:00Z').getUTCDay());
    return Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => shifted(start, index));
  }

  // Navigation changes the view date only; it never edits caller records.
  function shiftPeriod(anchor, view, step) {
    requireDay(anchor);
    if (!['month', 'week', 'day'].includes(view) || ![-1, 1].includes(step)) throw RangeError('Invalid calendar navigation');
    if (view !== 'month') return shifted(anchor, step * (view === 'week' ? 7 : 1));
    const first = new Date(anchor.slice(0, 8) + '01T00:00:00Z');
    first.setUTCMonth(first.getUTCMonth() + step);
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0);
    return shifted(first.toISOString().slice(0, 10), Math.min(Number(anchor.slice(-2)), next.getUTCDate()) - 1);
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

  return { calendarDays, shiftPeriod, entries, workRows, amountValue, amountLabel };
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
const ACCOUNT_KEY='toshi_google_sync_account_v1',READ_SCOPE='https://www.googleapis.com/auth/calendar.readonly';
let token='',expires=0,pending=null,tokenScopes='',verified=null,generation=0;
const failure=(code,message)=>Object.assign(Error(message),{code});
function invalidate(){token='';expires=0;tokenScopes='';verified=null;generation++;}
function normalizeEmail(value){const email=typeof value==='string'?value.trim().toLowerCase():'';if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure('GOOGLE_ACCOUNT_INVALID','本人のGoogleアカウントのメールアドレスを入力してください');return email;}
function account(){
 try{const raw=root.localStorage.getItem(ACCOUNT_KEY);if(!raw)throw Error();const value=JSON.parse(raw);if(value.version!==1||value.confirmed!==true||typeof value.revision!=='string'||!value.revision||normalizeEmail(value.email)!==value.email)throw Error();return {email:value.email,raw};}
 catch{throw failure('GOOGLE_ACCOUNT_REQUIRED','ホームの「同期用Googleアカウント」で本人のメールアドレスを入力・確認してください。同期は停止しています');}
}
function saveAccount(email,{confirmed=false}={}){
 if(confirmed!==true)throw failure('GOOGLE_ACCOUNT_CONFIRM_REQUIRED','本人による設定の確認が必要です');
 const normalized=normalizeEmail(email);invalidate();
 const raw=JSON.stringify({version:1,email:normalized,confirmed:true,revision:root.crypto.randomUUID()});
 try{root.localStorage.setItem(ACCOUNT_KEY,raw);if(root.localStorage.getItem(ACCOUNT_KEY)!==raw)throw Error();}
 catch{throw failure('GOOGLE_ACCOUNT_SAVE_FAILED','本人設定の保存を確認できません。同期を停止しました');}
 return normalized;
}
function covers(actual,required){const set=new Set(String(actual||'').split(/\s+/));return required.split(/\s+/).every(scope=>set.has(scope));}
function assertSession(expected=verified){
 if(!expected||expected!==verified||expected.token!==token||Date.now()>=expires||account().raw!==expected.raw)throw failure('GOOGLE_ACCOUNT_UNVERIFIED','本人確認済みのGoogle接続を確認できません。同期を停止しました。もう一度接続してください');
 return true;
}
function grant(){const binding=verified;assertSession(binding);return {access_token:token,expiresAt:expires,scope:tokenScopes,assertValid:()=>assertSession(binding)};}
async function verifyAccount(setting){
 verified=null;
 if(!covers(tokenScopes,READ_SCOPE))throw failure('GOOGLE_ACCOUNT_READ_REQUIRED','本人確認に必要な既存のカレンダー読取り権限を確認できません。予定・ToDoの同期から接続を確認してください');
 const current=token,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary?fields=id,primary,accessRole',{method:'GET',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+current}});
  if(!response.ok)throw Error();const value=await response.json();
  if(value.primary!==true||value.accessRole!=='owner'||typeof value.id!=='string')throw Error();
  if(normalizeEmail(value.id)!==setting.email)throw failure('GOOGLE_ACCOUNT_MISMATCH','接続したGoogleアカウントが本人設定と一致しません。同期を停止しました。「Googleアカウントを選び直す」から本人のアカウントを選んでください');
  if(current!==token||Date.now()>=expires||account().raw!==setting.raw)throw Error();
  verified={token:current,raw:setting.raw,email:setting.email};
 }catch(error){if(error.code==='GOOGLE_ACCOUNT_MISMATCH')throw error;throw failure('GOOGLE_ACCOUNT_VERIFY_FAILED','接続アカウントの本人確認に失敗しました。同期を停止しました。通信と本人設定を確認してください');}
 finally{clearTimeout(timer);}
}
function authorize(required=SCOPE,{selectAccount=false,recheck=false}={}){
 if(pending){if(selectAccount)return Promise.reject(failure('GOOGLE_AUTH_BUSY','Google接続の確認中です。完了後に選び直してください'));return pending.then(()=>authorize(required));}
 let setting;try{setting=account();}catch(error){invalidate();return Promise.reject(error);}
 if(selectAccount)invalidate();
 if(!recheck&&token&&Date.now()<expires&&covers(tokenScopes,required)){try{assertSession();return Promise.resolve();}catch{/* Revalidate a changed or unverified session. */}}
 const serial=generation;
 // Start GIS synchronously in the click gesture. Never infer identity from a hint.
 const obtain=token&&Date.now()<expires&&covers(tokenScopes,required)?Promise.resolve():new Promise((resolve,reject)=>{
  if(!root.google?.accounts?.oauth2){reject(failure('GOOGLE_AUTH_UNAVAILABLE','Google認証を読み込めません。通信を確認して再度お試しください。'));return;}
  const fail=e=>reject(failure(e?.type==='popup_failed_to_open'?'GOOGLE_POPUP_BLOCKED':e?.type==='popup_closed'?'GOOGLE_POPUP_CLOSED':'GOOGLE_AUTH_FAILED','Google接続を完了していません。端末のデータは保持しています。'));
  try{const client=root.google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:required,callback:r=>{
   if(serial!==generation){reject(failure('GOOGLE_ACCOUNT_CHANGED','本人設定が変わったため接続を停止しました'));return;}
   if(r.error){reject(failure(r.error==='access_denied'?'GOOGLE_ACCESS_DENIED':'GOOGLE_AUTH_FAILED','Google接続が許可されませんでした'));return;}
   if(typeof r.access_token!=='string'||!r.access_token||!Number.isFinite(Number(r.expires_in))||Number(r.expires_in)<=60||!covers(r.scope,required)){reject(failure('GOOGLE_AUTH_RESPONSE_INVALID','Google接続の応答・権限・有効期限を確認できません'));return;}
   token=r.access_token;expires=Date.now()+(Number(r.expires_in)-60)*1000;tokenScopes=r.scope;resolve();
  },error_callback:fail});client.requestAccessToken({prompt:selectAccount?'select_account':''});}catch(e){fail(e);}
 });
 const request=obtain.then(()=>{if(serial!==generation)throw failure('GOOGLE_ACCOUNT_CHANGED','本人設定が変わったため接続を停止しました');return verifyAccount(setting);}).catch(error=>{invalidate();throw error;});
 pending=request;request.then(()=>{if(pending===request)pending=null;},()=>{if(pending===request)pending=null;});return request;
}
async function selectAccount(){await authorize(SCOPE,{selectAccount:true});return {email:verified.email};}
async function connectForSync({calendar=true,diary=false,proof=false,money=false}={}){
 const diaryScope=root.HubDiarySync?.SCOPE;
 if(diary&&diaryScope!=='https://www.googleapis.com/auth/spreadsheets')throw Error('日記同期の接続設定を確認できません');
 const required=[calendar?SCOPE:'',diary?diaryScope:'',proof?'https://www.googleapis.com/auth/drive.file':'',money?READ_SCOPE+' https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file':''].filter(Boolean).join(' ');
 if(!required)throw Error('同期できる項目がありません');
 await authorize(required,{recheck:true});return grant();
}
async function api(path,options={}){assertSession();if(options.method&&options.method!=='GET'){const id=decodeURIComponent(path.split('/')[1]||'');if(id==='primary'||id.toLowerCase()===verified.email)throw failure('GOOGLE_PRIMARY_WRITE_BLOCKED','マイカレンダーへの書込みは禁止されています');}const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const response=await fetch('https://www.googleapis.com/calendar/v3/'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});if(!response.ok){if(response.status===401)invalidate();const error=Error('Google HTTP '+response.status+(response.status===401?'。もう一度接続してください':''));error.status=response.status;throw error;}return response.status===204?{}:response.json();}finally{clearTimeout(timer);}}
async function calendars(){let page='',items=[];do{const value=await api('users/me/calendarList?maxResults=250'+(page?'&pageToken='+encodeURIComponent(page):''));items.push(...(value.items||[]));page=value.nextPageToken||'';}while(page);return items.filter(c=>c.primary||['TOSHI','CPG','TASK','Trip','GOLF','誕生日','Anniversary'].includes(c.summary));}
const base=x=>'calendars/'+encodeURIComponent(x.googleCalendarId)+'/events/'+encodeURIComponent(x.googleId);
async function read(from,to){
 await authorize();const binding=verified,targets=await calendars(),parts=targets.map(()=>[]);let next=0,failed=false;
 // Different calendars are independent reads. Keep pagination within each
 // calendar ordered, cap concurrent requests, and settle every worker before
 // a failure returns so no late read can overlap a retry or partial commit.
 const worker=async()=>{while(!failed&&next<targets.length){const index=next++,calendar=targets[index];try{let page='';do{const query=new URLSearchParams({timeZone:'Asia/Tokyo',singleEvents:'true',orderBy:'startTime',maxResults:'2500',timeMin:from+'T00:00:00+09:00',timeMax:to+'T00:00:00+09:00'});if(page)query.set('pageToken',page);const value=await api('calendars/'+encodeURIComponent(calendar.id)+'/events?'+query);parts[index].push(...(value.items||[]).filter(e=>e.start&&e.status!=='cancelled').map(e=>HubCore.fromGoogle(e,calendar)));page=value.nextPageToken||'';}while(page&&!failed);}catch(error){failed=true;throw error;}}};
 const results=await Promise.allSettled(Array.from({length:Math.min(3,targets.length)},worker));const rejected=results.find(x=>x.status==='rejected');if(rejected)throw rejected.reason;
 assertSession(binding);return {rows:parts.flat(),calendars:targets};
}
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a).sort(),other=Object.keys(b).sort();return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&same(a[key],b[key]));}
async function complete(item,done,options={}){if(!['todo','task'].includes(item.type)||!item.googleCalendarId||!item.googleId)throw Error('更新する作業とGoogle予定IDを確認してください');await authorize();const binding=verified,latest=await api(base(item));if(latest.id!==item.googleId||latest.status==='cancelled')throw Error('Googleの対象ID・削除状態が変わりました。更新していません');if(typeof latest.etag!=='string'||!latest.etag)throw Error('Googleの更新版を取得できないため更新を停止しました');const patch=HubCore.completionPatch(latest,done,new Date().toISOString(),options.completedDate);if(options.beforeUpdate)await options.beforeUpdate({calendarId:item.googleCalendarId,eventId:item.googleId,event:latest,row:HubCore.fromGoogle(latest,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project})});assertSession(binding);await api(base(item),{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':latest.etag},body:JSON.stringify(patch)});const result=await api(base(item)),equal=same;if(result.id!==item.googleId||result.status==='cancelled'||result.summary!==patch.summary||Object.entries(patch.extendedProperties.private).some(([key,value])=>!equal(result.extendedProperties?.private?.[key],value))||Object.entries(latest).some(([key,value])=>!['etag','updated','sequence','summary','extendedProperties'].includes(key)&&!equal(result[key],value))||!equal(result.extendedProperties?.shared,latest.extendedProperties?.shared))throw Error('Google更新後の目印・完了状態・保持情報が一致しません。対象ID：'+item.googleId+'。再同期して対象を確認してください');assertSession(binding);return HubCore.fromGoogle(result,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project});}
async function inspectDeadlines(item){
 if(item.type!=='todo'||!item.googleCalendarId||!item.googleId)throw Error('照合するToDoのGoogle予定IDを確認してください');
 await authorize();const binding=verified,calendar={id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project};
 const event=await api(base(item));if(event.id!==item.googleId||event.status==='cancelled')throw Error('Googleの対象予定を確認できません');
 const events=new Map([[event.id,event]]),origin=event.originalStartTime?.date||HubCore.fromGoogle({...event,start:event.originalStartTime||event.start},calendar).date;
 if(event.recurringEventId&&HubCore.day(origin)){
  const query=new URLSearchParams({timeZone:'Asia/Tokyo',timeMin:origin+'T00:00:00+09:00',timeMax:HubCore.addDays(origin,367)+'T00:00:00+09:00',maxResults:'250'});let page='',count=0;
  do{if(page)query.set('pageToken',page);const value=await api('calendars/'+encodeURIComponent(calendar.id)+'/events/'+encodeURIComponent(event.recurringEventId)+'/instances?'+query);
   for(const row of value.items||[]){if(row.recurringEventId!==event.recurringEventId)throw Error('別の繰返し予定が返されたため照合を中止しました');if(row.status!=='cancelled')events.set(row.id,row);}
   page=value.nextPageToken||'';if(++count>=4&&page)throw Error('対象の発生分が多いため照合を中止しました');
  }while(page);
 }
 assertSession(binding);return [...events.values()].map(event=>({calendarId:calendar.id,eventId:event.id,event,row:HubCore.fromGoogle(event,calendar),calendar}));
}
async function repairDeadline(proof,date,{beforeUpdate,alignStart=false}={}){
 if(typeof beforeUpdate!=='function'||!proof?.eventId||!proof.calendarId||typeof proof.event?.etag!=='string'||!proof.event.etag)throw Error('修正前の予定と保存確認が必要です');
 await authorize();const binding=verified,item={googleCalendarId:proof.calendarId,googleId:proof.eventId},latest=await api(base(item));
 if(latest.id!==proof.eventId||latest.status==='cancelled'||latest.etag!==proof.event.etag)throw Error('確認後にGoogleの予定が変わりました。もう一度期限を照合してください');
 const patch=HubCore.deadlinePatch(latest,proof.calendar,date,{alignStart});
 await beforeUpdate({calendarId:proof.calendarId,eventId:proof.eventId,event:latest,row:HubCore.fromGoogle(latest,proof.calendar)});assertSession(binding);
 const changed=!same(patch.extendedProperties.private,latest.extendedProperties?.private||{});
 if(changed)await api(base(item),{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':latest.etag},body:JSON.stringify(patch)});
 const result=await api(base(item));assertSession(binding);
 if(result.id!==proof.eventId||result.status==='cancelled'||!same(result.extendedProperties?.private,patch.extendedProperties.private)||!same(result.extendedProperties?.shared,latest.extendedProperties?.shared)||Object.entries(latest).some(([key,value])=>!['etag','updated','sequence','extendedProperties'].includes(key)&&!same(result[key],value)))throw Error('Googleの期限更新後の読戻しが一致しません。端末の期限は変更していません。再照合してください');
 return {row:HubCore.fromGoogle(result,proof.calendar),event:result,googleChanged:changed};
}
async function publish(item){await authorize();const binding=verified,available=await calendars();assertSession(binding);const calendar=available.find(c=>!c.primary&&c.id.toLowerCase()!==verified.email&&c.summary==='TASK'&&['writer','owner'].includes(c.accessRole));if(!calendar)throw Error('書き込みできるTASKカレンダーが見つかりません');const date=item.type==='todo'?item.deadlineDate:item.scheduledDate;if(!HubCore.day(date))throw Error('日付のないタスクはこの端末に保持します');const id='hub'+item.safeId.replace(/-/g,'').toLowerCase(),body={id,summary:HubCore.googleWorkTitle(item.title,item.type,!!item.done),start:{date},end:{date:HubCore.addDays(date,1)},extendedProperties:{private:{toshiHubType:item.type,toshiHubProject:item.project||'TASK',toshiHubDeadlineDate:item.type==='todo'?item.deadlineDate:'',toshiHubDone:String(!!item.done),toshiHubCompletedAt:item.completedAt||'',toshiHubCompletedDate:item.completedDate||'',toshiHubSafeId:item.safeId,toshiHubDiaryEntryId:item.diaryEntryId||'',toshiHubStart:item.start||item.scheduledDate||'',toshiHubEnd:item.type==='todo'?item.deadlineDate:'',toshiHubDeadlineTime:item.deadlineTime||''}}},path='calendars/'+encodeURIComponent(calendar.id)+'/events';try{await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(error){if(error.status!==409)throw error;const existing=await api(path+'/'+id);if(existing.extendedProperties?.private?.toshiHubSafeId!==item.safeId)throw Error('Googleの予定IDが重複しました。登録は中止しました。');}const confirmed=await api(path+'/'+id);if(confirmed.id!==id)throw Error('登録後のGoogle予定IDを確認できません');if(confirmed.status==='cancelled')throw Error('同じ作業はGoogleで削除されています。端末の記録を保持しました。Google側を確認してください。');if(confirmed.summary!==body.summary||confirmed.start?.date!==body.start.date||confirmed.end?.date!==body.end.date||Object.entries(body.extendedProperties.private).some(([key,value])=>confirmed.extendedProperties?.private?.[key]!==value))throw Error('同じ作業がGoogleにありますが、端末の最新内容と一致しません。端末の記録を保持しました。Google側を確認してください。');assertSession(binding);return HubCore.fromGoogle(confirmed,calendar);}
async function connectForMoney(){await authorize(READ_SCOPE+' https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',{recheck:true});return grant();}
async function connectForProof(){const scope='https://www.googleapis.com/auth/drive.file';await authorize(scope,{recheck:true});return grant();}
function currentProofGrant(){if(!token||Date.now()>=expires||!covers(tokenScopes,'https://www.googleapis.com/auth/drive.file'))throw Object.assign(Error('DRIVE_AUTH_REQUIRED'),{code:'DRIVE_AUTH_REQUIRED'});return grant();}
root.HubGoogle={SCOPE,account,saveAccount,selectAccount,read,complete,publish,inspectDeadlines,repairDeadline,connectForSync,connectForMoney,connectForProof,currentProofGrant};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: diary.js */
try {
(function(){
 'use strict';
 const C=ToshiDiaryCore,store=new ToshiDiaryStore(),el=id=>document.getElementById(id);
 const fields={date:'diaryDate',title:'diaryTitle',body:'diaryBody',people:'diaryPeople',golfGood:'diaryGolfGood',golfImprove:'diaryGolfImprove',golfNext:'diaryGolfNext'};
 let state={revisions:[],meta:{}},ready=false,editing=null,editParents=null,token='',expires=0,sessionGrant=null,syncing=false,authorizing=false,saving=false,draftTimer=null,draftGeneration=0,writeQueue=Promise.resolve(),problem='';
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
 async function startNew(){if(dirty()&&!confirm('書きかけの内容を閉じて、新しく書きますか？'))return;clearTimeout(draftTimer);draftGeneration++;setForm();el('diaryEditor').open=true;await write([],{draft:null});}
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
  el('diaryEditor').open=true;queueDraft();el('diaryEditor').scrollIntoView({behavior:'smooth',block:'start'});
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
  if(typeof sessionGrant?.assertValid!=='function')throw Error('本人確認済みのGoogle接続がありません。同期を停止しました');
  sessionGrant.assertValid();
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
 async function connect(){
  if(!ready||syncing||authorizing)return;if(!state.meta.sheet){showError(Error('先に自分のダイアリー台帳を設定してください'));return;}
  authorizing=true;problem='';renderState();
  try{const grant=await HubGoogle.connectForSync({calendar:false,diary:true});sessionGrant=grant;token=grant.access_token;expires=grant.expiresAt;await synchronize();}
  catch(error){showError(error);}
  finally{authorizing=false;renderState();}
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
  if(typeof grant.assertValid!=='function')return {ok:false,message:'本人確認済みのGoogle接続がありません。同期を停止しました'};
  grant.assertValid();sessionGrant=grant;token=grant.access_token;expires=grant.expiresAt;return synchronize();
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
 async function restore(snapshot){validate(snapshot);if(root.HubBoardStore)await HubBoardStore.validateAssetRestore(snapshot);for(const db of snapshot.databases){if(db.exists&&db.stores.some(s=>s.name!==(db.name===NAME?'records':'entries')&&DiarySafety.unpackValue(s.records).length))throw Error('未対応の追加保存領域があります。画像復元は実行していません。完全バックアップを保持してください');}const records=[];for(const db of snapshot.databases){if(!db.exists)continue;for(const s of db.stores){const rows=DiarySafety.unpackValue(s.records),keys=DiarySafety.unpackValue(s.keys);if(db.name===NAME&&s.name==='records'){for(const r of rows.sort((a,b)=>(a.order||0)-(b.order||0))){if(!r||typeof r.id!=='string'||!['board','receipt'].includes(r.kind))throw Error('復元する画像記録の形式が違います');records.push(r);}continue;}if(s.name!=='entries')continue;const kind=db.name==='toshi_board'?'board':'receipt',current=await entries(kind),present=new Set(current.all.map(r=>r.origin&&JSON.stringify(r.origin)));for(let i=0;i<rows.length;i++){const origin={database:db.name,key:keys[i],hash:await digest(rows[i])};if(present.has(JSON.stringify(origin)))continue;records.push({id:'legacy-'+db.name+'-'+await digest([keys[i],origin.hash]),kind,payload:rows[i],origin,createdAt:new Date().toISOString(),restored:true});}}}await append(records);return records.length;}
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

;/* Source: hub-receipt-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubReceiptCore=api;})(globalThis,function(){
 'use strict';
 const GROUPS=['カード（法人）','現預金','要確認'];
 const canonical=x=>JSON.stringify(x===null||typeof x!=='object'?x:Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])));
 const text=x=>String(x??'');
 const normal=x=>text(x).normalize('NFKC').trim();
 function day(value){if(typeof value==='number'&&Number.isFinite(value)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';}const s=text(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
 function sourceKey(fileId,sheetId,no){const n=normal(no);if(typeof fileId!=='string'||!/^[A-Za-z0-9_-]+$/.test(fileId)||!Number.isSafeInteger(sheetId)||sheetId<0||!n||n.length>100||!['string','number'].includes(typeof no)||typeof no==='number'&&!Number.isSafeInteger(no))throw Error('ファイル・元シート・Noで領収書を識別できません');return JSON.stringify([fileId,sheetId,n]);}
 function photo(value){const s=text(value),m=/^=HYPERLINK\(\s*"([^"]+)"\s*[,;]/i.exec(s);try{const u=new URL(m?m[1]:s);if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password)return '';if(!/^\/file\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(u.pathname)&&!(u.pathname==='/open'&&/^[A-Za-z0-9_-]+$/.test(u.searchParams.get('id')||'')))return '';return u.href;}catch{return '';}}
 function payment(k,q){
  const p=normal(k),note=normal(q);
  const corpLiteral=/^(法人カード(?:\([^)]*\))?|カード\(法人\))$/.test(p),uncertainCorp=/法人カード(?:(?:か個人カード)?か|なのか|は)?(?:不明|未確認)|法人カード(?:ではない|の可能性|かどうか)/.test(note);
  const corp=corpLiteral||/(?:支払方法|決済方法)[:：]\s*法人カード|法人カードで(?:支払|決済)/.test(note)&&!uncertainCorp;
  const personalLiteral=/^(個人(?:クレジット)?カード|個人タッチ決済)(?:\([^)]*\))?$/.test(p),uncertainPersonal=/個人(?:クレジット)?カード(?:(?:か法人カード)?か|なのか|は)?(?:不明|未確認)|個人(?:クレジット)?カード(?:ではない|じゃない|の可能性|かどうか)|(?:現マーク|現印|手書き[「『(]?現[」』)]).{0,3}なし/.test(note);
  const personal=personalLiteral||/個人(?:クレジット)?カード|代表者の個人決済|会社側は現預金|現預金処理|現マーク|現印|手書き[「『(]?現[」』)]/.test(note)&&!uncertainPersonal;
  const cash=/^(現預金|現金|現)$/.test(p),conflict=corp&&(personal||cash)||corpLiteral&&/法人カードではない/.test(note),group=conflict?'要確認':corp?'カード（法人）':personal||cash?'現預金':'要確認';
  const methods=[];if(/^法人カード/.test(p)||/^(個人(?:クレジット)?カード|現金|タッチ決済|個人タッチ決済)/.test(p))methods.push(text(k));if(personal&&/個人(?:クレジット)?カード/.test(note)&&!methods.some(x=>/個人/.test(x)))methods.push('個人カード');if(/電子マネー/.test(note)&&!/電子マネー(?:か不明|ではない|未確認)/.test(note))methods.push('電子マネー');if(/ネット[／/]QR決済|QR決済/.test(note)&&!/QR決済(?:か不明|ではない|未確認)/.test(note))methods.push('ネット／QR決済');if(/タッチ決済/.test(note)&&!methods.some(x=>/タッチ/.test(x)))methods.push('タッチ決済');
  return {group,method:methods.join('／')||'実際の決済方法は未確認',conflict,basis:'K列：'+(text(k)||'未記載')+'／Q列の補足を保持'};
 }

 function receipt(fileId,sheetId,values,formula){const raw=Array.from({length:19},(_,i)=>values[i]??'');return {key:sourceKey(fileId,sheetId,raw[0]),fileId,sheetId,no:raw[0],date:day(raw[1]),company:text(raw[2]),account:text(raw[3]),vendor:text(raw[4]),purpose:text(raw[5]),amount:typeof raw[6]==='number'&&Number.isSafeInteger(raw[6])?raw[6]:null,payment:text(raw[10]),invoice:text(raw[12]),registration:text(raw[11]),note:text(raw[16]),state:text(raw[17]),photoReference:text(raw[18]),photoFormula:text(formula),photo:photo(formula)||photo(raw[18]),raw};}
 function validateRows(rows){const seen=new Set();for(const r of rows){if(!r||sourceKey(r.fileId,r.sheetId,r.no)!==r.key||seen.has(r.key))throw Error('元台帳のNoが欠落・重複しています。前回の表示と履歴を保持します');seen.add(r.key);}return rows;}
 const fingerprint=r=>canonical({key:r.key,raw:r.raw,photo:r.photo,photoReference:r.photoReference});
 function review(r,audit=[]){const found=[...audit].reverse().find(x=>x.kind==='receipt-review'&&x.key===r.key);if(!found)return {value:null,stale:false};return {value:found.fingerprint===fingerprint(r)?found.value:null,stale:found.fingerprint!==fingerprint(r)};}
 function resolved(r,audit=[]){const checked=review(r,audit),v=checked.value||{},p=payment(r.payment,r.note);return {group:GROUPS.includes(v.group)?v.group:p.group,method:p.method,paymentConfirmed:v.paymentConfirmed===true,purposeConfirmed:v.purposeConfirmed===true,taxConfirmed:v.taxConfirmed===true,invoiceConfirmed:v.invoiceConfirmed===true,statementKey:typeof v.statementKey==='string'?v.statementKey:'',statementFingerprint:typeof v.statementFingerprint==='string'?v.statementFingerprint:'',stale:checked.stale,conflict:p.conflict};}
 function matches(r,statements){const date=Date.parse(r.date+'T00:00:00Z');return statements.filter(s=>s.amount===r.amount&&s.company===r.company&&s.date&&Number.isFinite(date)&&Math.abs(Date.parse(s.date+'T00:00:00Z')-date)<=86400000).map(s=>s.key);}
 function reconciliation(r,audit,statements=[]){const v=resolved(r,audit);if(v.group==='現預金')return {status:'対象外（現預金）',ok:true};if(v.group!=='カード（法人）')return {status:'提出区分要確認',ok:false};const s=statements.find(x=>x.key===v.statementKey),owners=[];for(const other of audit||[])if(other.kind==='receipt-review'&&other.value?.statementKey===v.statementKey)owners.push(other.key);const currentOwners=[...new Set(owners)].filter(key=>{const latest=[...audit].reverse().find(x=>x.kind==='receipt-review'&&x.key===key);return latest?.value?.statementKey===v.statementKey;});if(s&&v.statementFingerprint===fingerprint(s)&&s.amount===r.amount&&s.company===r.company&&matches(r,[s]).length===1&&payment(s.payment,s.note).group==='カード（法人）'&&currentOwners.length===1)return {status:'本人照合済み',ok:true,statement:s};return {status:s?'明細変更・重複対応のため再確認':v.statementKey?'対応する明細が未取得':'未照合',ok:false};}
 function summary(rows,audit=[],statements=[]){const totals=Object.fromEntries(GROUPS.map(x=>[x,{count:0,amount:0}]));let amount=0,invalidAmounts=0,unreviewed=0,unmatched=0;for(const r of rows){const v=resolved(r,audit),m=reconciliation(r,audit,statements);totals[v.group].count++;if(r.amount===null)invalidAmounts++;else{amount+=r.amount;totals[v.group].amount+=r.amount;}if(!v.paymentConfirmed||!v.purposeConfirmed||!v.taxConfirmed||!v.invoiceConfirmed||v.group==='要確認')unreviewed++;if(!m.ok)unmatched++;}return {count:rows.length,amount,invalidAmounts,unreviewed,unmatched,totals,ready:rows.length>0&&!invalidAmounts&&!unreviewed&&!unmatched};}
 function monthRows(rows,month,company=''){return rows.filter(r=>(!month||r.date.slice(0,7)===month)&&(!company||r.company===company)).sort((a,b)=>a.date.localeCompare(b.date)||normal(a.no).localeCompare(normal(b.no),'ja',{numeric:true}));}
 function snapshot({source,month,rows,audit,statements,kind,now,id,parentId=null}){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!['working','submission'].includes(kind)||typeof id!=='string'||!id||!Number.isFinite(Date.parse(now)))throw Error('固定版の対象月・種類・作成時刻を確認してください');validateRows(rows);if(rows.some(r=>r.fileId!==source.fileId||r.sheetId!==source.sheetId||r.date.slice(0,7)!==month))throw Error('固定版に別の月・元台帳の記録が混在しています');const total=summary(rows,audit,statements);if(kind==='submission'&&!total.ready)throw Error('提出区分・用途・税務・インボイス・カード照合に未確認があります。作業版として保存できます');const records=monthRows(rows,month).map(r=>({receipt:structuredClone(r),review:resolved(r,audit),reconciliation:reconciliation(r,audit,statements)}));return {format:'papa-hub-receipt-close',version:1,id,parentId,source:{fileId:source.fileId,sheetId:source.sheetId,title:source.title},month,kind,createdAt:now,sourceReadAt:source.at,totals:total,records};}
 function changes(snapshot,rows,audit=[],statements=[]){const before=new Map(snapshot.records.map(x=>[x.receipt.key,x])),current=new Map(rows.filter(r=>r.date.slice(0,7)===snapshot.month).map(r=>[r.key,r]));return {added:[...current.keys()].filter(k=>!before.has(k)),removed:[...before.keys()].filter(k=>!current.has(k)),corrected:[...current.keys()].filter(k=>before.has(k)&&fingerprint(before.get(k).receipt)!==fingerprint(current.get(k))),reviewChanged:[...current.keys()].filter(k=>before.has(k)&&(canonical(before.get(k).review)!==canonical(resolved(current.get(k),audit))||canonical(before.get(k).reconciliation)!==canonical(reconciliation(current.get(k),audit,statements))))};}

 function csvRows(snapshot){return [['元ファイル','元シートID','元No','日付','会社','支払先','内容・但し書き','勘定科目','金額（税込）','提出区分','実際の決済方法','支払方法（K列）','備考（Q列）','インボイス記載','登録番号','支払区分確認','用途確認','税務確認','インボイス確認','カード照合','原本参照','元画像リンク'],...snapshot.records.map(x=>{const r=x.receipt,v=x.review;return [r.fileId,r.sheetId,r.no,r.date,r.company,r.vendor,r.purpose,r.account,r.amount,v.group,v.method,r.payment,r.note,r.invoice,r.registration,v.paymentConfirmed?'確認済み':'未確認',v.purposeConfirmed?'確認済み':'未確認',v.taxConfirmed?'確認済み':'未確認',v.invoiceConfirmed?'確認済み':'未確認',x.reconciliation.status,r.photoReference,r.photo];})];}
 function validateSnapshot(s){
  const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
  const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
  if(!exact(s,['format','version','id','parentId','source','month','kind','createdAt','sourceReadAt','totals','records'])||s.format!=='papa-hub-receipt-close'||s.version!==1||!validId(s.id)||s.parentId!==null&&!validId(s.parentId)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||!['working','submission'].includes(s.kind)||!Number.isFinite(Date.parse(s.createdAt))||!Number.isFinite(Date.parse(s.sourceReadAt))||!exact(s.source,['fileId','sheetId','title'])||typeof s.source.fileId!=='string'||s.source.title!=='台帳'||!Number.isSafeInteger(s.source.sheetId)||!Array.isArray(s.records)||s.records.length>10000)throw Error('固定版の形式を確認できません');
  const reviewKeys=['group','method','paymentConfirmed','purposeConfirmed','taxConfirmed','invoiceConfirmed','statementKey','statementFingerprint','stale','conflict'],totals=Object.fromEntries(GROUPS.map(x=>[x,{count:0,amount:0}]));let amount=0,invalidAmounts=0,unreviewed=0,unmatched=0;const matchedStatements=new Set();
  for(const row of s.records){if(!exact(row,['receipt','review','reconciliation']))throw Error('固定版の項目を確認できません');const r=row.receipt,v=row.review,m=row.reconciliation;if(!r||!Array.isArray(r.raw)||r.raw.length!==19||r.raw.some(x=>!['string','number','boolean'].includes(typeof x))||canonical(receipt(r.fileId,r.sheetId,r.raw,r.photoFormula))!==canonical(r)||r.fileId!==s.source.fileId||r.sheetId!==s.source.sheetId||r.date.slice(0,7)!==s.month||!exact(v,reviewKeys)||reviewKeys.some(k=>!(k in v))||!GROUPS.includes(v.group)||['method','statementKey','statementFingerprint'].some(k=>typeof v[k]!=='string')||['paymentConfirmed','purposeConfirmed','taxConfirmed','invoiceConfirmed','stale','conflict'].some(k=>typeof v[k]!=='boolean')||!exact(m,['status','ok','statement'])||typeof m.status!=='string'||typeof m.ok!=='boolean')throw Error('固定版の領収書・確認状態を確認できません');
   if(m.ok&&v.group==='カード（法人）'){if(m.status!=='本人照合済み'||matchedStatements.has(v.statementKey))throw Error('固定版にカード明細の重複対応があります');matchedStatements.add(v.statementKey);const st=m.statement,{receiptMatch,...plain}=st||{};if(typeof receiptMatch!=='string'||canonical(receipt(st.fileId,st.sheetId,st.raw,st.photoFormula))!==canonical(plain)||st.fileId!==s.source.fileId||st.sheetId===s.source.sheetId||st.key!==v.statementKey||fingerprint(st)!==v.statementFingerprint||st.amount!==r.amount||st.company!==r.company||matches(r,[st]).length!==1||payment(st.payment,st.note).group!=='カード（法人）')throw Error('固定版のカード照合を確認できません');}else if(m.ok&&(v.group!=='現預金'||m.status!=='対象外（現預金）'))throw Error('固定版の照合状態が不正です');if(!m.ok&&!['提出区分要確認','明細変更・重複対応のため再確認','対応する明細が未取得','未照合'].includes(m.status))throw Error('固定版の照合状態が不正です');
   totals[v.group].count++;if(r.amount===null)invalidAmounts++;else{amount+=r.amount;totals[v.group].amount+=r.amount;}if(!v.paymentConfirmed||!v.purposeConfirmed||!v.taxConfirmed||!v.invoiceConfirmed||v.group==='要確認')unreviewed++;if(!m.ok)unmatched++;
  }
  validateRows(s.records.map(x=>x.receipt));const expected={count:s.records.length,amount,invalidAmounts,unreviewed,unmatched,totals,ready:s.records.length>0&&!invalidAmounts&&!unreviewed&&!unmatched};if(canonical(s.totals)!==canonical(expected)||s.kind==='submission'&&!expected.ready)throw Error('固定版の件数・合計・確認状況が一致しません');return s;
 }
 return {GROUPS,canonical,day,sourceKey,photo,payment,receipt,validateRows,fingerprint,review,resolved,matches,reconciliation,summary,monthRows,snapshot,changes,csvRows,validateSnapshot};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-receipt-cloud.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubReceiptCloud=api;})(globalThis,function(){
 'use strict';
 const FOLDER='PAPA HUB 領収書締め版',TAG='papa-hub-receipt-close-v1';
 function create({approved,authorize,state,append,core,fetch:request=globalThis.fetch}){
  const fail=code=>Object.assign(Error(code),{code}),fields='id,name,mimeType,ownedByMe,shared,trashed,permissions(type,role),parents,appProperties';
  const check=()=>{if(approved()!==true)throw fail('TRANSMISSION_NOT_APPROVED');};
  async function apiSession(){check();const grant=await authorize();if(typeof grant?.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes('https://www.googleapis.com/auth/drive.file'))throw fail('DRIVE_AUTH_REQUIRED');return async(path,options={})=>{check();const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);try{let response;try{response=await request('https://www.googleapis.com/'+path,{...options,headers:{...options.headers,Authorization:'Bearer '+grant.access_token},signal:c.signal,cache:'no-store'});}catch{throw fail('DRIVE_NETWORK_UNCONFIRMED');}if(!response.ok)throw Object.assign(fail('DRIVE_HTTP_ERROR'),{status:response.status});try{return await response.json();}catch{throw fail('DRIVE_RESPONSE_INVALID');}}finally{clearTimeout(timer);}};}
  const privateMeta=(m,type)=>m?.mimeType===type&&m.ownedByMe===true&&m.shared===false&&m.trashed!==true&&m.permissions?.length===1&&m.permissions[0].type==='user'&&m.permissions[0].role==='owner';
  async function discover(api,fileId){const matches=[];let page;do{const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='papaHubReceiptClose' and value='"+TAG+"' } and appProperties has { key='sourceFileId' and value='"+fileId+"' }",r=await api('drive/v3/files?'+new URLSearchParams({q,spaces:'drive',fields:'nextPageToken,files(id)',pageSize:'100',...(page?{pageToken:page}:{})}));matches.push(...(r.files||[]));page=r.nextPageToken;}while(page);if(matches.length>1)throw fail('FOLDER_AMBIGUOUS');return matches[0]?.id||null;}
  async function reserve(key,candidate){check();await append('receipt-cloud-reservation',s=>{if(!s.cloud[key]?.fileId)s.cloud[key]={state:'pending',fileId:candidate};});const id=state().cloud[key]?.fileId;if(typeof id!=='string'||!id)throw fail('LOCAL_DELIVERY_READBACK_FAILED');return id;}
  async function generate(api){const r=await api('drive/v3/files/generateIds?count=1&space=drive&type=files'),id=r.ids?.[0];if(typeof id!=='string'||!id)throw fail('FILE_ID_MISSING');return id;}
  const metadata=(api,id)=>api('drive/v3/files/'+encodeURIComponent(id)+'?fields='+encodeURIComponent(fields));
  async function folder(api,source,create){const key='folder:'+source.fileId;let id=state().cloud[key]?.fileId||await discover(api,source.fileId);if(!id&&!create)return null;if(!id)id=await reserve(key,await generate(api));let m;try{m=await metadata(api,id);}catch(e){if(e.status!==404||!create)throw e;try{await api('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:FOLDER,mimeType:'application/vnd.google-apps.folder',parents:['root'],appProperties:{papaHubReceiptClose:TAG,sourceFileId:source.fileId}})});}catch(e){if(e.status!==409)throw e;}m=await metadata(api,id);}if(m.id!==id||m.name!==FOLDER||!privateMeta(m,'application/vnd.google-apps.folder')||m.appProperties?.papaHubReceiptClose!==TAG||m.appProperties?.sourceFileId!==source.fileId)throw fail('FOLDER_NOT_PRIVATE');return id;}
  async function verify(api,id,parent,source,closeId){const m=await metadata(api,id);if(!privateMeta(m,'application/json')||!m.parents?.includes(parent)||m.appProperties?.papaHubReceiptClose!==TAG||m.appProperties?.sourceFileId!==source.fileId||m.appProperties?.closeId!==closeId)throw fail('REMOTE_RECORD_IDENTITY_MISMATCH');const value=await api('drive/v3/files/'+encodeURIComponent(id)+'?alt=media');core.validateSnapshot(value);if(value.source.fileId!==source.fileId||value.source.sheetId!==source.sheetId||value.id!==closeId)throw fail('REMOTE_RECORD_IDENTITY_MISMATCH');return value;}
  async function upload(snapshot){check();core.validateSnapshot(snapshot);const payload=core.canonical(snapshot);if(new TextEncoder().encode(payload).length>4*1024*1024)throw fail('RECORD_TOO_LARGE');const api=await apiSession(),parent=await folder(api,snapshot.source,true),id=state().cloud[snapshot.id]?.fileId||await reserve(snapshot.id,await generate(api));let found=false;try{const existing=await verify(api,id,parent,snapshot.source,snapshot.id);if(core.canonical(existing)!==payload)throw fail('REMOTE_RECORD_READBACK_MISMATCH');found=true;}catch(e){if(e.status!==404)throw e;}if(!found){const boundary='receipt_'+crypto.randomUUID(),m={id,name:snapshot.month+'_'+(snapshot.kind==='submission'?'締め':'作業版')+'_'+snapshot.id+'.json',mimeType:'application/json',parents:[parent],appProperties:{papaHubReceiptClose:TAG,sourceFileId:snapshot.source.fileId,closeId:snapshot.id,month:snapshot.month}},body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(m)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+payload+'\r\n--'+boundary+'--\r\n';try{await api('upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});}catch(e){if(e.status!==409)throw e;}if(core.canonical(await verify(api,id,parent,snapshot.source,snapshot.id))!==payload)throw fail('REMOTE_RECORD_READBACK_MISMATCH');}
   check();await append('receipt-cloud-confirmed',s=>{if(s.cloud[snapshot.id]?.fileId!==id)throw fail('LOCAL_DELIVERY_READBACK_FAILED');s.cloud[snapshot.id]={fileId:id,state:'confirmed',at:new Date().toISOString()};});return {ok:true,fileId:id};
  }
  async function list(source){check();if(!/^[A-Za-z0-9_-]+$/.test(source.fileId)||!Number.isSafeInteger(source.sheetId))throw fail('REMOTE_RECORD_IDENTITY_MISMATCH');const api=await apiSession(),parent=await folder(api,source,false);if(!parent)return [];const files=[];let page;do{const r=await api('drive/v3/files?'+new URLSearchParams({q:"trashed = false and '"+parent+"' in parents and appProperties has { key='papaHubReceiptClose' and value='"+TAG+"' }",fields:'nextPageToken,files(id,appProperties)',pageSize:'100',...(page?{pageToken:page}:{})}));files.push(...(r.files||[]));if(files.length>1000)throw fail('RECORD_TOO_LARGE');page=r.nextPageToken;}while(page);const result=[];for(const f of files){const closeId=f.appProperties?.closeId;if(typeof closeId!=='string')throw fail('REMOTE_RECORD_IDENTITY_MISMATCH');result.push({snapshot:await verify(api,f.id,parent,source,closeId),fileId:f.id});}return result;
  }
  return {upload,list};
 }
 return {FOLDER,TAG,create};
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
 const metadata=await api(sheet+'?fields=sheets.properties'),tabs=(metadata.sheets||[]).map(s=>s.properties),tab=tabs.find(s=>s.title==='台帳');if(!tab||tab.gridProperties.columnCount<19)throw Error('19列の「台帳」タブを確認できません');
 async function table(properties,width){if(!properties||properties.gridProperties.columnCount<width||properties.gridProperties.rowCount>100000)throw Error('台帳の取得範囲を確認できません');const output=[];
  for(let start=1;start<=properties.gridProperties.rowCount;start+=500){const end=Math.min(start+499,properties.gridProperties.rowCount),last=String.fromCharCode(64+width),range=encodeURIComponent("'"+properties.title.replaceAll("'","''")+"'!A"+start+':'+last+end),[values,formulas]=await Promise.all([api(sheet+'/values/'+range+'?valueRenderOption=UNFORMATTED_VALUE'),api(sheet+'/values/'+range+'?valueRenderOption=FORMULA')]);
   for(let n=0;n<(values.values||[]).length;n++){const v=values.values[n]||[];if(start===1&&n===0){output.push({header:v});continue;}if(!v.some(x=>x!==''&&x!=null))continue;const f=formulas.values?.[n];if(!f||String(f[0]??'').normalize('NFKC').trim()!==String(v[0]??'').normalize('NFKC').trim()||String(f[0]??'').startsWith('='))throw Error('読込中に元Noの対応が変わりました。前回表示を保持します');for(const col of [1,2,4,5,6,10,16]){if(typeof f[col]==='string'&&f[col].startsWith('='))continue;if((f[col]??'')!==(v[col]??''))throw Error('読込中に台帳の内容が変わりました。再読込してください');}output.push({values:v,formulas:f});}
  }return output;
 }
 const tableRows=await table(tab,19),header=tableRows[0]?.header;const expectedHeaders=['No','日付','会社','勘定科目','支払先','内容・但し書き','金額(税込)','10%対象(税込)','8%対象(税込)','不課税・対象外','支払方法','登録番号','インボイス','人数','相手先','1人あたり','備考','状態','写真ファイル名'];const norm=x=>String(x||'').normalize('NFKC').replace(/\s/g,'');if(expectedHeaders.some((name,i)=>norm(header?.[i])!==norm(name)))throw Error('元台帳A:Sの19列を確認できません。以前の表示を保持します');
 const rows=HubReceiptCore.validateRows(tableRows.slice(1).map(x=>HubReceiptCore.receipt(sheet,tab.sheetId,x.values,x.formulas[18])));
 const result={rows,at:new Date().toISOString(),source:{fileId:sheet,sheetId:tab.sheetId,title:tab.title},cards:{status:'unavailable',rows:[]},closing:{status:'unavailable',rows:[]},months:{status:'success',rows:[]}};
 const optional=async(key,work)=>{try{result[key]={status:'success',...await work()};}catch{result[key]={status:'failed',rows:[],message:'取得・構造確認が未完了です。元データは変更していません。'};}};
 await Promise.all([
  optional('cards',async()=>{const t=tabs.find(s=>s.title==='カード明細');if(!t)throw Error('missing');const all=await table(t,19),h=all[0]?.header;if(h?.[0]!=='No'||h?.[10]!=='支払方法'||h?.[18]!=='領収書照合')throw Error('headers');return {sheetId:t.sheetId,title:t.title,rows:HubReceiptCore.validateRows(all.slice(1).map(x=>({...HubReceiptCore.receipt(sheet,t.sheetId,x.values,''),receiptMatch:String(x.values[18]||'')})))};}),
  optional('closing',async()=>{const t=tabs.find(s=>s.title==='月末締め管理');if(!t||t.gridProperties.columnCount<12||t.gridProperties.rowCount>10000)throw Error('missing');const range=encodeURIComponent("'月末締め管理'!A1:L"+t.gridProperties.rowCount),[v,f]=await Promise.all([api(sheet+'/values/'+range+'?valueRenderOption=UNFORMATTED_VALUE'),api(sheet+'/values/'+range+'?valueRenderOption=FORMULA')]),h=v.values?.[3];if(h?.[0]!=='対象月'||h?.[6]!=='締め状況'||h?.[8]!=='固定版リンク')throw Error('headers');const closeRows=(v.values||[]).slice(4).map((r,i)=>({r,formula:f.values?.[i+4]?.[8]})).filter(x=>HubReceiptCore.day(x.r[0]));const months=closeRows.map(x=>HubReceiptCore.day(x.r[0]).slice(0,7));if(new Set(months).size!==months.length)throw Error('duplicate month');const fixedLink=(value,formula)=>{const m=/^=HYPERLINK\(\s*"([^"]+)"\s*[,;]/i.exec(formula||''),url=m?m[1]:String(value||'');return /^#gid=\d+$/.test(url)?'https://docs.google.com/spreadsheets/d/'+sheet+'/edit'+url:HubExport.safeURL(url);};return {sheetId:t.sheetId,title:t.title,rows:closeRows.map(({r,formula})=>({month:HubReceiptCore.day(r[0]).slice(0,7),monthEnd:HubReceiptCore.day(r[1]),sendTarget:HubReceiptCore.day(r[2]),count:typeof r[3]==='number'?r[3]:null,amount:typeof r[4]==='number'?r[4]:null,monthTab:String(r[5]||''),status:String(r[6]||''),cardStatus:String(r[7]||''),fixedLink:fixedLink(r[8],formula),sentAt:HubReceiptCore.day(r[9]),receivedAt:HubReceiptCore.day(r[10]),note:String(r[11]||'')}))};}),
  optional('months',async()=>{const rows=[];for(const t of tabs.filter(s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s.title))){if(t.gridProperties.columnCount<10)throw Error('width');const v=await api(sheet+'/values/'+encodeURIComponent("'"+t.title+"'!A1:J4")+'?valueRenderOption=UNFORMATTED_VALUE');if(v.values?.[3]?.[6]!=='提出区分'||HubReceiptCore.day(v.values?.[1]?.[1]).slice(0,7)!==t.title)throw Error('headers');rows.push({month:t.title,sheetId:t.sheetId,title:t.title,amount:typeof v.values?.[1]?.[5]==='number'?v.values[1][5]:null,count:typeof v.values?.[1]?.[7]==='number'?v.values[1][7]:null,note:String(v.values?.[2]?.[0]||'')});}return {rows};})
 ]);
 return result;
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

;/* Source: hub-file-preview.js */
try {
/* Read-only local preview. No stored record, key or original byte is changed. */
(function(root){
 'use strict';
 const base=new URL('.',document.currentScript?.src||location.href),pdfBase=new URL('vendor/pdfjs-6.4.299/',base);
 const types={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 async function inspect(blob,name='',declared=''){
  const bytes=new Uint8Array(await blob.slice(0,1024).arrayBuffer()),at=(values,start=0)=>values.every((v,i)=>bytes[i+start]===v),ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end)),ext=String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]||'';let format='unknown';
  if(ascii(0,1024).includes('%PDF-'))format='pdf';
  else if(at([137,80,78,71,13,10,26,10]))format='png';
  else if(at([255,216,255]))format='jpg';
  else if(['GIF87a','GIF89a'].includes(ascii(0,6)))format='gif';
  else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')format='webp';
  else if(ascii(4,8)==='ftyp'&&/avif|avis/.test(ascii(8,32)))format='avif';
  else if(at([80,75])&&['docx','xlsx'].includes(ext))format=ext;
  else if(at([208,207,17,224,161,177,26,225])&&['doc','xls'].includes(ext))format=ext;
  const mime=types[format]||'',stored=String(blob.type||declared||'').split(';')[0].toLowerCase();
  return {format,mime,stored,preview:format==='pdf'?'pdf':['png','jpg','gif','webp','avif'].includes(format)?'image':'external',mismatch:!!mime&&stored!==mime,extension:format==='unknown'?'':format};
 }
 let pdfModule;
 function library(){if(!pdfModule)pdfModule=import(new URL('build/pdf.mjs',pdfBase).href).then(m=>{m.GlobalWorkerOptions.workerSrc=new URL('build/pdf.worker.mjs',pdfBase).href;return m;}).catch(e=>{pdfModule=null;throw e;});return pdfModule;}
 function mount(content,blob,record={}){
  let closed=false,urls=[],loading=null,doc=null,rendering=null,drawing=false,pdfBusy=false,pageNo=1,zoom=1;
  const session={close(){if(closed)return;closed=true;rendering?.cancel();const task=loading;loading=null;if(task)Promise.resolve(task.destroy()).catch(()=>{});else if(doc)Promise.resolve(doc.destroy()).catch(()=>{});doc=null;for(const url of urls)URL.revokeObjectURL(url);urls=[];}};
  const info=node('p','形式を確認しています…','muted'),status=node('p','原本は端末内で読み取り、外部の変換サービスには送信しません。','feature-preview-status'),area=node('div',undefined,'feature-preview-area'),actions=node('div',undefined,'feature-preview-actions'),help=node('p','','muted');status.setAttribute('role','status');content.append(info,status,actions,help,area);
  const save=node('button','原本を保存');save.type='button';let detected=null;
  const originalName=String(record.fileName||blob.name||record.id||'original'),getName=()=>{const name=originalName==='original'&&detected?.extension?'original.'+detected.extension:originalName;return HubExport.filename(name);};
  save.onclick=()=>{HubExport.download(blob,getName());help.textContent='ダウンロード後、Androidの「マイファイル」→「ダウンロード」から対応アプリで開いてください。';};
  const external=node('button','外部アプリで開く・共有');external.type='button';external.disabled=true;external.onclick=async()=>{if(!detected||closed)return;const file=new File([blob],getName(),{type:detected.mime||blob.type||'application/octet-stream'});try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:String(record.title||record.vendor||'原本')});if(!closed)help.textContent='外部アプリへの操作を開始しました。閲覧できたかは開いたアプリで確認してください。';}else{HubExport.download(blob,getName());help.textContent='このブラウザでは直接のアプリ選択に対応していません。保存後、Androidの「マイファイル」→「ダウンロード」で原本を開いてください。';}}catch(e){if(closed)return;help.textContent=e.name==='AbortError'?'外部アプリの選択を取り消しました。原本はそのままです。':'外部アプリを開けませんでした。「原本を保存」して、ダウンロードしたファイルを対応アプリで開いてください。';}};
  actions.append(external,save);
  function unavailable(message){if(closed)return;area.replaceChildren();status.textContent=message+' 原本の破損を意味するものではありません。「外部アプリで開く・共有」または「原本を保存」を利用してください。';}
  async function showPDF(){if(closed||pdfBusy)return;pdfBusy=true;status.textContent='PDFを端末内で開いています…';area.replaceChildren();try{
   if(blob.size>50*1024*1024)throw Object.assign(Error(),{name:'PreviewSizeLimit'});
   const lib=await library();if(closed)return;const data=new Uint8Array(await blob.arrayBuffer());if(closed)return;
   loading=lib.getDocument({data,cMapUrl:new URL('cmaps/',pdfBase).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',pdfBase).href,wasmUrl:new URL('wasm/',pdfBase).href,iccUrl:new URL('iccs/',pdfBase).href,isEvalSupported:false,enableXfa:false,useSystemFonts:true,canvasMaxAreaInBytes:16*1024*1024,stopAtErrors:true});
   let password=false;loading.onPassword=()=>{password=true;unavailable('パスワード付きPDFはHUB内で表示できません。');Promise.resolve(loading?.destroy()).catch(()=>{});};
   try{doc=await loading.promise;}catch(e){if(password)return;throw e;}if(closed)return;
   const controls=node('div',undefined,'feature-preview-controls'),previous=node('button','前のページ'),next=node('button','次のページ'),label=node('label','ページ '),input=node('input'),count=node('span',' / '+doc.numPages),smaller=node('button','縮小'),larger=node('button','拡大'),caption=node('p','','muted'),canvas=node('canvas');input.type='number';input.min='1';input.max=String(doc.numPages);input.value='1';input.setAttribute('aria-label','表示するページ');label.append(input,count);for(const b of [previous,next,smaller,larger])b.type='button';controls.append(previous,label,next,smaller,larger);area.append(controls,caption,canvas);canvas.setAttribute('role','img');
   async function draw(target=pageNo,newZoom=zoom){if(closed||drawing)return;drawing=true;pageNo=target;zoom=newZoom;previous.disabled=next.disabled=smaller.disabled=larger.disabled=input.disabled=true;status.textContent='PDF '+pageNo+' / '+doc.numPages+'ページを表示しています…';let page;
    try{page=await doc.getPage(pageNo);if(closed)return;const first=page.getViewport({scale:1}),width=Math.min(1200,Math.max(220,content.clientWidth-24)),fit=width/first.width,cssScale=fit*zoom,ratio=Math.min(devicePixelRatio||1,2),limit=Math.sqrt(4*1024*1024/(first.width*first.height)),scale=Math.min(cssScale*ratio,limit),viewport=page.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width=width*zoom+'px';canvas.style.height='auto';canvas.setAttribute('aria-label','PDF '+pageNo+' / '+doc.numPages+'ページ');input.value=String(pageNo);rendering=page.render({canvasContext:canvas.getContext('2d'),viewport});await rendering.promise;if(closed)return;caption.textContent=pageNo+' / '+doc.numPages+'ページ｜'+Math.round(zoom*100)+'%';status.textContent='PDFをHUB内に表示しました。';}
    catch(e){if(!closed&&e.name!=='RenderingCancelledException'){canvas.hidden=true;unavailable('このPDFのページをHUB内で表示できませんでした。');}}
    finally{rendering=null;drawing=false;page?.cleanup();if(!closed){previous.disabled=pageNo<=1;next.disabled=pageNo>=doc.numPages;smaller.disabled=zoom<=1;larger.disabled=zoom>=3;input.disabled=false;}}
   }
   previous.onclick=()=>draw(Math.max(1,pageNo-1));next.onclick=()=>draw(Math.min(doc.numPages,pageNo+1));smaller.onclick=()=>draw(pageNo,Math.max(1,zoom-.5));larger.onclick=()=>draw(pageNo,Math.min(3,zoom+.5));input.onchange=()=>{const n=Number(input.value);if(Number.isInteger(n)&&n>=1&&n<=doc.numPages)draw(n);else input.value=String(pageNo);};await draw();
  }catch(e){if(!closed)unavailable(e.name==='PreviewSizeLimit'?'50MBを超えるPDFは、端末の負担を抑えるためHUB内に表示しません。':'PDFの表示処理を完了できませんでした。通信または端末の表示機能を確認してください。');}finally{pdfBusy=false;}}
  (async()=>{try{detected=await inspect(blob,originalName,record.mime||record.imageType);if(closed)return;external.disabled=false;info.textContent='形式：'+(detected.format==='unknown'?'未判定':detected.format.toUpperCase())+'｜保存時の種類：'+(detected.stored||'未設定')+(detected.mismatch?'｜表示用の形式を原本から判定しました':'');
   if(detected.preview==='image'){const image=node('img');image.className='feature-image';image.alt=String(record.title||record.vendor||'原本画像');image.onload=()=>{if(!closed)status.textContent='画像をHUB内に表示しました。';};image.onerror=()=>unavailable('この画像形式または画像をHUB内で表示できませんでした。');const url=URL.createObjectURL(new Blob([blob],{type:detected.mime}));urls.push(url);image.src=url;area.append(image);status.textContent='画像を開いています…';}
   else if(detected.preview==='pdf')await showPDF();
   else unavailable(['doc','docx','xls','xlsx'].includes(detected.format)?'Word・ExcelはHUB内プレビューの対象外です。対応する外部アプリで開いてください。':'保存ファイルの形式をHUB内プレビュー用に判定できませんでした。');
  }catch{if(!closed){external.disabled=false;detected={mime:'',extension:''};unavailable('保存ファイルの読み取りまたは形式の確認を完了できませんでした。');}}})();
  return session;
 }
 root.HubFilePreview={inspect,mount};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-board-core.js */
try {
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubBoardCore=api;})(globalThis,function(){
 'use strict';
 const FORMAT='papa-hub-board-revision',MAX_FILE=64*1024*1024,MAX_REVISIONS=10000;
 const canonical=x=>JSON.stringify(x===null||typeof x!=='object'?x:Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])));
 const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
 async function hash(value){return hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value instanceof Blob?await value.arrayBuffer():value));}
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
 const str=(v,n)=>typeof v==='string'&&v.length<=n;
 const safeURL=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 const rid=v=>typeof v==='string'&&/^r_(?:[a-f0-9]{64}|[a-f0-9-]{36})$/.test(v),eid=v=>typeof v==='string'&&/^e_[a-f0-9]{64}$/.test(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 function validateContent(c){const keys=c?.type==='note'?['type','title','text']:c?.type==='url'?['type','title','url']:c?.type==='file'?['type','title','fileName','mime','hash','size']:[];if(!keys.length||!exact(c,keys)||!str(c.title,1000)||!c.title.trim())throw Error('ボード内容の形式を確認できません');if(c.type==='note'&&!str(c.text,2*1024*1024)||c.type==='url'&&(!str(c.url,8192)||!c.url||safeURL(c.url)!==c.url)||c.type==='file'&&(!str(c.fileName,1000)||!str(c.mime,200)||!digest(c.hash)||!Number.isSafeInteger(c.size)||c.size<0||c.size>MAX_FILE))throw Error('ボードのメモ・URL・添付形式を確認できません');return c;}
 async function content(payload){const title=String(payload.title||'見出しなし'),blob=payload.blob instanceof Blob?payload.blob:payload.image instanceof Blob?payload.image:null;let c;if(blob){if(blob.size>MAX_FILE)throw Error('64MBを超える添付は端末に保持しています。同期を開始していません');c={type:'file',title,fileName:String(payload.fileName||blob.name||'original'),mime:String(payload.mime||payload.imageType||blob.type||''),hash:await hash(blob),size:blob.size};}else if(payload.type==='note'||typeof payload.text==='string'&&!payload.url)c={type:'note',title,text:String(payload.text||'')};else if(payload.url)c={type:'url',title,url:safeURL(payload.url)};else throw Error('未対応の元ボード形式です。原本は端末に保持しています');validateContent(c);return {content:c,blob};}
 async function initial(c){validateContent(c);const h=await hash(canonical(c)),r={format:FORMAT,version:1,id:'r_'+h,entity:'e_'+h,parents:[],createdAt:null,actor:'initial',deleted:false,content:structuredClone(c)};return r;}
 function validate(r){if(!exact(r,['format','version','id','entity','parents','createdAt','actor','deleted','content'])||r.format!==FORMAT||r.version!==1||!rid(r.id)||!eid(r.entity)||!Array.isArray(r.parents)||r.parents.length>100||new Set(r.parents).size!==r.parents.length||r.parents.some(x=>!rid(x)||x===r.id)||typeof r.deleted!=='boolean')throw Error('ボード履歴の形式を確認できません');if(r.parents.length===0){if(r.actor!=='initial'||r.createdAt!==null||r.deleted||r.id!=='r_'+r.entity.slice(2))throw Error('初期ボード履歴を確認できません');}else if(!/^d_[a-f0-9-]{36}$/.test(r.actor)||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))throw Error('端末・操作時刻を確認できません');if(r.deleted){if(r.content!==null)throw Error('削除履歴に不正な内容があります');}else validateContent(r.content);return r;}
 async function validateIdentity(r){validate(r);if(!r.parents.length&&'e_'+await hash(canonical(r.content))!==r.entity)throw Error('初期ボード識別と内容が一致しません');return r;}
 function merge(...sets){const map=new Map();for(const r of sets.flat()){validate(r);if(map.has(r.id)&&canonical(map.get(r.id))!==canonical(r))throw Error('同じボード履歴IDに異なる内容があります。上書きしていません');map.set(r.id,r);}if(map.size>MAX_REVISIONS)throw Error('履歴件数が同期上限を超えています。端末データは保持しています');const degree=new Map(),children=new Map();for(const r of map.values()){degree.set(r.id,r.parents.length);for(const p of r.parents){if(!map.has(p)||map.get(p).entity!==r.entity)throw Error('ボードの親履歴が不足・不一致です');if(!children.has(p))children.set(p,[]);children.get(p).push(r.id);}}const queue=[...degree].filter(x=>x[1]===0).map(x=>x[0]);for(let i=0;i<queue.length;i++)for(const c of children.get(queue[i])||[])if(degree.set(c,degree.get(c)-1).get(c)===0)queue.push(c);if(queue.length!==map.size)throw Error('ボード履歴が循環しています');return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));}
 function heads(revisions){const all=merge(revisions),parents=new Set(all.flatMap(r=>r.parents)),byEntity=new Map();for(const r of all)if(!parents.has(r.id)){if(!byEntity.has(r.entity))byEntity.set(r.entity,[]);byEntity.get(r.entity).push(r);}return byEntity;}
 function revision(entity,parents,c,actor,deleted=false){if(!parents.length)throw Error('更新元の履歴を確認してください');return validate({format:FORMAT,version:1,id:'r_'+crypto.randomUUID(),entity,parents:[...parents].sort(),createdAt:new Date().toISOString(),actor,deleted,content:deleted?null:structuredClone(validateContent(c))});}
 return {FORMAT,MAX_FILE,MAX_REVISIONS,canonical,hash,safeURL,digest,rid,eid,content,initial,validate,validateIdentity,merge,heads,revision};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-board-backup.js */
try {
/* Portable board-only archive. Existing databases and original keys stay read-only. */
(function(root){
 'use strict';
 const FORMAT='papa-hub-personal-board-backup';
 function validate(value){if(value?.format!==FORMAT||value.version!==1||value.app!=='personal-papa-hub'||typeof value.sourceOrigin!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw Error('個人用HUBのボードバックアップを選んでください');HubAssets.validate(value.assets);for(const db of value.assets.databases){if(db.name==='toshi_receipts'&&db.exists)throw Error('ボード専用バックアップに領収書が混在しています');if(db.name===HubAssets.NAME&&db.exists)for(const s of db.stores)for(const r of DiarySafety.unpackValue(s.records)){if(r?.kind!=='board')throw Error('ボード以外の記録が混在しています');const p=r.payload;if(p?.boardRecord===HubBoardStore.MARK){if(p.recordType==='revision')HubBoardCore.validate(p.revision);else if(p.recordType==='attachment'){if(!HubBoardCore.digest(p.hash)||!(p.blob instanceof Blob))throw Error('バックアップの添付形式が不正です');}else throw Error('バックアップの保護履歴が不正です');}}}return value;}
 async function capture(){const assets=await HubAssets.capture(),databases=[];for(const db of assets.databases){if(db.name==='toshi_receipts'){databases.push({name:db.name,exists:false});continue;}const copy=structuredClone(db);if(copy.name===HubAssets.NAME&&copy.exists)for(const s of copy.stores){const rows=DiarySafety.unpackValue(s.records),keys=DiarySafety.unpackValue(s.keys),indices=rows.map((r,i)=>r?.kind==='board'?i:-1).filter(i=>i>=0);s.records=await DiarySafety.packValue(indices.map(i=>rows[i]));s.keys=await DiarySafety.packValue(indices.map(i=>keys[i]));}databases.push(copy);}return validate({format:FORMAT,version:1,app:'personal-papa-hub',sourceOrigin:location.origin,createdAt:new Date().toISOString(),assets:{format:'toshi-assets-archive',version:1,databases}});}
 function same(a,b){return a?.format===FORMAT&&b?.format===FORMAT&&a.sourceOrigin===b.sourceOrigin&&JSON.stringify(a.assets)===JSON.stringify(b.assets);}
 async function stable(){const first=await capture(),again=await capture();if(!same(first,again))throw Error('ボードが保存中です。完了後にバックアップを保存してください');return first;}
 async function verify(value){validate(value);if(value.sourceOrigin!==location.origin||!same(value,await stable()))throw Error('保存ファイルと現在のボードが一致しません。最新のバックアップを保存して選び直してください');await HubBoardStore.validateBackup(value);return true;}
 async function restore(value){validate(value);HubApp.checkWrite();await HubBoardStore.validateBackup(value);await HubAssets.restore(value.assets);const rows=(await HubAssets.entries('board')).all;for(const db of value.assets.databases){if(!db.exists)continue;for(const s of db.stores){const originals=DiarySafety.unpackValue(s.records),keys=DiarySafety.unpackValue(s.keys);for(let i=0;i<originals.length;i++){const r=originals[i];if(db.name==='toshi_board'&&s.name==='entries'){const hash=await HubAssets.digest(r),found=rows.find(x=>x.origin?.database===db.name&&JSON.stringify(x.origin.key)===JSON.stringify(keys[i])&&x.origin.hash===hash);if(!found||await HubAssets.digest(found.payload)!==hash)throw Error('復元後の元資料の読み戻しが一致しません');}else if(db.name===HubAssets.NAME&&s.name==='records'&&r.payload){const found=rows.find(x=>x.id===r.id);if(!found||await HubAssets.digest(found.payload)!==await HubAssets.digest(r.payload))throw Error('復元後のボード履歴の読み戻しが一致しません');}}}}return {ok:true};}
 root.HubBoardBackup={FORMAT,validate,capture,stable,same,verify,restore};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-board-store.js */
try {
(function(root){
 'use strict';const C=HubBoardCore,MARK='papa-hub-board-v1',DEVICE='papa_hub_board_device_v1',SETTINGS='toshi_board_sync_settings_v1',CONSENT='papa_hub_board_consent_v1';
 function settings(){const raw=localStorage.getItem(SETTINGS);if(!raw)return {version:1,enabled:false,deviceId:null,account:null,reservations:{},acked:[],lastSync:null};const s=JSON.parse(raw);if(s?.version!==1||typeof s.enabled!=='boolean'||!Array.isArray(s.acked)||!s.reservations||typeof s.reservations!=='object')throw Error('ボード同期設定を確認できません。データは保持しています');return {...s,enabled:localStorage.getItem(CONSENT)===localStorage.getItem(DEVICE)&&s.deviceId===localStorage.getItem(DEVICE)&&/^d_[a-f0-9-]{36}$/.test(s.deviceId||'')};}
 function device(){HubApp.checkWrite();let id=localStorage.getItem(DEVICE);if(!id){id='d_'+crypto.randomUUID();localStorage.setItem(DEVICE,id);}if(!/^d_[a-f0-9-]{36}$/.test(id))throw Error('この端末の識別情報を確認できません');return id;}
 function configure(change){HubApp.checkWrite();const s=settings(),before=JSON.stringify(s),oldEnabled=s.enabled;change(s);s.deviceId=device();const enabling=s.enabled&&!oldEnabled;if(!s.enabled&&oldEnabled)localStorage.setItem(CONSENT,'off');const comparable=JSON.parse(before);comparable.enabled=s.enabled;comparable.deviceId=s.deviceId;if(enabling||JSON.stringify(comparable)!==JSON.stringify(s)||!localStorage.getItem(SETTINGS)){const raw=JSON.stringify(s);localStorage.setItem(SETTINGS,raw);if(localStorage.getItem(SETTINGS)!==raw)throw Error('同期設定の端末読み戻しを確認できません');}if(enabling){localStorage.setItem(CONSENT,s.deviceId);if(localStorage.getItem(CONSENT)!==s.deviceId)throw Error('送信同意の保存を確認できません');}return settings();}
 async function update(change){if(!navigator.locks?.request)throw Error('安全な同期設定の保存にはWeb Locks対応ブラウザが必要です。端末内データは保持しています');return navigator.locks.request('papa-hub-board-settings',()=>configure(change));}
 const revRecord=r=>({id:'board-revision-'+r.id,kind:'board',payload:{boardRecord:MARK,recordType:'revision',revision:r}}),blobRecord=(hash,blob)=>({id:'board-attachment-'+hash,kind:'board',payload:{boardRecord:MARK,recordType:'attachment',hash,blob}});
 async function fromRows(assets){const revisions=[],blobs=new Map(),aliases=new Map(),legacy=[];for(const row of assets.all){const p=row.payload||{};if(p.boardRecord===MARK){if(p.recordType==='revision'){await C.validateIdentity(p.revision);revisions.push(p.revision);}else if(p.recordType==='attachment'){if(!C.digest(p.hash)||!(p.blob instanceof Blob)||await C.hash(p.blob)!==p.hash)throw Error('端末の添付ファイルを照合できません');blobs.set(p.hash,p.blob);}else throw Error('未対応のボード保護記録です');}else{const parsed=await C.content(p),r=await C.initial(parsed.content);revisions.push(r);legacy.push(r);if(parsed.blob&&!blobs.has(parsed.content.hash))blobs.set(parsed.content.hash,parsed.blob);if(!aliases.has(r.entity))aliases.set(r.entity,[]);aliases.get(r.entity).push(row.id);}}
  const merged=C.merge(revisions);for(const r of merged)if(!r.deleted&&r.content.type==='file'&&(!blobs.has(r.content.hash)||blobs.get(r.content.hash).size!==r.content.size))throw Error('端末の添付が不足しています。既存資料は保持しています');return {revisions:merged,blobs,heads:C.heads(merged),hidden:assets.hidden,aliases,legacy};}
 async function read(){return fromRows(await HubAssets.entries('board'));}
 async function validateBackup(value){const rows=[];for(const db of value.assets.databases){if(!db.exists)continue;for(const st of db.stores){const records=DiarySafety.unpackValue(st.records),keys=DiarySafety.unpackValue(st.keys);if(records.length&&db.name==='toshi_board'&&st.name!=='entries')throw Error('元ボードの追加保存領域を確認できません。完全バックアップを保持してください');if(db.name==='toshi_board'&&st.name==='entries'){for(let i=0;i<records.length;i++){const hash=await HubAssets.digest(records[i]);rows.push({id:'legacy-'+db.name+'-'+await HubAssets.digest([keys[i],hash]),kind:'board',payload:records[i]});}}else if(db.name===HubAssets.NAME&&st.name==='records')for(const r of records)if(r.kind==='board'&&r.payload)rows.push(r);else{}}}const backup=await fromRows({all:rows,hidden:new Set()}),local=await read();C.merge(local.revisions,backup.revisions);return backup;}
 async function persist(revisions,blobs=new Map()){HubApp.checkWrite();const before=await read(),merged=C.merge(before.revisions,revisions);for(const r of revisions)await C.validateIdentity(r);const records=[];for(const [hash,blob] of blobs){if(!C.digest(hash)||!(blob instanceof Blob)||await C.hash(blob)!==hash)throw Error('添付の内容がハッシュと一致しません');if(!before.blobs.has(hash))records.push(blobRecord(hash,blob));}
  for(const r of merged)if(!r.deleted&&r.content.type==='file'){const b=blobs.get(r.content.hash)||before.blobs.get(r.content.hash);if(!b||b.size!==r.content.size)throw Error('履歴に必要な添付がありません');}const own=new Set((await HubAssets.entries('board')).all.filter(x=>x.payload?.boardRecord===MARK&&x.payload.recordType==='revision').map(x=>x.payload.revision.id));for(const r of merged)if(!own.has(r.id))records.push(revRecord(r));if(records.length)await HubAssets.append(records);const after=await read(),found=new Map(after.revisions.map(r=>[r.id,r]));for(const r of merged)if(C.canonical(found.get(r.id))!==C.canonical(r))throw Error('ボード履歴の保存・読み戻しが一致しません');for(const [hash] of blobs)if(!after.blobs.has(hash))throw Error('添付の保存・読み戻しが一致しません');return after;}
 async function add(payload){const x=await C.content(payload),r=await C.initial(x.content),before=await read();if(before.heads.has(r.entity))throw Error('同じ内容の資料は既にあります。削除済みなら履歴から復元してください');return persist([r],x.blob?new Map([[x.content.hash,x.blob]]):new Map());}
 async function edit(entity,parents,payload,deleted=false){const before=await read();if(!before.heads.has(entity))throw Error('変更元のボードが見つかりません');const x=deleted?{content:null,blob:null}:await C.content(payload),r=C.revision(entity,parents,x.content,device(),deleted);return persist([r],x.blob?new Map([[x.content.hash,x.blob]]):new Map());}
 async function visibility(entity,hide){HubApp.checkWrite();await HubAssets.append([{id:'board-visibility-'+crypto.randomUUID(),kind:'board',action:hide?'hide':'show',target:entity}]);}
 function hidden(state,entity){return state.hidden.has(entity)||(state.aliases.get(entity)||[]).some(id=>state.hidden.has(id))&&!state.hidden.has('board-show-'+entity);}
 async function show(entity){await HubAssets.append([{id:'board-visibility-'+crypto.randomUUID(),kind:'board',action:'show',target:entity},{id:'board-visibility-'+crypto.randomUUID(),kind:'board',action:'hide',target:'board-show-'+entity}]);}
 function payload(state,r){if(r.deleted)return null;const c=r.content;return c.type==='file'?{type:c.type,title:c.title,fileName:c.fileName,mime:c.mime,blob:state.blobs.get(c.hash)}:structuredClone(c);}
 root.HubBoardStore={MARK,DEVICE,SETTINGS,CONSENT,settings,configure,update,device,read,fromRows,validateBackup,validateAssetRestore:assets=>validateBackup({assets}),persist,add,edit,visibility,show,hidden,payload};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-features.js */
try {
(function(){
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(cls)x.className=cls;return x;},today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 function fail(e,id='hubFeatureStatus'){const x=$(id)||$('hubStatus');x.textContent=e.message||String(e);}
 function button(title,work,write=false){const x=make('button',title);x.type='button';if(write){x.dataset.write='';x.disabled=!globalThis.HubApp?.canWrite();}x.onclick=()=>Promise.resolve().then(work).catch(e=>fail(e));return x;}
 const addHTML=(parent,html)=>{const t=document.createElement('template');t.innerHTML=html;parent.append(t.content);};
 addHTML($('money'),`<div class="card feature-money"><div class="calhead"><h2>入出金を管理</h2><button id="featureMoneyNew" type="button" data-write disabled>＋追加</button></div><div class="actions"><button id="featureMoneyPrev" type="button">前月</button><button id="featureMoneyNext" type="button">翌月</button><button id="featureMoneyImport" type="button" data-write disabled>ナミからJSON取込</button></div><div class="moneygrid"><div class="moneybox">未消込の入金<b id="featureIncomeTotal"></b></div><div class="moneybox">未消込の支払<b id="featurePaymentTotal"></b></div></div><h3>入金</h3><div id="featureIncomeRows"></div><h3>支払</h3><div id="featurePaymentRows"></div><h3>日付・区分の確認が必要な記録</h3><div id="featureOtherMoneyRows"></div></div>`);
 addHTML($('home'),`<div class="home-feature-links"><button type="button" id="featureBoardHome" class="board-action">ワンタイムボードを開く ›</button><button type="button" id="featureReceiptHome" class="board-action">領収書管理を開く ›</button></div>`);
 addHTML(document.querySelector('main'),`<p id="hubFeatureStatus" class="muted" role="status"></p><section id="board" class="panel" hidden><div class="card"><div class="calhead"><h2>ワンタイムボード</h2><button type="button" data-feature-home>ホーム</button></div><form id="featureBoardForm"><label>種類<select id="featureBoardType"><option value="url">Webリンク</option><option value="note">メモ</option><option value="file">PDF・画像・Word・Excel</option></select></label><label>見出し<input id="featureBoardTitle" maxlength="300" required></label><div class="actions"><input id="featureBoardQuery" placeholder="Googleで資料を探す"><button type="button" id="featureBoardSearch">検索</button></div><label id="featureBoardURLLabel">資料のURL<input id="featureBoardURL" type="url"></label><label id="featureBoardTextLabel" hidden>メモ<textarea id="featureBoardText" rows="4"></textarea></label><label id="featureBoardFileLabel" hidden>ファイル<input id="featureBoardFile" type="file" accept="application/pdf,image/png,image/jpeg,image/gif,image/webp,image/avif,.doc,.docx,.xls,.xlsx"></label><button type="submit" data-write disabled class="board-action">ボードに追加</button></form><input id="featureBoardFilter" type="search" placeholder="資料名・メモを検索"><label><input type="checkbox" id="featureBoardHidden">どけた資料も表示</label><div id="featureBoardRows"></div><p id="featureBoardStatus" role="status"></p></div></section>
 <section id="receipts" class="panel" hidden><div class="card"><h2>Driveの領収書台帳</h2><label>本人の台帳URL<input type="url" id="featureReceiptSheet"></label><div class="actions"><button type="button" id="featureReceiptConnect">Googleで台帳を確認</button><button type="button" id="featureReceiptOpen">台帳を開く</button><button type="button" id="featureReceiptSet" data-write disabled>台帳を設定</button></div><p id="featureReceiptDriveStatus" role="status">Google台帳未読込</p><div class="twocol"><label>月<input type="month" id="featureReceiptMonth"></label><label>会社<select id="featureReceiptCompany"><option value="">すべて</option><option>CP</option><option>CPY</option><option>AT</option><option>個人（不動産）</option><option>要確認</option></select></label></div><div id="featureReceiptDriveSummary"></div><div id="featureReceiptDriveRows"></div></div>
 <div class="card"><h2>領収書写真・端末保存</h2><p class="muted">以前の写真は元の保存領域から読み取り表示します。新しい写真・台帳は別の保護領域に保存し、Google Driveへ自動送信しません。</p><form id="featureReceiptForm"><div class="twocol"><label>写真を撮る<input type="file" id="featureReceiptCamera" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label>写真を選ぶ<input type="file" id="featureReceiptFile" accept="image/jpeg,image/png,image/webp"></label></div><div id="featureReceiptPreview"></div><button type="button" id="featureReceiptOCR">写真から自動読取</button><p id="featureReceiptOCRStatus" role="status"></p><details><summary>ナミの読取結果を貼る</summary><textarea id="featureReceiptNami" placeholder="日付｜支払先｜金額"></textarea><button type="button" id="featureReceiptApply">候補入力</button></details><div class="twocol"><label>会社<select id="featureReceiptNewCompany" required><option value="">選択</option><option>CP</option><option>CPY</option><option>AT</option></select></label><label>利用日<input type="date" id="featureReceiptDate" required></label></div><label>金額<input type="number" id="featureReceiptAmount" min="1" step="1" required></label><label>支払先<input id="featureReceiptVendor" required maxlength="100"></label><label>内容<input id="featureReceiptPurpose" required maxlength="150"></label><div class="twocol"><label>実際の決済方法<input id="featureReceiptPayment" maxlength="100" placeholder="例：個人カード・タッチ決済・現金・法人カードのブランド"></label><label>経理への提出区分<select id="featureReceiptSubmission"><option>要確認</option><option>カード（法人）</option><option>現預金</option></select></label><label>勘定科目<input id="featureReceiptAccount" maxlength="60"></label></div><label>備考<input id="featureReceiptNote" maxlength="200"></label><button class="board-action" data-write disabled>領収書を保存</button></form><p id="featureReceiptStatus" role="status"></p><div id="featureReceiptLocalSummary"></div><div class="actions"><button type="button" id="featureReceiptCSV">台帳CSVを保存</button><button type="button" id="featureReceiptZIP">台帳と写真をZIP保存</button></div><label><input type="checkbox" id="featureReceiptHidden">どけた領収書も表示</label><div id="featureReceiptLocalRows"></div></div></section>
 <details class="card" id="featureArchiveCard"><summary>資料・領収書の画像バックアップ・復元</summary><p class="muted">画像・資料・メモ・元の保存キーを含めて保全します。復元は別の保護領域への追加のみで、旧領域を上書きしません。</p><button type="button" id="featureArchiveDownload">画像を含む完全バックアップ</button><label>完全バックアップ・ボード専用バックアップから復元<input type="file" id="featureArchiveRestore" accept="application/json,.json" data-write disabled></label><p id="featureArchiveStatus" role="status"></p></details>`);
 addHTML(document.body,`<dialog id="featureMoneyDialog"><form id="featureMoneyForm"><div class="calhead"><h2>入出金を登録</h2><button type="button" id="featureMoneyClose">閉じる</button></div><label>区分<select id="featureMoneyKind"><option value="income">入金</option><option value="payment">支払</option></select></label><label>件名<input id="featureMoneyTitle" required maxlength="300"></label><label>金額<input type="number" id="featureMoneyAmount" required min="0" step="1"></label><label>日付<input type="date" id="featureMoneyDate" required></label><label>時刻（任意）<input type="time" id="featureMoneyTime"></label><p id="featureMoneyError" role="status"></p><button class="board-action" data-write disabled>端末に保存</button></form></dialog><dialog id="featureImportDialog"><h2>ナミから資金繰り取込</h2><textarea id="featureImportText" rows="8" placeholder="money配列のJSON"></textarea><div class="actions"><button type="button" id="featureImportCheck">取込前に確認</button><button type="button" id="featureImportCommit" data-write disabled>確認した内容を取込</button><button type="button" id="featureImportClose">閉じる</button></div><p id="featureImportStatus" role="status"></p></dialog><dialog id="featureViewer"><div class="calhead"><h2 id="featureViewTitle"></h2><button type="button" id="featureViewClose">閉じる</button></div><div id="featureViewBody"></div></dialog>`);
 $('home').querySelector('.home-links').after($('home').querySelector('.home-feature-links'));
 addHTML($('work'),'<details class="card"><summary>どけた予定・作業を戻す</summary><div id="featureArchivedItems"></div></details>');
 function archivedItems(){if(!globalThis.HubApp||HubApp.panel()!=='work')return;const rows=$('featureArchivedItems');rows.replaceChildren();for(const item of HubApp.allItems().filter(x=>x.cancelled)){rows.append(make('p',item.title||'件名なし'),button('一覧へ戻す',()=>HubApp.archiveItem(item,false),true));}}
 window.addEventListener('hub-render',archivedItems);
 let filePreview=null;
 function viewClose(){filePreview?.close();filePreview=null;$('featureViewer').close();$('featureViewBody').replaceChildren();}
 function view(record){viewClose();const r=record.payload||{},content=$('featureViewBody');$('featureViewTitle').textContent=r.title||r.vendor||'原本';const blob=r.blob||r.image;
  if(r.type==='note')content.append(make('div',r.text||'','feature-note'));
  else if(blob instanceof Blob){filePreview=HubFilePreview.mount(content,blob,r);}
  else{const url=HubExport.safeURL(r.url);if(url){const link=make('a','元の資料を開く');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';content.append(link);}else content.append(make('p','元のURL・画像の形式を確認できません。元データは保管しています。'));}
  $('featureViewer').showModal();
 }
 $('featureViewClose').onclick=viewClose;$('featureViewer').addEventListener('cancel',e=>{e.preventDefault();viewClose();});
 let moneyEditing=null,moneyInitial='',importPlan=null,importBefore='';
 function moneyForm(row=null){globalThis.HubMoneySync?.guardLegacy();HubApp.checkWrite();moneyEditing=row;$('featureMoneyKind').value=row?.kind||'payment';$('featureMoneyTitle').value=row?.title||'';$('featureMoneyAmount').value=row?.amount??'';$('featureMoneyDate').value=row?.date||today();$('featureMoneyTime').value=row?.time||'';$('featureMoneyError').textContent='';for(const id of ['featureMoneyDate','featureMoneyAmount'])$(id).required=!row||!!$(id).value;moneyInitial=moneyValues();$('featureMoneyDialog').showModal();}
 function moneyValues(){return JSON.stringify(['featureMoneyKind','featureMoneyTitle','featureMoneyAmount','featureMoneyDate','featureMoneyTime'].map(id=>$(id).value));}
 function moneyClose(){if(moneyValues()!==moneyInitial&&!confirm('未保存の入力を閉じますか？'))return;$('featureMoneyDialog').close();}
 $('featureMoneyNew').onclick=()=>{try{moneyForm();}catch(e){fail(e);}};$('featureMoneyClose').onclick=moneyClose;$('featureMoneyDialog').addEventListener('cancel',e=>{e.preventDefault();moneyClose();});
 $('featureMoneyForm').onsubmit=async e=>{e.preventDefault();try{globalThis.HubMoneySync?.guardLegacy();const fields=['kind','title','amount','date','time'],values=Object.fromEntries(fields.map((key,i)=>[key,JSON.parse(moneyValues())[i]])),initial=Object.fromEntries(fields.map((key,i)=>[key,JSON.parse(moneyInitial)[i]])),x=moneyEditing?HubMoney.edit(moneyEditing,values,initial):HubMoney.validate({...values,title:values.title.trim(),amount:Number(values.amount)});const pendingSave=HubApp.commit('money-save',next=>{if(moneyEditing){next.history.push({kind:'previous-money',at:new Date().toISOString(),value:moneyEditing});next.moneyEdits[moneyEditing._key]={...next.moneyEdits[moneyEditing._key],...HubMoney.patch(x),_key:moneyEditing._key};}else{delete x._key;x.safeId=crypto.randomUUID();x.done=false;next.money.push(x);}});if(pendingSave)await pendingSave;$('featureMoneyDialog').close();fail(Error('入出金を端末の保護領域へ保存しました'));}catch(error){fail(error,'featureMoneyError');}};
 function money(){if(!globalThis.HubApp)return;const model=HubMoney.model(HubApp.money(),$('hubMoneyMonth').value),amount=n=>Number.isFinite(n)?'¥'+n.toLocaleString('ja-JP'):'要確認';$('featureIncomeTotal').textContent=amount(model.incomeTotal);$('featurePaymentTotal').textContent=amount(model.paymentTotal);for(const [id,rows] of [['featureIncomeRows',model.income],['featurePaymentRows',model.payment],['featureOtherMoneyRows',model.other]]){const container=$(id);container.replaceChildren();if(!rows.length)container.append(make('p','この月の記録はありません','muted'));for(const r of rows){const row=make('article',undefined,'hub-row'+(r.done?' done':'')),content=make('div');content.append(make('b',r.title||'件名なし'),make('p',(r.date||'日付不明')+'｜'+amount(r.amount)+'｜'+(r.done?'消込済み':'未消込')+(r.settledDate?'｜消込日 '+r.settledDate:''),'muted'));const actions=make('div',undefined,'row-actions');actions.append(button(r.done?'完了を取り消す':'完了にする',async()=>{globalThis.HubMoneySync?.guardLegacy();if(!confirm((r.done?'完了を取り消す':'完了にする')+'：'+r.title+' '+amount(r.amount)+' でよいですか？'))return;const pendingSave=HubApp.commit('money-complete',next=>{next.history.push({kind:'previous-money',at:new Date().toISOString(),value:r});next.moneyEdits[r._key]={...next.moneyEdits[r._key],done:!r.done};});if(pendingSave)await pendingSave;},true),button('編集',()=>moneyForm(r),true));content.append(actions);row.append(content);container.append(row);}}}
 for(const [id,n] of [['featureMoneyPrev',-1],['featureMoneyNext',1]])$(id).onclick=()=>{const d=new Date($('hubMoneyMonth').value+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);$('hubMoneyMonth').value=d.toISOString().slice(0,7);HubApp.render();};
 $('featureMoneyImport').onclick=()=>{$('featureImportStatus').textContent='';importPlan=null;$('featureImportDialog').showModal();};$('featureImportClose').onclick=()=>$('featureImportDialog').close();
 $('featureImportText').oninput=()=>{importPlan=null;$('featureImportStatus').textContent='内容が変わりました。取込前の確認をやり直してください';};
 $('featureImportCheck').onclick=()=>{try{importPlan=HubMoney.planImport(JSON.parse($('featureImportText').value),HubApp.money());importBefore=JSON.stringify(HubApp.money());$('featureImportStatus').textContent='追加 '+importPlan.add.length+'件、定期項目更新 '+importPlan.update.length+'件、重複または一致候補 '+importPlan.skip.length+'件は追加しません。定期項目の更新は明示されたコード・月の一致だけで行い、前の内容を履歴に残します。';}catch(e){importPlan=null;fail(e,'featureImportStatus');}};
 $('featureImportCommit').onclick=async()=>{try{globalThis.HubMoneySync?.guardLegacy();if(!importPlan||JSON.stringify(HubApp.money())!==importBefore)throw Error('取込前の確認をやり直してください');if(!confirm('確認した '+importPlan.add.length+'件を追加し、定期項目 '+importPlan.update.length+'件を履歴付きで更新しますか？'))return;const pendingSave=HubApp.commit('money-import',next=>{for(const x of importPlan.add){const copy={...x,safeId:crypto.randomUUID()};delete copy._key;next.money.push(copy);}for(const pair of importPlan.update){next.history.push({kind:'previous-money',at:new Date().toISOString(),value:pair.before});next.moneyEdits[pair.before._key]={...next.moneyEdits[pair.before._key],...HubMoney.patch(pair.after)};}});if(pendingSave)await pendingSave;$('featureImportDialog').close();fail(Error('取込完了。追加 '+importPlan.add.length+'件、重複候補 '+importPlan.skip.length+'件は保持してスキップ'));importPlan=null;}catch(e){fail(e,'featureImportStatus');}};
 $('featureBoardHome').onclick=()=>HubApp.navigate('board');$('featureReceiptHome').onclick=()=>HubApp.navigate('receipts');document.querySelectorAll('[data-feature-home]').forEach(x=>x.onclick=()=>HubApp.navigate('home'));
 function boardMode(){const type=$('featureBoardType').value;for(const [id,t] of [['featureBoardURLLabel','url'],['featureBoardTextLabel','note'],['featureBoardFileLabel','file']])$(id).hidden=type!==t;}
 $('featureBoardType').onchange=boardMode;boardMode();$('featureBoardSearch').onclick=()=>{const q=$('featureBoardQuery').value.trim();if(q)window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener,noreferrer');};
 async function board(legacyOnly=false){if(legacyOnly!==true&&globalThis.HubBoardLocal)return HubBoardLocal.render();try{const data=await HubAssets.entries('board'),all=$('featureBoardHidden').checked?data.all:data.visible,q=$('featureBoardFilter').value.toLocaleLowerCase(),rows=$('featureBoardRows');rows.replaceChildren();for(const r of all.filter(r=>[r.payload?.title,r.payload?.text].join('\n').toLocaleLowerCase().includes(q))){const item=make('article',undefined,'hub-row'),x=r.payload||{};item.append(button((x.type==='note'?'メモ｜':x.type==='file'?'ファイル｜':'リンク｜')+(x.title||'見出しなし'),()=>view(r)),button(data.hidden.has(r.id)?'一覧に戻す':'どける',()=>HubAssets.visibility(r,!data.hidden.has(r.id)),true));if(r.legacy)item.append(make('span','以前の保存記録','muted'));rows.append(item);}if(!all.length)rows.append(make('p','保存済み資料はありません','muted'));}catch(e){fail(e,'featureBoardStatus');}}
 $('featureBoardFilter').oninput=board;$('featureBoardHidden').onchange=board;
 $('featureBoardForm').onsubmit=async e=>{e.preventDefault();if(globalThis.HubBoardLocal)return HubBoardLocal.saveForm();try{const type=$('featureBoardType').value,payload={type,title:$('featureBoardTitle').value.trim()};if(!payload.title)throw Error('見出しを入力してください');if(type==='url'){payload.url=HubExport.safeURL($('featureBoardURL').value);if(!payload.url)throw Error('http/httpsの資料URLを入力してください');}else if(type==='note'){payload.text=$('featureBoardText').value;if(!payload.text.trim())throw Error('メモを入力してください');}else{const file=$('featureBoardFile').files[0];if(!file||file.size>15*1024*1024||!(/\.(pdf|png|jpe?g|gif|webp|avif|docx?|xlsx?)$/i.test(file.name)))throw Error('15MB以下のPDF・画像・Word・Excelを選んでください');payload.blob=file;payload.mime=file.type;payload.fileName=file.name;}await HubAssets.add('board',payload);$('featureBoardForm').reset();boardMode();await board();$('featureBoardStatus').textContent='保護領域へ保存しました。旧資料・画像は変更していません。';}catch(error){fail(error,'featureBoardStatus');}};
 let drive=null,receiptImage=null,previewURL=null;
 async function receipts(){if(!globalThis.HubApp)return;const sheet=HubApp.overlay().receiptSheetUrl||localStorage.getItem('toshi_receipt_sheet_url')||'';if(!$('featureReceiptSheet').value)$('featureReceiptSheet').value=sheet;const month=$('featureReceiptMonth').value,company=$('featureReceiptCompany').value;if(drive){const rows=drive.rows.filter(r=>(!month||r.date.slice(0,7)===month)&&(!company||r.company===company));$('featureReceiptDriveSummary').textContent=rows.length+'件｜原本リンクあり '+rows.filter(r=>r.photo).length+'件｜原本リンクなし '+rows.filter(r=>!r.photo).length+'件｜前回読込 '+new Date(drive.at).toLocaleString('ja-JP');$('featureReceiptDriveRows').replaceChildren();for(const r of rows){const wrap=make('article',undefined,'hub-row');wrap.append(make('p',(r.date||'日付要確認')+'｜'+r.company+'｜'+r.vendor+'｜'+(r.amount===null?'金額要確認':r.amount.toLocaleString()+'円')),make('p',r.purpose,'muted'));if(r.photo){const link=make('a','Driveの原本を開く');link.href=r.photo;link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);}else wrap.append(make('p','原本リンクなし','diary-warning'));$('featureReceiptDriveRows').append(wrap);}if(globalThis.HubReceiptWorkflow)HubReceiptWorkflow.render(drive);}
  const data=await HubAssets.entries('receipt'),items=($('featureReceiptHidden').checked?data.all:data.visible).filter(r=>(!month||String(r.payload?.date||'').slice(0,7)===month)&&(!company||r.payload?.company===company));$('featureReceiptLocalSummary').textContent='端末 '+items.length+'件｜Googleへ自動送信しません';$('featureReceiptLocalRows').replaceChildren();for(const r of items){const x=r.payload||{},row=make('article',undefined,'hub-row');row.append(make('p',(x.date||'日付不明')+'｜'+(x.company||'未分類')+'｜'+(x.vendor||'支払先不明')+'｜'+String(x.amount??'金額不明')+'円'),make('p','提出区分：'+(x.submissionGroup||'要確認')+'｜実際の決済方法：'+(x.payment||'未記載'),'muted'),button('写真を見る・保存',()=>view(r)),button(data.hidden.has(r.id)?'一覧に戻す':'どける',()=>HubAssets.visibility(r,!data.hidden.has(r.id)),true));$('featureReceiptLocalRows').append(row);}
 }
 for(const id of ['featureReceiptMonth','featureReceiptCompany','featureReceiptHidden'])$(id).onchange=()=>receipts().catch(e=>fail(e,'featureReceiptStatus'));
 $('featureReceiptConnect').onclick=async()=>{const b=$('featureReceiptConnect');if(b.disabled)return;b.disabled=true;$('featureReceiptDriveStatus').textContent='Google台帳を確認中…';try{drive=await HubReceipts.read($('featureReceiptSheet').value);await receipts();$('featureReceiptDriveStatus').textContent=['cards','closing','months'].some(k=>drive[k]?.status!=='success')?'元台帳は読み込みました。カード明細・月別一覧・締め管理の一部は未確認です。元台帳は変更していません。':'元台帳・カード明細・月別一覧・締め管理を読み込みました。Google側は変更していません。';}catch(e){$('featureReceiptDriveStatus').textContent='読込失敗：'+e.message+(drive?'。前回読込の表示を保持しています（最新確認は未完了）':'。Google台帳は未確認です');}finally{b.disabled=false;}};
 $('featureReceiptOpen').onclick=()=>{const id=HubReceipts.id($('featureReceiptSheet').value);if(id)window.open('https://docs.google.com/spreadsheets/d/'+id+'/edit','_blank','noopener,noreferrer');else fail(Error('台帳URLを入力してください'));};$('featureReceiptSet').onclick=async()=>{try{const url=$('featureReceiptSheet').value.trim();if(!HubReceipts.id(url))throw Error('台帳URLを確認してください');const pendingSave=HubApp.commit('receipt-settings',next=>{next.receiptSheetUrl=url;});if(pendingSave)await pendingSave;$('featureReceiptDriveStatus').textContent='台帳の設定を保存しました。Googleはまだ読み込んでいません。';}catch(e){fail(e,'featureReceiptDriveStatus');}};
 function selectImage(input){const file=input.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){fail(Error('20MB以下のJPEG・PNG・WebPを選んでください'),'featureReceiptStatus');return;}receiptImage=file;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);const image=make('img');image.src=previewURL;image.className='feature-image';image.alt='選んだ領収書';$('featureReceiptPreview').replaceChildren(image);$('featureReceiptStatus').textContent='写真はまだ未保存です。内容を確認して保存してください。';}
 $('featureReceiptCamera').onchange=e=>selectImage(e.target);$('featureReceiptFile').onchange=e=>selectImage(e.target);
 function applyReceipt(date,vendor,amount){if(HubCore.day(date))$('featureReceiptDate').value=date;if(vendor)$('featureReceiptVendor').value=vendor;if(Number.isSafeInteger(Number(amount))&&Number(amount)>0)$('featureReceiptAmount').value=String(Number(amount));}
 $('featureReceiptApply').onclick=()=>{const parts=$('featureReceiptNami').value.trim().split(/[｜|]/);if(parts.length!==3||!HubCore.day(parts[0])||!Number.isSafeInteger(Number(parts[2].replace(/[,円¥￥\s]/g,'')))){fail(Error('日付｜支払先｜金額の形式で入力してください'),'featureReceiptStatus');return;}applyReceipt(parts[0],parts[1],parts[2].replace(/[,円¥￥\s]/g,''));$('featureReceiptStatus').textContent='候補を入力しました。写真と照合して保存してください。';};
 $('featureReceiptForm').onsubmit=async e=>{e.preventDefault();try{const payload={id:'receipt-'+crypto.randomUUID(),company:$('featureReceiptNewCompany').value,date:$('featureReceiptDate').value,amount:Number($('featureReceiptAmount').value),vendor:$('featureReceiptVendor').value.trim(),purpose:$('featureReceiptPurpose').value.trim(),payment:$('featureReceiptPayment').value,submissionGroup:$('featureReceiptSubmission').value,account:$('featureReceiptAccount').value,note:$('featureReceiptNote').value,image:receiptImage,imageType:receiptImage?.type||'',createdAt:new Date().toISOString()};if(!receiptImage||!HubCore.day(payload.date)||!payload.company||!payload.vendor||!payload.purpose||!Number.isSafeInteger(payload.amount)||payload.amount<=0)throw Error('写真・会社・日付・金額・支払先・内容を確認してください');await HubAssets.add('receipt',payload);$('featureReceiptForm').reset();receiptImage=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('featureReceiptPreview').replaceChildren();$('featureReceiptStatus').textContent='写真と台帳を端末に保存しました。Googleへは送信していません。';await receipts();}catch(error){fail(error,'featureReceiptStatus');}};
 async function receiptExport(zip){const data=await HubAssets.entries('receipt'),month=$('featureReceiptMonth').value,company=$('featureReceiptCompany').value,rows=data.visible.filter(r=>(!month||String(r.payload?.date||'').slice(0,7)===month)&&(!company||r.payload?.company===company)),matrix=[['記録ID','利用日','会社','支払先','内容','金額','支払方法','勘定科目','備考','写真ファイル','経理提出区分']];const files=[];for(let n=0;n<rows.length;n++){const x=rows[n].payload,ext=x.image?.type==='image/png'?'.png':x.image?.type==='image/webp'?'.webp':x.image?.type==='image/jpeg'?'.jpg':'.bin',name='receipt-'+String(n+1).padStart(4,'0')+ext;matrix.push([x.id||rows[n].id,x.date,x.company,x.vendor,x.purpose,x.amount,x.payment,x.account,x.note,x.image instanceof Blob?name:'原本画像なし',x.submissionGroup||'要確認']);if(x.image instanceof Blob)files.push({name,blob:x.image});}const csv=new Blob([HubExport.csv(matrix)],{type:'text/csv;charset=utf-8'});if(zip){files.unshift({name:'台帳.csv',blob:csv});HubExport.download(await HubExport.zip(files),'領収書-'+(month||'全期間')+'.zip');}else HubExport.download(csv,'領収書-'+(month||'全期間')+'.csv');$('featureReceiptStatus').textContent='ダウンロードを開始しました。端末にファイルが保存されたか確認してください。';}
 $('featureReceiptCSV').onclick=()=>receiptExport(false).catch(e=>fail(e,'featureReceiptStatus'));$('featureReceiptZIP').onclick=()=>receiptExport(true).catch(e=>fail(e,'featureReceiptStatus'));
 $('featureArchiveDownload').onclick=async()=>{try{HubExport.download(new Blob([JSON.stringify(await HubSafety.capture())],{type:'application/json'}),'toshi-hub-complete-backup.json');$('featureArchiveStatus').textContent='画像を含むバックアップのダウンロードを開始しました。';}catch(e){fail(e,'featureArchiveStatus');}};
 $('featureArchiveRestore').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw Error('256MB以下のバックアップを選んでください');const value=JSON.parse(await file.text());if(value.format==='papa-hub-personal-board-backup'){HubBoardBackup.validate(value);if(!confirm('このボードバックアップの資料・原本・履歴を、今の資料を残したまま端末に追加復元しますか？'))return;await HubBoardBackup.restore(value);$('featureArchiveStatus').textContent='ボードを端末へ追加復元しました。端末間同期は行いません。';await refresh();return;}if(value.format!=='toshi-hub-safety-backup'||value.version!==1||value.sourceOrigin!==location.origin)throw Error('同じ保存オリジンのHUB完全バックアップを選んでください');HubAssets.validate(value.assets);if(!confirm('資料・領収書の画像を保護領域へ追加復元します。旧保存領域は上書きしません。続けますか？'))return;const count=await HubAssets.restore(value.assets);$('featureArchiveStatus').textContent='画像・資料 '+count+'件を照合して復元しました。旧領域は変更していません。';await refresh();}catch(error){fail(error,'featureArchiveStatus');}finally{e.target.value='';}};
 async function refresh(){if(!globalThis.HubApp)return;const p=HubApp.panel();if(p==='board')await board();if(p==='receipts')await receipts();}
 window.addEventListener('hub-panel',()=>refresh().catch(e=>fail(e)));window.addEventListener('hub-assets-changed',()=>refresh().catch(e=>fail(e)));
 $('featureReceiptMonth').value=today().slice(0,7);$('featureReceiptDate').value=today();
 function serializeForm(id){const form=$(id),handler=form.onsubmit;let pending=false;form.onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;const controls=[...form.querySelectorAll('input,textarea,select,button')],states=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);try{await handler(e);}finally{pending=false;controls.forEach((x,i)=>x.disabled=x.hasAttribute('data-write')?!HubApp.canWrite():states[i]);}};}
 serializeForm('featureBoardForm');serializeForm('featureReceiptForm');
 if(globalThis.HubPersistence){HubPersistence.guardForm($('featureMoneyForm'));$('featureImportCommit').onclick=HubPersistence.guardAction($('featureImportDialog'),$('featureImportCommit').onclick);$('featureImportDialog').addEventListener('cancel',e=>{if($('featureImportDialog').dataset.saving==='true'){e.preventDefault();e.stopImmediatePropagation();}},true);}
 globalThis.HubFeatures={viewRecord:view,boardLegacy:()=>board(true),money,refresh,moneyForm,applyReceipt,receiptImage:()=>receiptImage,receiptDrive:()=>drive,setReceiptDrive:value=>{drive=value;return receipts();}};
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

;/* Source: hub-deadline.js */
try {
(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./hub-core.js'):root.HubCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubDeadlineRepair=api;})(globalThis,function(root,C){
'use strict';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function shifted(date,isHoliday){
 if(!C.day(date))return null;
 for(let i=0;i<370;i++){const holiday=isHoliday(date);if(holiday===null)return null;if(new Date(date+'T12:00:00Z').getUTCDay()!==0&&!holiday)return date;date=C.addDays(date,1);}
 return null;
}
function candidates(proofs,selectedKey,localRows,overlay,isHoliday){
 const local=new Map(localRows.map(row=>[row._key,row]));
 return proofs.flatMap(proof=>{
  const key=C.key(proof.row),original=proof.event.originalStartTime?.date||(proof.event.originalStartTime?.dateTime?new Date(proof.event.originalStartTime.dateTime).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}):''),date=proof.row.date;
  const moved=original&&original!==date&&shifted(original,isHoliday)===date;
  if(key!==selectedKey&&!moved)return [];
  const current=local.get(key),valid=proof.row.type==='todo'&&!proof.row.done&&!proof.row.cancelled&&(!current||current.type==='todo'&&!current.done&&!current.completionConflict),patch=overlay.edits[key];
  const starts=[C.workStart(proof.row),...(current?[C.workStart(current)]:[])],alignStart=!!moved&&starts.includes(original)&&starts.every(value=>!value||value===original||value===date);
  const mismatch=C.deadline(proof.row)!==date||(current&&C.deadline(current)!==date)||proof.event.extendedProperties?.private?.toshiHubEnd!==date||alignStart;
  return [{proof,key,date,local:current,patch:structuredClone(patch),cached:structuredClone(overlay.google.find(row=>C.key(row)===key)),valid,selected:!!valid&&!!mismatch,original,canAlignStart:!!moved,alignStart}];
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function assertLocal(overlay,plan,rows){
 if(!equal(overlay.edits[plan.key],plan.patch)||!equal(overlay.google.find(row=>C.key(row)===plan.key),plan.cached)||!equal(rows.find(row=>row._key===plan.key),plan.local))throw Error('確認後に端末の対象データが変わりました。もう一度照合してください');
 if(plan.local&&(plan.local.type!=='todo'||plan.local.done||plan.local.completionConflict))throw Error('端末の未完了状態を確認できません');
 if(plan.local)C.validateItem({...plan.local,...(plan.alignStart?{start:plan.proof.row.date,scheduledDate:plan.proof.row.date}:{}),deadlineDate:plan.date,end:plan.date},plan.local);
}
function apply(overlay,plan,result){
 if(C.key(result)!==plan.key||result.type!=='todo'||result.done||result.cancelled||C.deadline(result)!==plan.date)throw Error('同じIDの未完了ToDoと期限を確認できません');
 if(plan.alignStart&&C.workStart(result)!==plan.proof.row.date)throw Error('Google予定日と開始日が一致しません');
 if(!equal(overlay.edits[plan.key],plan.patch)||!equal(overlay.google.find(row=>C.key(row)===plan.key),plan.cached))throw Error('端末の対象データが変わりました。Googleは再照合してください');
 const index=overlay.google.findIndex(row=>C.key(row)===plan.key);
 if(index>=0)overlay.google[index]=result;else overlay.google.push(result);
 if(plan.patch){overlay.edits[plan.key]={...plan.patch,deadlineDate:plan.date,...(plan.alignStart?{start:plan.proof.row.date,scheduledDate:plan.proof.row.date}:{})};if(Object.hasOwn(plan.patch,'end'))overlay.edits[plan.key].end=plan.date;}
}
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
let dialog=null,pending=false;
async function verifyLocal(){await root.HubApp.verifyCalendarReadback();}
async function open(item){
 if(pending||dialog?.open)return;root.HubApp.checkWrite();
 dialog=element('dialog');dialog.style.maxWidth='620px';dialog.style.width='calc(100% - 24px)';
 const title=element('h2','Googleと期限・開始日を照合'),message=element('p','Googleの最新予定と、この端末の編集内容を確認しています。'),body=element('div'),actions=element('div'),applyButton=element('button','選択した日付を整合する'),close=element('button','閉じる');
 message.setAttribute('role','status');actions.className='row-actions';applyButton.type=close.type='button';applyButton.disabled=true;actions.append(applyButton,close);dialog.append(title,message,body,actions);document.body.append(dialog);
 const dispose=()=>{if(!pending){dialog.close();dialog.remove();dialog=null;}};close.onclick=dispose;dialog.addEventListener('cancel',e=>{e.preventDefault();dispose();});dialog.showModal();pending=true;close.disabled=true;
 try{
  const proofs=await root.HubGoogle.inspectDeadlines(item),overlay=root.HubApp.overlay(),rows=root.HubApp.allItems();root.HubApp.checkWrite();
  const plans=candidates(proofs,item._key,rows,overlay,date=>root.HubHolidays.isHoliday(date)),inputs=[];
  body.append(element('p','選択した発生分だけ日付をそろえます。「開始日もそろえる」を選ぶと、移動前の日に残っているToDoの開始日もGoogle予定日に合わせます。Googleの予定日・件名・完了状態は変更しません。同じ繰返しの日曜・祝日から移動済みの候補を今後約1年分表示し、通常の土曜日は移動しません。'));
  for(const plan of plans){
   const box=element('section');box.className='card';const label=element('label'),check=element('input');check.type='checkbox';check.dataset.deadlineSelect='';check.style.width=check.style.height='20px';check.checked=plan.selected;check.disabled=!plan.valid;label.append(check,document.createTextNode(' '+plan.proof.row.title+'｜'+plan.date));box.append(label);
   const p=plan.proof.event.extendedProperties?.private||{};
   box.append(element('p','Google予定日：'+plan.proof.row.date+'｜Googleの期限：'+(C.deadline(plan.proof.row)||'未設定')+'｜この端末の期限：'+(plan.local?C.deadline(plan.local)||'未設定':'未取得')));
   box.append(element('p','GoogleのToDo開始日：'+(C.workStart(plan.proof.row)||'未設定')+'｜この端末の開始日：'+(plan.local?C.workStart(plan.local)||'未設定':'未取得')));
   const startLabel=element('label'),startCheck=element('input');startCheck.type='checkbox';startCheck.dataset.alignStart='';startCheck.style.width=startCheck.style.height='20px';startCheck.checked=plan.alignStart;startCheck.disabled=!plan.valid||!plan.canAlignStart;startLabel.append(startCheck,document.createTextNode(' 開始日も '+plan.proof.row.date+' にそろえる'));box.append(startLabel);
   const change=element('label','修正後の期限 '),input=element('input');input.type='date';input.value=plan.date;input.disabled=!plan.valid;change.append(input);box.append(change);
   const detail=element('details'),summary=element('summary','修正前の日付情報と端末の編集内容'),pre=element('pre',JSON.stringify({eventId:plan.proof.eventId,googleDeadlineDate:p.toshiHubDeadlineDate??null,googleLegacyEnd:p.toshiHubEnd??null,googleTodoStart:p.toshiHubStart??null,localEdit:plan.patch??null},null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);box.append(detail);
   if(!plan.valid)box.append(element('p','未完了ToDoの状態を確認できないため、この発生分は修正できません。'));
   body.append(box);inputs.push({plan,check,input,startCheck});
  }
  const enabled=()=>{applyButton.disabled=pending||!inputs.some(x=>x.check.checked&&x.plan.valid);};inputs.forEach(x=>{x.check.onchange=enabled;});
  message.textContent=plans.length?'内容を確認し、修正する発生分を選んでください。':'照合できる未完了ToDoがありません。';
  applyButton.onclick=async()=>{
   if(pending)return;try{root.HubApp.checkWrite();}catch(error){message.textContent=error.message;return;}const selected=inputs.filter(x=>x.check.checked&&x.plan.valid).map(x=>({...x.plan,date:x.input.value,alignStart:x.startCheck.checked}));if(!selected.length)return;
   if(selected.some(x=>!C.day(x.date))){message.textContent='修正後の期限をYYYY-MM-DDで入力してください。';return;}
   if(!confirm(selected.map(x=>x.proof.row.title+'：期限 '+x.date+(x.alignStart?'｜開始 '+x.proof.row.date:'')).join('\n')+'\n\nこの'+selected.length+'件の選択した日付だけをGoogleと端末に保存しますか？変更前の情報は履歴に残します。'))return;
   pending=true;close.disabled=true;enabled();inputs.forEach(x=>{x.check.disabled=true;x.input.disabled=true;x.startCheck.disabled=true;});let done=0;
   try{
    for(const plan of selected){
     assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());message.textContent='期限を照合・保存しています：'+(done+1)+' / '+selected.length;
     const result=await root.HubGoogle.repairDeadline(plan.proof,plan.date,{alignStart:plan.alignStart,beforeUpdate:async proof=>{
      root.HubApp.checkWrite();assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());
      await root.HubApp.commit('deadline-before-update',next=>{next.history.push({at:new Date().toISOString(),kind:'previous-google-event',calendarId:proof.calendarId,eventId:proof.eventId,value:proof.event},{at:new Date().toISOString(),kind:'previous-deadline-edit',key:plan.key,value:structuredClone(plan.patch)??null},...(plan.local?[{at:new Date().toISOString(),kind:'previous-item',value:plan.local}]:[]));});await verifyLocal();
     }});
     root.HubApp.checkWrite();assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());
     await root.HubApp.commit('deadline-reconcile',next=>{if(plan.cached)next.history.push({at:new Date().toISOString(),kind:'previous-google',value:plan.cached});apply(next,plan,result.row);});await verifyLocal();done++;
    }
    message.textContent=done+'件の日付をGoogleで読み戻し、端末への保存も確認しました。ToDo一覧と予定の週表示を確認してください。';
   }catch(error){message.textContent=done+'件は端末への保存確認済みです。残りは完了していません：'+error.message+'。Googleへの反映だけ進んだ可能性もあるため、閉じて再照合してください。';}
   finally{pending=false;close.disabled=false;applyButton.disabled=true;}
  };
 }catch(error){message.textContent='照合できません：'+error.message+'。保存済みの期限は変更していません。';}
 finally{pending=false;close.disabled=false;applyButton.disabled=!body.querySelector('input[data-deadline-select]:checked');}
}
return {shifted,candidates,assertLocal,apply,open};
});

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
function displayMoneyItems(){const rows=moneyItems();return identity?.ok&&globalThis.HubMoneySync?HubMoneySync.viewMoney(rows):rows;}
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
 if(item.classificationWarnings?.length){
  const compatibleNotice='完了状態の保存情報を確認できません。旧件名の表示を保持しています。対象ID：'+item.googleId;
  const help=item.source==='google'&&['todo','task'].includes(item.type)&&item.classificationWarnings.includes(compatibleNotice);
  const warnings=item.classificationWarnings.filter(message=>!help||message!==compatibleNotice);
  if(warnings.length)content.append(node('p',warnings.join(' '),'diary-warning'));
  if(help){
   const explanation=node('details',undefined,'muted hub-completion-help');
   explanation.append(node('summary','完了状態について'),node('p','HUB用の完了情報がまだ確認できない作業です。'+(item.done?'現在は完了として表示しています。実際の状態を確認し、未完了に戻す場合だけ左の✓を押してください。':'未完了なら操作は不要です。作業が完了したら、左の○を押して登録してください。実施日が分からなければ空欄で登録できます。')));
   const diagnostic=node('details');diagnostic.append(node('summary','確認用の詳細'),node('p',compatibleNotice));explanation.append(diagnostic);content.append(explanation);
  }
 }
 if(Array.isArray(item.metadataWarnings)&&item.metadataWarnings.length)content.append(node('p',item.metadataWarnings.filter(x=>typeof x==='string').join(' '),'diary-warning')); 
 const actions=node('div',undefined,'row-actions');
 if(item.source==='google'){if(/^https:\/\/(calendar\.google\.com|www\.google\.com\/calendar)(\/|\?|$)/.test(item.googleUrl||'')){const a=node('a','Googleで開く');a.href=item.googleUrl;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}}
 else{actions.append(button('編集',()=>openEditor(item),true));if(item.safeId&&['todo','task'].includes(item.type)&&(C.deadline(item)||item.scheduledDate))actions.append(button('Googleへ登録',()=>publish(item),true));}
 if(item.source==='google'&&item.type==='todo'&&!item.done&&globalThis.HubDeadlineRepair){const audit=button('期限をGoogleと照合',()=>HubDeadlineRepair.open(item),true);if(item.googleUnverified){audit.disabled=true;audit.dataset.unverified='true';}actions.append(audit);}
 actions.append(button('一覧からどける',()=>archiveItem(item,true),true));content.append(actions);if(item._viewOrigin)content.append(node('div','確認用：'+item._viewOrigin,'muted'));row.append(content);return row;
}
function moneyViewRow(entry){const row=node('article',undefined,'hub-row cash-entry'+(entry.kind==='income'?' cash-income':entry.kind==='payment'?' cash-payment':'')+(entry.done?' done':'')),content=node('div',undefined,'hub-row-content');row.append(node('div',entry.time||'日付','hub-time'));content.append(node('span',entry.kind==='income'?'入金':entry.kind==='payment'?'出金':'区分要確認','cash-kind'),node('div',entry.title||'(件名なし)','hub-title'),node('div',(entry.date||'日付未確認')+'｜'+(entry.amount_label||K.amountLabel(entry.amount))+(entry.estimate?'｜見込':'')+(entry.done?'｜消込済み':''),'muted'));if(entry._viewOrigin)content.append(node('div','確認用：'+entry._viewOrigin,'muted'));row.append(content);return row;}
const unverified=x=>x.source==='google'&&x.googleUnverified===true;
function calendarRows(date,money=displayMoneyItems()){const all=K.entries(items(),money,date);return {main:all.filter(x=>!unverified(x)),pending:all.filter(unverified)};}
function appendUnverified(container,rows){const pending=rows.filter(unverified);if(!pending.length)return;const box=node('details',undefined,'hub-unverified');box.append(node('summary','Google未確認の保存済み記録 '+pending.length+'件'),node('p','今回の取得で確認できなかった記録です。通常一覧と分けて保管しています。元の記録は削除していません。','muted'));for(const entry of pending)box.append(calendarEntry(entry));container.append(box);}
function calendarEntry(entry){if(entry.entry_kind==='money')return moneyViewRow(entry);const item=items().find(x=>x._key===entry.stable_key);return item?itemRow(item):node('p','記録の対応を確認できません','muted');}
function renderSelected(){return withViewData(buildSelected);}
function buildSelected(){const {main:rows,pending}=calendarRows(selected),container=$('hubSelectedRows');$('hubSelectedTitle').textContent=selected+' の予定';container.replaceChildren();if(!rows.length)container.append(node('p',pending.length?'未確認の保存済み記録があります。下の別枠から開けます。':'予定・入出金はありません','empty'));else rows.forEach(x=>container.append(calendarEntry(x)));appendUnverified(container,pending);}
function renderCalendar(){return withViewData(buildCalendar);}
function buildCalendar(){
 const container=$('hubCalendar'),mode=['week','day'].includes($('hubView').value)?$('hubView').value:'month',days=K.calendarDays(anchor,mode),money=displayMoneyItems();container.replaceChildren();$('hubMonth').value=anchor.slice(0,7);$('hubYear').value=anchor.slice(0,4);$('hubMonthNumber').value=String(Number(anchor.slice(5,7)));
 $('calendar').className='panel '+mode+'-mode';for(const [id,view] of [['hubMonthView','month'],['hubWeekView','week'],['hubDayView','day']])$(id).setAttribute('aria-pressed',String(mode===view));$('hubToday').textContent='今日';$('hubCalendarSelectedCard').hidden=mode==='day';
 $('hubPeriod').textContent=mode==='month'?Number(anchor.slice(0,4))+'年'+Number(anchor.slice(5,7))+'月':mode==='week'?days[0]+' 〜 '+days[6]:Number(anchor.slice(5,7))+'月'+Number(anchor.slice(8))+'日（'+['日','月','火','水','木','金','土'][new Date(anchor+'T12:00:00Z').getUTCDay()]+'）';$('hubPeriod').setAttribute('aria-label',mode==='day'?anchor+' の予定':$('hubPeriod').textContent);
 const holidayKnown=HubHolidays.isHoliday(anchor)!==null;$('hubHolidayNotice').textContent=holidayKnown?'':anchor.slice(0,4)+'年の祝日データは未収録です。';
 if(mode==='month'){
  const grid=node('div',undefined,'hub-grid cal');for(const label of ['日','月','火','水','木','金','土'])grid.append(node('div',label,'hub-weekday dow'));
  for(const date of days){const {main:entries,pending}=calendarRows(date,money),dow=new Date(date+'T12:00:00Z').getUTCDay(),holiday=HubHolidays.isHoliday(date)===true,cell=button('',()=>{const openWeek=date===today();selected=date;if(openWeek){anchor=date;$('hubView').value='week';}renderCalendar();if(openWeek)scrollCalendarToday();});cell.dataset.date=date;
   cell.className='hub-cell day month-day'+(date===today()?' today':'')+(date===selected?' month-selected':'')+(dow===0?' sun':dow===6?' sat':'')+(holiday?' holiday':'')+(date.slice(0,7)!==anchor.slice(0,7)?' muted-day':'');cell.setAttribute('aria-label',date+' '+entries.length+'件'+(pending.length?'｜未確認 '+pending.length+'件':'')+(holiday?' '+HubHolidays.name(date):''));cell.setAttribute('aria-pressed',String(date===selected));cell.append(node('span',String(Number(date.slice(-2))),'daynum month-date'));
   const group=node('span',undefined,'month-events');for(const entry of entries){const line=node('span',undefined,'month-event'+(entry.entry_kind==='money'?' month-money':'')+(entry.done?' month-done':''));if(knownProjects.has(entry.project))line.dataset.project=entry.project;line.append(node('span',entry.time_label||'','month-time'),node('span',(entry.title||'(件名なし)')+(entry.entry_kind==='money'?' '+entry.amount_label:''),'month-title'));line.onclick=event=>{event.stopPropagation();selected=date;renderCalendar();scrollCalendarDetail();};group.append(line);}cell.append(group);if(pending.length)cell.append(node('span','未確認 '+pending.length+'件','month-unverified'));grid.append(cell);
  }container.append(grid);
 }else if(mode==='day'){const day=node('div',undefined,'hub-day dayrow'+(anchor===today()?' today':''));day.dataset.date=anchor;const {main:rows,pending}=calendarRows(anchor,money);if(!rows.length)day.append(node('p',pending.length?'未確認の保存済み記録があります。下の別枠から開けます。':'予定・入出金はありません','empty'));else rows.forEach(x=>day.append(calendarEntry(x)));appendUnverified(day,pending);container.append(day);
 }else for(const date of days){const dow=new Date(date+'T12:00:00Z').getUTCDay(),holiday=HubHolidays.isHoliday(date)===true,day=node('div',undefined,'hub-day weekrow'+(date===today()?' today todayweek':'')+(dow===0?' sun':dow===6?' sat':'')+(holiday?' holiday':''));const choose=button(date+'（'+['日','月','火','水','木','金','土'][dow]+'）'+(holiday?' '+HubHolidays.name(date):''),()=>{selected=date;renderSelected();$('hubCalendar').querySelectorAll('.weekdate').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.date===selected)));});choose.className='weekdate';choose.dataset.date=date;choose.setAttribute('aria-pressed',String(date===selected));day.dataset.date=date;day.append(choose);const {main:rows,pending}=calendarRows(date,money);if(!rows.length)day.append(node('div',pending.length?'未確認の保存済み記録あり':'予定なし','empty'));else rows.forEach(x=>day.append(calendarEntry(x)));appendUnverified(day,pending);container.append(day);}
 renderSelected();
}
function renderWork(){return withViewData(buildWork);}
function buildWork(){const container=$('hubWorkRows');container.replaceChildren();const rows=K.workRows(items(),{period:workPeriod,type:$('hubWorkFilter').value,done:$('hubDoneFilter').value},today());document.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.period===workPeriod)));$('hubWorkPeriodNotice').textContent=workPeriod==='week'?'今日から7日後までの明示された期限を表示します。':workPeriod==='none'?'期限なしのタスクと、期限がまだ明示されていないToDoです。':'';if(!rows.length)container.append(node('p','該当する作業はありません','empty'));rows.forEach(x=>container.append(itemRow(items().find(item=>item._key===x.stable_key)||x)));const lost=items().filter(x=>x.workClassificationLost);if(lost.length){const warning=node('details');warning.append(node('summary','分類の確認が必要な以前の作業 '+lost.length+'件'));for(const item of lost)warning.append(itemRow(item));container.append(warning);}renderNewWorkNotice();}
function renderMoney(){if(globalThis.HubFeatures){HubFeatures.money();return;}const container=$('hubMoneyRows');container.replaceChildren();const rows=moneyItems().filter(x=>typeof x.date==='string'&&x.date.slice(0,7)===$('hubMoneyMonth').value);if(!rows.length)container.append(node('p','この月の保存済み入出金はありません','empty'));for(const x of rows){const row=node('article',undefined,'hub-row'+(x.done?' done':'')),content=node('div');content.append(node('div',x.title||'(件名なし)','hub-title'),node('div',(x.date||'')+'｜'+(x.kind==='income'?'入金':x.kind==='payment'?'出金':'区分要確認')+' '+K.amountLabel(x.amount)+'｜'+(x.done?'消込済み':'未消込'),'muted'));row.append(content);container.append(row);}}

function viewGoogleLink(container,item){if(item.source==='google'&&/^https:\/\/(calendar\.google\.com|www\.google\.com\/calendar)(\/|\?|$)/.test(item.googleUrl||'')){const a=node('a','Googleで開く');a.href=item.googleUrl;a.target='_blank';a.rel='noopener noreferrer';const actions=node('div',undefined,'row-actions');actions.append(a);container.append(actions);}}
const yen=value=>value===null?'要確認':'¥'+Number(value).toLocaleString('ja-JP');
function cashSummary(prefix,section){for(const [suffix,key]of [['Income','income'],['Payment','payment'],['Net','net']])$('home'+prefix+suffix).textContent=yen(section[key]);$('home'+prefix+'Notice').textContent=section.needsConfirmation?'金額・入出金区分を確認できない記録があります。集計は要確認です。':'';}
function cashRows(container,rows){container.replaceChildren();if(!rows.length){container.append(node('p','保存済みの未消込記録はありません','empty'));return;}for(const x of rows)container.append(moneyViewRow(x));}
function renderHome(){const h=HubHome.project(items(),displayMoneyItems(),today());h.todayRows=h.todayRows.filter(x=>!unverified(x));h.todayCount=h.todayRows.length;$('homeTodayCount').textContent=h.todayCount+'件';$('homeWorkCount').textContent=h.incompleteWorkCount+'件';$('homeMoneyTitle').textContent=h.month.replace('-','年')+'月の未消込';cashSummary('Month',h.monthCash);cashSummary('Ahead',h.cashAhead);$('homeCashPeriod').textContent=h.cashAhead.startDate+' 〜 '+h.cashAhead.endDate;$('homeTodayRows').replaceChildren();if(h.todayRows.length)h.todayRows.forEach(x=>$('homeTodayRows').append(itemRow(x)));else $('homeTodayRows').append(node('p','今日の保存済み予定はありません','empty'));appendUnverified($('homeTodayRows'),calendarRows(today(),[]).pending);cashRows($('homeCashRows'),h.cashAhead.rows);$('homeNextCash').hidden=!h.nextCash.rows.length;cashRows($('homeNextRows'),h.nextCash.rows);$('homeDataNotice').textContent=h.invalidDateCount?'日付を確認できない入出金 '+h.invalidDateCount+'件は日付別集計に含めていません。元の記録は保持されています。':'';}
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
async function toggle(item){checkWrite();if(item.googleUnverified)throw Error('Google側の最新状態を確認できないため、完了状態は変更できません。');if(busy)return;const done=!item.done;let completedDate='';if(done){const answer=prompt('「'+item.title+'」の実施日をYYYY-MM-DDで入力してください。不明なら空欄のままOKを押してください。操作時刻と実施日は別に保存します。',item.completedDate||'');if(answer===null)return;completedDate=answer.trim();if(completedDate&&!C.day(completedDate))throw Error('実施日はYYYY-MM-DDで入力してください。不明なら空欄にしてください。');}if(item.source==='google'){if(!confirm('Googleの作業「'+item.title+'」を'+(done?'完了':'未完了')+'にしますか？'))return;busy=true;controls();try{const result=await HubGoogle.complete(item,done,{completedDate,beforeUpdate:async proof=>{const saved=commit('google-before-update',next=>{next.history.push({at:new Date().toISOString(),kind:'previous-google',value:proof.row},{at:new Date().toISOString(),kind:'previous-google-event',calendarId:proof.calendarId,eventId:proof.eventId,value:proof.event});});if(saved)await saved;await verifyCalendarReadback();}});const pendingSave=commit('google-complete',next=>{const old=next.google.find(x=>C.key(x)===item._key);next.history.push({at:new Date().toISOString(),kind:'previous-google',value:old||item});next.google=next.google.filter(x=>C.key(x)!==item._key);next.google.push(result);delete next.edits[item._key];if(!done)next.edits[item._key]={completionDecision:'reopened'};});if(pendingSave)await pendingSave;status('対象のGoogle予定IDで件名の目印・分類・完了状態と保持情報を読み戻し照合しました。実施日が不明なら空欄です。端末への保存は完了しました。');}catch(error){status('Googleへの反映を確認できません：'+error.message+'。再同期して確認してください。');}finally{busy=false;controls();}return;}
 const pendingSave=commit('completion',next=>{next.history.push({at:new Date().toISOString(),kind:'previous-item',value:item});next.edits[item._key]={...next.edits[item._key],done,completedDate:done?completedDate:'',completedAt:done?new Date().toISOString():''};});if(pendingSave)await pendingSave;status('端末の作業を'+(done?'完了':'未完了')+'にしました。');}
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
function chooseCalendarView(mode){if(!['month','week','day'].includes(mode))return;const current=K.calendarDays(anchor,$('hubView').value);if(current.includes(selected))anchor=selected;else selected=anchor;$('hubView').value=mode;renderCalendar();if(mode==='day')scrollCalendarStart();}
for(const [id,mode] of [['hubMonthView','month'],['hubWeekView','week'],['hubDayView','day']])$(id).onclick=()=>chooseCalendarView(mode);for(const id of ['hubYear','hubMonthNumber'])$(id).onchange=()=>{const key=$('hubYear').value+'-'+String($('hubMonthNumber').value).padStart(2,'0')+'-01';if(C.day(key)){anchor=selected=key;renderCalendar();}};
function moveCalendar(step){const mode=$('hubView').value,keepSelected=mode==='week'?K.calendarDays(anchor,mode).includes(selected):mode==='month'&&selected.slice(0,7)===anchor.slice(0,7);anchor=selected=K.shiftPeriod(keepSelected?selected:anchor,mode,step);renderCalendar();if(mode==='day')scrollCalendarStart();}
for(const [id,step]of [['hubPrev',-1],['hubNext',1]])$(id).onclick=()=>moveCalendar(step);$('hubToday').onclick=()=>{anchor=selected=today();renderCalendar();};$('hubSync').onclick=()=>sync().catch(error=>status(error.message));

let calendarScrollRequest=0,calendarDayTimer=null;
function scrollCalendarStart(){const request=++calendarScrollRequest,date=anchor,mode=$('hubView').value;requestAnimationFrame(()=>{if(request!==calendarScrollRequest||panel!=='calendar'||anchor!==date||$('hubView').value!==mode)return;$('hubCalendarMainCard').scrollIntoView({block:'start',behavior:'auto'});});}
// Touch navigation is limited to the calendar surface, never action controls.
// Native vertical scrolling and pinch zoom remain available.
function installCalendarSwipe(){
 const surface=$('hubCalendar');let gesture=null,ignoredClick=null;
 document.addEventListener('pointerdown',event=>{ignoredClick=null;if(gesture&&event.pointerId!==gesture.id)gesture=null;},true);
 surface.addEventListener('pointerdown',event=>{
  if(panel!=='calendar'||!event.isPrimary||!['touch','pen'].includes(event.pointerType)||event.button!==0||event.clientX<24||event.clientX>innerWidth-24||event.target.closest('a,input,select,textarea,summary,button:not(.month-day):not(.weekdate),[contenteditable="true"]'))return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),scroll:scrollY,mode:$('hubView').value,anchor,selected};
 },{passive:true});
 document.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.abs(dy)>24&&Math.abs(dy)>=Math.abs(dx))gesture=null;},{passive:true});
 // Consume only horizontal intent before replacing the touched row. Otherwise
 // Chromium can retain the old touch target and swallow the following tap.
 surface.addEventListener('touchmove',event=>{if(!gesture||event.touches.length!==1||!event.cancelable)return;const touch=event.touches[0],dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.5)event.preventDefault();},{passive:false});
 document.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});
 document.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;const start=gesture;gesture=null;
  const dx=event.clientX-start.x,dy=event.clientY-start.y,threshold=Math.max(48,Math.min(88,surface.clientWidth*.16));
  if(panel!=='calendar'||start.mode!==$('hubView').value||start.anchor!==anchor||start.selected!==selected||performance.now()-start.at>1200||Math.abs(scrollY-start.scroll)>12||Math.abs(dx)<threshold||Math.abs(dx)<=Math.abs(dy)*1.5)return;
  ignoredClick={id:event.pointerId,until:performance.now()+500};
  requestAnimationFrame(()=>{if(panel!=='calendar'||start.mode!==$('hubView').value||start.anchor!==anchor||start.selected!==selected)return;try{moveCalendar(dx<0?1:-1);}catch(error){status(error.message);}});
 },{passive:true});
 surface.addEventListener('click',event=>{if(ignoredClick&&performance.now()<ignoredClick.until&&(event.pointerType==='touch'||event.pointerType==='pen'||event.detail>0)&&(!event.pointerId||event.pointerId===ignoredClick.id)){ignoredClick=null;event.preventDefault();event.stopImmediatePropagation();}},true);
}
installCalendarSwipe();
function refreshCalendarToday(){const date=today();$('hubTodayLabel').textContent=new Date(date+'T12:00:00Z').toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'long'});$('hubCalendar').querySelectorAll('[data-date]').forEach(el=>{if(el.classList.contains('month-day')||el.classList.contains('weekrow')||el.classList.contains('dayrow'))el.classList.toggle('today',el.dataset.date===date);if(el.classList.contains('weekrow'))el.classList.toggle('todayweek',el.dataset.date===date);});}
function scheduleCalendarDay(){clearTimeout(calendarDayTimer);const next=Date.parse(C.addDays(today(),1)+'T00:00:00+09:00');calendarDayTimer=setTimeout(()=>{refreshCalendarToday();scheduleCalendarDay();},Math.max(1000,next-Date.now()+50));}
function positionCalendar(target){if(!target)return;const rect=target.getBoundingClientRect(),viewport=window.visualViewport,top=viewport?.offsetTop||0,bottom=Math.min(window.innerHeight,viewport?top+viewport.height:window.innerHeight,document.querySelector('.hub-nav').getBoundingClientRect().top),middle=(top+Math.max(top,bottom))/2;window.scrollTo({top:Math.max(0,window.scrollY+rect.top+rect.height/2-middle),behavior:'auto'});}
function scrollCalendarToday(){const request=++calendarScrollRequest,date=selected,mode=$('hubView').value;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(request!==calendarScrollRequest||panel!=='calendar'||anchor!==date||selected!==date||$('hubView').value!==mode)return;if(mode==='day')$('hubCalendarMainCard').scrollIntoView({block:'start',behavior:'auto'});else positionCalendar($('hubCalendar').querySelector('[data-date="'+date+'"]'));}));}
function scrollCalendarDetail(){const request=++calendarScrollRequest,date=selected,requestedAnchor=anchor;requestAnimationFrame(()=>{if(request!==calendarScrollRequest||panel!=='calendar'||anchor!==requestedAnchor||selected!==date||$('hubView').value!=='month')return;$('hubSelectedRows').closest('.calendar-selected-card').scrollIntoView({block:'start',behavior:'auto'});});}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCalendarToday();scheduleCalendarDay();}});scheduleCalendarDay();

document.querySelectorAll('[data-panel]').forEach(el=>el.onclick=()=>{if(el.dataset.panel==='calendar'){anchor=selected=today();refreshCalendarToday();navigate('calendar');scrollCalendarToday();}else navigate(el.dataset.panel);});window.addEventListener('popstate',()=>navigate(location.hash.slice(1),false));window.addEventListener('storage',e=>{if(e.key===C.LEGACY||e.key===C.STORAGE){blocked=true;controls();status('他のHUB画面でデータが変わりました。入力を控え、他の画面を閉じて再読み込みしてください。');}});
$('hubDownload').onclick=async()=>{try{$('hubDownload').disabled=true;verified=false;controls();snapshot=await HubSafety.capture();download(snapshot,'toshi-hub-safety-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');$('hubVerify').disabled=false;$('hubVerify').value='';$('hubSafetyStatus').textContent='保存したバックアップを選び、内容を確認してください。';}catch(error){$('hubSafetyStatus').textContent=error.message;}finally{$('hubDownload').disabled=false;}};
$('hubVerify').onchange=async e=>{verified=false;try{const file=e.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw Error('256MB以下のファイルを選んでください');const value=JSON.parse(await file.text());if(!HubSafety.same(snapshot,value))throw Error('いま保存したバックアップと一致しません');verified=true;$('hubSafetyStatus').textContent='バックアップの内容が一致しました。編集と同期を有効にできます。';}catch(error){$('hubSafetyStatus').textContent=error.message;}controls();};$('hubContinue').onclick=()=>activate(true).catch(error=>{$('hubSafetyStatus').textContent=error.message;});
window.addEventListener('hub-money-view-changed',()=>{if(identity)render();});
globalThis.HubApp={syncCalendar:async()=>{if(busy||saving)return {ok:false,message:"予定・ToDoの処理中です。完了を待ってください"};return sync();},items,archiveItem,allItems:()=>renderingAllItems||identity?.displayItems||C.list(legacy,viewOverlay||overlay),money:moneyItems,overlay:()=>structuredClone(overlay),checkWrite,commit,verifyCalendarReadback,navigate,openEditor,render,panel:()=>panel,assetReady:()=>ready&&localStorage.getItem(marker)==='1',canWrite:()=>ready&&!blocked&&!!identity?.ok&&!busy&&!saving};
if(globalThis.HubPersistence)HubPersistence.guardForm($('hubForm'));
(async()=>{try{const reading=read();if(reading)await reading;identity=await HubIdentity.inspect(legacyRaw,legacy,overlay);viewOverlay=identity.displayOverlay;$('hubIdentityStatus').hidden=identity.ok;$('hubIdentityStatus').textContent=identity.message||'';$('hubTodayLabel').textContent=new Date(today()+'T12:00:00Z').toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'long'});for(let year=1900;year<=new Date().getFullYear()+100;year++){const option=node('option',String(year));option.value=String(year);$('hubYear').append(option);}for(let month=1;month<=12;month++){const option=node('option',month+'月');option.value=String(month);$('hubMonthNumber').append(option);}$('hubMoneyMonth').value=today().slice(0,7);$('hubSyncFrom').value=localStorage.getItem('toshi_google_sync_from_v1')||'2020-01-01';$('hubSyncTo').value=C.addDays(today(),100);$('hubSyncStatus').textContent=overlay.syncedAt?'前回同期 '+new Date(overlay.syncedAt).toLocaleString('ja-JP'):'Google未接続。端末の保存済み予定を表示しています。';if(localStorage.getItem(marker)==='1'){panel=location.hash.slice(1)||'home';await activate(false);return;}navigate(location.hash.slice(1)||'home',false);snapshot=await HubSafety.capture();verified=!HubSafety.hasData(snapshot);$('hubBackupSteps').hidden=verified;$('hubSafetyStatus').textContent=verified?'このブラウザに既存のHUB記録はありません。編集と同期を有効にして始められます。':'保存済みデータを読み取り表示しています。編集・同期の前に安全バックアップを保存してください。';controls();}catch(error){blocked=true;controls();$('hubSafetyStatus').textContent='確認できません：'+error.message;}})();
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-offline.js */
try {
(function(root){
 'use strict';const base=new URL('.',document.currentScript?.src||location.href),listeners=[];let registration=null,preparing=null;
 const emit=m=>listeners.forEach(fn=>fn(m));
 async function query(kind){if(!navigator.serviceWorker||!registration)return null;const worker=registration.active;if(!worker)return null;return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},kind==='PAPA_HUB_PREPARE_PDF'?600000:10000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};worker.postMessage({kind},[channel.port2]);});}
 function show(value){emit(value?.core?(value.pdf?'オフライン起動・端末内PDF表示：準備済み':'オフライン起動：準備済み。PDF表示用データは準備待ちです。'):'オフライン起動は準備中または未対応です。今開いている画面の端末データは利用できます。');}
 async function refresh(){show(await query('PAPA_HUB_OFFLINE_STATUS'));}
 async function preparePDF(){if(preparing)return preparing;if(!navigator.onLine){await refresh();return;}if(!registration?.active){emit('オフライン起動の準備中です。少し待ってもう一度押してください。');return;}emit('オフラインPDF表示用のプログラムを準備しています。原本は送信しません。');preparing=query('PAPA_HUB_PREPARE_PDF').then(show).finally(()=>preparing=null);return preparing;}
 root.HubOffline={observe(fn){listeners.push(fn);refresh();},preparePDF,refresh};
 async function start(){if(!navigator.serviceWorker){await refresh();return;}try{registration=await navigator.serviceWorker.register(new URL('hub-offline-worker.js',base),{scope:base.pathname,updateViaCache:'none'});navigator.serviceWorker.addEventListener('controllerchange',refresh);await navigator.serviceWorker.ready;await refresh();}catch{show(null);}}
 const schedule=()=>setTimeout(start,2000);if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});window.addEventListener('online',refresh);
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-board-local.js */
try {
/* Local-only compatibility view. Original assets and previously saved revisions remain intact. */
(function(root){
 'use strict';
 const S=HubBoardStore,$=id=>document.getElementById(id);
 let sequence=0;
 // Cancel only this board's delivery. No calendar/proof consent or user records are changed.
 try{const consent=localStorage.getItem(S.CONSENT);if(consent!==null&&consent!=='off')localStorage.setItem(S.CONSENT,'off');}catch{}
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function action(label,run,write=false){const b=make('button',label);b.type='button';if(write){b.dataset.write='';b.disabled=!HubApp.canWrite();}b.onclick=async()=>{try{await run();}catch(e){$('featureBoardStatus').textContent=e.message;}};return b;}
 const label=p=>(p.type==='note'?'メモ｜':p.type==='file'?'ファイル｜':'リンク｜')+p.title;
 const open=p=>HubFeatures.viewRecord({payload:p});
 async function render(){const seq=++sequence;try{
  const state=await S.read();if(seq!==sequence)return;
  const rows=$('featureBoardRows'),filter=$('featureBoardFilter').value.toLocaleLowerCase(),showHidden=$('featureBoardHidden').checked;
  rows.replaceChildren();
  const history=make('details'),historyRows=make('div');history.append(make('summary','保存済み資料の履歴'),historyRows);
  for(const [entity,heads] of state.heads){
   const hidden=S.hidden(state,entity),active=heads.filter(r=>!r.deleted);
   if((!hidden||showHidden)&&active.length&&active.some(r=>[r.content.title,r.content.text,r.content.url].join('\n').toLocaleLowerCase().includes(filter))){
    const row=make('article',undefined,'hub-row');row.dataset.boardEntity=entity;
    if(active.length>1)row.append(make('p','保存済みの複数の版があります。どの内容も保持しています。','muted'));
    for(const revision of active){const p=S.payload(state,revision);row.append(action(label(p),()=>open(p)));}
    row.append(action(hidden?'一覧に戻す':'どける',async()=>{if(!confirm(hidden?'この資料をこの端末の一覧に戻しますか？':'この端末の一覧からどけますか？原本と履歴は残します。'))return;if(hidden)await S.show(entity);else await S.visibility(entity,true);await render();},true));
    rows.append(row);
   }
   const revisions=state.revisions.filter(r=>r.entity===entity&&!r.deleted);
   if(revisions.length>1||!active.length){
    const item=make('div',undefined,'hub-row');
    for(const revision of revisions){const p=S.payload(state,revision);item.append(action(label(p)+'｜'+(revision.createdAt?new Date(revision.createdAt).toLocaleString('ja-JP'):'以前の保存記録'),()=>open(p)));}
    if(!active.length&&revisions.length){const prior=[...revisions].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];item.append(action('この端末の一覧へ復元',async()=>{if(!confirm('保存済みの内容を、この端末の一覧へ復元しますか？旧版は保持し、Driveへは送信しません。'))return;await S.edit(entity,heads.map(r=>r.id),S.payload(state,prior));await render();},true));}
    historyRows.append(item);
   }
  }
  if(!rows.children.length)rows.append(make('p','表示する資料はありません。検索条件や「どけた資料も表示」を確認してください。','muted'));
  if(historyRows.children.length)rows.append(history);
 }catch(e){if(seq===sequence)$('featureBoardStatus').textContent='資料を確認できません：'+e.message+'。原本と履歴は保持しています。';}}
 async function saveForm(){try{
  HubApp.checkWrite();const type=$('featureBoardType').value,payload={type,title:$('featureBoardTitle').value.trim()};
  if(!payload.title)throw Error('見出しを入力してください');
  if(type==='note'){payload.text=$('featureBoardText').value;if(!payload.text.trim())throw Error('メモを入力してください');}
  else if(type==='url'){payload.url=HubBoardCore.safeURL($('featureBoardURL').value);if(!payload.url)throw Error('http/httpsの資料URLを入力してください');}
  else{const file=$('featureBoardFile').files[0];if(!file||file.size>15*1024*1024||!(/\.(pdf|png|jpe?g|gif|webp|avif|docx?|xlsx?)$/i.test(file.name)))throw Error('15MB以下のPDF・画像・Word・Excelを選んでください');payload.blob=file;payload.mime=file.type;payload.fileName=file.name;}
  await S.add(payload);$('featureBoardForm').reset();$('featureBoardType').onchange();await render();$('featureBoardStatus').textContent='この端末に保存・読み戻し確認しました。Driveへは送信しません。';
 }catch(e){$('featureBoardStatus').textContent=e.message;}}
 root.HubBoardLocal={render,saveForm};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-receipt-workflow.js */
try {
(function(){
 'use strict';
 const C=HubReceiptCore,$=id=>document.getElementById(id),node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(cls)el.className=cls;return el;};
 let data=null,busy=false,prepared=null;const drafts=new Map();
 const status=node('p');status.id='receiptWorkflowStatus';status.setAttribute('role','status');
 const panel=node('section');panel.id='receiptWorkflowPanel';$('featureReceiptDriveSummary').before(panel,status);
 const dialog=node('dialog');dialog.id='receiptCloseDialog';dialog.style.cssText='max-width:560px;width:calc(100% - 32px);box-sizing:border-box';document.body.append(dialog);
 function captureDrafts(){for(const form of document.querySelectorAll('#featureReceiptDriveRows form'))if(form.receiptDirty&&form.receiptRead)drafts.set(form.receiptKey,{fingerprint:form.receiptFingerprint,value:form.receiptRead()});}
 const evidenceState=()=>C.canonical({source:data.source,rows:data.rows,cards:data.cards,closing:data.closing,months:data.months});
 const state=()=>{const value=HubApp.overlay().receiptWorkflowV1;if(value===undefined)return {version:1,audit:[],closings:[],cloud:{}};if(value?.version!==1||!Array.isArray(value.audit)||!Array.isArray(value.closings)||!value.cloud||typeof value.cloud!=='object')throw Error('領収書の管理履歴を確認できません。既存データは保持しています');return value;};
 async function append(kind,change){HubApp.checkWrite();const pending=HubApp.commit(kind,next=>{let value=next.receiptWorkflowV1;if(value===undefined)value=next.receiptWorkflowV1={version:1,audit:[],closings:[],cloud:{}};if(value?.version!==1||!Array.isArray(value.audit)||!Array.isArray(value.closings)||!value.cloud)throw Error('管理履歴の構造を確認できません');change(value);});if(pending)await pending;const stored=localStorage.getItem(HubCore.STORAGE),raw=await HubPersistence.load(stored);HubApp.checkWrite();if(C.canonical(JSON.parse(raw))!==C.canonical(HubApp.overlay()))throw Error('領収書管理の端末読み戻しが一致しません');}
 const action=(label,work,write=false)=>{const b=node('button',label);b.type='button';if(write){b.dataset.write='';b.disabled=!HubApp.canWrite()||busy;}b.onclick=async()=>{if(busy)return;try{await work();}catch(e){status.textContent=e.message||'領収書の操作を確認できません';}};return b;};
 function link(label,url){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 function field(label,type,value){const l=node('label',label),i=node('input');i.type=type;if(type==='checkbox')i.checked=value===true;else i.value=value||'';l.append(i);return {label:l,input:i};}
 const yen=x=>Number.isSafeInteger(x)?x.toLocaleString('ja-JP')+'円':'金額要確認';
 function tabUrl(sheetId){return 'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(data.source.fileId)+'/edit#gid='+sheetId;}
 function selectedMonth(){return $('featureReceiptMonth').value;}
 function monthData(month){return C.monthRows(data.rows,month);}
 function sheetEvidence(month,rows){const report=data.months.rows.find(r=>r.month===month);return {report,matches:!!report&&report.count===rows.length&&report.amount===rows.reduce((n,r)=>n+(r.amount||0),0)};}
 function render(next){
  captureDrafts();if(next)data=next;if(!data?.source)return;
  try{const local=state(),month=selectedMonth(),all=monthData(month),rows=C.monthRows(data.rows,month,$('featureReceiptCompany').value),total=C.summary(rows,local.audit,data.cards.rows),fullTotal=C.summary(all,local.audit,data.cards.rows),external=data.closing.rows.filter(r=>r.month===month),evidence=sheetEvidence(month,all),closed=local.closings.filter(s=>s.source.fileId===data.source.fileId&&s.source.sheetId===data.source.sheetId&&s.month===month);
   panel.replaceChildren(node('h3','月別集計・経理提出区分'),node('p','元の「台帳」だけを取込元にしています。月別シートとカード明細は参照用です。金額を重ねて合算しません。','muted'));
   $('featureReceiptDriveSummary').textContent=rows.length+'件｜合計 '+yen(total.amount)+(total.invalidAmounts?'（金額未確認 '+total.invalidAmounts+'件を除く）':'')+'｜台帳リンクあり '+rows.filter(r=>r.photo).length+'件｜前回読込 '+new Date(data.at).toLocaleString('ja-JP');
   const totals=node('div');totals.className='receipt-totals';for(const group of C.GROUPS){const t=total.totals[group];totals.append(node('p',group+'：'+t.count+'件／'+yen(t.amount)));}panel.append(totals,node('p','支払区分・用途・税務・インボイスの確認は別々です。元台帳の「確定」だけでは確認済みにしません。','muted'));
   if(data.rows.some(r=>!r.date))panel.append(node('p','日付を確認できない記録 '+data.rows.filter(r=>!r.date).length+'件があります。月別集計に含まれません。','diary-warning'));
   panel.append(node('h3','月末締めと翌月5日頃の提出'));
   if(month){panel.append(node('p','対象月：'+month+'｜全社 '+all.length+'件／'+yen(fullTotal.amount)));
    if(evidence.report)panel.append(link('Googleの月別提出一覧を開く',tabUrl(evidence.report.sheetId)),node('p',evidence.matches?'月別一覧の件数・合計は元台帳と一致しています。':'月別一覧と元台帳の件数・合計が不一致です。再読込して確認してください。',evidence.matches?'muted':'diary-warning'));
    else panel.append(node('p','この月の月別シートは未作成または取得未確認です。','diary-warning'));
    if(data.closing.status==='success'){if(!external.length)panel.append(node('p','Googleの締め管理にこの月の記録はありません。','diary-warning'));for(const x of external){panel.append(node('p','Googleの締め状況：'+(x.status||'未記載')+'｜カード照合：'+(x.cardStatus||'未記載')),node('p','月末予定 '+(x.monthEnd||'未記載')+'｜送付目安 '+(x.sendTarget||'未記載')+'｜送信日 '+(x.sentAt||'未記載')+'｜受領日 '+(x.receivedAt||'未記載')),node('p',x.note,'muted'));if(x.fixedLink)panel.append(link('Google管理表の固定版を開く',x.fixedLink));else panel.append(node('p','過去の提出版リンクは未登録です。現在の一覧を当時の提出版とは扱いません。','muted'));}panel.append(link('Googleの月末締め管理を開く',tabUrl(data.closing.sheetId)));}
    else panel.append(node('p','Googleの締め管理は取得・確認が未完了です。','diary-warning'));
    panel.append(node('p',data.cards.status==='success'?'カード明細：'+data.cards.rows.filter(r=>r.date.slice(0,7)===month).length+'件（利用月）。候補だけでは照合済みにしません。':'カード明細を確認できていません。照合済みにはしません。',data.cards.status==='success'?'muted':'diary-warning'));
    panel.append(action('締め版を確認して保存',prepareClose,true));
   }else panel.append(node('p','固定版を作るときは月を選んでください。','muted'));
   if(globalThis.HubReceiptCloudUI)HubReceiptCloudUI.controls(panel);
   panel.append(node('p','自動締め・自動メール送信は行いません。送信日・受領日は実施後にGoogleの管理表へ記録してください。','muted'));
   for(const s of closed){const delta=C.changes(s,data.rows,local.audit,data.cards.rows),entry=node('details'),sum=node('summary',(s.kind==='submission'?'確認済み提出版':'未確認を含む固定作業版')+'｜'+new Date(s.createdAt).toLocaleString('ja-JP')+'｜'+s.totals.count+'件／'+yen(s.totals.amount));entry.append(sum,node('p','保存後の追加 '+delta.added.length+'件・訂正 '+delta.corrected.length+'件・確認状態の差分 '+delta.reviewChanged.length+'件・元台帳から見つからない記録 '+delta.removed.length+'件。以前の固定版は保持しています。'),action('固定版CSVを保存',()=>download(s,false)),action('固定版JSONを保存',()=>download(s,true)));
    const remote=local.cloud[s.id];if(remote?.state==='confirmed'&&remote.fileId)entry.append(link('Driveの固定版を開く','https://drive.google.com/file/d/'+encodeURIComponent(remote.fileId)+'/view'),node('p','Googleへの保存・読み戻し確認済み。他端末の表示確認は別です。','muted'));else entry.append(node('p','Googleへの固定版保存は未確認です。端末内の固定版は保存済みです。','muted'));
    if(globalThis.HubReceiptCloudUI)entry.append(action(remote?.state==='confirmed'?'同じ固定版のDrive保存を確認':'この固定版をDriveに保存する',()=>HubReceiptCloudUI.prepare(s),true));panel.append(entry);
   }
   $('featureReceiptDriveRows').replaceChildren();for(const r of rows){const v=C.resolved(r,local.audit),draft=drafts.get(r.key),draftValue=draft?.fingerprint===C.fingerprint(r)?draft.value:null,rec=C.reconciliation(r,local.audit,data.cards.rows),wrap=node('article',undefined,'hub-row');wrap.dataset.receiptKey=r.key;wrap.append(node('h3','No '+r.no+'｜'+(r.date||'日付要確認')+'｜'+yen(r.amount)),node('p',r.company+'｜'+r.vendor),node('p','内容：'+(r.purpose||'未記載（用途を要確認）')),node('p','提出区分：'+v.group+'｜実際の決済方法：'+v.method),node('p','支払方法（K列）：'+(r.payment||'未記載'),'muted'),node('p','補足（Q列）：'+(r.note||'未記載'),'muted'),node('p','カード明細：'+rec.status),node('p','台帳の状態：'+(r.state||'未記載')+'｜インボイス記載：'+(r.invoice||'未記載')+'｜登録番号：'+(r.registration||'未記載'),'muted'));
    if(v.conflict||v.stale)wrap.append(node('p',v.stale?'元台帳が変更されています。以前の確認は履歴に残し、再確認してください。':'支払区分の根拠に食い違いがあります。本人が確認するまで要確認です。','diary-warning'));
    if(r.photo)wrap.append(link('台帳に記載された原本リンクを開く',r.photo),node('p','リンク先の原本閲覧は別確認です。','muted'));else wrap.append(node('p','原本未対応付け：'+(r.photoReference||'参照情報なし')+'。ファイル名・PDFページだけでは推測して結び付けません。','diary-warning'));
    const check=node('details');check.append(node('summary','支払・用途・税務・インボイスとカード明細を確認'));
    const form=node('form'),groupLabel=node('label','経理への提出区分'),group=node('select');for(const name of C.GROUPS){const option=node('option',name);option.value=name;group.append(option);}group.value=draftValue?.group||v.group;groupLabel.append(group);form.append(groupLabel);
    const controls={};for(const [name,label] of [['paymentConfirmed','支払区分を本人確認した'],['purposeConfirmed','用途を確認した'],['taxConfirmed','税務・勘定科目を確認した'],['invoiceConfirmed','インボイスの有無・内容を確認した']]){const item=field(label,'checkbox',draftValue?draftValue[name]:v[name]);controls[name]=item.input;form.append(item.label);}
    const statementLabel=node('label','法人カード明細との対応（候補は自動確定しません）'),select=node('select'),empty=node('option','未照合');empty.value='';select.append(empty);const candidateKeys=new Set(C.matches(r,data.cards.rows));for(const s of data.cards.rows.filter(s=>candidateKeys.has(s.key)||s.key===v.statementKey)){const o=node('option','明細No '+s.no+'｜'+s.date+'｜'+s.vendor+'｜'+yen(s.amount)+'｜'+s.payment+(s.receiptMatch?'｜明細の記載：'+s.receiptMatch:''));o.value=s.key;select.append(o);}const retainedKey=draftValue?.statementKey??v.statementKey;if(retainedKey&&![...select.options].some(o=>o.value===retainedKey)){const missing=node('option','以前の選択（明細未取得・要再確認）：'+retainedKey);missing.value=retainedKey;select.append(missing);}select.value=retainedKey;statementLabel.append(select);form.append(statementLabel,node('p','前後1日の同額・同じ会社を候補にします。店名、実際のカード、深夜の日付差を本人が確認してください。','muted'));
    if(draft&&draft.fingerprint!==C.fingerprint(r)){const old=node('textarea');old.readOnly=true;old.rows=3;old.value=JSON.stringify(draft.value);form.append(node('p','元台帳が変わったため以前の下書きは自動適用しません。未保存の入力を下に保持しています。','diary-warning'),old);}
    form.receiptKey=r.key;form.receiptFingerprint=C.fingerprint(r);form.receiptDirty=!!draftValue;form.receiptRead=()=>({group:group.value,...Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c.checked])),statementKey:select.value});form.oninput=form.onchange=e=>{if(e.target===group&&group.value!=='カード（法人）')select.value='';form.receiptDirty=true;drafts.set(r.key,{fingerprint:C.fingerprint(r),value:form.receiptRead()});};
    const save=node('button','この領収書の確認を端末に保存');save.type='submit';save.dataset.write='';save.disabled=!HubApp.canWrite();form.append(save);form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{HubApp.checkWrite();const current=data.rows.find(x=>x.key===r.key);if(!current||C.fingerprint(current)!==C.fingerprint(r))throw Error('確認中に元台帳の内容が変わりました。再確認してください');const chosen=data.cards.rows.find(x=>x.key===select.value);if(select.value&&!candidateKeys.has(select.value))throw Error('同額・同じ会社・前後1日の明細か確認してください');if(select.value&&group.value!=='カード（法人）')throw Error('現預金の領収書に法人カード明細を対応付けません');const value={group:group.value,...Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c.checked])),statementKey:chosen?.key||'',statementFingerprint:chosen?C.fingerprint(chosen):''};const event={id:crypto.randomUUID(),kind:'receipt-review',key:r.key,fingerprint:C.fingerprint(r),at:new Date().toISOString(),value};captureDrafts();busy=true;for(const input of document.querySelectorAll('#featureReceiptDriveRows input,#featureReceiptDriveRows select,#featureReceiptDriveRows button'))input.disabled=true;status.textContent='確認内容を端末に保存しています…';await append('receipt-review',x=>x.audit.push(event));if(C.canonical(state().audit.find(x=>x.id===event.id))!==C.canonical(event))throw Error('確認履歴の読み戻しが一致しません');drafts.delete(r.key);form.receiptDirty=false;status.textContent='確認を端末に保存・読み戻し確認済みです。元台帳K列・Q列やGoogleの締め管理は変更していません。';}catch(error){status.textContent=error.message;}finally{busy=false;render();}};check.append(form);wrap.append(check);$('featureReceiptDriveRows').append(wrap);}
  }catch(e){status.textContent=e.message;}
 }
 function download(s,json){const content=json?JSON.stringify(s,null,2):HubExport.csv(C.csvRows(s));HubExport.download(new Blob([content],{type:json?'application/json':'text/csv;charset=utf-8'}),s.month+'_'+(s.kind==='submission'?'締め':'作業版')+'_'+s.id+(json?'.json':'.csv'));}
 async function prepareClose(){if(busy)return;HubApp.checkWrite();const month=selectedMonth();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('固定版を保存する月を選んでください');const fileId=data.source.fileId;busy=true;status.textContent='元台帳を再読込して、固定版の対象を確認しています…';try{const fresh=await HubReceipts.read($('featureReceiptSheet').value);if(fresh.source.fileId!==fileId)throw Error('確認中に台帳が変わりました');await HubFeatures.setReceiptDrive(fresh);const local=state(),rows=monthData(month),total=C.summary(rows,local.audit,data.cards.rows),evidence=sheetEvidence(month,rows),ready=total.ready&&data.cards.status==='success'&&data.closing.status==='success'&&data.months.status==='success'&&evidence.matches;prepared={source:{...data.source,at:data.at},rows,audit:local.audit,statements:data.cards.rows,month,auditBefore:C.canonical(local.audit),rowsBefore:C.canonical(rows),evidenceBefore:evidenceState(),ready};
   dialog.replaceChildren(node('h2',month+' の固定版を保存'),node('p','全社 '+rows.length+'件／'+yen(total.amount)),node('p','支払・用途・税務・インボイスの未確認 '+total.unreviewed+'件／カード未照合 '+total.unmatched+'件'),node('p','今の一覧を値として端末に固定保存します。以前の提出版は上書きしません。過去に提出した月でも、この操作で当時の提出版を再現したことにはなりません。Googleの元台帳・月別シート・締め管理を変更せず、メールも送信しません。','muted'));
   const form=node('form'),label=node('label','固定版の種類'),kind=node('select');for(const [value,title] of [['working','未確認を含む固定作業版'],['submission','確認済み提出版（すべての確認後）']]){const o=node('option',title);o.value=value;o.disabled=value==='submission'&&!ready;kind.append(o);}label.append(kind);const agree=field('件数・合計・未確認事項と保存先を確認しました','checkbox',false),save=node('button','この内容を端末に固定保存');save.type='submit';save.disabled=true;agree.input.onchange=()=>save.disabled=!agree.input.checked;const cancel=action('閉じる',()=>{prepared=null;dialog.close();});form.append(label,agree.label,save,cancel);form.onsubmit=async e=>{e.preventDefault();if(!prepared||!agree.input.checked||busy)return;try{busy=true;save.disabled=true;HubApp.checkWrite();const p=prepared;if(C.canonical(state().audit)!==p.auditBefore||C.canonical(monthData(p.month))!==p.rowsBefore||evidenceState()!==p.evidenceBefore)throw Error('確認中に記録が変わりました。固定版を作り直してください');if(kind.value==='submission'&&!p.ready)throw Error('未確認の項目があります');const previous=state().closings.filter(s=>s.source.fileId===p.source.fileId&&s.source.sheetId===p.source.sheetId&&s.month===p.month).at(-1),snapshot=C.snapshot({...p,kind:kind.value,now:new Date().toISOString(),id:crypto.randomUUID(),parentId:previous?.id||null});await append('receipt-close',x=>x.closings.push(snapshot));if(C.canonical(state().closings.find(s=>s.id===snapshot.id))!==C.canonical(snapshot))throw Error('固定版の端末読み戻しが一致しません');status.textContent=(snapshot.kind==='submission'?'確認済み提出版':'未確認を含む固定作業版')+'を端末に保存・読み戻し確認済みです。Googleへの保存は別操作です。';prepared=null;dialog.close();}catch(error){status.textContent=error.message;}finally{busy=false;render();}};dialog.append(form);status.textContent='保存前の確認画面を開きました。まだ固定版は保存していません。';dialog.showModal();
  }finally{busy=false;render();}
 }
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else prepared=null;});
 globalThis.HubReceiptWorkflow={render,state,append,data:()=>data,status:message=>status.textContent=message,download};
})();

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-receipt-cloud-ui.js */
try {
(function(){
 'use strict';
 const W=HubReceiptWorkflow,C=HubReceiptCore,node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
 const dialog=node('dialog');dialog.id='receiptCloudDialog';dialog.style.cssText='max-width:560px;width:calc(100% - 32px);box-sizing:border-box';document.body.append(dialog);let active=false,selected=null;
 function prepare(snapshot){if(active)return;HubApp.checkWrite();const source=snapshot?.source||W.data()?.source;if(!source)throw Error('先に元台帳を読み込んでください');if(snapshot)C.validateSnapshot(snapshot);selected={snapshot,source:{...source},canonical:snapshot?C.canonical(snapshot):null};dialog.replaceChildren(node('h2',snapshot?'この固定版を非公開Driveへ保存':'非公開Driveの固定版を端末に追加'));
  dialog.append(node('p','保存先：接続する本人のマイドライブ内の非公開「'+HubReceiptCloud.FOLDER+'」専用フォルダ。保存時の初回だけ作成します。共有設定や元画像は変更しません。'),node('p',snapshot?'送る内容：この固定版の領収書明細（金額・支払先・用途・支払方法・補足）、確認状態、元台帳No、原本リンク。写真本体と認証情報は送りません。ナミ向けの同期確認記録とは別の、領収書提出用の固定版です。':'この元台帳に対応する固定版を読み取り、内容と保存先を検証して端末へ追加します。今の確認履歴や提出版を上書きせず、空のブラウザの安全制限解除や元データの復元は行いません。'),node('p','使う権限：HUBが作成・許可されたファイルのdrive.file。Drive全体の権限は求めません。Googleの接続画面が出る場合があります。自動保存・自動締め・自動メール送信は行いません。元台帳・月別シート・月末締め管理には書き込みません。'));
  const form=node('form'),label=node('label'),agree=node('input');agree.type='checkbox';label.append(agree,document.createTextNode('内容・非公開の保存先・権限と、この1回の操作を了承します'));const result=node('p');result.id='receiptCloudStatus';result.setAttribute('role','status');const submit=node('button',snapshot?'この固定版だけをDriveに保存':'固定版を読み取り端末へ追加');submit.type='submit';submit.disabled=true;agree.onchange=()=>submit.disabled=active||!agree.checked;const cancel=node('button','閉じる');cancel.type='button';cancel.onclick=()=>{if(!active){selected=null;dialog.close();}};form.append(label,result,submit,cancel);dialog.append(form);dialog.showModal();
  form.onsubmit=async e=>{e.preventDefault();if(active||!agree.checked||!selected)return;const target=selected;active=true;submit.disabled=true;agree.disabled=true;cancel.disabled=true;result.textContent='非公開の保存先と内容を確認しています…';
   try{HubApp.checkWrite();if(W.data()?.source.fileId!==target.source.fileId)throw Error('SOURCE_CHANGED');const transport=HubReceiptCloud.create({approved:()=>active&&HubApp.canWrite()&&W.data()?.source.fileId===target.source.fileId,authorize:()=>HubGoogle.connectForProof(),state:W.state,append:W.append,core:C});if(target.snapshot){const saved=W.state().closings.find(s=>s.id===target.snapshot.id);if(C.canonical(saved)!==target.canonical)throw Error('SNAPSHOT_CHANGED');await transport.upload(saved);result.textContent='この固定版をGoogle Driveへ保存し、読み戻した内容の一致を確認しました。元台帳とGoogleの締め管理は変更していません。Flip8・Fold8それぞれの画面への反映は別確認です。';}
    else{const records=await transport.list(target.source);await W.append('receipt-cloud-import',state=>{for(const entry of records){const s=entry.snapshot,old=state.closings.find(x=>x.id===s.id),remote=state.cloud[s.id];if(old&&C.canonical(old)!==C.canonical(s))throw Error('同じ固定版IDに異なる内容があります。以前の固定版を保持します');if(remote?.fileId&&remote.fileId!==entry.fileId)throw Error('固定版の保存先が複数あります。以前の履歴を保持します');if(!old)state.closings.push(s);state.cloud[s.id]={state:'confirmed',fileId:entry.fileId,at:new Date().toISOString()};}});result.textContent=records.length+'件の固定版をDriveから読み取り、端末への追加と読み戻しを確認しました。現在の確認欄は上書きしていません。';}
    W.status(result.textContent);selected=null;
   }catch(error){const p=HubProofDrive.describe(error,'LOCAL');result.textContent='この操作の完了は未確認です。'+p.message+' '+p.detail+'。端末の固定版と元データは保持しています。同じ操作から再試行できます。';W.status(result.textContent);}
   finally{active=false;agree.checked=false;agree.disabled=false;cancel.disabled=false;submit.disabled=true;W.render();}
  };
 }
 function controls(panel){const b=node('button','Driveの固定版を読み込む');b.type='button';b.dataset.write='';b.disabled=!HubApp.canWrite()||active;b.onclick=()=>{try{prepare(null);}catch(error){W.status(error.message);}};panel.append(b,node('p','固定版はまず端末に保存します。Drive保存・他端末への追加は、内容を確認して行う別操作です。','muted'));}
 dialog.addEventListener('cancel',e=>{if(active)e.preventDefault();else selected=null;});
 globalThis.HubReceiptCloudUI={prepare,controls};
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
   if(checked.changes.some(c=>c.kind==='money'))globalThis.HubMoneySync?.guardLegacy();
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
 const CODES=new Set(['TRANSMISSION_NOT_APPROVED','DIFFERENT_DEVICE','FLIP8_TEST_ONLY','DRIVE_AUTH_REQUIRED','DRIVE_NETWORK_UNCONFIRMED','DRIVE_HTTP_ERROR','DRIVE_RESPONSE_INVALID','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE','GOOGLE_AUTH_UNAVAILABLE','GOOGLE_POPUP_BLOCKED','GOOGLE_POPUP_CLOSED','GOOGLE_AUTH_FAILED','GOOGLE_ACCESS_DENIED','GOOGLE_INVALID_SCOPE','GOOGLE_AUTH_RESPONSE_INVALID','GOOGLE_ACCOUNT_REQUIRED','GOOGLE_ACCOUNT_MISMATCH','GOOGLE_ACCOUNT_VERIFY_FAILED','GOOGLE_ACCOUNT_UNVERIFIED','GOOGLE_ACCOUNT_READ_REQUIRED']);
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
  else if(d.code.startsWith('GOOGLE_ACCOUNT_'))message='本人設定と接続アカウントを確認できないため送信を停止しました。ホームの同期用Googleアカウントを確認してください。';
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
   if(typeof grant.assertValid!=='function')throw failure('GOOGLE_ACCOUNT_UNVERIFIED',undefined,'AUTH');
   grant.assertValid();
   const api=async(path,options={},stage='DRIVE')=>{
    if(approved()!==true||await beforeRequest()!==true||approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
    grant.assertValid();
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
 const VERSION='1.2.31',store=new HubProofStore(),$=id=>document.getElementById(id);
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
 async function finish(attempt,states,{allowSend=true}={}){if(!attempt)return;try{const record=await store.finish(attempt,states);message((record.localSaveVerified?'端末への保存・読み戻しを確認しました。':'保存未確認または部分失敗の記録を残しました。')+' Google版との独立照合・画面表示は未確認です。');if($('hubProofSettings').open)await refresh();if(allowSend&&HubProofContinuous.enabled())void HubProofContinuous.send(record);}catch{message('確認記録の保存・読み戻しを確認できません。HUB未確認です。予定・ダイアリーの同期結果は上の表示で確認してください。');}}
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
 function show(states){proofStates=states;box.hidden=false;box.replaceChildren(text('h2','Googleまとめ同期'));for(const s of states)box.append(text('p',s.label+'：'+s.message));if(states.length&&states.every(x=>x.status==='success'))box.append(text('p',states.map(x=>x.label).join('・')+'の同期が完了しました。'));else if(states.some(x=>x.status==='failed'||x.status==='skipped')&&!states.some(x=>x.status==='running'||x.status==='waiting'))box.append(text('p','未完了の項目があります。表示を確認して、もう一度同期してください。'));if(globalThis.HubProof)box.append(text('p','ナミ向け確認記録：'+(HubProof.transmissionApproved()?'このFlip8では同期後に送信します。結果はホームで確認してください。':'自動送信OFF。結果はホームで確認できます。')+'Google最新版との一致・画面表示は未確認です。'));}
 function lock(){for(const button of buttons){button.dataset.unverified=String(active);button.disabled=active||!HubApp.canWrite();}}
 async function syncAll(){
  if(active)return;
  active=true;lock();let authorized=false;
  try{
   HubApp.checkWrite();proofStates=[];proofAttempt=globalThis.HubProof?await HubProof.begin():null;const diary=globalThis.HubDiarySync?.state();
   const from=document.getElementById('hubSyncFrom').value,to=document.getElementById('hubSyncTo').value;
   const calendarEligible=HubCore.day(from)&&HubCore.day(to)&&from<=to;
   const diaryEligible=!!diary?.ready&&!!diary.configured&&!diary.busy;
   const money=globalThis.HubMoneySync?.state(),moneyConfigured=!!money?.configured;
   await runner.run({concurrent:true,jobs:[
    {key:'calendar',label:'予定・ToDo',eligible:calendarEligible,reason:'同期する期間を確認してください',scopes:HubGoogle.SCOPE.split(/\s+/),sync:()=>HubApp.syncCalendar()},
    {key:'diary',label:'ダイアリー',eligible:diaryEligible,reason:!diary?.ready?'保存領域の準備中です。完了後にもう一度同期してください':!diary.configured?'台帳未設定です。ダイアリー画面で設定してください':'ダイアリーの処理中です。完了を待ってください',scopes:[globalThis.HubDiarySync?.SCOPE||''],sync:grant=>HubDiarySync.syncWithGrant(grant)},
    ...(moneyConfigured?[{key:'money',label:'お金',eligible:!!money.ready&&!money.busy,reason:'お金の処理中です。完了後に再試行してください',scopes:HubMoneySync.SCOPE.split(/\s+/),sync:grant=>HubMoneySync.syncWithGrant(grant)}]:[])
   ],authorize:async eligible=>{const grant=await HubGoogle.connectForSync({calendar:eligible.some(x=>x.key==='calendar'),diary:eligible.some(x=>x.key==='diary'),money:eligible.some(x=>x.key==='money'),proof:globalThis.HubProof?.transmissionApproved()===true});authorized=true;return grant;},onChange:show});
  }catch(error){show([{key:'all',label:'同期開始',status:'failed',message:error.message}]);}
  finally{if(globalThis.HubProof)await HubProof.finish(proofAttempt,proofStates,{allowSend:authorized});proofAttempt=null;active=false;lock();}
 }
 for(const button of buttons)button.onclick=syncAll;
 for(const id of ['hubSync','diarySync']){const button=document.getElementById(id),original=button.onclick;button.onclick=function(e){if(!active)return original?.call(this,e);};}
 const accountInput=document.getElementById('hubGoogleAccountEmail'),accountStatus=document.getElementById('hubGoogleAccountStatus');
 function accountStatusText(){try{accountStatus.textContent='この端末の同期先：'+HubGoogle.account().email+'。同期時に実際の接続アカウントを照合します。';}catch(error){accountStatus.textContent=error.message;}}
 document.getElementById('hubGoogleAccountSave').onclick=()=>{
  try{HubApp.checkWrite();if(active)throw Error('同期が終わってから設定してください');
   const email=accountInput.value.trim();if(!accountInput.reportValidity())return;
   if(!confirm('この端末の同期用Googleアカウントを次のアドレスに設定しますか？\n'+email+'\n本人のGoogleアカウントの正式なメールアドレスであることを確認してください。既存の予定・日記・送信先は移動しません。'))return;
   HubGoogle.saveAccount(email,{confirmed:true});accountInput.value='';accountStatusText();
  }catch(error){accountStatus.textContent=error.message;}
 };
 document.getElementById('hubGoogleAccountSelect').onclick=async()=>{
  try{HubApp.checkWrite();if(active)throw Error('同期が終わってから選び直してください');accountStatus.textContent='Googleアカウントを確認しています…';await HubGoogle.selectAccount();accountStatus.textContent='本人設定との一致を確認しました。同期ボタンから同期してください。';}
  catch(error){accountStatus.textContent=error.message;}
 };
 window.addEventListener('storage',accountStatusText);accountStatusText();
 globalThis.HubSyncAll={sync:syncAll,active:()=>active};
}());

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money-ledger.js */
try {
/* Personal money revision protocol. Pure data operations; never writes a bank, rent master or legacy store. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyLedger=api;})(globalThis,function(){
 'use strict';
 const FORMAT='papa-money-ledger',VERSION=1;
 const HEADERS=['履歴ID','記録ID','元の履歴ID','操作','操作日時','端末JSON','入出金JSON','SHA256'];
 const SAMPLE_HEADERS=['比較ID','分割番号','分割数','端末ID','端末名','取得日時','比較データ','SHA256'];
 const VIEW_HEADERS=['照合ID','記録ID','状態','対象月','入出金','件名','予定日','予定額','実入出金日','実績額','消込状態','確認根拠','正本','最新履歴ID','入出金JSON'];
 const SYNC_HEADERS=['送信ID','端末ID','端末名','確認日時','照合ID','履歴件数','記録件数','競合件数','端末比較ID','注記'];
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const fail=message=>{throw Error(message);};
 const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(x);
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const month=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 const integer=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
 const nullable=(x,validate)=>x===null||validate(x);
 const text=(x,max=500)=>typeof x==='string'&&x.length<=max;
 function canonical(value){
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(!plain(value))return fail('JSONの記録形式を確認できません');
  const keys=Object.keys(value).sort();if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return fail('保存できないキーがあります');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 }
 async function hash(value){return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:canonical(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
 function valueCheck(v){
  if(!plain(v)||!['income','payment','unconfirmed'].includes(v.kind)||!text(v.title,300)||!v.title.trim()||!nullable(v.subjectMonth,month)||!nullable(v.plannedDate,date)||!nullable(v.plannedAmount,integer)||typeof v.done!=='boolean'||!Array.isArray(v.actuals)||v.actuals.length>1000||!['hub','rent-master','legacy-unclassified'].includes(v.source?.type))return fail('入出金の区分・対象月・予定日・金額・消込状態を確認してください');
  const ids=new Set();for(const x of v.actuals){if(!plain(x)||!safeId(x.id)||ids.has(x.id)||!nullable(x.date,date)||!nullable(x.amount,integer)||!['unconfirmed','reported','bank-verified','ledger-verified'].includes(x.evidence?.status)||!text(x.evidence?.note||'',2000)||!text(x.evidence?.ref||'',2000))return fail('実績・確認根拠の形式または実績IDが不正です');ids.add(x.id);}
  if(v.businessKey!==null&&!text(v.businessKey,500))return fail('対応キーを確認してください');
  if(!text(v.note||'',4000)||canonical(v).length>40000)return fail('入出金の1件が大きすぎます。元の記録を保持して停止しました');return v;
 }
 function revisionCheck(r){
  if(!plain(r)||r.format!==FORMAT||r.version!==VERSION||!safeId(r.recordId)||!safeId(r.revisionId)||!Array.isArray(r.parents)||r.parents.length>50||r.parents.some(p=>!safeId(p)||p===r.revisionId)||new Set(r.parents).size!==r.parents.length||!['create','edit','settle','reopen','resolve','migrate','rent-refresh'].includes(r.action)||!text(r.at,50)||!Number.isFinite(Date.parse(r.at))||!safeId(r.device?.id)||!text(r.device?.name,80)||!text(r.reason||'',2000))return fail('入出金の履歴ID・元履歴・端末・日時を確認できません');
  valueCheck(r.value);if(!r.parents.length&&!['create','migrate','rent-refresh'].includes(r.action)||r.parents.length&&['create','migrate'].includes(r.action))return fail('履歴の親子関係を確認できません');return r;
 }
 function unsigned(r){const v={...r};delete v.fingerprint;return v;}
 async function seal(r){r={reason:'',...r};revisionCheck(r);return {...copy(unsigned(r)),fingerprint:await hash(unsigned(r))};}
 async function verify(r){revisionCheck(r);if(typeof r.fingerprint!=='string'||await hash(unsigned(r))!==r.fingerprint)return fail('同じ履歴IDの内容またはSHA256が一致しません');return r;}
 function analyze(revisions){
  const byId=new Map(),issues=[],blocked=new Set();
  for(const r of revisions){try{revisionCheck(r);}catch(e){issues.push({recordId:r?.recordId||null,revisionId:r?.revisionId||null,message:e.message});if(r?.recordId)blocked.add(r.recordId);continue;}
   const old=byId.get(r.revisionId);if(old&&canonical(old)!==canonical(r)){blocked.add(old.recordId);blocked.add(r.recordId);issues.push({recordId:r.recordId,revisionId:r.revisionId,message:'同じ履歴IDに違う内容があります。両方を保全し、この記録を未確認にしています'});}else byId.set(r.revisionId,r);
  }
  const ids=new Map();for(const r of byId.values()){if(!ids.has(r.recordId))ids.set(r.recordId,[]);ids.get(r.recordId).push(r);}
  for(const r of byId.values())for(const p of r.parents){const parent=byId.get(p);if(!parent||parent.recordId!==r.recordId){blocked.add(r.recordId);issues.push({recordId:r.recordId,revisionId:r.revisionId,message:'元の履歴が欠けているか、別の記録です'});}}
  // No timestamp wins: cycles, multiple roots and concurrent heads remain explicit conflicts.
  const visiting=new Set(),visited=new Set();function visit(id){if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);const r=byId.get(id);let ok=true;for(const p of r?.parents||[])if(byId.has(p)&&!visit(p))ok=false;visiting.delete(id);visited.add(id);return ok;}
  for(const r of byId.values())if(!visit(r.revisionId)){blocked.add(r.recordId);issues.push({recordId:r.recordId,message:'履歴の循環を検出しました'});}
  const rows=[];for(const [id,history]of ids){const parents=new Set(history.flatMap(r=>r.parents)),heads=history.filter(r=>!parents.has(r.revisionId)).sort((a,b)=>a.revisionId.localeCompare(b.revisionId));let invalid=blocked.has(id);
   for(const r of history){const ps=r.parents.map(p=>byId.get(p)).filter(Boolean);if(ps.some(p=>p.value._migration&&canonical(r.value._migration??null)!==canonical(p.value._migration))){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'移行元の対応履歴が変更されています'});}if(ps.some(p=>p.value.done)&&!r.value.done&&(r.action!=='reopen'&&r.action!=='resolve'||!r.reason?.trim())){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'消込済みを古い未消込で戻す変更を止めました'});}if(r.value.source.type==='rent-master'&&!['rent-refresh','resolve'].includes(r.action)){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'家賃正本の参照記録をHUBの編集として更新できません'});}}
   rows.push({recordId:id,status:invalid?'unverified':heads.length!==1?'conflict':'ready',heads:heads.map(r=>r.revisionId),value:heads.length===1?copy(heads[0].value):null,alternatives:heads.map(copy),history:history.map(copy)});
  }
  const business=new Map();for(const row of rows){const key=row.value?.businessKey;if(key){if(!business.has(key))business.set(key,[]);business.get(key).push(row);}}
  for(const same of business.values())if(same.length>1)for(const row of same){row.status='conflict';issues.push({recordId:row.recordId,message:'同じ対象月・対応キーの記録が複数あります。自動合算していません'});}
  rows.sort((a,b)=>a.recordId.localeCompare(b.recordId));return {rows,issues,revisionCount:byId.size,conflictCount:rows.filter(r=>r.status!=='ready').length};
 }
 async function audit(input){const valid=[],quarantine=[];for(const row of new Map(input.map(x=>[canonical(x),x])).values()){try{await verify(row);valid.push(copy(row));}catch(error){quarantine.push({recordId:row?.recordId||null,revisionId:row?.revisionId||null,message:error.message,raw:copy(row)});}}
  const state=analyze(valid),bad=new Set(quarantine.map(x=>x.recordId).filter(Boolean));for(const row of state.rows)if(bad.has(row.recordId))row.status='unverified';for(const id of bad)if(!state.rows.some(r=>r.recordId===id))state.rows.push({recordId:id,status:'unverified',heads:[],value:null,alternatives:[],history:[]});state.rows.sort((a,b)=>a.recordId.localeCompare(b.recordId));
  const unique=[...new Map(valid.map(r=>[r.revisionId+':'+r.fingerprint,r])).values()].sort((a,b)=>a.revisionId.localeCompare(b.revisionId)||a.fingerprint.localeCompare(b.fingerprint));
  return {...state,conflictCount:state.rows.filter(r=>r.status!=='ready').length,revisions:unique,quarantine,checkpoint:await hash({format:FORMAT,version:VERSION,revisions:unique,quarantine:quarantine.map(q=>({revisionId:q.revisionId,recordId:q.recordId,raw:q.raw})).sort((a,b)=>canonical(a).localeCompare(canonical(b)))})};
 }
 function current(state,id){return state.rows.find(r=>r.recordId===id);}
 async function change(state,{recordId,revisionId,parents,value,action,device,at,reason=''}){
  const before=current(state,recordId),expected=before?.heads||[];if(canonical([...parents].sort())!==canonical([...expected].sort()))return fail('別の編集があります。入力を保持して最新状態を確認してください');
  if(before&&!['ready','conflict'].includes(before.status))return fail('未確認の履歴があります。元の記録を保持して編集を停止しました');
  if(before?.status==='conflict'&&action!=='resolve')return fail('同時編集を確認してから統合してください');
  if(before?.value?.source?.type==='rent-master'&&!['rent-refresh','resolve'].includes(action))return fail('家賃は正本の月別表で修正し、読み直してください');
  if(before?.value?._migration&&canonical(value._migration??null)!==canonical(before.value._migration))return fail('移行元の対応履歴は変更できません');
  const r=await seal({format:FORMAT,version:VERSION,recordId,revisionId,parents:[...parents].sort(),action,device:copy(device),at,reason,value:copy(value)});const after=analyze([...state.revisions,r]),row=current(after,recordId);if(row?.status==='unverified')return fail(after.issues.find(x=>x.recordId===recordId)?.message||'履歴の更新を確認できません');return r;
 }
 function toRow(r){revisionCheck(r);return [r.revisionId,r.recordId,canonical(r.parents),r.action,r.at,canonical(r.device),canonical({format:r.format,version:r.version,value:r.value,reason:r.reason||''}),r.fingerprint];}
 function fromRow(row){if(!Array.isArray(row)||row.length!==8)return fail('履歴の列数が違います');const body=JSON.parse(row[6]);return {format:body.format,version:body.version,revisionId:String(row[0]),recordId:String(row[1]),parents:JSON.parse(row[2]),action:String(row[3]),at:String(row[4]),device:JSON.parse(row[5]),value:body.value,reason:body.reason||'',fingerprint:String(row[7])};}
 function legacyValue(row){return {kind:['income','payment'].includes(row.kind)?row.kind:'unconfirmed',title:typeof row.title==='string'&&row.title.trim()?row.title:'旧記録（要確認）',subjectMonth:month(row.subjectMonth)?row.subjectMonth:null,plannedDate:date(row.date)?row.date:null,plannedAmount:integer(row.amount)?row.amount:null,actuals:[],done:!!row.done,source:{type:'legacy-unclassified'},businessKey:null,note:'旧記録の対象月・実績・正本との対応は未確認です',legacy:copy(row)};}
 function summary(state,subjectMonth=null){const rows=state.rows.filter(r=>r.status==='ready'&&(!subjectMonth||r.value.subjectMonth===subjectMonth)),sum=kind=>{const pending=rows.filter(r=>r.value.kind===kind&&!r.value.done),unknown=pending.filter(r=>r.value.plannedAmount===null).length;return {count:pending.length,amount:pending.reduce((n,r)=>n+(r.value.plannedAmount||0),0),unknown}};return {recordCount:state.rows.length,readyCount:rows.length,conflictCount:state.conflictCount,income:sum('income'),payment:sum('payment'),unassignedMonth:state.rows.filter(r=>r.value&&!r.value.subjectMonth).length};}
 function viewRows(state){return state.rows.map(r=>{const v=r.value,actuals=v?.actuals||[],dates=[...new Set(actuals.map(x=>x.date).filter(Boolean))].sort(),known=actuals.every(x=>x.amount!==null),amount=actuals.length&&known?actuals.reduce((n,x)=>n+x.amount,0):'';return [state.checkpoint,r.recordId,r.status==='ready'?'照合可':r.status==='conflict'?'同時編集・対応重複':'履歴未確認',v?.subjectMonth||'未確認',v?.kind==='income'?'入金':v?.kind==='payment'?'支払':'未確認',v?.title||'',v?.plannedDate||'',v?.plannedAmount??'',dates.join(' / '),amount,v?(v.done?'消込済み':'未消込'):'未確認',actuals.map(x=>x.evidence.status+':'+(x.evidence.note||'')).join(' / '),v?.source?.type||'',canonical(r.heads),canonical(v||{alternatives:r.alternatives})];});}
 async function packSample({id,device,at,payload}){if(!safeId(id)||!safeId(device.id)||!text(device.name,80)||!Number.isFinite(Date.parse(at)))return fail('端末比較のID・端末・日時を確認してください');const json=canonical(payload);if(json.length>8*1024*1024)return fail('お金の比較データが大きすぎます。元の記録を保持しました');const fingerprint=await hash(json),chunks=[];for(let i=0;i<json.length;i+=18000)chunks.push(json.slice(i,i+18000));return {id,device:copy(device),at,fingerprint,rows:chunks.map((chunk,i)=>[id,i,chunks.length,device.id,device.name,at,chunk,fingerprint])};}
 async function unpackSamples(rows){const groups=new Map(),result=[],issues=[];for(const row of rows){if(!Array.isArray(row)||row.length!==8){issues.push('端末比較の列が不正です');continue;}const id=String(row[0]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
  for(const [id,group]of groups){try{const first=group[0],n=Number(first[2]),parts=new Map();if(!safeId(id)||!Number.isSafeInteger(n)||n<1||n>1000)return fail('端末比較の分割数が不正です');for(const r of group){const index=Number(r[1]);if(!Number.isSafeInteger(index)||index<0||index>=n||[2,3,4,5,7].some(k=>String(r[k])!==String(first[k]))||parts.has(index)&&parts.get(index)!==r[6])return fail('同じ端末比較IDの内容が違います');parts.set(index,String(r[6]));}if(parts.size!==n)return fail('端末比較の送信が途中です。再試行が必要です');const json=Array.from({length:n},(_,i)=>parts.get(i)).join('');if(await hash(json)!==first[7])return fail('端末比較の読戻しが一致しません');result.push({id,device:{id:String(first[3]),name:String(first[4])},at:String(first[5]),fingerprint:String(first[7]),payload:JSON.parse(json)});}catch(error){issues.push(id+': '+error.message);}}
  return {samples:result,issues};
 }
  function sampleHeads(samples){const byId=new Map(samples.map(s=>[s.id,s])),groups=new Map(),issues=[];for(const s of samples){if(!groups.has(s.device.id))groups.set(s.device.id,[]);groups.get(s.device.id).push(s);}const heads=[];for(const [deviceId,rows]of groups){const parents=new Set();for(const s of rows)for(const id of s.payload.previousSampleIds||[]){const parent=byId.get(id);if(!parent||parent.device.id!==deviceId)issues.push('端末比較の元データが不足または別端末です：'+s.id);parents.add(id);}heads.push(...rows.filter(s=>!parents.has(s.id)));}return {heads,issues};}
 function planBody(plan){return {format:'papa-money-migration-plan',version:1,id:plan.id,samplePins:copy(plan.samplePins||[]),groups:Array.isArray(plan.groups)?plan.groups.map(g=>({recordId:g.recordId,sources:copy(g.sources||[]),value:copy(g.value),reason:g.reason||'',reopenApproved:g.reopenApproved===true})):[]};}
 async function prepareMigration(input,samples,state,device,at,{requireLatest=true}={}){
  const plan=planBody(input);if(input.format!==plan.format||input.version!==1||!safeId(plan.id)||!Array.isArray(plan.samplePins)||plan.samplePins.length!==2||!Array.isArray(plan.groups)||plan.groups.length>10000)return fail('Flip・Foldの2件の比較IDを指定した移行プランを確認してください');
  const selected=plan.samplePins.map(pin=>samples.find(s=>s.id===pin.id&&s.fingerprint===pin.fingerprint));if(selected.some(s=>!s)||new Set(selected.map(s=>s.device.id)).size!==2||new Set(selected.map(s=>s.device.name)).size!==2)return fail('異なる2端末の比較元が見つからないか、端末名を区別できません');
  for(const s of selected)if(await hash(s.payload)!==s.fingerprint||s.payload.format!=='papa-money-comparison'||!Array.isArray(s.payload.money))return fail('比較元のお金データの照合が一致しません');
  if(requireLatest){const latest=sampleHeads(samples);if(latest.issues.length||selected.some(s=>latest.heads.filter(x=>x.device.id===s.device.id).length!==1||!latest.heads.some(x=>x.id===s.id)))return fail('比較後に端末データが更新されたか、比較元が競合しています。移行プランを作り直してください');}
  const members=new Map();for(const s of selected)for(const r of s.payload.money){const k=s.id+'\u0000'+r._key;if(typeof r._key!=='string'||members.has(k))return fail('端末内の記録の対応が重複しています');members.set(k,{sample:s,row:r});}
  const covered=new Set(),recordIds=new Set(),planHash=await hash(plan),existing=state.revisions.filter(r=>r.value?._migration?.planId===plan.id&&!r.parents.length&&['migrate','rent-refresh'].includes(r.action)),actor=existing[0]?.device||device,recordedAt=existing[0]?.at||at,revisionList=[];
  for(let index=0;index<plan.groups.length;index++){const g=plan.groups[index];if(!safeId(g.recordId)||recordIds.has(g.recordId)||!Array.isArray(g.sources)||!g.sources.length||!text(g.reason||'',2000)||g.value?._migration)return fail('移行先ID・対応元・理由を確認してください');recordIds.add(g.recordId);valueCheck(g.value);const originals=[];for(const ref of g.sources){const k=ref.sampleId+'\u0000'+ref.key;if(!members.has(k)||covered.has(k))return fail('移行元が見つからないか複数回使われています');covered.add(k);originals.push(members.get(k).row);}if(originals.some(r=>!!r.done)&&!g.value.done&&(g.reopenApproved!==true||!g.reason?.trim()))return fail('消込済みを未消込へ戻す移行には、本人の取消確認と理由が必要です');
   const value={...copy(g.value),_migration:{planId:plan.id,planHash,index,groupCount:plan.groups.length,samplePins:copy(plan.samplePins),sources:copy(g.sources),reopenApproved:g.reopenApproved===true}};
   const revisionId='migration:'+plan.id+':'+g.recordId,r=await seal({format:FORMAT,version:VERSION,recordId:g.recordId,revisionId,parents:[],action:value.source.type==='rent-master'?'rent-refresh':'migrate',at:recordedAt,device:copy(actor),reason:g.reason||'',value});
   const old=state.revisions.find(x=>x.revisionId===revisionId);if(old&&canonical(old)!==canonical(r))return fail('同じ移行プランIDの内容が変わっています。元の履歴は変更していません');if(!old&&state.rows.some(x=>x.recordId===g.recordId))return fail('移行先の記録IDは既に別の記録に使われています');revisionList.push(old||r);
  }
  if(covered.size!==members.size)return fail('移行元のお金データに対応先のない記録があります。削除せず確認してください');
  const projected=await audit([...state.revisions,...revisionList]);if(revisionList.filter(r=>!state.revisions.some(old=>old.revisionId===r.revisionId)).some(r=>current(projected,r.recordId)?.status!=='ready'))return fail('移行先の対応キーや履歴に競合があります。内容を確認してください');
  return {plan,planHash,revisions:revisionList,sourceCount:members.size,recordCount:revisionList.length,alreadyApplied:revisionList.every(r=>state.revisions.some(x=>x.revisionId===r.revisionId))};
 }
 async function migrations(state,samples){
  const groups=new Map();for(const r of state.revisions)if(r.value?._migration&&!r.parents.length&&['migrate','rent-refresh'].includes(r.action)){const id=r.value._migration.planId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}const plans=[],aliases=[];
  for(const [id,roots]of groups){const m=roots[0].value._migration;try{if(roots.length!==m.groupCount||new Set(roots.map(r=>r.value._migration.index)).size!==roots.length||roots.some(r=>r.value._migration.planHash!==m.planHash))return fail('移行の履歴がまだ全件届いていません');const ordered=roots.slice().sort((a,b)=>a.value._migration.index-b.value._migration.index),plan={format:'papa-money-migration-plan',version:1,id,samplePins:m.samplePins,groups:ordered.map(r=>{const value=copy(r.value),metadata=value._migration;delete value._migration;return {recordId:r.recordId,sources:metadata.sources,value,reason:r.reason||'',reopenApproved:metadata.reopenApproved===true};})};if(await hash(planBody(plan))!==m.planHash)return fail('移行プランの照合が一致しません');await prepareMigration(plan,samples,state,roots[0].device,roots[0].at,{requireLatest:false});for(const r of roots)for(const ref of r.value._migration.sources){const sample=samples.find(s=>s.id===ref.sampleId);aliases.push({recordId:r.recordId,deviceId:sample.device.id,key:ref.key,sampleId:sample.id,original:copy(sample.payload.money.find(x=>x._key===ref.key))});}plans.push({id,status:'ready',recordCount:roots.length,samplePins:m.samplePins});}catch(error){plans.push({id,status:'pending',message:error.message,recordCount:roots.length});}}
  const sourceDrift=[];const heads=sampleHeads(samples);for(const plan of plans.filter(p=>p.status==='ready'))for(const pin of plan.samplePins){const before=samples.find(s=>s.id===pin.id);for(const latest of heads.heads.filter(s=>s.device.id===before?.device.id))if(latest.payload.financialFingerprint!==before.payload.financialFingerprint)sourceDrift.push({planId:plan.id,device:copy(latest.device),sampleId:latest.id,at:latest.at});}
  return {plans,aliases,sourceDrift,active:plans.length>0&&plans.every(p=>p.status==='ready')};
 }

 return {sampleHeads,planBody,prepareMigration,migrations,FORMAT,VERSION,HEADERS,SAMPLE_HEADERS,VIEW_HEADERS,SYNC_HEADERS,canonical,copy,hash,safeId,date,month,integer,valueCheck,revisionCheck,seal,verify,analyze,audit,current,change,toRow,fromRow,legacyValue,summary,viewRows,packSample,unpackSamples};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money-store.js */
try {
/* Append-only personal finance store, separate from all legacy/diary/receipt databases. */
(function(root){
 'use strict';
 const C=root.HubMoneyLedger,NAME='papa_hub_money_v1',FORMAT='papa-money-store-backup';
 const fail=message=>{throw Error(message);},clone=C.copy;
 async function open(write=false){if(!write&&typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(d=>d.name===NAME))return null;return new Promise((ok,no)=>{const q=indexedDB.open(NAME,1);let absent=false;q.onupgradeneeded=()=>{if(!write){absent=true;q.transaction.abort();return;}const d=q.result;d.createObjectStore('events',{keyPath:'key'});d.createObjectStore('meta',{keyPath:'key'});d.createObjectStore('samples',{keyPath:'id'});};q.onsuccess=()=>ok(q.result);q.onerror=()=>absent?ok(null):no(q.error);q.onblocked=()=>no(Error('他のPAPA HUB画面が保存領域を使用しています'));});}
 const guard=()=>root.HubApp?.checkWrite();
 async function raw(){const db=await open();if(!db)return {events:[],meta:[],samples:[]};try{return await new Promise((ok,no)=>{const tx=db.transaction(['events','meta','samples'],'readonly'),result={};for(const key of ['events','meta','samples']){const q=tx.objectStore(key).getAll();q.onsuccess=()=>result[key]=q.result;}tx.oncomplete=()=>ok(result);tx.onabort=tx.onerror=()=>no(tx.error||Error('お金の保存内容を読めません'));});}finally{db.close();}}
 async function state(){const data=await raw();return {...await C.audit(data.events.map(x=>x.value)),meta:Object.fromEntries(data.meta.map(x=>[x.key,x.value])),samples:data.samples.map(clone)};}
 async function putMeta(key,value,expected=undefined){guard();const db=await open(true);try{await new Promise((ok,no)=>{const tx=db.transaction('meta','readwrite'),s=tx.objectStore('meta'),q=s.get(key);let error;q.onsuccess=()=>{try{guard();if(expected!==undefined&&C.canonical(q.result?.value??null)!==C.canonical(expected))throw Error('別の画面でお金の設定が更新されています');s.put({key,value:clone(value)});}catch(e){error=e;tx.abort();}};tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(error||tx.error||Error('お金の設定を保存できません'));});}finally{db.close();}const check=await state();if(C.canonical(check.meta[key])!==C.canonical(value))return fail('お金の設定の読み戻しが一致しません');return clone(value);}
 async function append(revisions,{remote=false,expectedHeads={}}={}){
  guard();const prepared=[];for(const r of revisions){let valid=true;try{await C.verify(r);}catch(error){if(!remote)throw error;valid=false;}prepared.push({valid,key:(typeof r?.revisionId==='string'?r.revisionId:'invalid')+':'+await C.hash(r),value:clone(r)});}
  const db=await open(true);try{await new Promise((ok,no)=>{const tx=db.transaction('events','readwrite'),s=tx.objectStore('events'),q=s.getAll();let error;q.onsuccess=()=>{try{guard();const prior=q.result,current=C.analyze(prior.map(x=>x.value));for(const [id,heads]of Object.entries(expectedHeads)){if(prepared.filter(x=>x.value.recordId===id).every(x=>prior.some(p=>p.key===x.key)))continue;const row=C.current(current,id);if(prior.some(p=>p.value?.recordId===id&&p.valid===false)||row?.status==='unverified'||C.canonical([...(row?.heads||[])].sort())!==C.canonical([...heads].sort()))throw Error('同じ記録が別の画面で変更されました。入力は保持しています');}const known=new Map(prior.map(x=>[x.key,x]));for(const row of prepared)if(!known.has(row.key)){s.add(row);known.set(row.key,row);}}catch(e){error=e;tx.abort();}};tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(error||tx.error||Error('お金の履歴を保存できません'));});}finally{db.close();}
  const saved=await raw(),keys=new Set(saved.events.map(x=>x.key));if(prepared.some(x=>!keys.has(x.key)))return fail('お金の履歴の読み戻しが一致しません');root.dispatchEvent?.(new Event('hub-money-changed'));return state();
 }
 async function saveSample(sample){guard();const unpack=await C.unpackSamples(sample.rows);if(unpack.issues.length||unpack.samples.length!==1||unpack.samples[0].id!==sample.id)return fail('端末比較の内容を確認できません');const db=await open(true);try{await new Promise((ok,no)=>{const tx=db.transaction('samples','readwrite'),s=tx.objectStore('samples'),q=s.get(sample.id);let error;q.onsuccess=()=>{try{guard();if(q.result&&C.canonical(q.result)!==C.canonical(sample))throw Error('同じ比較IDの内容が違います。両方の元データを保持して停止しました');if(!q.result)s.add(clone(sample));}catch(e){error=e;tx.abort();}};tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(error||tx.error||Error('端末比較を保存できません'));});}finally{db.close();}const stored=(await raw()).samples.find(x=>x.id===sample.id);if(C.canonical(stored)!==C.canonical(sample))return fail('端末比較の読み戻しが一致しません');return clone(sample);}
 async function configure(value){const old=(await state()).meta.config||null;if(old?.sheetId&&old.sheetId!==value.sheetId)return fail('別の共通台帳への切替は自動では行いません。移行内容を確認してください');return putMeta('config',value,old);}
 async function capture(){return {format:FORMAT,version:1,data:await raw()};}
 async function restore(backup){if(backup?.format!==FORMAT||backup.version!==1||!Array.isArray(backup.data?.events)||!Array.isArray(backup.data?.samples))return fail('お金のバックアップ形式を確認できません');const revisions=backup.data.events.map(x=>x.value);for(const r of revisions)await C.verify(r);for(const sample of backup.data.samples)await saveSample(sample);await append(revisions,{remote:true});return {revisions:revisions.length,samples:backup.data.samples.length,settingsRestored:false};}
 root.HubMoneyStore={NAME,FORMAT,state,raw,append,putMeta,saveSample,configure,capture,restore};
 if(root.HubSafety){const original=root.HubSafety;root.HubSafety={...original,capture:async()=>{const first=await original.capture(),money=await capture(),originalAgain=await original.capture(),again=await capture();if(!original.same(first,originalAgain)||C.canonical(money)!==C.canonical(again))return fail('バックアップ中にお金の記録が変わりました。再度保存してください');return {...first,money};},same:(a,b)=>original.same(a,b)&&C.canonical(a.money??null)===C.canonical(b.money??null),hasData:s=>original.hasData(s)||!!s.money?.data?.events?.length||!!s.money?.data?.samples?.length};}
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money-cloud.js */
try {
/* Non-public personal ledger transport. Only the configured file is read/appended; no bank or rent-master writes. */
(function(root){
 'use strict';
 const C=root.HubMoneyLedger,TABS=['設定','入出金履歴','端末比較','照合表示','同期記録'],SCOPE='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
 const settingsRows=({owner,ledgerId})=>[['項目','値'],['format',C.FORMAT],['version',String(C.VERSION)],['owner',owner],['ledgerId',ledgerId],['migration','端末比較・未統合'],['rentMaster','未設定・既存表を変更しません'],['notice','ナミは読取・照合のみ。過去の履歴セルを直接変更しないでください。']];
 const fail=message=>{throw Error(message);},same=(a,b)=>C.canonical(a)===C.canonical(b);
 function create({fetchImpl=(...args)=>fetch(...args),store=root.HubMoneyStore}={}){
  let active=false;
  async function request(grant,url,options={}){grant.assertValid();if(!String(grant.scope).split(/\s+/).includes('https://www.googleapis.com/auth/spreadsheets')||!String(grant.scope).split(/\s+/).includes('https://www.googleapis.com/auth/drive.file'))return fail('お金台帳の既存Sheets・drive.file権限を確認できません');const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);try{const r=await fetchImpl(url,{method:options.method||'GET',cache:'no-store',credentials:'omit',signal:ctl.signal,headers:{Authorization:'Bearer '+grant.access_token,...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});grant.assertValid();if(!r.ok){const e=Error('お金台帳の通信結果を確認できません（HTTP '+r.status+'）。端末の記録は保持しています');e.status=r.status;throw e;}return r.status===204?{}:await r.json();}finally{clearTimeout(timer);}}
  const sheet=(id,path='')=>'https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+path;
  async function privacy(grant,id,owner){if(!/^[A-Za-z0-9_-]{20,}$/.test(id)||typeof owner!=='string'||!owner.includes('@'))return fail('本人専用のお金台帳ID・Googleアカウントを確認してください');const m=await request(grant,'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,mimeType,ownedByMe,owners(emailAddress),shared,trashed,permissions(type,role)');if(m.id!==id||m.mimeType!=='application/vnd.google-apps.spreadsheet'||m.ownedByMe!==true||m.shared!==false||m.trashed===true||!Array.isArray(m.permissions)||m.permissions.length!==1||m.permissions[0].type!=='user'||m.permissions[0].role!=='owner'||!m.owners?.some(x=>String(x.emailAddress).toLowerCase()===owner.toLowerCase()))return fail('本人だけが所有する非公開台帳だと確認できません。共有権限は変更していません');return m;}
  async function values(grant,id,tab,range){const r=await request(grant,sheet(id,'/values/'+encodeURIComponent("'"+tab+"'!"+range))+'?valueRenderOption=UNFORMATTED_VALUE');return r.values||[];}
  async function append(grant,id,tab,rows){if(!rows.length)return;for(let i=0;i<rows.length;i+=20)await request(grant,sheet(id,'/values/'+encodeURIComponent("'"+tab+"'!A1"))+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:{majorDimension:'ROWS',values:rows.slice(i,i+20)}});}
  async function paged(grant,id,tab,headers){const result=[];for(let from=1;from<=100000;from+=500){const end=String.fromCharCode(64+headers.length),rows=await values(grant,id,tab,'A'+from+':'+end+(from+499));if(from===1){if(!same(rows[0],headers))return fail(tab+'の列が違います。既存の記録を保持して停止しました');rows.shift();}for(const row of rows)if(row.some(v=>v!==''&&v!==null))result.push(row);if(rows.length<(from===1?499:500))return result;}return fail('台帳の取得上限を超えました。全件照合済みとは表示しません');}
  async function projection(grant,config,state,{write=false}={}){const expected=C.viewRows(state),rows=await paged(grant,config.sheetId,'照合表示',C.VIEW_HEADERS),known=new Map();for(const row of rows.filter(r=>r[0]===state.checkpoint)){const old=known.get(row[1]);if(old&&!same(old,row))return fail('同じ照合版の表示に違う内容があります。履歴は保持して停止しました');known.set(row[1],row);}for(const row of expected)if(known.has(row[1])&&!same(known.get(row[1]),row))return fail('照合表示と履歴が一致しません。元の履歴は変更していません');const missing=expected.filter(row=>!known.has(row[1]));if(missing.length&&!write)return fail('照合表示の保存・読み戻しが未確認です。履歴は保持しています');if(write)await append(grant,config.sheetId,'照合表示',missing);return expected.length;}
  async function read(grant,config){await privacy(grant,config.sheetId,config.owner);const properties=await request(grant,sheet(config.sheetId)+'?fields=sheets.properties.title');if(!TABS.every(t=>properties.sheets?.some(s=>s.properties.title===t)))return fail('専用のお金台帳のタブを確認できません');const rawSettings=await values(grant,config.sheetId,'設定','A1:B12'),settings=Object.fromEntries(rawSettings.slice(1));if(settings.format!==C.FORMAT||String(settings.version)!==String(C.VERSION)||settings.owner!==config.owner||settings.ledgerId!==config.ledgerId)return fail('お金台帳の形式・本人・台帳識別子が一致しません');
   const rows=await paged(grant,config.sheetId,'入出金履歴',C.HEADERS),events=[];for(const row of rows){try{events.push(C.fromRow(row));}catch(error){events.push({recordId:C.safeId(String(row[1]))?String(row[1]):null,revisionId:C.safeId(String(row[0]))?String(row[0]):null,invalidRow:C.copy(row),problem:error.message});}}
   const sampleRows=await paged(grant,config.sheetId,'端末比較',C.SAMPLE_HEADERS),samples=await C.unpackSamples(sampleRows);samples.issues.push(...C.sampleHeads(samples.samples).issues);const state=await C.audit(events),migration=await C.migrations(state,samples.samples);for(const plan of migration.plans.filter(p=>p.status!=='ready'))for(const row of state.rows)if(row.history.some(r=>r.value?._migration?.planId===plan.id))row.status='migration-pending';state.conflictCount=state.rows.filter(r=>r.status!=='ready').length;return {state,events,sampleRows,samples,migration,settings,readAt:new Date().toISOString()};
  }
  async function bootstrap(grant,owner){
   let attempt=(await store.state()).meta.createAttempt;if(!attempt){attempt={operationId:crypto.randomUUID(),ledgerId:crypto.randomUUID(),owner,started:false,sheetId:null};await store.putMeta('createAttempt',attempt,null);}if(attempt.owner!==owner)return fail('台帳作成を始めた本人と現在の接続先が違います');
   const name='PAPA HUB 個人入出金 '+attempt.operationId;
   if(!attempt.sheetId){const q="trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and name = '"+name+"'",found=await request(grant,'https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'100'}));if((found.files||[]).length>1)return fail('同じ台帳の候補が複数あります。自動で選んだり再作成したりしません');if(found.files?.length){attempt={...attempt,sheetId:found.files[0].id};await store.putMeta('createAttempt',attempt);}else if(attempt.started)return fail('前回の台帳作成結果は未確認です。少し待って同じボタンで再検索してください。別の台帳は作っていません');else{
     attempt={...attempt,started:true};await store.putMeta('createAttempt',attempt);
     const headerLists=[settingsRows({owner,ledgerId:attempt.ledgerId}),[C.HEADERS],[C.SAMPLE_HEADERS],[C.VIEW_HEADERS],[C.SYNC_HEADERS]],body={properties:{title:name},sheets:TABS.map((title,i)=>({properties:{sheetId:i,title,gridProperties:{rowCount:1000,columnCount:20,frozenRowCount:1}},data:[{startRow:0,startColumn:0,rowData:headerLists[i].map((row,index)=>({values:row.map(value=>({userEnteredValue:{stringValue:String(value)},...(index===0?{userEnteredFormat:{backgroundColor:{red:.94,green:.95,blue:.96},textFormat:{bold:true}}}:{})}))}))}]}))};
     const made=await request(grant,'https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',body});if(!made.spreadsheetId)return fail('作成した台帳IDを確認できません');attempt={...attempt,sheetId:made.spreadsheetId};await store.putMeta('createAttempt',attempt);
    }}
   const config={sheetId:attempt.sheetId,owner,ledgerId:attempt.ledgerId,enabled:true};await read(grant,config);await store.configure(config);return config;
  }
  async function connect(grant,owner,sheetId){await privacy(grant,sheetId,owner);const rows=await values(grant,sheetId,'設定','A1:B12'),settings=Object.fromEntries(rows.slice(1)),config={sheetId,owner,ledgerId:settings.ledgerId,enabled:true};await read(grant,config);await store.configure(config);return config;}
  async function sync(grant,config,{write=true}={}){if(active)return fail('お金の同期中です。完了を待ってください');active=true;try{
    const before=await read(grant,config);await store.append(before.events,{remote:true});for(const sample of before.samples.samples)await store.saveSample(await C.packSample(sample));let local=await store.state();
    if(write){const known=new Set(before.state.revisions.map(r=>r.revisionId+':'+r.fingerprint)),pending=local.revisions.filter(r=>!known.has(r.revisionId+':'+r.fingerprint));await append(grant,config.sheetId,'入出金履歴',pending.map(C.toRow));
     const device=local.meta.device;for(const sample of local.samples.filter(s=>s.device.id===device?.id)){const found=before.samples.samples.find(s=>s.id===sample.id);if(found){if(found.fingerprint!==sample.fingerprint||!same(found.device,sample.device))return fail('同じ端末比較IDの内容が異なります');continue;}const existing=new Map(before.sampleRows.filter(r=>r[0]===sample.id).map(r=>[Number(r[1]),r]));for(const row of sample.rows){const old=existing.get(Number(row[1]));if(old&&!same(old,row))return fail('端末比較の途中データが違います。元の記録を保持しました');}await append(grant,config.sheetId,'端末比較',sample.rows.filter(r=>!existing.has(Number(r[1]))));}
    }
    const verified=await read(grant,config),again=await read(grant,config);if(verified.state.checkpoint!==again.state.checkpoint||!same(verified.samples,again.samples))return fail('照合中に別の端末から更新されました。データは保持し、最新版の確認は再試行してください');
    await store.append(again.events,{remote:true});for(const sample of again.samples.samples)await store.saveSample(await C.packSample(sample));local=await store.state();if(write){const all=new Set(again.state.revisions.map(r=>r.revisionId+':'+r.fingerprint));if(local.revisions.some(r=>!all.has(r.revisionId+':'+r.fingerprint)))return fail('端末の履歴がGoogleへ届いたことを確認できません');for(const sample of local.samples.filter(s=>s.device.id===local.meta.device?.id))if(!again.samples.samples.some(s=>s.id===sample.id&&s.fingerprint===sample.fingerprint))return fail('端末比較のGoogle読戻しが一致しません');
     await projection(grant,config,again.state,{write:true});await projection(grant,config,again.state);const at=new Date().toISOString(),sample=local.samples.filter(s=>s.device.id===local.meta.device?.id).at(-1),notice=(again.migration.active?'指定された端末比較から移行済み。':'端末比較・未統合。')+'未送信端末の現在内容と銀行実績は未確認。照合表示は履歴の照合IDと一致する版だけ参照';await append(grant,config.sheetId,'同期記録',[[crypto.randomUUID(),local.meta.device?.id||'',local.meta.device?.name||'未設定',at,again.state.checkpoint,again.state.revisionCount,again.state.rows.length,again.state.conflictCount,sample?.id||'',notice]]);
     const final=await read(grant,config);if(final.state.checkpoint!==again.state.checkpoint||!same(final.samples,again.samples))return fail('保存確認中に台帳が更新されました。再同期してください。履歴は保持しています');
    }
    const receipt={at:new Date().toISOString(),checkpoint:again.state.checkpoint,revisionCount:again.state.revisionCount,recordCount:again.state.rows.length,conflicts:again.state.conflictCount,quarantine:again.state.quarantine.length,samples:again.samples.samples.map(s=>({id:s.id,device:s.device,at:s.at,fingerprint:s.fingerprint})),sampleIssues:again.samples.issues,migration:again.migration.sourceDrift.length?'移行後の端末変更は未照合':again.migration.active?'指定比較から移行済み':'未統合',write};await store.putMeta('remote:'+config.ledgerId,receipt);return {ok:again.state.conflictCount===0&&again.samples.issues.length===0&&again.migration.sourceDrift.length===0&&!again.migration.plans.some(p=>p.status!=='ready'),state:again.state,receipt,samples:again.samples};
   }finally{active=false;}}
  return {read,sync,bootstrap,connect,privacy,active:()=>active};
 }
 root.HubMoneyCloud={create,SCOPE,TABS,settingsRows};
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money-list.js */
try {
/* Presentation only: never patches a record, stores a filter, or infers a month. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyList=api;})(globalThis,function(){
 'use strict';
 const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 function model(rows,month,status='pending'){
  if(!['pending','settled','all'].includes(status))status='pending';
  const result={dated:[],undated:[],unassignedDated:[],unassignedUndated:[],unassignedTotal:rows.filter(r=>!validMonth(r.value?.subjectMonth)).length};
  for(const row of rows){const value=row.value||{};if(status==='pending'&&value.done===true||status==='settled'&&value.done!==true)continue;
   const knownMonth=validMonth(value.subjectMonth);if(knownMonth&&month&&value.subjectMonth!==month)continue;
   const key=knownMonth?(validDate(value.plannedDate)?'dated':'undated'):(validDate(value.plannedDate)?'unassignedDated':'unassignedUndated');result[key].push(row);
  }
  for(const key of ['dated','unassignedDated'])result[key].sort((a,b)=>a.value.plannedDate.localeCompare(b.value.plannedDate));
  return result;
 }
 return {model};
});

} catch (error) { setTimeout(function () { throw error; }, 0); }

;/* Source: hub-money-sync.js */
try {
/* Personal money UI/controller. Setup is opt-in; legacy finance/diary/photo stores are never replaced. */
(function(root){
 'use strict';
 const C=root.HubMoneyLedger,S=root.HubMoneyStore,transport=root.HubMoneyCloud.create(),$=id=>document.getElementById(id),today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const html=(parent,value)=>{const t=document.createElement('template');t.innerHTML=value;parent.append(t.content);},node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
 let data=null,migration={plans:[],aliases:[],active:false},busy=false,grant=null,editor=null,checkedPlan=null,autoTimer=null,seenFinancial='',rendering=false,viewSignature='';
 const card=node('section',undefined,'card money-sync-card');card.id='moneySyncCard';$('money').prepend(card);
 html(card,`<h2>お金の同期</h2><p id="moneySyncStatus" role="status">端末のお金を読み取り中です。</p><details><summary>初回の接続・端末比較</summary><label>この端末<select id="moneyDevice"><option value="">選んでください</option><option>Flip8</option><option>Fold8</option></select></label><button id="moneyDeviceSave" type="button" data-money-write>端末名を確認</button><p>最初の1台で本人専用台帳を作り、もう1台には同じURLを設定します。日記や画像は送りません。</p><button id="moneyLedgerCreate" type="button" data-money-write>本人専用の台帳を作る</button><label>同じ共通台帳のURL<input id="moneyLedgerURL" type="url" inputmode="url"></label><button id="moneyLedgerConnect" type="button" data-money-write>この台帳につなぐ</button><button id="moneyCompareSend" type="button" data-money-write>この端末のお金を保全して比較用に送る</button><p id="moneyComparisonStatus" class="muted"></p><details><summary>移行内容を確認して統合</summary><p>両端末の比較元をナミと照合した後、確認済みの対応プランだけを適用します。元の端末データと履歴は残ります。</p><label>確認する移行プランJSON<textarea id="moneyMigrationJSON" rows="5"></textarea></label><button id="moneyMigrationCheck" type="button" data-money-write>内容を確認</button><pre id="moneyMigrationPreview" class="money-sync-pre"></pre><button id="moneyMigrationApply" type="button" data-money-write disabled>確認した内容で移行</button></details></details><div class="actions"><button id="moneySyncNow" type="button" data-money-write>同期する</button><button id="moneyReadNow" type="button" data-money-write>読み直す</button><a id="moneyLedgerOpen" target="_blank" rel="noopener noreferrer" hidden>台帳を開く</a></div><p id="moneyLedgerCheckpoint" class="muted money-sync-pre"></p><div class="actions"><button id="moneyShowLedger" type="button">共通台帳を表示</button><button id="moneyShowLegacy" type="button">この端末の元の記録を表示</button><button id="moneyFinanceBackup" type="button">お金の保全データを保存</button></div><p id="moneyLegacyNotice" class="muted"></p>`);
 const auditDetails=node('details');auditDetails.append(node('summary','同期状況・元の記録・バックアップ'));const legacyActions=$('moneyShowLedger').parentElement;auditDetails.append($('moneyLedgerCheckpoint'),legacyActions,$('moneyLegacyNotice'),node('p','銀行の自動連携ではありません。実際の入出金は確認根拠を付けて別に記録します。','muted'));card.append(auditDetails);
 const settingsDetails=node('details');settingsDetails.id='moneySettings';settingsDetails.append(node('summary','接続・バックアップ・同期状況'));const setupDetails=card.querySelector('details');settingsDetails.append(setupDetails,auditDetails);card.append(settingsDetails);
 const calendarNotice=node('p',undefined,'muted');calendarNotice.id='moneyCalendarNotice';calendarNotice.hidden=true;$('hubCalendar').before(calendarNotice);
 const homeNotice=node('p',undefined,'muted');homeNotice.id='moneyHomeNotice';homeNotice.hidden=true;$('homeDataNotice').before(homeNotice);
 const ledger=node('section',undefined,'card');ledger.id='moneyLedgerView';ledger.hidden=true;card.after(ledger);
 html(ledger,`<div class="calhead"><h2>共通台帳の入出金</h2><button id="moneyLedgerNew" type="button" data-money-write>＋追加</button></div><div class="money-list-filters"><label>対象月<input id="moneySubjectMonth" type="month"></label><label>消込状態<select id="moneySettlementFilter"><option value="pending">未消込のみ</option><option value="settled">消込済みのみ</option><option value="all">すべて</option></select></label></div><p id="moneyLedgerSummary"></p><section aria-label="選択した対象月の記録"><div id="moneyLedgerRows"></div></section><details id="moneyLedgerUnassigned"><summary id="moneyLedgerUnassignedTitle">対象月未確認</summary><p class="muted">請求対象月が未確認の記録です。選択月の記録や集計には混ぜていません。</p><div id="moneyLedgerUnassignedRows"></div></details>`);$('moneySubjectMonth').value=today().slice(0,7);
 const dialog=node('dialog');dialog.id='moneyLedgerEditor';document.body.append(dialog);html(dialog,`<form id="moneyLedgerForm"><h2 id="moneyEditorHeading">共通台帳を編集</h2><p id="moneyEditorInfo" class="muted"></p><div id="moneyPlannedFields"><label>区分<select id="moneyKind"><option value="income">入金</option><option value="payment">支払</option></select></label><label>件名<input id="moneyTitle" maxlength="300" required></label><label>対象月（不明なら空欄）<input id="moneyMonth" type="month"></label><label>予定日（不明なら空欄）<input id="moneyPlannedDate" type="date"></label><label>予定額（不明なら空欄）<input id="moneyPlannedAmount" type="number" min="0" step="1"></label><label>備考<textarea id="moneyNote" maxlength="4000"></textarea></label></div><div id="moneyActualFields" hidden><label>実際の入出金日（不明なら空欄）<input id="moneyActualDate" type="date"></label><label>今回の実績額（不明なら空欄）<input id="moneyActualAmount" type="number" min="0" step="1"></label><label>確認根拠<select id="moneyEvidence"><option value="reported">本人報告</option><option value="bank-verified">銀行の明細を確認</option><option value="ledger-verified">正本の台帳を確認</option><option value="unconfirmed">未確認</option></select></label><label>確認した資料・根拠の説明<textarea id="moneyEvidenceNote" maxlength="2000"></textarea></label><label>本人の非公開資料URL（任意）<input id="moneyEvidenceRef" type="url"></label></div><div id="moneyResolveFields" hidden><label>残っている両方の履歴<textarea id="moneyResolveBefore" rows="8" readonly></textarea></label><label>本人が確認した統合後の入出金JSON<textarea id="moneyResolveValue" rows="8"></textarea></label><label>統合・取消の理由<input id="moneyResolveReason" maxlength="2000"></label></div><p id="moneyEditorStatus" role="status"></p><div class="actions"><button id="moneyEditorSave" type="submit">端末に履歴を保存</button><button id="moneyEditorClose" type="button">閉じる</button></div></form>`);
 function status(message){$('moneySyncStatus').textContent=message;}
 function identity(){return root.HubGoogle.account().email;}
 const reject=error=>status(error.message+'。元の記録は保持しています。');
 const click=(id,fn)=>$(id).onclick=()=>{try{Promise.resolve(fn()).catch(reject);}catch(error){reject(error);}};
 function config(){return data?.meta.config;}
 function financial(){root.HubApp.checkWrite();const raw=localStorage.getItem('toshi_v5'),legacy=raw===null?{money:[]}:JSON.parse(raw),overlay=root.HubApp.overlay();return C.copy({money:root.HubApp.money(),legacyMoney:legacy.money||[],overlayMoney:overlay.money||[],moneyEdits:overlay.moneyEdits||{},history:(overlay.history||[]).filter(r=>r.kind==='previous-money'||String(r.kind||'').startsWith('money-')),legacyBinding:overlay.legacyBinding||null});}
 async function reload(){data=await S.state();const unpack=await C.unpackSamples(data.samples.flatMap(s=>s.rows));migration=await C.migrations(data,unpack.samples);for(const p of migration.plans.filter(x=>x.status!=='ready'))for(const row of data.rows)if(row.history.some(r=>r.value?._migration?.planId===p.id))row.status='migration-pending';data.conflictCount=data.rows.filter(r=>r.status!=='ready').length;return data;}
 function migrated(){return !!data?.revisions.some(r=>r.value?._migration);}
 function viewMoney(original){if(!migrated())return original;return data.rows.filter(r=>r.status==='ready').map(r=>({...C.copy(r.value),safeId:r.recordId,_key:'ledger-money:'+r.recordId,title:r.value.title,date:r.value.plannedDate||'',amount:r.value.plannedAmount,time:'',done:r.value.done,_viewOrigin:'共通台帳'}));}
 function legacyGuard(){if(busy||transport.active())throw Error('お金の同期・保全中です。入力は保持しています');if(migrated())throw Error('共通台帳への移行履歴があります。元の記録は保全用です。共通台帳の対象IDから編集してください');}
 function controls(){if($('moneyEditorSave'))$('moneyEditorSave').disabled=busy;for(const el of document.querySelectorAll('[data-money-write]'))el.disabled=busy||!root.HubApp?.canWrite();$('moneyMigrationApply').disabled=busy||!checkedPlan||!root.HubApp?.canWrite();}
 function rows(){const container=$('moneyLedgerRows'),unassigned=$('moneyLedgerUnassignedRows');container.replaceChildren();unassigned.replaceChildren();if(!data)return;const selected=$('moneySubjectMonth').value,filter=$('moneySettlementFilter').value,list=root.HubMoneyList.model(data.rows,selected,filter),model=C.summary(data,selected||null),yen=n=>n===null?'未確認':'¥'+n.toLocaleString('ja-JP');$('moneyLedgerSummary').textContent='全体 '+model.recordCount+'件｜対象月の未消込 入金 '+yen(model.income.amount)+'（金額未確認 '+model.income.unknown+'件）／支払 '+yen(model.payment.amount)+'（金額未確認 '+model.payment.unknown+'件）｜競合・未確認 '+model.conflictCount+'件｜対象月未確認 '+model.unassignedMonth+'件';
  $('moneyLedgerUnassignedTitle').textContent='対象月未確認（表示 '+(list.unassignedDated.length+list.unassignedUndated.length)+'件／全 '+list.unassignedTotal+'件）';
  if(!list.dated.length&&!list.undated.length)container.append(node('p','選択した対象月・消込状態に合う記録はありません。対象月未確認の記録は下の別枠から確認できます。','muted'));
  if(!list.unassignedDated.length&&!list.unassignedUndated.length)unassigned.append(node('p','この消込状態に合う対象月未確認の記録はありません。','muted'));
  function draw(visible,target){
  for(const row of visible){const v=row.value,box=node('article',undefined,'hub-row'+(v?.done?' done':''));box.dataset.moneyRecord=row.recordId;box.append(node('span',v?.kind==='income'?'入金':v?.kind==='payment'?'支払':'区分未確認','badge'),node('b',v?.title||'同時編集・履歴の確認が必要です'),node('p','対象月 '+(v?.subjectMonth||'未確認')+'｜予定 '+(v?.plannedDate||'未確認')+'｜'+yen(v?.plannedAmount??null)+'｜'+(row.status==='ready'?(v?.done?'消込済み':'未消込'):'同時編集・履歴未確認'),'muted'));
   if(v?.actuals?.length)box.append(node('p','実績：'+v.actuals.map(x=>(x.date||'日付未確認')+' '+yen(x.amount)+' '+x.evidence.status).join('／'),'muted'));
   const actions=node('div',undefined,'actions');if(row.status==='ready'&&v.source.type!=='rent-master'){actions.classList.add('money-record-actions');actions.append(action('編集',()=>openEditor(row,'edit'),'編集'),action('実績',()=>openEditor(row,'actual'),'実績を追記'),action(v.done?'消込取消':'消込',()=>complete(row),v.done?'消込を取り消す':'消込済みにする'));}else if(row.status==='conflict')actions.append(action('同時編集を確認',()=>openEditor(row,'resolve')));
   if(v?.source.type==='rent-master')box.append(node('p','家賃の請求・実績は正本の月別表で修正し、ナミと照合してから更新します。HUBから正本へ書き戻しません。','muted'));
   box.append(actions);const history=node('details');history.append(node('summary','詳細・履歴（'+row.history.length+'件）'),node('p','記録ID '+row.recordId,'muted money-sync-pre'),node('p','訂正履歴（原文を保持）','muted'));for(const r of row.history)history.append(node('pre',C.canonical(r),'money-sync-pre'));box.append(history);target.append(box);
  }
  }
  draw(list.dated,container);if(list.undated.length){container.append(node('h3','予定日未設定'));draw(list.undated,container);}
  draw(list.unassignedDated,unassigned);if(list.unassignedUndated.length){unassigned.append(node('h3','予定日未設定'));draw(list.unassignedUndated,unassigned);}
 }
 function action(label,work,description){const b=node('button',label);if(description){b.setAttribute('aria-label',description);b.title=description;}b.type='button';b.dataset.moneyWrite='';b.disabled=busy||!root.HubApp?.canWrite();b.onclick=()=>Promise.resolve(work()).catch(error=>status(error.message));return b;}
 async function render(){if(rendering)return;rendering=true;try{await reload();const d=data.meta.device,c=config(),remote=c&&data.meta['remote:'+c.ledgerId],unpacked=await C.unpackSamples(data.samples.flatMap(s=>s.rows)),heads=C.sampleHeads(unpacked.samples);if(d)$('moneyDevice').value=d.name;if(c){$('moneyLedgerURL').value='https://docs.google.com/spreadsheets/d/'+c.sheetId+'/edit';$('moneyLedgerOpen').href=$('moneyLedgerURL').value;$('moneyLedgerOpen').hidden=false;}
   $('moneyComparisonStatus').textContent=heads.heads.map(s=>s.device.name+'：比較ID '+s.id+'／'+s.payload.money?.length+'件／取得 '+s.at).join('\n')+(heads.issues.length?'\n元データの不足・競合を確認してください':'')+(remote?.sampleIssues?.length?'\nGoogle上に送信途中・未確認の比較データがあります。送信元の端末で再試行してください。':'');
   const unknownDevices=new Set(heads.heads.map(s=>s.device.id)).size<2;$('moneyLegacyNotice').textContent=migration.sourceDrift?.length?'移行後の元データに未照合の変更があります。比較データは保全済みです。ナミと差分を確認するまで、端末の全記録が統合済みとは扱いません。':migrated()?'元の端末データは変更せず保全しています。共通台帳と相違があれば、新しい比較データを送って再照合してください。':unknownDevices?'両端末の比較前です。端末のお金と共通台帳は未統合です。':'両端末の比較データを確認できます。本人が移行内容を確認するまでは未統合です。';
   $('moneyLedgerCheckpoint').textContent=remote?'最後のGoogle照合 '+new Date(remote.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+'\nGoogle履歴の照合ID '+remote.checkpoint+'\nこの端末の履歴照合ID '+data.checkpoint+'\n'+(remote.checkpoint===data.checkpoint?'この照合版の一致を確認済み。':'端末に未送信または未照合の履歴があります。')+' '+remote.migration+'。他端末の未送信編集と銀行実績は未確認です。':'Google未照合。端末データが空・入出金がないという意味ではありません。';
   if(!c)status('未接続。端末の既存のお金をそのまま表示しています。');else if(!busy&&!$('moneySyncStatus').dataset.result)status(migration.active?'移行の対応履歴を確認できました。Googleとの一致は下の照合時刻・IDで確認してください。':'台帳接続済み。両端末の比較・移行は未完了です。');
   if($('moneyLedgerView').dataset.chosen!=='true'&&migration.active)showLedger(true);rows();controls();const awaiting=data.conflictCount||migration.sourceDrift?.length||migration.plans.some(p=>p.status!=='ready');calendarNotice.hidden=!migrated();homeNotice.hidden=!migrated()||!awaiting;homeNotice.textContent='お金の共通台帳に未照合の記録があります。表示中の集計には確認待ちの記録を自動加算していません。お金の画面で確認してください。';calendarNotice.textContent=awaiting?'お金の共通台帳に未照合の記録があります。確認待ちの記録は集計へ自動加算しません。お金の画面で確認してください。':'入出金は共通台帳の予定日を表示しています。実績・消込状態はお金の画面で確認できます。';const signature=data.checkpoint+':'+migration.active+':'+(migration.sourceDrift?.length||0)+':'+data.conflictCount;if(signature!==viewSignature){viewSignature=signature;queueMicrotask(()=>root.dispatchEvent(new Event('hub-money-view-changed')));}
  }finally{rendering=false;}}
 function showLedger(on){ledger.hidden=!on;ledger.dataset.chosen='true';const original=document.querySelector('#money .feature-money');if(original)original.hidden=on;$('moneyShowLedger').setAttribute('aria-pressed',String(on));$('moneyShowLegacy').setAttribute('aria-pressed',String(!on));}
 async function device(){await reload();if(!data.meta.device)throw Error('最初にこの端末名を確認してください');return data.meta.device;}
 function authenticated(){return root.HubGoogle.connectForMoney();}
 async function withBusy(work){if(busy)return;root.HubApp.checkWrite();busy=true;controls();try{return await work();}catch(error){$('moneySyncStatus').dataset.result='1';status(error.message+'。元の記録と未送信履歴は保持しています。');throw error;}finally{busy=false;await render();}}
 async function captureComparison(){const d=await device(),before=financial(),fingerprint=await C.hash(before),all=await C.unpackSamples(data.samples.flatMap(s=>s.rows)),prior=C.sampleHeads(all.samples).heads.filter(s=>s.device.id===d.id);if(prior.length===1&&prior[0].payload.financialFingerprint===fingerprint){seenFinancial=fingerprint;return data.samples.find(s=>s.id===prior[0].id);}
 const payload={format:'papa-money-comparison',version:1,financialFingerprint:fingerprint,previousSampleIds:prior.map(s=>s.id).sort(),...before},sample=await C.packSample({id:crypto.randomUUID(),device:d,at:new Date().toISOString(),payload});root.HubApp.checkWrite();if(await C.hash(financial())!==fingerprint)throw Error('保全中にお金が変わりました。読み直して再試行してください');await S.saveSample(sample);seenFinancial=fingerprint;return sample;}
 async function synchronize({write=true,capture=false,suppliedGrant=null,authPromise=null}={}){return withBusy(async()=>{await device();if(!config()?.enabled)throw Error('本人専用の共通台帳を先につないでください');grant=suppliedGrant||await (authPromise||authenticated());if(config().owner!==identity())throw Error('この台帳を設定した本人とGoogle接続が違います');if(capture)await captureComparison();const result=await transport.sync(grant,config(),{write});$('moneySyncStatus').dataset.result='1';status((write?'お金台帳へ保存・読戻し照合しました。':'Googleから読み直し、端末へ履歴を追加保持しました。')+' '+result.state.rows.length+'件／競合・未確認 '+result.state.conflictCount+'件。'+(result.receipt.sampleIssues.length?'送信途中・未確認の比較データがあります。':'')+(result.receipt.migration==='未統合'?'両端末の比較と移行は未完了です。':''));return {...result,message:'お金の履歴 '+result.state.rows.length+'件を読戻し確認。'+result.receipt.migration+'。未送信端末の最新内容・銀行実績は未確認です。'};});}
 function background(){clearTimeout(autoTimer);autoTimer=setTimeout(async()=>{try{if(!config()?.enabled||!grant||busy||editor)return;grant.assertValid();await synchronize({write:true,suppliedGrant:grant});}catch{/* The pending state and manual retry remain visible. */}},500);}
 async function saveRevision(revision,parents){await S.append([revision],{expectedHeads:{[revision.recordId]:parents}});await render();status('お金の履歴を端末に保存しました。Googleとの一致はまだ未確認です。');background();}
 function openEditor(row=null,mode='edit'){clearTimeout(autoTimer);root.HubApp.checkWrite();if(busy)throw Error('お金の処理が終わってから編集してください');if(!config()?.enabled)throw Error('本人専用の共通台帳を先につないでください');const v=row?.value||{kind:'payment',title:'',subjectMonth:null,plannedDate:null,plannedAmount:null,actuals:[],done:false,source:{type:'hub'},businessKey:null,note:''};if(v.source.type==='rent-master'&&mode!=='resolve')throw Error('家賃は正本で修正して照合してください');editor={row,mode,recordId:row?.recordId||crypto.randomUUID(),revisionId:crypto.randomUUID(),actualId:crypto.randomUUID(),parents:[...(row?.heads||[])],before:C.copy(v),pending:null};$('moneyLedgerForm').reset();$('moneyKind').value=v.kind==='income'?'income':'payment';$('moneyTitle').value=v.title;$('moneyMonth').value=v.subjectMonth||'';$('moneyPlannedDate').value=v.plannedDate||'';$('moneyPlannedAmount').value=v.plannedAmount??'';$('moneyNote').value=v.note||'';$('moneyPlannedFields').hidden=mode!=='edit';$('moneyActualFields').hidden=mode!=='actual';$('moneyResolveFields').hidden=mode!=='resolve';$('moneyTitle').required=mode==='edit';$('moneyResolveBefore').value=mode==='resolve'?JSON.stringify(row.alternatives,null,2):'';$('moneyResolveValue').value='';$('moneyEditorHeading').textContent=mode==='actual'?'実績を追記':mode==='resolve'?'同時編集を確認':'共通台帳の入出金';$('moneyEditorInfo').textContent='対象月・予定・実績・消込は別に保存します。記録ID '+editor.recordId;$('moneyEditorStatus').textContent='';$('moneyEditorSave').textContent='端末に履歴を保存';for(const el of $('moneyLedgerForm').elements)el.disabled=false;dialog.showModal();}
 async function complete(row){root.HubApp.checkWrite();if(busy)throw Error('お金の処理中です');let reason='';if(row.value.done){const answer=prompt('消込を取り消す理由を入力してください。旧端末の情報では自動で戻しません。');if(answer===null)return;reason=answer.trim();if(!reason)throw Error('取消理由が必要です');}else if(!confirm('「'+row.value.title+'」を消込済みにしますか？実績の日付・金額が不明なら補っていません。'))return;await reload();const r=await C.change(data,{recordId:row.recordId,revisionId:crypto.randomUUID(),parents:row.heads,action:row.value.done?'reopen':'settle',device:await device(),at:new Date().toISOString(),reason,value:{...row.value,done:!row.value.done}});await saveRevision(r,row.heads);}
 function closeEditor(){if(editor&&!confirm('入力を閉じますか？Googleとの照合状態は、共通台帳の画面で確認してください。'))return;dialog.close();editor=null;}
 $('moneyEditorClose').onclick=closeEditor;dialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
 $('moneyLedgerForm').onsubmit=async e=>{e.preventDefault();if(!editor)return;if(busy){$('moneyEditorStatus').textContent='お金の同期中です。入力は保持しています。完了後に保存してください。';return;}const draft=editor;busy=true;controls();for(const el of e.target.elements)el.disabled=true;try{root.HubApp.checkWrite();await reload();let revision=draft.pending;if(!revision){let value=C.copy(draft.before),action=draft.row?'edit':'create',reason='';if(draft.mode==='resolve'){value=JSON.parse($('moneyResolveValue').value);action='resolve';reason=$('moneyResolveReason').value.trim();if(!reason)throw Error('統合理由を入力してください');}else if(draft.mode==='actual'){const amount=$('moneyActualAmount').value,date=$('moneyActualDate').value,evidence={status:$('moneyEvidence').value,note:$('moneyEvidenceNote').value.trim(),ref:$('moneyEvidenceRef').value.trim()};if(['bank-verified','ledger-verified'].includes(evidence.status)&&!evidence.note&&!evidence.ref)throw Error('確認した明細・台帳の根拠を記入してください');value.actuals.push({id:draft.actualId,date:date||null,amount:amount===''?null:Number(amount),evidence});}else{value={...value,kind:$('moneyKind').value,title:$('moneyTitle').value.trim(),subjectMonth:$('moneyMonth').value||null,plannedDate:$('moneyPlannedDate').value||null,plannedAmount:$('moneyPlannedAmount').value===''?null:Number($('moneyPlannedAmount').value),note:$('moneyNote').value};}revision=await C.change(data,{recordId:draft.recordId,revisionId:draft.revisionId,parents:draft.parents,action,device:await device(),at:new Date().toISOString(),reason,value});draft.pending=revision;}await S.append([revision],{expectedHeads:{[revision.recordId]:draft.parents}});dialog.close();editor=null;status('端末に履歴を保存しました。Googleとの一致は未確認です。');}catch(error){$('moneyEditorStatus').textContent=error.message+'。入力は保持しています。';$('moneyEditorSave').textContent=draft.pending?'保存状況を確認':'端末に履歴を保存';}finally{busy=false;for(const el of e.target.elements)el.disabled=!!editor?.pending&&el.id!=='moneyEditorSave'&&el.id!=='moneyEditorClose';await render();if(!editor)background();}};
 click('moneyDeviceSave',()=>withBusy(async()=>{const name=$('moneyDevice').value;if(!['Flip8','Fold8'].includes(name))throw Error('この端末名を選んでください');await reload();const old=data.meta.device||null;if(old&&old.name!==name)throw Error('保全済みの端末名は変更しません。別端末には別の端末IDを設定してください');await S.putMeta('device',old||{id:crypto.randomUUID(),name},old);status(name+'として保存・読戻ししました。まだGoogleへは送っていません。');}));
 function setup(create){root.HubApp.checkWrite();if(busy)return;if(!confirm('この端末のお金の記録・編集履歴を、本人専用のGoogle台帳へ保全・送信します。日記・写真・領収書・認証情報は送りません。元の記録は保持し、まだ統合しません。\n保存先：'+(create?'マイドライブに新しく作る非公開のお金台帳':$('moneyLedgerURL').value.trim())+'\nこの内容で接続し、比較用に保存しますか？'))return;const auth=authenticated();auth.catch(()=>{});return withBusy(async()=>{await device();grant=await auth;const owner=identity();let c;if(create){if(config())throw Error('接続済みの共通台帳があります。新しく作りません');c=await transport.bootstrap(grant,owner);}else{const match=/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/.exec($('moneyLedgerURL').value.trim());if(!match)throw Error('本人専用の共通台帳URLを入力してください');c=await transport.connect(grant,owner,match[1]);}await reload();await captureComparison();const result=await transport.sync(grant,c);$('moneySyncStatus').dataset.result='1';status('本人専用の台帳を接続し、この端末のお金を比較用に保全・送信・読戻ししました。既存のお金は未統合です。もう1台にも同じURLを設定してください。');return result;});}
 click('moneyLedgerCreate',()=>setup(true));click('moneyLedgerConnect',()=>setup(false));
 function syncClick(options){root.HubApp.checkWrite();if(busy)return;const auth=authenticated();auth.catch(()=>{});return synchronize({...options,authPromise:auth});}
 click('moneyCompareSend',()=>syncClick({capture:true}));click('moneySyncNow',()=>syncClick({capture:true}));click('moneyReadNow',()=>syncClick({write:false}));
 $('moneySubjectMonth').onchange=rows;$('moneySettlementFilter').onchange=rows;click('moneyShowLedger',()=>showLedger(true));click('moneyShowLegacy',()=>showLedger(false));click('moneyLedgerNew',()=>openEditor());
 function download(value,name){const blob=new Blob([JSON.stringify(value)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 click('moneyFinanceBackup',async()=>{root.HubApp.checkWrite();const before=financial(),archive=await S.capture();if(await C.hash(before)!==await C.hash(financial()))throw Error('保存中にお金が変わりました。再試行してください');download({format:'papa-money-preservation',version:1,at:new Date().toISOString(),device:data?.meta.device||null,current:before,archive},'PAPA-HUB-money-'+(data?.meta.device?.name||'device')+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');status('お金と履歴の保全ファイルを作りました。ダウンロード先で保存を確認してください。画像・日記・認証情報は含めません。');});
 async function validatePlan(auth){await device();if(!config()?.enabled)throw Error('共通台帳の接続が必要です');grant=await auth;const remote=await transport.read(grant,config());await S.append(remote.events,{remote:true});for(const sample of remote.samples.samples)await S.saveSample(await C.packSample(sample));await reload();const source=await C.unpackSamples(data.samples.flatMap(s=>s.rows));if(source.issues.length||remote.samples.issues.length)throw Error('途中送信・内容不一致の比較データがあります。先に送信を完了してください');const plan=JSON.parse($('moneyMigrationJSON').value),prepared=await C.prepareMigration(plan,source.samples,data,data.meta.device,new Date().toISOString());
  // A changed live local source cannot be approved from an older pinned snapshot.
  const pin=plan.samplePins.map(p=>source.samples.find(s=>s.id===p.id)).find(s=>s?.device.id===data.meta.device.id);if(pin&&pin.payload.financialFingerprint!==await C.hash(financial()))throw Error('この端末に比較後の編集があります。比較用に送り直して移行プランを作り直してください');return prepared;}
 click('moneyMigrationCheck',()=>{root.HubApp.checkWrite();if(busy)return;const auth=authenticated();auth.catch(()=>{});checkedPlan=null;return withBusy(async()=>{const prepared=await validatePlan(auth);checkedPlan={hash:prepared.planHash,plan:prepared.plan};$('moneyMigrationPreview').textContent='比較元 '+prepared.plan.samplePins.map(x=>x.id).join(' / ')+'\n元の記録 '+prepared.sourceCount+'件 → 共通の記録 '+prepared.recordCount+'件\n'+prepared.plan.groups.map(g=>g.recordId+'｜'+g.value.title+'｜対象月 '+(g.value.subjectMonth||'未確認')+'｜予定 '+(g.value.plannedDate||'未確認')+'｜予定額 '+(g.value.plannedAmount??'未確認')+'｜'+(g.value.done?'消込済み':'未消込')+'｜実績 '+JSON.stringify(g.value.actuals)+'｜正本 '+g.value.source.type).join('\n')+'\n元の端末データ・訂正履歴は削除も上書きもしません。';status('移行の対応を表示しました。両端末の編集・消込状態・対象月・実績・家賃正本との対応を確認してください。まだ移行していません。');});});
 $('moneyMigrationJSON').addEventListener('input',()=>{checkedPlan=null;controls();});
 click('moneyMigrationApply',()=>{root.HubApp.checkWrite();if(busy||!checkedPlan)return;const checked=checkedPlan;if(!confirm('表示した両端末の対応・金額・対象月・消込状態を確認し、この内容で共通台帳へ移行しますか？元の記録は保持します。'))return;const auth=authenticated();auth.catch(()=>{});return withBusy(async()=>{const prepared=await validatePlan(auth);if(prepared.planHash!==checked.hash)throw Error('確認後に移行内容が変わりました。確認からやり直してください');await S.putMeta('migration-plan:'+prepared.plan.id,{plan:prepared.plan,planHash:prepared.planHash,at:new Date().toISOString()});const expectedHeads=Object.fromEntries(prepared.revisions.filter(r=>!data.revisions.some(old=>old.revisionId===r.revisionId)).map(r=>[r.recordId,[]]));await S.append(prepared.revisions,{expectedHeads});const result=await transport.sync(grant,config());await reload();if(!migration.active)throw Error('移行の全件読戻しが未確認です。同じ移行プランで再試行できます');checkedPlan=null;showLedger(true);$('moneySyncStatus').dataset.result='1';status('確認した対応で移行し、Googleとの全件一致を読み戻しました。もう1台でもお金を同期して同じ照合IDを確認してください。元の端末記録はそのまま保全しています。');return result;});});
 async function onLegacyRender(){try{await render();if(!config()?.enabled||busy||!root.HubApp?.canWrite())return;const fingerprint=await C.hash(financial());if(!seenFinancial){seenFinancial=fingerprint;return;}if(fingerprint!==seenFinancial){await captureComparison();background();}}catch(error){reject(error);}}
 root.addEventListener('hub-render',onLegacyRender);root.addEventListener('hub-panel',()=>render().catch(reject));root.addEventListener('storage',()=>render().catch(reject));root.addEventListener('hub-money-changed',()=>render().catch(reject));
 root.HubMoneySync={SCOPE:root.HubMoneyCloud.SCOPE,guardLegacy:legacyGuard,viewMoney,render,openEditor,captureComparison,state:()=>({ready:!!data,configured:!!config()?.enabled,busy,migrated:migrated(),migration}),syncWithGrant:suppliedGrant=>synchronize({suppliedGrant,capture:true}),restore:async backup=>withBusy(async()=>{await S.restore(backup);status('お金の履歴を追加で復元しました。設定の上書きや古いデータでの置換はしていません。Googleとの一致は未確認です。');})};
 render().catch(reject);
})(globalThis);

} catch (error) { setTimeout(function () { throw error; }, 0); }
