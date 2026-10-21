/* Local-only compatibility view. Original assets and previously saved revisions remain intact. */
(function(root){
 'use strict';
 const S=HubBoardStore,$=id=>document.getElementById(id);
 let sequence=0;
 // Cancel only this board's delivery. No calendar/proof consent or user records are changed.
 try{const consent=localStorage.getItem(S.CONSENT);if(consent!==null&&consent!=='off')localStorage.setItem(S.CONSENT,'off');}catch{}
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function action(label,run,write=false){const b=make('button',label);b.type='button';if(write){b.dataset.write='';b.disabled=!HubApp.canWrite();}b.onclick=async()=>{try{await run();}catch(e){$('featureBoardStatus').textContent=e.message;}};return b;}
 const label=p=>(p.type==='note'?'メモ｜':p.type==='file'?'ファイル｜':'リンク｜')+p.title;
 const open=p=>HubFeatures.viewRecord({payload:p});
 async function render(){const seq=++sequence;try{
  const state=await S.read();if(seq!==sequence)return;
  const rows=$('featureBoardRows'),filter=$('featureBoardFilter').value.toLocaleLowerCase(),showHidden=$('featureBoardHidden').checked;
  rows.replaceChildren();
  const history=make('details'),historyRows=make('div');history.append(make('summary','保存済み資料の履歴'),historyRows);
  for(const [entity,heads] of state.heads){
   const hidden=S.hidden(state,entity),active=heads.filter(r=>!r.deleted);
   if((!hidden||showHidden)&&active.length&&active.some(r=>[r.content.title,r.content.text,r.content.url].join('\n').toLocaleLowerCase().includes(filter))){
    const row=make('article',undefined,'hub-row');row.dataset.boardEntity=entity;
    if(active.length>1)row.append(make('p','保存済みの複数の版があります。どの内容も保持しています。','muted'));
    for(const revision of active){const p=S.payload(state,revision);row.append(action(label(p),()=>open(p)));}
    row.append(action(hidden?'一覧に戻す':'どける',async()=>{if(!confirm(hidden?'この資料をこの端末の一覧に戻しますか？':'この端末の一覧からどけますか？原本と履歴は残します。'))return;if(hidden)await S.show(entity);else await S.visibility(entity,true);await render();},true));
    rows.append(row);
   }
   const revisions=state.revisions.filter(r=>r.entity===entity&&!r.deleted);
   if(revisions.length>1||!active.length){
    const item=make('div',undefined,'hub-row');
    for(const revision of revisions){const p=S.payload(state,revision);item.append(action(label(p)+'｜'+(revision.createdAt?new Date(revision.createdAt).toLocaleString('ja-JP'):'以前の保存記録'),()=>open(p)));}
    if(!active.length&&revisions.length){const prior=[...revisions].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];item.append(action('この端末の一覧へ復元',async()=>{if(!confirm('保存済みの内容を、この端末の一覧へ復元しますか？旧版は保持し、Driveへは送信しません。'))return;await S.edit(entity,heads.map(r=>r.id),S.payload(state,prior));await render();},true));}
    historyRows.append(item);
   }
  }
  if(!rows.children.length)rows.append(make('p','表示する資料はありません。検索条件や「どけた資料も表示」を確認してください。','muted'));
  if(historyRows.children.length)rows.append(history);
 }catch(e){if(seq===sequence)$('featureBoardStatus').textContent='資料を確認できません：'+e.message+'。原本と履歴は保持しています。';}}
 async function saveForm(){try{
  HubApp.checkWrite();const type=$('featureBoardType').value,payload={type,title:$('featureBoardTitle').value.trim()};
  if(!payload.title)throw Error('見出しを入力してください');
  if(type==='note'){payload.text=$('featureBoardText').value;if(!payload.text.trim())throw Error('メモを入力してください');}
  else if(type==='url'){payload.url=HubBoardCore.safeURL($('featureBoardURL').value);if(!payload.url)throw Error('http/httpsの資料URLを入力してください');}
  else{const file=$('featureBoardFile').files[0];if(!file||file.size>15*1024*1024||!(/\.(pdf|png|jpe?g|gif|webp|avif|docx?|xlsx?)$/i.test(file.name)))throw Error('15MB以下のPDF・画像・Word・Excelを選んでください');payload.blob=file;payload.mime=file.type;payload.fileName=file.name;}
  await S.add(payload);$('featureBoardForm').reset();$('featureBoardType').onchange();await render();$('featureBoardStatus').textContent='この端末に保存・読み戻し確認しました。Driveへは送信しません。';
 }catch(e){$('featureBoardStatus').textContent=e.message;}}
 root.HubBoardLocal={render,saveForm};
})(globalThis);
