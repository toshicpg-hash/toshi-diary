(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./hub-core.js'):root.HubCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubDeadlineRepair=api;})(globalThis,function(root,C){
'use strict';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function shifted(date,isHoliday){
 if(!C.day(date))return null;
 for(let i=0;i<370;i++){const holiday=isHoliday(date);if(holiday===null)return null;if(new Date(date+'T12:00:00Z').getUTCDay()!==0&&!holiday)return date;date=C.addDays(date,1);}
 return null;
}
function candidates(proofs,selectedKey,localRows,overlay,isHoliday){
 const local=new Map(localRows.map(row=>[row._key,row]));
 return proofs.flatMap(proof=>{
  const key=C.key(proof.row),original=proof.event.originalStartTime?.date||(proof.event.originalStartTime?.dateTime?new Date(proof.event.originalStartTime.dateTime).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}):''),date=proof.row.date;
  const moved=original&&original!==date&&shifted(original,isHoliday)===date;
  if(key!==selectedKey&&!moved)return [];
  const current=local.get(key),valid=proof.row.type==='todo'&&!proof.row.done&&!proof.row.cancelled&&(!current||current.type==='todo'&&!current.done&&!current.completionConflict),patch=overlay.edits[key];
  const starts=[C.workStart(proof.row),...(current?[C.workStart(current)]:[])],alignStart=!!moved&&starts.includes(original)&&starts.every(value=>!value||value===original||value===date);
  const mismatch=C.deadline(proof.row)!==date||(current&&C.deadline(current)!==date)||proof.event.extendedProperties?.private?.toshiHubEnd!==date||alignStart;
  return [{proof,key,date,local:current,patch:structuredClone(patch),cached:structuredClone(overlay.google.find(row=>C.key(row)===key)),valid,selected:!!valid&&!!mismatch,original,canAlignStart:!!moved,alignStart}];
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function assertLocal(overlay,plan,rows){
 if(!equal(overlay.edits[plan.key],plan.patch)||!equal(overlay.google.find(row=>C.key(row)===plan.key),plan.cached)||!equal(rows.find(row=>row._key===plan.key),plan.local))throw Error('確認後に端末の対象データが変わりました。もう一度照合してください');
 if(plan.local&&(plan.local.type!=='todo'||plan.local.done||plan.local.completionConflict))throw Error('端末の未完了状態を確認できません');
 if(plan.local)C.validateItem({...plan.local,...(plan.alignStart?{start:plan.proof.row.date,scheduledDate:plan.proof.row.date}:{}),deadlineDate:plan.date,end:plan.date},plan.local);
}
function apply(overlay,plan,result){
 if(C.key(result)!==plan.key||result.type!=='todo'||result.done||result.cancelled||C.deadline(result)!==plan.date)throw Error('同じIDの未完了ToDoと期限を確認できません');
 if(plan.alignStart&&C.workStart(result)!==plan.proof.row.date)throw Error('Google予定日と開始日が一致しません');
 if(!equal(overlay.edits[plan.key],plan.patch)||!equal(overlay.google.find(row=>C.key(row)===plan.key),plan.cached))throw Error('端末の対象データが変わりました。Googleは再照合してください');
 const index=overlay.google.findIndex(row=>C.key(row)===plan.key);
 if(index>=0)overlay.google[index]=result;else overlay.google.push(result);
 if(plan.patch){overlay.edits[plan.key]={...plan.patch,deadlineDate:plan.date,...(plan.alignStart?{start:plan.proof.row.date,scheduledDate:plan.proof.row.date}:{})};if(Object.hasOwn(plan.patch,'end'))overlay.edits[plan.key].end=plan.date;}
}
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
let dialog=null,pending=false;
async function verifyLocal(){await root.HubApp.verifyCalendarReadback();}
async function open(item){
 if(pending||dialog?.open)return;root.HubApp.checkWrite();
 dialog=element('dialog');dialog.style.maxWidth='620px';dialog.style.width='calc(100% - 24px)';
 const title=element('h2','Googleと期限・開始日を照合'),message=element('p','Googleの最新予定と、この端末の編集内容を確認しています。'),body=element('div'),actions=element('div'),applyButton=element('button','選択した日付を整合する'),close=element('button','閉じる');
 message.setAttribute('role','status');actions.className='row-actions';applyButton.type=close.type='button';applyButton.disabled=true;actions.append(applyButton,close);dialog.append(title,message,body,actions);document.body.append(dialog);
 const dispose=()=>{if(!pending){dialog.close();dialog.remove();dialog=null;}};close.onclick=dispose;dialog.addEventListener('cancel',e=>{e.preventDefault();dispose();});dialog.showModal();pending=true;close.disabled=true;
 try{
  const proofs=await root.HubGoogle.inspectDeadlines(item),overlay=root.HubApp.overlay(),rows=root.HubApp.allItems();root.HubApp.checkWrite();
  const plans=candidates(proofs,item._key,rows,overlay,date=>root.HubHolidays.isHoliday(date)),inputs=[];
  body.append(element('p','選択した発生分だけ日付をそろえます。「開始日もそろえる」を選ぶと、移動前の日に残っているToDoの開始日もGoogle予定日に合わせます。Googleの予定日・件名・完了状態は変更しません。同じ繰返しの日曜・祝日から移動済みの候補を今後約1年分表示し、通常の土曜日は移動しません。'));
  for(const plan of plans){
   const box=element('section');box.className='card';const label=element('label'),check=element('input');check.type='checkbox';check.dataset.deadlineSelect='';check.style.width=check.style.height='20px';check.checked=plan.selected;check.disabled=!plan.valid;label.append(check,document.createTextNode(' '+plan.proof.row.title+'｜'+plan.date));box.append(label);
   const p=plan.proof.event.extendedProperties?.private||{};
   box.append(element('p','Google予定日：'+plan.proof.row.date+'｜Googleの期限：'+(C.deadline(plan.proof.row)||'未設定')+'｜この端末の期限：'+(plan.local?C.deadline(plan.local)||'未設定':'未取得')));
   box.append(element('p','GoogleのToDo開始日：'+(C.workStart(plan.proof.row)||'未設定')+'｜この端末の開始日：'+(plan.local?C.workStart(plan.local)||'未設定':'未取得')));
   const startLabel=element('label'),startCheck=element('input');startCheck.type='checkbox';startCheck.dataset.alignStart='';startCheck.style.width=startCheck.style.height='20px';startCheck.checked=plan.alignStart;startCheck.disabled=!plan.valid||!plan.canAlignStart;startLabel.append(startCheck,document.createTextNode(' 開始日も '+plan.proof.row.date+' にそろえる'));box.append(startLabel);
   const change=element('label','修正後の期限 '),input=element('input');input.type='date';input.value=plan.date;input.disabled=!plan.valid;change.append(input);box.append(change);
   const detail=element('details'),summary=element('summary','修正前の日付情報と端末の編集内容'),pre=element('pre',JSON.stringify({eventId:plan.proof.eventId,googleDeadlineDate:p.toshiHubDeadlineDate??null,googleLegacyEnd:p.toshiHubEnd??null,googleTodoStart:p.toshiHubStart??null,localEdit:plan.patch??null},null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);box.append(detail);
   if(!plan.valid)box.append(element('p','未完了ToDoの状態を確認できないため、この発生分は修正できません。'));
   body.append(box);inputs.push({plan,check,input,startCheck});
  }
  const enabled=()=>{applyButton.disabled=pending||!inputs.some(x=>x.check.checked&&x.plan.valid);};inputs.forEach(x=>{x.check.onchange=enabled;});
  message.textContent=plans.length?'内容を確認し、修正する発生分を選んでください。':'照合できる未完了ToDoがありません。';
  applyButton.onclick=async()=>{
   if(pending)return;try{root.HubApp.checkWrite();}catch(error){message.textContent=error.message;return;}const selected=inputs.filter(x=>x.check.checked&&x.plan.valid).map(x=>({...x.plan,date:x.input.value,alignStart:x.startCheck.checked}));if(!selected.length)return;
   if(selected.some(x=>!C.day(x.date))){message.textContent='修正後の期限をYYYY-MM-DDで入力してください。';return;}
   if(!confirm(selected.map(x=>x.proof.row.title+'：期限 '+x.date+(x.alignStart?'｜開始 '+x.proof.row.date:'')).join('\n')+'\n\nこの'+selected.length+'件の選択した日付だけをGoogleと端末に保存しますか？変更前の情報は履歴に残します。'))return;
   pending=true;close.disabled=true;enabled();inputs.forEach(x=>{x.check.disabled=true;x.input.disabled=true;x.startCheck.disabled=true;});let done=0;
   try{
    for(const plan of selected){
     assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());message.textContent='期限を照合・保存しています：'+(done+1)+' / '+selected.length;
     const result=await root.HubGoogle.repairDeadline(plan.proof,plan.date,{alignStart:plan.alignStart,beforeUpdate:async proof=>{
      root.HubApp.checkWrite();assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());
      await root.HubApp.commit('deadline-before-update',next=>{next.history.push({at:new Date().toISOString(),kind:'previous-google-event',calendarId:proof.calendarId,eventId:proof.eventId,value:proof.event},{at:new Date().toISOString(),kind:'previous-deadline-edit',key:plan.key,value:structuredClone(plan.patch)??null},...(plan.local?[{at:new Date().toISOString(),kind:'previous-item',value:plan.local}]:[]));});await verifyLocal();
     }});
     root.HubApp.checkWrite();assertLocal(root.HubApp.overlay(),plan,root.HubApp.allItems());
     await root.HubApp.commit('deadline-reconcile',next=>{if(plan.cached)next.history.push({at:new Date().toISOString(),kind:'previous-google',value:plan.cached});apply(next,plan,result.row);});await verifyLocal();done++;
    }
    message.textContent=done+'件の日付をGoogleで読み戻し、端末への保存も確認しました。ToDo一覧と予定の週表示を確認してください。';
   }catch(error){message.textContent=done+'件は端末への保存確認済みです。残りは完了していません：'+error.message+'。Googleへの反映だけ進んだ可能性もあるため、閉じて再照合してください。';}
   finally{pending=false;close.disabled=false;applyButton.disabled=true;}
  };
 }catch(error){message.textContent='照合できません：'+error.message+'。保存済みの期限は変更していません。';}
 finally{pending=false;close.disabled=false;applyButton.disabled=!body.querySelector('input[data-deadline-select]:checked');}
}
return {shifted,candidates,assertLocal,apply,open};
});
