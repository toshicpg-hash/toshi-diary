/* Explicit local quarantine disposition. Never makes an invalid event valid. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hub-money-ledger.js'):root.HubMoneyLedger);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyQuarantine=api;})(globalThis,function(C){
'use strict';const same=(a,b)=>C.canonical(a)===C.canonical(b),fail=m=>{throw Error(m);};
async function plan({local,remoteEvents,secondRemoteEvents,decisions,operationId,at}){
 if(!C.safeId(operationId)||!Number.isFinite(Date.parse(at))||!same(remoteEvents,secondRemoteEvents))fail('修復ID・日時・独立した2回のGoogle読取りを確認してください');
 const events=local.events.map(e=>e.value),state=await C.audit(events),remote=await C.audit(remoteEvents);
 if(remote.quarantine.length||remote.conflictCount||!same(state.revisions,remote.revisions))fail('有効履歴の不一致・未送信編集・競合があります');
 if(!state.quarantine.length||!Array.isArray(decisions)||decisions.length!==state.quarantine.length||new Set(decisions.map(d=>d.revisionId)).size!==decisions.length)fail('隔離全件の処置を明示してください');
 const entries=[];
 for(const q of state.quarantine){const raw=q.raw,row=raw.invalidRow,d=decisions.find(d=>d.revisionId===raw.revisionId);
  if(!d||!['awaiting-formal','separate-review'].includes(d.disposition)||typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>1000)fail('原本保管の理由と処置が必要です');
  if(d.disposition==='awaiting-formal'&&!C.safeId(d.replacementOperationId))fail('対応する正式操作IDを固定してください');
  if(d.disposition==='separate-review'&&d.replacementOperationId)fail('別途確認の記録に正式操作を割当てません');
  if(!Array.isArray(row)||row.length!==7||row[0]!==raw.revisionId||row[1]!==raw.recordId||row[3]!=='settle')fail('対象はSHA列欠落の旧消込操作だけです');
  if(remote.revisions.some(r=>r.revisionId===row[0]))fail('同じ履歴IDがGoogleにあります');
  let parents,money;try{parents=JSON.parse(row[2]);money=JSON.parse(row[6]);}catch{fail('旧操作を解析できません');}
  const current=C.current(remote,row[1]);
  if(!current||current.status!=='ready'||!same(parents,current.heads)||current.value.done||current.value.actuals.length||money.format!==C.FORMAT||money.version!==1||!same(money.value,{...current.value,done:true}))fail('旧操作が現在の親履歴の消込フラグだけの変更ではありません');
  const stored=local.events.filter(e=>same(e.value,raw));if(stored.length!==1)fail('隔離原本の保存単位が一意ではありません');
  entries.push({entry:C.copy(stored[0]),rawHash:await C.hash(raw),recordId:row[1],parentHeads:parents,decision:C.copy(d)});
 }
 const body={format:'papa-money-quarantine-disposition',version:1,operationId,at,config:C.copy(local.meta.find(m=>m.key==='config')?.value||null),beforeHash:await C.hash(local),expectedCheckpoint:remote.checkpoint,entries};return {...body,planHash:await C.hash(body)};
}
async function validate(plan,local){const body=C.copy(plan);delete body.planHash;if(plan.format!=='papa-money-quarantine-disposition'||plan.version!==1||await C.hash(body)!==plan.planHash||await C.hash(local)!==plan.beforeHash)fail('確認後に修復計画または端末データが変わりました');}
function confirmedActuals(v){return !!(v?.done&&!v.withdrawal&&v.actuals.length&&v.actuals.every(a=>a.date&&a.amount!==null&&a.account?.label?.trim()&&a.account?.reference?.trim()&&a.evidence?.status!=='unconfirmed'&&a.evidence?.note?.trim()));}
async function links(archive,state){const result=[];for(const item of archive.plan.entries){const op=item.decision.replacementOperationId,batch=op&&state.revisions.find(r=>r.revisionId==='batch:'+op),child=batch?.value.operations.find(c=>c.recordId===item.recordId),row=C.current(state,item.recordId),historicalMatch=!!(child&&row?.status==='ready'&&row.history.some(h=>h.revisionId===child.revisionId)&&confirmedActuals(child.value)&&item.parentHeads.every(h=>child.parents.includes(h))),verified=historicalMatch&&confirmedActuals(row.value)&&child.value.actuals.every(a=>row.value.actuals.some(current=>same(a,current)));result.push({recordId:item.recordId,disposition:item.decision.disposition,historicalMatch,verified,revisionId:child?.revisionId||null,actualIds:child?.value.actuals.map(a=>a.id)||[]});}return result;}
async function verifyArchive(a){const p=a?.plan,b=C.copy(p);delete b.planHash;if(p.format!=='papa-money-quarantine-disposition'||p.version!==1||await C.hash(b)!==p.planHash||a.approval?.planHash!==p.planHash||a.approval?.confirmed!==true)fail('保管原本の計画・確認が不一致です');for(const e of p.entries){if(await C.hash(e.entry.value)!==e.rawHash)fail('保管原本が変わりました');let invalid=false;try{await C.verify(e.entry.value);}catch{invalid=true;}if(!invalid)fail('有効履歴を隔離保管できません');}return true;}
return {plan,validate,links,verifyArchive};});
