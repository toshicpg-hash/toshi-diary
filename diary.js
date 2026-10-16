(function(){
 'use strict';
 const C=ToshiDiaryCore,store=new ToshiDiaryStore(),el=id=>document.getElementById(id);
 const fields={date:'diaryDate',title:'diaryTitle',body:'diaryBody',people:'diaryPeople',golfGood:'diaryGolfGood',golfImprove:'diaryGolfImprove',golfNext:'diaryGolfNext'};
 let state={revisions:[],meta:{}},ready=false,editing=null,editParents=null,token='',expires=0,client=null,syncing=false,authorizing=false,saving=false,draftTimer=null,draftGeneration=0,writeQueue=Promise.resolve(),problem='';
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('toshi_diary_changed_v1'):null;
 const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const sheetId=value=>/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/.exec(value.trim())?.[1]||'';
 function text(tag,value,className=''){const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;}
 function button(label,handler,className=''){const b=text('button',label,className);b.type='button';b.onclick=()=>Promise.resolve(handler()).catch(showError);return b;}
 function readFields(){return Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,el(id).value]));}
 function dirty(){const v=readFields();return editing?Object.keys(fields).some(k=>v[k]!==editing[k]):Object.keys(fields).some(k=>k!=='date'&&v[k].trim());}
 function write(records=[],meta={}){const p=writeQueue.catch(()=>{}).then(()=>store.commit(records,meta));writeQueue=p;return p;}
 async function reload(){state=await store.state();renderList();renderRelated();renderState();}
 function showError(e){problem=e.message||String(e);el('diaryFormStatus').textContent='処理できませんでした：'+problem;renderState();}
 function renderState(){
  const configured=!!state.meta.sheet,known=new Set(state.meta['remote:'+state.meta.sheet]?.ids||[]),pending=state.revisions.filter(r=>!known.has(r.revisionId)).length;
  const remote=state.meta['remote:'+state.meta.sheet],conflictCount=C.conflicts(state.revisions).length;
  let msg=!ready?'端末の保存領域を確認中':!configured?'端末保存のみ｜台帳未設定・Google未接続':authorizing?'Google接続の確認待ち｜端末の記録は保持しています':syncing?'Google同期中｜端末の記録は保持しています':pending?'端末保存済み｜Google未同期の履歴 '+pending+'件':remote?'端末保存済み｜前回のGoogle照合済み':'端末保存のみ｜Google未同期';
  if(configured&&!syncing)msg+='｜'+(token&&Date.now()<expires?'Google接続中':'Google未接続');
  if(remote)msg+='\n前回同期：'+new Date(remote.at).toLocaleString('ja-JP')+'（その時点の確認）';
  if(conflictCount)msg+='\n同時編集 '+conflictCount+'件：両方を保持。内容を見て統合できます。';
  if(problem)msg+='\n'+problem;
  msg+='\nナミ：Googleへ同期した記録は台帳URLで共有可能。未同期の端末内記録はアクセス不可。';
  el('diaryState').textContent=msg;
  for(const id of ['diarySave','diarySync','diarySetSheet','diaryDisconnect','diaryBackup','diaryRestore','diaryNew'])el(id).disabled=!ready||saving||((syncing||authorizing)&&['diarySync','diarySetSheet','diaryDisconnect'].includes(id));
 }
 function setForm(record=null,parents=null){
  editing=record;editParents=parents;
  const values=record||{date:today()};for(const [k,id] of Object.entries(fields))el(id).value=values[k]||'';
  el('diaryEditorTitle').textContent=record?'ダイアリーを追記・編集':'今日のひとこと';
  el('diaryEditMeta').textContent=record?'入力 '+new Date(record.createdAt).toLocaleString('ja-JP')+'｜更新 '+new Date(record.updatedAt).toLocaleString('ja-JP')+'｜出来事の日付とは別に保持':'';
  el('diaryExtras').open=!!(record&&(record.people||record.golfGood||record.golfImprove||record.golfNext));
  el('diaryDraftStatus').textContent='';el('diaryFormStatus').textContent='';renderRelated();
 }
 async function startNew(){if(dirty()&&!confirm('書きかけの内容を閉じて、新しく書きますか？'))return;clearTimeout(draftTimer);draftGeneration++;setForm();await write([],{draft:null});}
 function queueDraft(){
  if(!ready||saving)return;const generation=++draftGeneration;clearTimeout(draftTimer);
  draftTimer=setTimeout(async()=>{const draft={fields:readFields(),baseRevisionId:editing?.revisionId||null,parents:editParents,at:new Date().toISOString()};try{await write([],{draft});if(generation===draftGeneration)el('diaryDraftStatus').textContent='書きかけをこの端末に保存済み（ダイアリー未登録・未共有）';}catch(e){el('diaryDraftStatus').textContent='書きかけを保存できません。入力欄は残しています：'+e.message;}},500);
 }
 async function saveDiary(e){
  e.preventDefault();if(!ready||saving)return;if(editing&&!dirty()&&!editParents){el('diaryFormStatus').textContent='変更はありません。保存済みのダイアリーを保持しています。';return;}
  let record;try{record=C.create(readFields(),{base:editing,parents:editParents,deviceId:state.meta.deviceId});}catch(error){showError(error);return;}
  saving=true;clearTimeout(draftTimer);draftGeneration++;el('diaryFormStatus').textContent='端末へ保存中…';renderState();
  for(const id of Object.values(fields))el(id).disabled=true;
  try{await write([record],{draft:null});await reload();setForm(record);el('diaryFormStatus').textContent='この端末に保存しました。Google共有は同期後に完了します。';problem='';channel?.postMessage('changed');}
  catch(error){showError(error);}finally{saving=false;for(const id of Object.values(fields))el(id).disabled=false;renderState();}
 }
 async function edit(record,resolve=false){
  if(dirty()&&!confirm('書きかけを閉じて、このダイアリーを編集しますか？'))return;
  clearTimeout(draftTimer);draftGeneration++;
  const alternatives=C.heads(state.revisions).filter(r=>r.entryId===record.entryId);
  setForm(record,resolve?alternatives.map(r=>r.revisionId):null);
  if(resolve){el('diaryBody').value=alternatives.map(r=>'【同時編集の内容】\n'+shareText(r)).join('\n\n');el('diaryFormStatus').textContent='両方の内容を確認・整理して保存してください。元の文章は編集履歴に残ります。';}
  queueDraft();el('diaryEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function shareText(r){return [r.date+' '+(r.title||'ダイアリー'),r.body,r.people&&'一緒にいた人：'+r.people,r.golfGood&&'よかった点：'+r.golfGood,r.golfImprove&&'反省点：'+r.golfImprove,r.golfNext&&'次回試すこと：'+r.golfNext].filter(Boolean).join('\n');}
 async function copyToNami(record,container){
  const value=shareText(record);try{await navigator.clipboard.writeText(value);container.append(text('p','コピーしました。ナミの会話に貼ってください。自動送信はしていません。','muted'));}catch{const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.rows=5;container.append(text('p','コピーできませんでした。下の文章を選択して会話に貼ってください。','muted'),area);area.select();}
 }
 function renderList(){
  const rows=el('diaryRows');rows.replaceChildren();
  const list=C.search(state.revisions,{month:el('diaryMonth').value,query:el('diarySearch').value,ascending:el('diaryOrder').value==='asc'}),heads=C.heads(state.revisions),counts=new Map();heads.forEach(r=>counts.set(r.entryId,(counts.get(r.entryId)||0)+1));
  if(globalThis.CustomEvent)queueMicrotask(()=>document.dispatchEvent(new CustomEvent('hub-diary-records',{detail:{records:state.revisions}})));
  el('diaryCount').textContent=list.length+'件表示｜全体 '+new Set(heads.map(r=>r.entryId)).size+'件｜過去の編集履歴も保持';
  if(!list.length)rows.append(text('p','該当するダイアリーはありません。','muted'));
  let previousMonth='';
  for(const r of list){
   if(r.date.slice(0,7)!==previousMonth){previousMonth=r.date.slice(0,7);rows.append(text('h3',previousMonth.replace('-','年')+'月'));}
   const item=document.createElement('article'),conflict=counts.get(r.entryId)>1;item.className='diary-entry'+(conflict?' diary-conflict':'');item.dataset.diaryEntry=r.entryId;
   item.append(text('div',r.date+'｜'+(r.source==='nami'?'ナミから追加':'ダイアリー'),'muted'),text('h3',r.title||'ひとこと'),text('div',r.body,'diary-text'));
   for(const [label,k] of [['一緒にいた人','people'],['よかった点','golfGood'],['反省点','golfImprove'],['次回試すこと','golfNext']])if(r[k])item.append(text('p',label+'\n'+r[k],'diary-text'));
   const ack=new Set(state.meta['remote:'+state.meta.sheet]?.ids||[]);item.append(text('div','入力 '+new Date(r.createdAt).toLocaleString('ja-JP')+'｜更新 '+new Date(r.updatedAt).toLocaleString('ja-JP')+'｜'+(ack.has(r.revisionId)?'前回Google照合済み':'端末のみ・未同期'),'muted'));
   if(conflict)item.append(text('p','同時編集あり。どちらの文章も残っています。','diary-warning'));
   const actions=document.createElement('div');actions.className='diary-buttons';actions.append(button('追記・編集',()=>edit(r),'primary'),button('ナミへコピー',()=>copyToNami(r,item)));
   if(conflict)actions.append(button('両方を見て統合',()=>edit(r,true)));
   item.append(actions);
   const versions=state.revisions.filter(x=>x.entryId===r.entryId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
   const history=document.createElement('details');history.className='diary-history';history.append(text('summary','編集履歴 '+versions.length+'件（原文を保持）'));
   for(const version of versions){const d=document.createElement('div');d.append(text('p',new Date(version.updatedAt).toLocaleString('ja-JP')+'｜'+version.source,'muted'),text('div',shareText(version),'diary-text'));history.append(d);}
   item.append(history);rows.append(item);
  }
 }
 function renderRelated(){}
 async function setSheet(){
  if(syncing)return;const id=sheetId(el('diarySheetUrl').value);if(!id){showError(Error('Googleダイアリー台帳のURLを入力してください'));return;}
  if(state.meta.sheet&&state.meta.sheet!==id&&!confirm('同期先を変更しますか？\nhttps://docs.google.com/spreadsheets/d/'+id+'/edit\n端末のダイアリーは残り、次回同期時に新しい台帳へも追加されます。'))return;
  await write([],{sheet:id});token='';expires=0;problem='';await reload();
 }
 async function api(path,options={}){
  if(!token||Date.now()>=expires){token='';throw Error('Google未接続です。もう一度「Googleでダイアリーを同期」を押してください');}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  let response;try{response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers},cache:'no-store'});}catch(error){throw Error(error.name==='AbortError'?'通信が時間切れになりました。記録は保持しています。次回同期で送信済みか確認します':'通信できません。端末の記録は保持しています');}finally{clearTimeout(timer);}
  const body=await response.json().catch(()=>({}));if(!response.ok){if(response.status===401){token='';expires=0;}throw Error('Google HTTP '+response.status+'：'+(body.error?.message||'台帳の権限・Sheets APIの有効化を確認してください'));}return body;
 }
 async function readRemote(id){
  const metadata=await api(encodeURIComponent(id)+'?fields=sheets.properties'),properties=metadata.sheets?.find(s=>s.properties.title==='日記履歴')?.properties;
  if(!properties)throw Error('「日記履歴」タブがありません。専用台帳を選んでください');
  if(properties.gridProperties.rowCount>100000)throw Error('ダイアリー台帳が大きいため同期を停止しました。端末記録は保持しています');
  const values=[];for(let row=1;row<=properties.gridProperties.rowCount;row+=500){const range="'日記履歴'!A"+row+':N'+Math.min(row+499,properties.gridProperties.rowCount),j=await api(encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE');values.push(...(j.values||[]));}
  return C.fromRows(values);
 }
 async function synchronize(){
  if(syncing||!ready)return {ok:false,message:'ダイアリーは準備中または同期中です'};const id=state.meta.sheet;if(!id){showError(Error('先に自分のダイアリー台帳を設定してください'));return {ok:false,message:'ダイアリー台帳が未設定です'};}
  const evidence={fetch:'not_attempted',save:'not_attempted',readback:'not_attempted',sheetId:id,revisionIds:[]};syncing=true;problem='';renderState();
  try{
   const remote=await readRemote(id);evidence.fetch='success';await write(remote);await reload();
   const remoteMap=new Map(remote.map(r=>[r.revisionId,r])),pending=state.revisions.filter(r=>!remoteMap.has(r.revisionId));
   for(let offset=0;offset<pending.length;offset+=20){const batch=pending.slice(offset,offset+20);await api(encodeURIComponent(id)+'/values/'+encodeURIComponent("'日記履歴'!A:N")+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({majorDimension:'ROWS',values:batch.map(C.toRow)})});}
   const verified=await readRemote(id),verifiedMap=new Map(verified.map(r=>[r.revisionId,r]));
   for(const r of pending)if(!verifiedMap.has(r.revisionId)||C.canonical(r)!==C.canonical(verifiedMap.get(r.revisionId)))throw Error('Googleへの保存を確認できません。端末の記録は保持し、未同期のままにします');
   await write(verified,{['remote:'+id]:{at:new Date().toISOString(),ids:[...verifiedMap.keys()]}});evidence.save='success';await reload();const disk=new Map(state.revisions.map(r=>[r.revisionId,r]));for(const r of verified)if(!disk.has(r.revisionId)||C.canonical(disk.get(r.revisionId))!==C.canonical(r))throw Error('端末のダイアリーの読み戻しが一致しません');evidence.readback='success';evidence.verifiedAt=new Date().toISOString();evidence.revisionIds=verified.map(r=>r.revisionId);channel?.postMessage('changed');return {ok:true,message:'ダイアリーの同期・読み取り照合が完了しました',evidence};
  }catch(error){if(evidence.fetch!=='success')evidence.fetch='failed';else if(evidence.save!=='success')evidence.save='failed';else evidence.readback='failed';problem='同期失敗・未確認：'+error.message;try{await reload();}catch{} return {ok:false,message:problem,evidence};}
  finally{syncing=false;renderState();}
 }
 function connect(){
  if(!ready||syncing||authorizing)return;if(!state.meta.sheet){showError(Error('先に自分のダイアリー台帳を設定してください'));return;}
  if(token&&Date.now()<expires){synchronize();return;}
  if(!window.google?.accounts?.oauth2){showError(Error('Google接続を読み込めません。通信を確認してHUBを開き直してください'));return;}
  authorizing=true;problem='';renderState();
  try{client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/spreadsheets',callback:response=>{authorizing=false;if(response.error){showError(Error('Google接続失敗：'+response.error));return;}token=response.access_token;expires=Date.now()+Math.max(0,(Number(response.expires_in)||3600)-60)*1000;synchronize();},error_callback:()=>{authorizing=false;showError(Error('Google接続を完了していません。ダイアリーは端末に保持しています'));}});
  client.requestAccessToken({prompt:'select_account'});}catch(error){authorizing=false;showError(error);}
 }
 async function backup(){
  const current=await store.state(),blob=new Blob([JSON.stringify(C.backup(current.revisions,current.meta.draft||null),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='toshi-diary-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);el('diaryBackupStatus').textContent='バックアップのダウンロードを開始しました。端末にファイルが保存されたことを確認してください。';
 }
 async function restore(file){
  if(!file)return;try{if(file.size>64*1024*1024)throw Error('64MB以下のバックアップを選んでください');const value=JSON.parse(await file.text()),safety=value?.format==='toshi-diary-safety-backup';if(safety&&(value.version!==1||value.database!==DiarySafety.DATABASE||!Array.isArray(value.stores)))throw Error('安全バックアップの形式が違います');const records=safety?C.merge(DiarySafety.rows(value,'revisions')):C.restore(value);if(!confirm('ダイアリーの編集履歴 '+records.length+'件を今ある記録と照合して復元します。既存のダイアリーは削除しません。続けますか？'))return;await write(records);await reload();channel?.postMessage('changed');el('diaryBackupStatus').textContent='復元しました。Googleへの反映はダイアリーを同期してください。';if(safety)el('diaryBackupStatus').textContent+=' 台帳設定・書きかけは元ファイルに保持しています（現在の設定・入力は上書きしません）。';if(value.draft?.fields)el('diaryBackupStatus').textContent+=' バックアップの書きかけは元ファイルに保持しています（現在の入力は上書きしません）。';}catch(error){el('diaryBackupStatus').textContent='復元できませんでした。既存の記録は保持しています：'+error.message;}finally{el('diaryRestore').value='';}
 }
 async function init(){
  try{await store.open();state=await store.state();if(!state.meta.deviceId){await write([],{deviceId:crypto.randomUUID()});state=await store.state();}
   const params=new URLSearchParams(location.hash.slice(1)),id=params.get('diarySheet');
   if(id&&/^[A-Za-z0-9_-]{20,}$/.test(id)){if(confirm('このリンクのダイアリー台帳へ同期先を設定しますか？\nhttps://docs.google.com/spreadsheets/d/'+id+'/edit\n次に同期すると、この端末のダイアリーと全編集履歴をこの台帳へ追加します。'))await write([],{sheet:id});params.delete('diarySheet');history.replaceState(null,'',location.pathname+location.search+(params.size?'#'+params.toString():''));}
   ready=true;await reload();el('diarySheetUrl').value=state.meta.sheet?'https://docs.google.com/spreadsheets/d/'+state.meta.sheet+'/edit':'';setForm();
   const draft=state.meta.draft;if(draft?.fields){const base=state.revisions.find(r=>r.revisionId===draft.baseRevisionId)||null;setForm(base,draft.parents||null);for(const [k,field] of Object.entries(fields))if(typeof draft.fields[k]==='string')el(field).value=draft.fields[k];el('diaryDraftStatus').textContent='この端末の書きかけを復元しました（ダイアリー未登録・未共有）';renderRelated();}
   renderState();
  }catch(error){ready=false;problem='ダイアリーの保存領域を開けません：'+error.message+'。保存済みデータは削除していません。';renderState();}
 }
 globalThis.HubDiarySync={SCOPE:'https://www.googleapis.com/auth/spreadsheets',state:()=>({ready,configured:!!state.meta.sheet,busy:syncing||authorizing||saving}),syncWithGrant:async grant=>{
  if(!ready||syncing||authorizing||saving)return {ok:false,message:'ダイアリーは準備中または処理中です'};
  if(!state.meta.sheet)return {ok:false,message:'ダイアリー台帳が未設定です。ダイアリー画面で設定してください'};
  if(!grant||typeof grant.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes('https://www.googleapis.com/auth/spreadsheets'))return {ok:false,message:'ダイアリーのGoogle接続を確認できません。端末の記録は保持しています'};
  token=grant.access_token;expires=grant.expiresAt;return synchronize();
 }};
 el('diaryForm').onsubmit=saveDiary;el('diaryNew').onclick=()=>startNew().catch(showError);
 for(const id of Object.values(fields))el(id).addEventListener('input',()=>{queueDraft();if(id==='diaryDate')renderRelated();});
 ['diaryMonth','diaryOrder'].forEach(id=>el(id).onchange=renderList);el('diarySearch').oninput=renderList;
 el('diaryAllMonths').onclick=()=>{el('diaryMonth').value='';renderList();};
 el('diarySetSheet').onclick=()=>setSheet().catch(showError);el('diarySync').onclick=connect;
 el('diaryOpenSheet').onclick=()=>{if(state.meta.sheet)window.open('https://docs.google.com/spreadsheets/d/'+state.meta.sheet+'/edit','_blank','noopener,noreferrer');else showError(Error('先に台帳URLを設定してください'));};
 el('diaryDisconnect').onclick=()=>{if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';expires=0;problem='';renderState();};
 el('diaryBackup').onclick=()=>backup().catch(showError);el('diaryRestore').onchange=e=>restore(e.target.files[0]);
 channel&&(channel.onmessage=()=>{if(ready)reload().catch(showError);});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)reload().catch(showError);});
 document.addEventListener('click',e=>{if(e.target.closest('[data-go="diary"]')&&ready)reload().catch(showError);});
 document.addEventListener('diary-activate',()=>{init();},{once:true});
})();

