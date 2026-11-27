(function(){
 'use strict';
 if(!globalThis.HubSyncCore||!globalThis.HubApp)return;
 const buttons=[...document.querySelectorAll('[data-sync-all]')],box=document.getElementById('hubSyncAllStatus'),runner=HubSyncCore.create();
 let active=false,finishing=false,proofAttempt=null,proofStates=[];
 const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 /* 1.2.61 トシさんの指示（11/27）：Googleまとめ同期の結果が長いので、すべて完了したときは1行にたたむ（押すと開く）。途中・未完了のときは開いたまま */
 let foldOpen=false;
 function show(states){proofStates=states;box.hidden=false;const rows=[];for(const s of states)rows.push(text('p',s.label+'：'+s.message));const done=states.length&&states.every(x=>x.status==='success'),busy=states.some(x=>x.status==='running'||x.status==='waiting'),problem=!busy&&states.some(x=>x.status==='failed'||x.status==='skipped');if(done)rows.push(text('p',states.map(x=>x.label).join('・')+'の同期が完了しました。'));else if(problem)rows.push(text('p','未完了の項目があります。表示を確認して、もう一度同期してください。'));if(globalThis.HubProof)rows.push(text('p','ナミ向け確認記録：'+(HubProof.transmissionApproved()?'このFlip8では同期後に送信します。結果はホームで確認してください。':'自動送信OFF。結果はホームで確認できます。')+'Google最新版との一致・画面表示は未確認です。'));const fold=document.createElement('details');fold.className='sync-all-fold';fold.open=!done||foldOpen;fold.addEventListener('toggle',()=>{if(done)foldOpen=fold.open;});const sum=document.createElement('summary');sum.append(text('span',done?'✓ 同期が完了しました':busy?'同期しています…':problem?'未完了の項目があります':'同期の結果'),text('span',done?'（押すと詳しい内容）':''));sum.lastChild.className='fold-hint';fold.append(sum,...rows);box.replaceChildren(text('h2','Googleまとめ同期'),fold);}
 function lock(){HubApp.refreshControls?.();globalThis.HubMoneySync?.refreshControls?.();for(const button of buttons){button.dataset.unverified=String(active);button.disabled=active||!HubApp.canWrite();}}
 async function syncAll(){
  if(active)return;
  active=true;lock();let authorized=false,recoveryGrant=null;
  try{
   await globalThis.HubMoneySync?.waitForIdle?.(()=>show([{key:'all',label:'同期開始',status:'waiting',message:'進行中のお金の同期・保存完了待ち…'}]));
   await HubApp.waitForSave?.(()=>show([{key:'all',label:'同期開始',status:'waiting',message:'保存完了待ち… 保存済み内容を確認してから同期します'}]));HubApp.checkWrite();proofStates=[];proofAttempt=globalThis.HubProof?await HubProof.begin():null;const diary=globalThis.HubDiarySync?.state();
   const from=document.getElementById('hubSyncFrom').value,to=document.getElementById('hubSyncTo').value;
   const calendarEligible=HubCore.day(from)&&HubCore.day(to)&&from<=to;
   const diaryEligible=!!diary?.ready&&!!diary.configured&&!diary.busy;
   const money=globalThis.HubMoneySync?.state(),moneyConfigured=!!money?.configured;
   await runner.run({concurrent:false,jobs:[
    {key:'calendar',label:'予定・ToDo',eligible:calendarEligible,reason:'同期する期間を確認してください',scopes:HubGoogle.SCOPE.split(/\s+/),sync:()=>HubApp.syncCalendar({combined:true})},
    {key:'diary',label:'ダイアリー',eligible:diaryEligible,reason:!diary?.ready?'保存領域の準備中です。完了後にもう一度同期してください':!diary.configured?'台帳未設定です。ダイアリー画面で設定してください':'ダイアリーの処理中です。完了を待ってください',scopes:[globalThis.HubDiarySync?.SCOPE||''],sync:grant=>HubDiarySync.syncWithGrant(grant)},
    ...(moneyConfigured?[{key:'money',label:'お金',eligible:!!money.ready&&!money.busy,reason:'お金の処理中です。完了後に再試行してください',scopes:HubMoneySync.SCOPE.split(/\s+/),sync:grant=>HubMoneySync.syncWithGrant(grant)}]:[])
   ].map(job=>({...job,wait:onWait=>HubApp.waitForSave?.(onWait)})),authorize:async eligible=>{const grant=await HubGoogle.connectForSync({calendar:eligible.some(x=>x.key==='calendar'),diary:eligible.some(x=>x.key==='diary'),money:eligible.some(x=>x.key==='money'),proof:globalThis.HubProof?.transmissionApproved()===true});authorized=true;recoveryGrant=grant;return grant;},onChange:show});
  }catch(error){show([{key:'all',label:'同期開始',status:'failed',message:error.message}]);}
  finally{finishing=true;lock();try{if(globalThis.HubProof)await HubProof.finish(proofAttempt,proofStates,{allowSend:authorized});}finally{proofAttempt=null;active=false;finishing=false;lock();if(authorized&&proofStates.length&&proofStates.every(s=>s.status==='success'))window.dispatchEvent(new CustomEvent('papa-sync-finished',{detail:{ok:true,grant:recoveryGrant}}));}}
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
 globalThis.HubSyncAll={sync:syncAll,active:()=>active,blocksWrites:()=>active&&!finishing};
}());
