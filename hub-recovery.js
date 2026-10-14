(function(){
 'use strict';
 const $=id=>document.getElementById(id),card=$('hubRecoveryCard');
 if(!card||!globalThis.HubRecovery||!globalThis.HubApp)return;
 let fileValue=null,preview=null,before='';
 const snapshot=()=>JSON.stringify([HubApp.allItems(),HubApp.money()]);
 function disable(){preview=null;$('hubRecoveryApply').disabled=true;$('hubRecoveryApply').dataset.unverified='true';}
 function status(message){$('hubRecoveryStatus').textContent=message;}
 $('hubRecoveryFile').onchange=async e=>{
  disable();fileValue=null;before='';$('hubRecoveryPreview').replaceChildren();
  try{
   HubApp.checkWrite();const file=e.target.files[0];if(!file)return;
   if(file.size>1024*1024)throw Error('1MB以下の補正ファイルを選んでください');
   const value=JSON.parse(await file.text());HubApp.checkWrite();
   const result=HubRecovery.plan(value,HubApp.allItems(),HubApp.money(),location.origin);
   for(const c of result.changes){const line=document.createElement('p');line.textContent=c.before.title+' → '+(c.kind==='work'?'完了（実施日 '+(c.completedDate||'不明')+'）':'消込済み（'+c.completedDate+'）');$('hubRecoveryPreview').append(line);}
   fileValue=value;preview=result;before=snapshot();
   $('hubRecoveryApply').dataset.unverified=String(!result.changes.length);
   $('hubRecoveryApply').disabled=!result.changes.length||!HubApp.canWrite();
   status('補正 '+result.changes.length+'件、一致済み '+result.skipped.length+'件。まだ保存していません。Googleは変更しません。');
  }catch(e){disable();status(e.message);}
 };
 $('hubRecoveryApply').onclick=async()=>{
  try{
   HubApp.checkWrite();if(!preview||!preview.changes.length||snapshot()!==before)throw Error('記録が変わったか確認内容がありません。補正ファイルを選び直してください');
   if(!confirm('表示した '+preview.changes.length+'件を本人確認による補正として端末へ保存しますか？Googleは変更しません。'))return;
   HubApp.checkWrite();if(snapshot()!==before)throw Error('確認中に記録が変わりました。選び直してください');
   const checked=HubRecovery.plan(fileValue,HubApp.allItems(),HubApp.money(),location.origin);
   const pending=HubApp.commit('user-confirmed-status-correction',next=>HubRecovery.apply(next,checked,new Date().toISOString()));
   if(pending)await pending;
   const check=HubRecovery.plan(fileValue,HubApp.allItems(),HubApp.money(),location.origin);
   if(check.changes.length)throw Error('保存の照合ができません。保存済み記録を確認してください');
   status(checked.changes.length+'件を端末へ保存し、状態を照合しました。Googleには未反映です。別端末へは自動共有されません。');disable();
  }catch(e){status(e.message);}
 };
 if(globalThis.HubPersistence){for(const [id,event]of [['hubRecoveryFile','onchange'],['hubRecoveryApply','onclick']]){const guarded=HubPersistence.guardAction(card,$(id)[event]);$(id)[event]=async function(e){try{return await guarded.call(this,e);}finally{$('hubRecoveryApply').disabled=!preview?.changes.length||!HubApp.canWrite();}};}}
}());
