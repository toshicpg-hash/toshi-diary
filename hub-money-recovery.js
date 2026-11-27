/* Read-only recovery history verifier. No planning, transport or execution capability. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hub-money-ledger.js'):root.HubMoneyLedger);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyRecovery=api;})(globalThis,function(C){
'use strict';const FORMAT='papa-money-recovery-v1',same=(a,b)=>C.canonical(a)===C.canonical(b),fail=m=>{throw Error(m);};
function readersCheck(readers,snapshotHash){if(!Array.isArray(readers)||readers.length!==2||new Set(readers.map(x=>x.deviceId)).size!==2||readers.some(x=>!C.safeId(x.deviceId)||x.capability!==FORMAT||!x.evidence?.trim()||!Number.isFinite(Date.parse(x.checkedAt))||x.snapshotHash!==snapshotHash||x.pendingPreserved!==true))fail('両端末の対応版・基準履歴・保全の実確認が必要です');}
const sorted=rs=>[...rs].sort((a,b)=>a.revisionId.localeCompare(b.revisionId));
function decode(rows){if(!Array.isArray(rows)||!same(rows[0],C.HEADERS))fail('復旧台帳の列が違います');return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(raw=>{try{return C.fromRow(raw);}catch(e){return {recordId:C.safeId(String(raw[1]))?String(raw[1]):null,revisionId:C.safeId(String(raw[0]))?String(raw[0]):null,invalidRow:C.copy(raw),problem:e.message};}});}
async function rawEvents(rows){const result=[];for(const [i,raw]of rows.slice(1).entries()){if(!raw.some(v=>v!==''&&v!==null))continue;try{const r=C.fromRow(raw);await C.verify(r);result.push(r);}catch(e){result.push({recordId:C.safeId(String(raw[1]))?String(raw[1]):null,revisionId:C.safeId(String(raw[0]))?String(raw[0]):null,invalidRow:C.copy(raw),problem:e.message});}}return result;}
function body(raw){if(!Array.isArray(raw)||raw.length!==8)fail('対象原本は8列が必要です');const b=JSON.parse(raw[6]);if(!b||b.format!==C.FORMAT||!b.value||!['settle','edit'].includes(raw[3]))fail('復旧対象の意味を確認できません');return b;}
function draftValue(raw,request,parent){const b=body(raw),v=C.copy(b.value);if(parent.value.done||parent.value.actuals.length||v.kind!==parent.value.kind||v.subjectMonth!==parent.value.subjectMonth||v.done!==true||v.actuals?.length!==1)fail('親の状態・対象月・単一実績を確認してください');const a=v.actuals[0];
 if(!C.date(a.date)||!C.integer(a.amount)||!a.account?.label?.trim()||!['bank-verified','ledger-verified','reported'].includes(a.evidence?.status)||!a.evidence?.note?.trim())fail('実績の根拠が不明です');
 if(!request.accountReference?.trim()||request.accountReference.length>160||!request.evidenceRef?.trim()||request.evidenceRef.length>2000||request.accountLabel!==a.account.label||!['preserve','unconfirmed'].includes(request.subjectMonthReview))fail('口座の根拠・対象月の扱いを明示してください');
 if(a.account.reference&&a.account.reference!==request.accountReference)fail('元の口座参照を変更できません');a.account.reference=request.accountReference;
 if(request.subjectMonthReview==='unconfirmed')v.subjectMonthReview={status:'unconfirmed',note:'既存の対象月は保持。銀行実績だけでは対象月を確定していません。'};
 C.valueCheck(v);return v;
}
async function auditEvents(input){
 const envelopes=[...new Map(input.filter(r=>r?.recovery).map(r=>[C.canonical(r),r])).values()];if(!envelopes.length)return {...await C.audit(input),recoveryArchives:[]};if(envelopes.length!==1)fail('複数の復旧封筒を自動統合しません');
 const e=envelopes[0],m=e.recovery;await C.verify(e);if(e.action!=='batch'||m?.format!==FORMAT||m.version!==1||!Array.isArray(m.baselineIds)||new Set(m.baselineIds).size!==m.baselineIds.length||!Array.isArray(m.entries)||m.entries.length!==e.value.operations.length)fail('復旧封筒が不正です');
 readersCheck(m.readers,m.snapshotHash);if(!/^[a-f0-9]{64}$/.test(m.snapshotHash)||C.toRow(e)[6].length>40000)fail('復旧封筒の基準・容量が不正です');
 const others=input.filter(r=>!r.recovery),base=await C.audit(others),pins=sorted(base.revisions.filter(r=>m.baselineIds.includes(r.revisionId)));
 if(pins.length!==m.baselineIds.length||await C.hash(pins)!==m.baselineHash)fail('復旧の基準履歴が一致しません');const baseline=await C.audit(pins),covered=new Set(),archives=[],records=new Set();
 for(const [i,entry]of m.entries.entries()){
  const matches=[];for(const q of base.quarantine)if(q.raw.invalidRow&&await C.hash(q.raw.invalidRow)===entry.rawHash)matches.push(q);
  if(!matches.length||records.has(entry.recordId))fail('隔離原本がないか対応が重複しています');records.add(entry.recordId);const raw=matches[0].raw.invalidRow,parent=C.current(baseline,entry.recordId),child=e.value.operations[i];
  if(raw[0]!==entry.revisionId||raw[1]!==entry.recordId||!parent||!same(JSON.parse(raw[2]),parent.heads)||child.recordId!==entry.recordId||child.action!=='settle'||!same(child.parents,parent.heads)||!same(child.value,draftValue(raw,entry.request,parent)))fail('原本・親・正式実績の対応が不一致です');
  for(const q of matches)covered.add(C.canonical(q.raw));
  // Old clients may have retained the same invalid revision as a parsed object.
  let parsed;try{parsed=C.fromRow(raw);}catch{}if(parsed)for(const q of base.quarantine)if(same(q.raw,parsed))covered.add(C.canonical(q.raw));
  archives.push({raw:C.copy(raw),rawHash:entry.rawHash,recordId:entry.recordId,originalRevisionId:entry.revisionId,replacementRevisionId:child.revisionId,operationId:e.revisionId});
 }
 const active=input.filter(r=>!covered.has(C.canonical(r))),state=await C.audit(active);
 if(e.value.operations.some(c=>C.current(state,c.recordId)?.status!=='ready'))fail('復旧対象に想定外の編集・競合があります');
 return {...state,recoveryArchives:archives};
}
async function inspect(rows){decode(rows);const events=await rawEvents(rows);return {events,state:await auditEvents(events)};}
return {FORMAT,inspect,auditEvents};
});
