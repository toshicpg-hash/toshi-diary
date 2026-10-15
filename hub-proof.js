(function(){
 'use strict';
 // No runtime setting or restored backup can override this release gate.
 const TRANSMISSION_APPROVED=false,VERSION='1.2.15',store=new HubProofStore(),$=id=>document.getElementById(id);
 const transport=HubProofDrive.create({approved:()=>TRANSMISSION_APPROVED,authorize:()=>HubGoogle.connectForProof(),store,core:HubProofCore});
 const message=s=>{$('hubProofStatus').textContent=s;};
 async function refresh(){
  if(!HubApp.assetReady()){message('端末の安全確認を終えてから登録できます。送信はOFFです。');return;}
  try{const device=await store.settings();$('hubProofDeviceStatus').textContent=device?'この端末：'+device.name+'｜識別番号 '+device.deviceId:'この端末は未登録です。Flip8とFold8はそれぞれの端末で登録してください。';
   $('hubProofDevice').disabled=!!device||!HubApp.canWrite();if(device)$('hubProofDevice').value=device.name;
   const rows=await store.rows(),container=$('hubProofRows');container.replaceChildren();for(const row of rows.slice(0,5)){
    const box=document.createElement('article'),label=document.createElement('p');let record;try{record=row.record&&HubProofCore.validate(row.record);}catch{}
    label.textContent=row.device.name+'｜同期番号 '+row.sequence+'｜'+row.startedAt+'｜'+(!record?'途中終了または確認記録未確定':record.localSaveVerified?'端末への保存・読み戻し確認済み':'保存未確認・部分失敗');box.append(label);
    const state=document.createElement('p');state.textContent='Google版との独立照合：HUB未確認／画面表示：未確認／Drive送信：OFF';box.append(state);
    if(record){const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='確認記録の内容';pre.textContent=JSON.stringify(record,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);box.append(detail);
     const retry=document.createElement('button');retry.type='button';retry.textContent='確認記録だけを再送（未承認）';retry.disabled=true;retry.dataset.write='';retry.dataset.unverified='true';retry.onclick=()=>resend(record.attemptId);box.append(retry);
    }container.append(box);
   }
  }catch{message('確認記録の保存領域を読み取れません。予定・日記の記録は保持しています。');}
 }
 async function begin(){try{if(!HubApp.assetReady())return null;const attempt=await store.begin(VERSION);if(!attempt)message('この端末が未登録のため確認記録は作成しません。Drive送信はOFFです。');return attempt;}catch{message('確認記録の作成を開始できません。通常の同期結果とは別に、HUB未確認として扱います。');return null;}}
 async function finish(attempt,states){if(!attempt)return;try{const record=await store.finish(attempt,states);message((record.localSaveVerified?'端末への保存・読み戻しを確認しました。':'保存未確認または部分失敗の記録を残しました。')+' Google版との独立照合・画面表示は未確認。Drive送信はOFFです。');if($('hubProofSettings').open)await refresh();}catch{message('確認記録の保存・読み戻しを確認できません。HUB未確認です。予定・日記の同期結果は上の表示で確認してください。');}}
 async function resend(id){
  if(!TRANSMISSION_APPROVED){message('確認記録の送信は未承認のためOFFです。Googleへの追加接続・送信は行いません。');return {ok:false};}
  HubApp.checkWrite();const row=await store.get(id);if(!row?.record)throw Error('確定した確認記録がありません');return transport.send(row.record);
 }
 $('hubProofRegister').onclick=async()=>{try{HubApp.checkWrite();await store.register($('hubProofDevice').value);message('この端末を登録しました。確認記録の送信はOFFのままです。');await refresh();}catch(e){message(e.message);}};
 $('hubProofSettings').addEventListener('toggle',()=>{if($('hubProofSettings').open)refresh();});
 globalThis.HubProof={begin,finish,resend,refresh,transmissionApproved:()=>TRANSMISSION_APPROVED};
})();
