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
