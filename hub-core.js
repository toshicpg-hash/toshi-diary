(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STORAGE='toshi_hub_safe_v1',LEGACY='toshi_v5';
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
const time=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const addDays=(value,n)=>{const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
function parseLegacy(raw){if(raw===null)return {items:[],money:[]};const value=JSON.parse(raw);if(!value||typeof value!=='object'||!Array.isArray(value.items)||!Array.isArray(value.money))throw Error('以前のHUBの保存形式を確認できません。元データは保持しています。');return value;}
function parseOverlay(raw){if(raw===null)return {version:1,items:[],edits:{},money:[],moneyEdits:{},google:[],history:[],syncedAt:''};const value=JSON.parse(raw);if(!value||value.version!==1||!['items','money','google','history'].every(k=>Array.isArray(value[k]))||!value.edits||!value.moneyEdits)throw Error('HUBの保存形式を確認できません。元データは保持しています。');return value;}
function key(x,index){return x.googleId&&x.googleCalendarId?'google:'+x.googleCalendarId+':'+x.googleId:x.safeId?'safe:'+x.safeId:'legacy:'+index;}
function list(legacy,overlay){const rows=new Map();legacy.items.forEach((x,i)=>rows.set(key(x,i),{...x,_key:key(x,i)}));overlay.items.forEach(x=>rows.set(key(x),{...x,_key:key(x)}));overlay.google.forEach(x=>rows.set(key(x),{...x,_key:key(x)}));for(const [k,patch]of Object.entries(overlay.edits)){if(rows.has(k))rows.set(k,{...rows.get(k),...patch,_key:k});}return [...rows.values()];}
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
 return {title:prefix?title.slice(prefix[0].length):title,type,project:type==='event'?(calendar.primary?'TOSHI':calendar.summary):(p.toshiHubProject||'TASK'),date:startDate,endDate:last||startDate,scheduledDate:metadata.start||startDate,time,endTime,allDay,done:type!=='event'&&(prefix?!!prefix[1]:p.toshiHubDone==='true'),...metadata,completedDate:p.toshiHubCompletedDate||'',completedAt:p.toshiHubCompletedAt||'',source:'google',googleId:event.id,googleCalendarId:calendar.id,googleUrl:event.htmlLink||'',googleDescription:event.description||'',googleOrganizerId:event.organizer?.email||'',externalTodo:!!prefix,hubTodo:type!=='event',cancelled:event.status==='cancelled'};
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
