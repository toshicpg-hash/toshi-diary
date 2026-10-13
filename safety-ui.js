(function(){
 'use strict';
 const $=id=>document.getElementById(id),marker='toshi_diary_clean_app_ready_v1';
 let snapshot=null,verified=false,activated=false;
 const notice=message=>{$('safetyStatus').textContent=message;};
 async function inspect(){
  snapshot=await DiarySafety.capture(indexedDB,location.origin);
  const revisions=DiarySafety.rows(snapshot,'revisions').length,hasData=DiarySafety.hasData(snapshot);
  let accepted=false;try{accepted=localStorage.getItem(marker)==='1';}catch{}
  if(accepted){await activate(false);return;}
  $('backupSteps').hidden=!hasData;$('safetyContinue').disabled=hasData;verified=!hasData;
  notice(hasData?'この端末に日記の編集履歴 '+revisions+'件を確認しました。まだ書き込みはしていません。\n最初にバックアップを保存し、保存したファイルを選んで確認してください。':'このブラウザに既存の日記データは見つかりませんでした。\n「日記を開く」で始められます。別の端末の日記は、同じ台帳を設定して同期してください。');
 }
 async function activate(remember){
  if(activated||!snapshot)return;
  if(remember){
   if(!verified)return;
   const current=await DiarySafety.capture(indexedDB,location.origin);
   if(!DiarySafety.sameData(snapshot,current)){snapshot=current;verified=false;$('safetyVerify').value='';$('backupSteps').hidden=false;$('safetyContinue').disabled=true;notice('確認中に日記が更新されました。他のHUB画面を閉じ、もう一度バックアップを保存してください。');return;}
   try{localStorage.setItem(marker,'1');}catch{}
  }
  activated=true;$('safetyGate').hidden=true;$('diary').hidden=false;
  const googleScript=document.createElement('script');googleScript.src='https://accounts.google.com/gsi/client';googleScript.async=true;document.head.append(googleScript);
  document.dispatchEvent(new Event('diary-activate'));
 }
 $('safetyDownload').onclick=async()=>{
  try{
   $('safetyDownload').disabled=true;verified=false;$('safetyContinue').disabled=true;
   snapshot=await DiarySafety.capture(indexedDB,location.origin);
   const payload=JSON.stringify(snapshot,null,2),blob=new Blob([payload],{type:'application/json'});if(blob.size>64*1024*1024)throw Error('バックアップが64MBを超えています。元データを保持したまま、別の保存方法を確認してください');const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='toshi-diary-safety-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('safetyVerify').disabled=false;$('safetyVerify').value='';notice('バックアップのダウンロードを開始しました。端末に保存されたファイルを選び、内容が一致することを確認してください。');
  }catch(error){notice('バックアップできませんでした：'+error.message+'。元データは変更していません。');}
  finally{$('safetyDownload').disabled=false;}
 };
 $('safetyVerify').onchange=async event=>{
  verified=false;$('safetyContinue').disabled=true;
  try{const file=event.target.files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('64MB以下のファイルを選んでください');const value=JSON.parse(await file.text());if(!DiarySafety.sameData(snapshot,value))throw Error('いま保存したバックアップと内容が一致しません');verified=true;$('safetyContinue').disabled=false;notice('保存したバックアップの内容が一致しました。「日記を開く」で再開できます。');}
  catch(error){notice('確認できませんでした：'+error.message+'。元データは変更していません。');}
 };
 $('safetyContinue').onclick=()=>activate(true).catch(error=>notice('再開できませんでした：'+error.message));
 inspect().catch(error=>notice('読み取り確認を完了できませんでした：'+error.message+'。元データは変更していません。'));
})();
