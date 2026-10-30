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
async function inspectCompletion(item){
 if(!['todo','task'].includes(item.type)||!item.googleCalendarId||!item.googleId)throw Error('更新する作業とGoogle予定IDを確認してください');
 await authorize();const binding=verified,event=await api(base(item));assertSession(binding);
 if(event.id!==item.googleId||event.status==='cancelled'||!event.etag)throw Error('Googleの対象ID・更新版を確認できません。更新していません');
 const row=HubCore.fromGoogle(event,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project});
 if(row.type!==item.type)throw Error('Googleの作業分類が変わりました。再同期して確認してください');
 return {calendarId:item.googleCalendarId,eventId:item.googleId,event,row,accountRaw:binding.raw};
}
function completionMatches(result,original,patch){
 return result.id===original.id&&result.status!=='cancelled'&&result.summary===patch.summary&&
 same(result.extendedProperties?.private,patch.extendedProperties.private)&&
 Object.entries(original).every(([key,value])=>['etag','updated','sequence','summary','extendedProperties'].includes(key)||same(result[key],value))&&
 same(result.extendedProperties?.shared,original.extendedProperties?.shared);
}
async function complete(item,done,options={}){
 if(options.proof&&options.proof.accountRaw!==account().raw)throw Error('確認後にGoogleアカウント設定が変わりました。更新していません');
 const proof=await inspectCompletion(item),binding=verified,latest=proof.event,attempt=options.attempt||{};
 if(options.proof&&(options.proof.calendarId!==proof.calendarId||options.proof.eventId!==proof.eventId))throw Error('確認画面の対象IDが一致しません。更新していません');
 // An uncertain request is only read back. Never issue another PATCH for that attempt.
 if(attempt.sent){
  if(attempt.calendarId!==proof.calendarId||attempt.eventId!==proof.eventId||attempt.done!==done||attempt.date!==options.completedDate)throw Error('確認中の操作内容が変わりました');
  if(!completionMatches(latest,attempt.original,attempt.patch))throw Error('前回の保存結果を確認できません。再同期して対象を確認してください。追加の更新はしていません');
  assertSession(binding);return proof.row;
 }
 if(options.proof&&options.proof.event.etag!==latest.etag)throw Error('確認後にGoogleの予定が変わりました。閉じて再同期してください。更新していません');
 const patch=HubCore.completionPatch(latest,done,new Date().toISOString(),options.completedDate);
 if(Object.hasOwn(options,'preserveCompletedAt')){if(!done)throw Error('完了を維持する操作を確認してください');const at=latest.extendedProperties?.private?.toshiHubCompletedAt||options.preserveCompletedAt;if(at&&!Number.isFinite(Date.parse(at)))throw Error('既存の完了日時を確認できません。変更していません');patch.extendedProperties.private.toshiHubCompletedAt=at;}
 if(completionMatches(latest,latest,patch))return proof.row;
 if(options.beforeUpdate)await options.beforeUpdate(proof);
 assertSession(binding);
 Object.assign(attempt,{sent:true,calendarId:proof.calendarId,eventId:proof.eventId,done,date:options.completedDate,original:latest,patch});
 await api(base(item),{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':latest.etag},body:JSON.stringify(patch)});
 const result=await api(base(item));
 if(!completionMatches(result,latest,patch))throw Error('Google更新後の完了状態・保持情報が一致しません');
 assertSession(binding);return HubCore.fromGoogle(result,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project});
}
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
root.HubGoogle={SCOPE,account,saveAccount,selectAccount,read,complete,inspectCompletion,publish,inspectDeadlines,repairDeadline,connectForSync,connectForMoney,connectForProof,currentProofGrant};
})(globalThis);
