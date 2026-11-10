#!/usr/bin/env node
/* Offline only: exact owner-reviewed, single-record edits. Never sends a request. */
'use strict';
const fs=require('node:fs'),C=require('../hub-money-ledger.js'),Read=require('./check-money-ledger.cjs');
const FORMAT='papa-money-nami-operation',FIELDS=['title','plannedDate','plannedAmount','subjectMonth','note'];
const fail=m=>{throw Error(m);},equal=(a,b)=>C.canonical(a)===C.canonical(b);
async function load(input){
 const report=await Read.check(input);
 if(!report.migration.active||report.migration.sourceDrift.length||report.comparisonIssues.length||report.quarantinedCount)fail('移行・端末比較・隔離を確認するまで停止します');
 const state=await C.audit(input.historyRows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(C.fromRow));
 return {report,state};
}
async function stable(input){
 if(!input.secondRead)fail('独立した2回目の全読取りが必要です');
 for(const k of ['settingsRows','historyRows','sampleRows'])if(!equal(input[k],input.secondRead[k]))fail('2回の読取りが一致しません');
 return load(input);
}
function patch(before,request,operationId){
 if(!request||Array.isArray(request)||Object.keys(request).some(k=>!['corrections','actual','actualEdit','settle','withdrawal'].includes(k)))fail('操作の指定が不正です');
 if(before.withdrawal)fail('撤回済みの記録は変更できません');
 const after=C.copy(before),corrections=request.corrections||{};
 if(Object.keys(corrections).some(k=>!FIELDS.includes(k)))fail('承認対象外の訂正です');
 Object.assign(after,C.copy(corrections));
 if(request.withdrawal){
  if(Object.keys(corrections).length||request.actual||request.actualEdit||request.settle!==undefined||before.done||before.actuals.length)fail('撤回は実績なしの未消込予定だけの単独操作です');
  if(Object.keys(request.withdrawal).some(k=>!['reason','replacementRecordId','replacementActualId'].includes(k)))fail('撤回の指定が不正です');
  after.withdrawal=C.copy(request.withdrawal);
 }else{
  if(request.actualEdit){
   if(request.actual)fail('実績の追加と訂正は分けて確認してください');
   const edit=request.actualEdit,found=after.actuals.find(a=>a.id===edit.id);
   if(!found||!equal(found,edit.before)||!edit.changes||!Object.keys(edit.changes).length||Object.keys(edit).some(k=>!['id','before','changes'].includes(k))||Object.keys(edit.changes).some(k=>!['date','amount','account','evidence'].includes(k)))fail('訂正する実績ID・変更前・変更項目が一致しません');
   const changed={...found,...C.copy(edit.changes)};
   if(!C.date(changed.date)||!Number.isSafeInteger(changed.amount)||changed.amount<0||!changed.account?.label?.trim()||!changed.account?.reference?.trim()||!['reported','bank-verified','ledger-verified'].includes(changed.evidence?.status)||!changed.evidence?.note?.trim())fail('訂正後の実績・実口座・根拠を確定してください');
   if(after.actuals.some(a=>a.id!==edit.id&&a.date===changed.date&&a.amount===changed.amount&&equal(a.account||null,changed.account)))fail('訂正後の実績が重複します');
   after.actuals=after.actuals.map(a=>a.id===edit.id?changed:a);
  }
  if(request.actual){
   const a=request.actual;
   if(Object.keys(a).some(k=>!['date','amount','account','evidence'].includes(k))||!C.date(a.date)||!Number.isSafeInteger(a.amount)||a.amount<0||!a.account?.label?.trim()||!a.account?.reference?.trim()||!['reported','bank-verified','ledger-verified'].includes(a.evidence?.status)||!a.evidence?.note?.trim())fail('実績日・実額・実口座・確認根拠を確定してください');
   const actual={...C.copy(a),id:'actual:'+operationId};
   if(before.actuals.some(x=>x.id===actual.id||x.date===a.date&&x.amount===a.amount&&(!x.account||equal(x.account,a.account))))fail('同じ実績の重複候補です。追記しません');
   after.actuals.push(actual);
  }
  if(request.settle!==undefined&&request.settle!==true)fail('消込取消は対象外です');
  if(request.settle){
   if(!after.subjectMonth||!after.actuals.length||after.actuals.some(a=>!a.date||a.amount===null||!a.account?.label||!a.account?.reference||a.evidence.status==='unconfirmed'||!a.evidence.note?.trim()))fail('対象月・実績・実口座・根拠が未確認です');
   after.done=true;
  }
 }
 C.valueCheck(after);if(equal(after,before))fail('変更がありません');return after;
}
function compatible(input){
 const readers=input.compatibleReaders;
 if(!Array.isArray(readers)||readers.length!==2||new Set(readers.map(x=>x.deviceId)).size!==2||readers.some(x=>!C.safeId(x.deviceId)||x.capability!=='money-stage2-v1'||typeof x.checkedAt!=='string'||!Number.isFinite(Date.parse(x.checkedAt))||x.checkpoint!==input.readerCheckpoint))fail('両端末の対応版・同期照合の確認が必要です');
 return C.copy(readers);
}
async function digest(plan){const body={...plan};delete body.planHash;return C.hash(body);}
async function validate(plan){
 if(plan?.format!==FORMAT||plan.version!==1||await digest(plan)!==plan.planHash)fail('予行の内容・ハッシュが一致しません');
 if(!C.safeId(plan.operationId)||!C.safeId(plan.recordId)||!C.safeId(plan.ledgerId)||typeof plan.owner!=='string'||!Number.isFinite(Date.parse(plan.at)))fail('予行の識別情報が不正です');
 if(!equal(patch(plan.before,plan.changes,plan.operationId),plan.after))fail('承認対象外の変更です');
 compatible({compatibleReaders:plan.compatibleReaders,readerCheckpoint:plan.baseline});
 if(plan.before.source.type==='rent-master'||plan.baseHeads.length!==1)fail('対象は単一の確定した予定に限ります');
}
async function plan(input){
 const {report,state}=await stable(input);
 if(!C.safeId(input.operationId)||input.operationId.length>140||!Number.isFinite(Date.parse(input.at)))fail('固定operationId・atが必要です');
 const row=C.current(state,input.recordId);
 if(row?.status!=='ready'||row.heads.length!==1||row.value.source.type==='rent-master')fail('対象IDが未確認・競合・家賃正本、または存在しません');
 const revisionId='nami-operation:'+input.operationId;
 if(state.revisions.some(r=>r.revisionId===revisionId))fail('操作IDは使用済みです。元の予行で読戻し確認してください');
 const readers=compatible(input);if(readers.some(x=>!report.devices.some(d=>d.id===x.deviceId)))fail('確認した端末が台帳比較と一致しません');if(input.readerCheckpoint!==state.checkpoint)fail('端末確認後に履歴が変わりました');
 const before=C.copy(row.value),after=patch(before,input.changes,input.operationId);
 const result={format:FORMAT,version:1,operationId:input.operationId,at:input.at,owner:report.owner,ledgerId:report.ledgerId,recordId:row.recordId,baseHeads:row.heads,before,after,changes:C.copy(input.changes),compatibleReaders:readers,baseline:state.checkpoint,history:state.revisions.map(r=>({id:r.revisionId,hash:r.fingerprint})),existingNotReady:state.rows.filter(r=>r.status!=='ready').map(r=>r.recordId).sort()};
 await C.change(state,{recordId:row.recordId,revisionId,parents:row.heads,value:after,action:after.withdrawal?'withdraw':input.changes.settle?'settle':'edit',device:{id:'nami',name:'ナミ'},at:input.at});
 return {...result,planHash:await digest(result)};
}
function approved(input,p){
 if(input.cancelled===true)fail('取消済みです。追記行は作りません');
 const a=input.approval;
 if(!a||a.planHash!==p.planHash||a.recordId!==p.recordId||a.ledgerId!==p.ledgerId||a.owner!==p.owner||a.operationId!==p.operationId||!Number.isFinite(Date.parse(a.at))||typeof a.note!=='string'||!a.note.trim()||a.note.length>700)fail('本人の対象・変更前後の承認が予行と一致しません');
}
async function revision(p,input){
 approved(input,p);
 return C.seal({format:C.FORMAT,version:1,recordId:p.recordId,revisionId:'nami-operation:'+p.operationId,parents:p.baseHeads,action:p.after.withdrawal?'withdraw':p.changes.settle?'settle':'edit',device:{id:'nami',name:'ナミ'},at:p.at,reason:'ナミ実績・撤回／予行 '+p.planHash+'／本人確認 '+input.approval.at+'／'+input.approval.note,value:p.after});
}
function bound(input,p){if(input.expectedOwner!==p.owner||input.expectedLedgerId!==p.ledgerId)fail('予行と本人・台帳が一致しません');}
function preserved(state,p){return p.history.every(pin=>state.revisions.some(r=>r.revisionId===pin.id&&r.fingerprint===pin.hash));}
async function prepare(input,p){
 await validate(p);approved(input,p);bound(input,p);
 const {state}=await stable(input),r=await revision(p,input),old=state.revisions.find(x=>x.revisionId===r.revisionId);
 if(old){const v=await verify(input,p);if(!v.ok)fail('既存の操作が未確認です：'+v.problems.join('／'));return {status:'already',append:null,verification:v};}
 if(state.checkpoint!==p.baseline||!preserved(state,p))fail('予行後に台帳が変わりました。古い予行では書けません');
 const checked=await C.change(state,{...r});if(!equal(checked,r))fail('改訂検証不一致');
 const after=await C.audit([...state.revisions,r]);
 if(C.current(after,p.recordId)?.status!=='ready')fail('編集後の競合を検出しました');
 return {status:'prepared-not-written',operationId:p.operationId,planHash:p.planHash,expectedCheckpoint:after.checkpoint,append:{tab:'入出金履歴',valueInputOption:'RAW',rows:[C.toRow(r)]},note:'未書込み。直前の全読取りに対する確認です。並行追記は読戻しまで未確認として扱います。'};
}
async function verify(input,p){
 await validate(p);bound(input,p);
 // Even after cancellation or an uncertain request, allow read-only verification with the original approval.
 const r=await revision(p,{...input,cancelled:false}),{state}=await stable(input),problems=[];
 const found=state.revisions.find(x=>x.revisionId===r.revisionId),row=C.current(state,p.recordId);
 if(!found)problems.push('追記が見つかりません。成功ではありません');
 else if(!equal(found,r))problems.push('同じ操作IDの内容・承認が一致しません');
 if(state.revisions.length!==p.history.length+1||state.revisions.some(x=>x.revisionId!==r.revisionId&&!p.history.some(pin=>pin.id===x.revisionId&&pin.hash===x.fingerprint)))problems.push('対象外の履歴変更があります');
 if(!preserved(state,p))problems.push('元の履歴が不足または変更されています');
 if(row?.status!=='ready'||!equal(row.heads,[r.revisionId])||!equal(row.value,p.after))problems.push('現在の対象が承認後の状態ではありません（競合・後続編集を含む）');
 const notReady=state.rows.filter(x=>x.status!=='ready').map(x=>x.recordId).sort();
 if(!equal(notReady,p.existingNotReady))problems.push('競合・未確認の構成が変わりました');
 return {ok:!problems.length,status:problems.length?'unverified':'verified',operationId:p.operationId,recordId:p.recordId,checkpoint:state.checkpoint,problems,note:problems.length?'保存結果は未確認です。再作成・削除・自動再承認をしないでください。':'台帳の読戻し確認済み。端末への反映・未送信端末の状態は別確認です。'};
}
module.exports={plan,prepare,verify,FIELDS};
if(require.main===module)(async()=>{const [mode,file,planned]=process.argv.slice(2);if(!['plan','prepare','verify'].includes(mode)||!file||mode!=='plan'&&!planned)fail('Usage: plan input.json | prepare input.json plan.json | verify input.json plan.json');const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),result=await module.exports[mode](read(file),planned?read(planned):undefined);process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.ok===false)process.exitCode=2;})().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
