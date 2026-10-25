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
function deadlinePatch(event,calendar,date){
 const row=fromGoogle(event,calendar),p=event.extendedProperties?.private||{};
 if(!day(date)||row.type!=='todo'||row.done||row.cancelled||p.toshiHubType&&p.toshiHubType!=='todo'||p.toshiHubDone!==undefined&&!['true','false'].includes(p.toshiHubDone))throw Error('未完了ToDoの分類・期限日を確認できないため変更していません');
 validateItem({...row,deadlineDate:date,end:date},row);
 return {extendedProperties:{private:{...p,toshiHubDeadlineDate:date,toshiHubEnd:date}}};
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
