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
