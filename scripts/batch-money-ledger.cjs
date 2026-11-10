#!/usr/bin/env node
/* Offline planning only. A complete batch is one RAW row; never a bank or Google client. */
'use strict';
const fs=require('node:fs'),C=require('../hub-money-ledger.js'),E=require('./operate-money-ledger.cjs'),Read=require('./check-money-ledger.cjs');
const FORMAT='papa-money-approved-batch',fail=m=>{throw Error(m);},same=(a,b)=>C.canonical(a)===C.canonical(b);
async function load(i){
 if(!i.secondRead||['settingsRows','historyRows','sampleRows'].some(k=>!same(i[k],i.secondRead[k])))fail('独立した2回の全読取りが必要です');
 const report=await Read.check(i),state=await C.audit(i.historyRows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(C.fromRow));
 if(!report.migration.active||report.migration.sourceDrift.length||report.comparisonIssues.length||state.quarantine.length||state.conflictCount)fail('移行・比較・隔離・競合を確認するまで停止します');
 return {report,state};
}
const hashPlan=async p=>{const v={...p};delete v.planHash;return C.hash(v);};
function readers(i,report,state){
 const rs=i.compatibleReaders;if(!Array.isArray(rs)||rs.length!==2||new Set(rs.map(r=>r.deviceId)).size!==2||rs.some(r=>r.capability!=='money-batch-v1'||r.checkpoint!==state.checkpoint||!Number.isFinite(Date.parse(r.checkedAt))||!report.devices.some(d=>d.id===r.deviceId)))fail('両端末の対応版・基準履歴の確認が必要です');
 return C.copy(rs);
}
function bind(i,p){if(i.expectedOwner!==p.owner||i.expectedLedgerId!==p.ledgerId)fail('本人・台帳IDが予行と違います');}
function approval(i,p){const a=i.approval;if(i.cancelled)fail('取消済みです');if(!a||a.planHash!==p.planHash||a.operationId!==p.operationId||a.ledgerId!==p.ledgerId||a.owner!==p.owner||!Number.isFinite(Date.parse(a.at))||typeof a.note!=='string'||!a.note.trim()||a.note.length>700)fail('全変更に対する本人承認が一致しません');}
function target(state,id){const r=C.current(state,id);if(!r||r.status!=='ready'||r.heads.length!==1||r.value.source.type==='rent-master'||r.value.withdrawal)fail('対象ID・履歴・正本・撤回状態を確認してください');return r;}
function drafts(state,requests,id){
 if(!Array.isArray(requests)||!requests.length||requests.length>20)fail('一括対象は1〜20操作です');
 const out=[],used=new Set();
 const add=(recordId,parents,before,value,action)=>{if(used.has(recordId))fail('一括内で同じ記録を複数回操作できません');used.add(recordId);out.push({recordId,parents,before,value,action});};
 for(const [index,request]of requests.entries()){
  if(Object.keys(request).some(k=>!['recordId','changes','split'].includes(k))||!!request.changes===!!request.split)fail('個別変更または分離を指定してください');
  const row=target(state,request.recordId);
  if(request.changes){const value=E.patch(row.value,request.changes,id+':'+index);add(row.recordId,row.heads,row.value,value,value.withdrawal?'withdraw':request.changes.settle?'settle':'edit');continue;}
  const split=request.split,parts=split.parts;
  if(Object.keys(split).some(k=>!['reason','parts'].includes(k))||typeof split.reason!=='string'||!split.reason.trim()||split.reason.length>1000||!['income','payment'].includes(row.value.kind)||row.value.done||row.value.actuals.length||!C.integer(row.value.plannedAmount)||!Array.isArray(parts)||parts.length<2||parts.length>5)fail('実績なし未消込の既知額だけを理由付きで分離できます');
  let total=0;const pins=[];
  for(const [n,part]of parts.entries()){
   if(Object.keys(part).some(k=>!['title','plannedAmount','subjectMonth','actual','settle','classificationPendingReason'].includes(k))||part.settle!==undefined&&typeof part.settle!=='boolean'||!C.integer(part.plannedAmount)||typeof part.title!=='string'||!part.title.trim())fail('分離内訳の件名・予定額が必要です');
   total+=part.plannedAmount;if(!Number.isSafeInteger(total))fail('分離額の合計が範囲外です');
   const recordId=n===0?row.recordId:'split:'+id+':'+index+':'+n;if(n&&C.current(state,recordId))fail('分離先IDが既にあります');pins.push({recordId,plannedAmount:part.plannedAmount});
  }
  if(total!==row.value.plannedAmount)fail('分離前後の予定額合計が一致しません');
  for(const [n,part]of parts.entries()){
   const base=n===0?C.copy(row.value):{kind:row.value.kind,title:part.title,subjectMonth:row.value.subjectMonth,plannedDate:row.value.plannedDate,plannedAmount:null,actuals:[],done:false,source:{type:'hub'},businessKey:'split:'+id+':'+index+':'+n,note:''};
   const changes={corrections:{title:part.title,plannedAmount:part.plannedAmount,...Object.hasOwn(part,'subjectMonth')?{subjectMonth:part.subjectMonth}:{}},...part.actual?{actual:part.actual}:{},...part.settle===true?{settle:true}:{},...part.classificationPendingReason?{classificationPendingReason:part.classificationPendingReason}:{}};
   const value=E.patch(base,changes,id+':'+index+':'+n);
   value.splitOrigin={operationId:id,recordId:row.recordId,heads:row.heads,plannedAmount:row.value.plannedAmount,parts:pins,reason:split.reason};
   add(pins[n].recordId,n===0?row.heads:[],n===0?row.value:null,value,n===0?(part.settle?'settle':'edit'):'create');
  }
 }
 if(out.length>20)fail('一括改訂は20記録までです');return out;
}
async function envelope(p,a){
 const reason='承認済み一括／'+p.planHash+'／'+a.at+'／'+a.note+'／分類保留 '+p.requests.flatMap(r=>r.changes?.classificationPendingReason?[r.changes.classificationPendingReason]:(r.split?.parts||[]).map(x=>x.classificationPendingReason).filter(Boolean)).join('／');
 return C.sealBatch({id:p.operationId,at:p.at,device:{id:'nami',name:'ナミ'},reason,operations:p.drafts.map((d,n)=>({format:C.FORMAT,version:C.VERSION,recordId:d.recordId,revisionId:'unused:'+n,parents:d.parents,action:d.action,value:d.value}))});
}
async function plan(i){
 const {report,state}=await load(i);if(!/^[A-Za-z0-9_.-]{1,60}$/.test(i.operationId)||!Number.isFinite(Date.parse(i.at)))fail('固定operationId・日時が必要です');
 if(state.revisions.some(r=>r.revisionId==='batch:'+i.operationId))fail('使用済み操作です。元の計画を読戻してください');
 const p={format:FORMAT,version:1,operationId:i.operationId,at:i.at,owner:report.owner,ledgerId:report.ledgerId,baseline:state.checkpoint,tables:{settingsRows:C.copy(i.settingsRows),sampleRows:C.copy(i.sampleRows),projectionRows:C.copy(i.projectionRows)},history:state.revisions.map(r=>({id:r.revisionId,hash:r.fingerprint})),compatibleReaders:readers(i,report,state),requests:C.copy(i.requests),drafts:drafts(state,i.requests,i.operationId)};
 p.planHash=await hashPlan(p);
 const r=await envelope(p,{at:i.at,note:'予行容量確認'}),after=await C.audit([...state.revisions,r]);if(after.conflictCount||after.quarantine.length)fail('一括反映後に競合・不正履歴があります');return p;
}
async function validate(i,p){
 if(p?.format!==FORMAT||p.version!==1||await hashPlan(p)!==p.planHash)fail('予行のハッシュが不一致です');bind(i,p);approval(i,p);
 if(!Array.isArray(p.compatibleReaders)||p.compatibleReaders.some(r=>r.checkpoint!==p.baseline||r.capability!=='money-batch-v1'))fail('端末確認が予行と不一致です');
}
async function prepare(i,p){
 await validate(i,p);const {state}=await load(i),r=await envelope(p,i.approval),existing=state.revisions.find(x=>x.revisionId===r.revisionId);
 if(existing){const result=await verify(i,p);if(!result.ok)fail('既存の操作結果が未確認です');return {status:'already',append:null,verification:result};}
 if(Object.keys(p.tables).some(k=>!same(i[k],p.tables[k]))||state.checkpoint!==p.baseline||!same(drafts(state,p.requests,p.operationId),p.drafts))fail('基準履歴または承認差分が変わりました');
 const after=await C.audit([...state.revisions,r]);if(after.conflictCount||after.quarantine.length)fail('一括変更後の安全性を確認できません');
 return {status:'prepared-not-written',operationId:p.operationId,expectedCheckpoint:after.checkpoint,append:{tab:'入出金履歴',valueInputOption:'RAW',rows:[C.toRow(r)]}};
}
async function verify(i,p){
 await validate({...i,cancelled:false},p);const {state}=await load(i),r=await envelope(p,i.approval),found=state.revisions.find(x=>x.revisionId===r.revisionId),problems=[];
 if(Object.keys(p.tables).some(k=>!same(i[k],p.tables[k])))problems.push('設定・比較・照合表示が基準から変わりました');
 if(!found||!same(found,r))problems.push('封筒が未検出または内容不一致');
 if(state.revisions.length!==p.history.length+1||p.history.some(pin=>!state.revisions.some(x=>x.revisionId===pin.id&&x.fingerprint===pin.hash)))problems.push('全履歴が基準＋承認した一括変更だけではありません');
 for(const [n,d]of p.drafts.entries()){const row=C.current(state,d.recordId);if(row?.status!=='ready'||!same(row.value,d.value)||!same(row.heads,[r.revisionId+':'+n]))problems.push('対象が承認後の状態ではありません：'+d.recordId);}
 return {ok:!problems.length,checkpoint:state.checkpoint,problems,recordCount:state.rows.length,historyCount:state.revisions.length,note:'Google保存の照合です。端末表示は別確認。未確認時は同じ操作を読み戻し、新しいIDで再送しないでください。'};
}
module.exports={plan,prepare,verify};
if(require.main===module)(async()=>{const [mode,file,p]=process.argv.slice(2);if(!['plan','prepare','verify'].includes(mode)||!file||mode!=='plan'&&!p)fail('Usage: plan input.json | prepare input.json plan.json | verify input.json plan.json');const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),result=await module.exports[mode](read(file),p?read(p):undefined);console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=2;})().catch(e=>{console.error(e.message);process.exitCode=1;});
