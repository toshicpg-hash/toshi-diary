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
