(function(root){
'use strict';
const SCOPE='https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
let token='',expires=0,client=null,pending=null,tokenScopes='';
function covers(actual,required){const set=new Set(String(actual||'').split(/\s+/));return required.split(/\s+/).every(scope=>set.has(scope));}
function authorize(required=SCOPE){
 if(token&&Date.now()<expires&&covers(tokenScopes,required))return Promise.resolve();
 if(pending)return pending;
 if(!root.google?.accounts?.oauth2)return Promise.reject(Error('Google認証を読み込めません。通信を確認して再度お試しください。'));
 const request=new Promise((resolve,reject)=>{const fail=e=>reject(Error(e?.message||'Google接続を完了していません。端末のデータは保持しています。'));
  try{client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:required,callback:r=>{
   if(r.error){reject(Error('Google認証: '+r.error));return;}
   if(typeof r.access_token!=='string'||!r.access_token){reject(Error('Google接続の応答を確認できません'));return;}
   token=r.access_token;expires=Date.now()+(Math.max(0,(Number(r.expires_in)||3600)-60))*1000;tokenScopes=typeof r.scope==='string'?r.scope:required===SCOPE?SCOPE:'';resolve();
  },error_callback:fail});client.requestAccessToken({prompt:required===SCOPE?'':'select_account'});}catch(e){fail(e);}
 });
 pending=request;request.then(()=>{if(pending===request)pending=null;},()=>{if(pending===request)pending=null;});return request;
}
async function connectForSync({calendar=true,diary=false}={}){
 const diaryScope=root.HubDiarySync?.SCOPE;
 if(diary&&diaryScope!=='https://www.googleapis.com/auth/spreadsheets')throw Error('日記同期の接続設定を確認できません');
 const required=[calendar?SCOPE:'',diary?diaryScope:''].filter(Boolean).join(' ');
 if(!required)throw Error('同期できる項目がありません');
 await authorize(required);return {access_token:token,expiresAt:expires,scope:tokenScopes};
}
async function api(path,options={}){if(!token)throw Error('Googleに接続してください');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const response=await fetch('https://www.googleapis.com/calendar/v3/'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});if(!response.ok){if(response.status===401){token='';expires=0;}const error=Error('Google HTTP '+response.status+(response.status===401?'。もう一度接続してください':''));error.status=response.status;throw error;}return response.status===204?{}:response.json();}finally{clearTimeout(timer);}}
async function calendars(){let page='',items=[];do{const value=await api('users/me/calendarList?maxResults=250'+(page?'&pageToken='+encodeURIComponent(page):''));items.push(...(value.items||[]));page=value.nextPageToken||'';}while(page);return items.filter(c=>c.primary||['TOSHI','CPG','TASK','Trip','GOLF','誕生日','Anniversary'].includes(c.summary));}
const base=x=>'calendars/'+encodeURIComponent(x.googleCalendarId)+'/events/'+encodeURIComponent(x.googleId);
async function read(from,to){await authorize();const targets=await calendars();let rows=[];for(const calendar of targets){let page='';do{const query=new URLSearchParams({timeZone:'Asia/Tokyo',singleEvents:'true',orderBy:'startTime',maxResults:'2500',timeMin:from+'T00:00:00+09:00',timeMax:to+'T00:00:00+09:00'});if(page)query.set('pageToken',page);const value=await api('calendars/'+encodeURIComponent(calendar.id)+'/events?'+query);rows.push(...(value.items||[]).filter(e=>e.start&&e.status!=='cancelled').map(e=>HubCore.fromGoogle(e,calendar)));page=value.nextPageToken||'';}while(page);}return {rows,calendars:targets};}
async function complete(item,done){await authorize();const latest=await api(base(item)),patch=HubCore.completionPatch(latest,done,new Date().toISOString());await api(base(item),{method:'PATCH',headers:{'Content-Type':'application/json',...latest.etag?{'If-Match':latest.etag}:{}},body:JSON.stringify(patch)});const result=await api(base(item));return HubCore.fromGoogle(result,{id:item.googleCalendarId,summary:item.externalTodo?'TASK':item.project});}
async function publish(item){await authorize();const available=await calendars(),calendar=available.find(c=>c.summary==='TASK'&&['writer','owner'].includes(c.accessRole));if(!calendar)throw Error('書き込みできるTASKカレンダーが見つかりません');const date=item.type==='todo'?item.deadlineDate:item.scheduledDate;if(!HubCore.day(date))throw Error('日付のないタスクはこの端末に保持します');const id='hub'+item.safeId.replace(/-/g,'').toLowerCase(),body={id,summary:(item.done?'✅':'')+(item.type==='todo'?'【ToDo】':'【タスク】')+item.title,start:{date},end:{date:HubCore.addDays(date,1)},extendedProperties:{private:{toshiHubType:item.type,toshiHubProject:item.project||'TASK',toshiHubDeadlineDate:item.type==='todo'?item.deadlineDate:'',toshiHubDone:String(!!item.done),toshiHubCompletedAt:item.completedAt||'',toshiHubCompletedDate:item.completedDate||'',toshiHubSafeId:item.safeId,toshiHubDiaryEntryId:item.diaryEntryId||'',toshiHubStart:item.start||item.scheduledDate||'',toshiHubEnd:item.type==='todo'?item.deadlineDate:'',toshiHubDeadlineTime:item.deadlineTime||''}}},path='calendars/'+encodeURIComponent(calendar.id)+'/events';try{await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(error){if(error.status!==409)throw error;const existing=await api(path+'/'+id);if(existing.extendedProperties?.private?.toshiHubSafeId!==item.safeId)throw Error('Googleの予定IDが重複しました。登録は中止しました。');}const confirmed=await api(path+'/'+id);if(confirmed.status==='cancelled')throw Error('同じ作業はGoogleで削除されています。端末の記録を保持しました。Google側を確認してください。');if(confirmed.summary!==body.summary||confirmed.start?.date!==body.start.date||confirmed.end?.date!==body.end.date||Object.entries(body.extendedProperties.private).some(([key,value])=>confirmed.extendedProperties?.private?.[key]!==value))throw Error('同じ作業がGoogleにありますが、端末の最新内容と一致しません。端末の記録を保持しました。Google側を確認してください。');return HubCore.fromGoogle(confirmed,calendar);}
async function connectForProof(){const scope='https://www.googleapis.com/auth/drive.file';await authorize(scope);return {access_token:token,expiresAt:expires,scope:tokenScopes};}
root.HubGoogle={SCOPE,read,complete,publish,connectForSync,connectForProof};
})(globalThis);
