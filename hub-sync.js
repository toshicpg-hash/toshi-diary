(function(){
 'use strict';
 if(!globalThis.HubSyncCore||!globalThis.HubApp)return;
 const buttons=[...document.querySelectorAll('[data-sync-all]')],box=document.getElementById('hubSyncAllStatus'),runner=HubSyncCore.create();
 let active=false;
 const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 function show(states){box.hidden=false;box.replaceChildren(text('h2','Googleまとめ同期'));for(const s of states)box.append(text('p',s.label+'：'+s.message));if(states.length&&states.every(x=>x.status==='success'))box.append(text('p','予定・ToDo・日記の同期が完了しました。'));else if(states.some(x=>x.status==='failed'||x.status==='skipped')&&!states.some(x=>x.status==='running'||x.status==='waiting'))box.append(text('p','未完了の項目があります。表示を確認して、もう一度同期してください。'));}
 function lock(){for(const button of buttons){button.dataset.unverified=String(active);button.disabled=active||!HubApp.canWrite();}}
 async function syncAll(){
  if(active)return;
  active=true;lock();
  try{
   HubApp.checkWrite();const diary=globalThis.HubDiarySync?.state();
   const from=document.getElementById('hubSyncFrom').value,to=document.getElementById('hubSyncTo').value;
   const calendarEligible=HubCore.day(from)&&HubCore.day(to)&&from<=to;
   const diaryEligible=!!diary?.ready&&!!diary.configured&&!diary.busy;
   await runner.run({jobs:[
    {key:'calendar',label:'予定・ToDo',eligible:calendarEligible,reason:'同期する期間を確認してください',scopes:HubGoogle.SCOPE.split(/\s+/),sync:()=>HubApp.syncCalendar()},
    {key:'diary',label:'日記',eligible:diaryEligible,reason:!diary?.ready?'保存領域の準備中です。完了後にもう一度同期してください':!diary.configured?'台帳未設定です。日記画面で設定してください':'日記の処理中です。完了を待ってください',scopes:[globalThis.HubDiarySync?.SCOPE||''],sync:grant=>HubDiarySync.syncWithGrant(grant)}
   ],authorize:eligible=>HubGoogle.connectForSync({calendar:eligible.some(x=>x.key==='calendar'),diary:eligible.some(x=>x.key==='diary')}),onChange:show});
  }catch(error){show([{key:'all',label:'同期開始',status:'failed',message:error.message}]);}
  finally{active=false;lock();}
 }
 for(const button of buttons)button.onclick=syncAll;
 for(const id of ['hubSync','diarySync']){const button=document.getElementById(id),original=button.onclick;button.onclick=function(e){if(!active)return original?.call(this,e);};}
 globalThis.HubSyncAll={sync:syncAll,active:()=>active};
}());
