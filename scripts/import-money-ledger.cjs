#!/usr/bin/env node
/* ナミ取込（第1段階：新しい予定の記録だけ）。トシさんが会話で確認した候補から、端末と同じ検証コードで改訂を作り、追記後に照合する。
   入出力には本人の入出金が含まれる。公開リポジトリやソースへ入れない。手順は docs/nami-import.md。
   plan  : node scripts/import-money-ledger.cjs plan  <private-input.json>          → 追記する行（20行ずつ）と照合の予定
   verify: node scripts/import-money-ledger.cjs verify <private-reread.json> <plan.json> → 追記の照合と「入出金の取込結果」に書く行 */
'use strict';
const fs=require('node:fs'),C=require('../hub-money-ledger.js');
const NAMI={id:'nami',name:'ナミ'},CHUNK=20;
const CAND_HEADERS=['import_id','date','kind','title','amount','account','memo','written_at','written_by'];
const RESULT_HEADERS=['import_id','result','reason','at','device_id'];
const ID=/^[A-Za-z0-9_.:-]{1,150}$/;
const fail=m=>{throw Error(m);};
function body(rows,headers,name){if(!Array.isArray(rows)||C.canonical((rows[0]||[]).map(String))!==C.canonical(headers))return fail(name+'のヘッダーが一致しません');return rows.slice(1).filter(r=>Array.isArray(r)&&r.some(v=>v!==''&&v!==null&&v!==undefined));}
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
/* 端末と同じ読み方で、共通台帳の全体を検証する */
async function load(input){
 const settings=Object.fromEntries(body(input.settingsRows,['項目','値'],'設定'));
 if(settings.format!==C.FORMAT||String(settings.version)!=='1'||!C.safeId(settings.ledgerId)||!input.expectedOwner||!input.expectedLedgerId||settings.owner!==input.expectedOwner||settings.ledgerId!==input.expectedLedgerId)return fail('本人・台帳ID・形式が一致しません。何も作っていません');
 const history=body(input.historyRows,C.HEADERS,'入出金履歴');
 const events=history.map(row=>{try{return C.fromRow(row.map(v=>v==null?'':String(v)));}catch(e){return {recordId:C.safeId(String(row[1]))?String(row[1]):null,revisionId:C.safeId(String(row[0]))?String(row[0]):null,invalidRow:C.copy(row),problem:e.message};}});
 const samples=await C.unpackSamples(body(input.sampleRows,C.SAMPLE_HEADERS,'端末比較')),state=await C.audit(events),migration=await C.migrations(state,samples.samples);
 return {settings,events,state,migration};
}
const notReady=state=>state.rows.filter(r=>r.status!=='ready').map(r=>r.recordId).sort();
/* 候補タブ（入出金の取込候補）の行と、トシさんが会話で確認した importId から、第1段階の候補を作る */
function candidates(input){
 const approved=new Set(input.approvedImportIds||[]);if(!approved.size)return fail('トシさんが確認した importId（approvedImportIds）がありません');
 if(!input.approval||!Number.isFinite(Date.parse(input.approval.at))||typeof input.approval.note!=='string'||!input.approval.note.trim()||input.approval.note.length>1000)return fail('トシさんの確認（approval.at・approval.note）を入れてください');
 const rows=body(input.candidateRows,CAND_HEADERS,'入出金の取込候補').map(r=>Object.fromEntries(CAND_HEADERS.map((h,i)=>[h,String(r[i]??'').trim()])));
 const out=[],seen=new Set();
 for(const id of approved){
  const found=rows.filter(r=>r.import_id===id);
  if(found.length!==1){out.push({importId:id,result:'held',reason:found.length?'同じ import_id の候補が複数あります':'候補タブに見つかりません'});continue}
  const r=found[0],amount=r.amount.replace(/[,，¥￥\s]/g,''),problems=[];
  if(!ID.test(id))problems.push('import_id の形（英数字と _ . : - だけ、150文字まで）');
  if(!C.date(r.date))problems.push('日付 YYYY-MM-DD');
  if(!['income','payment'].includes(r.kind))problems.push('kind は income か payment');
  if(!r.title||r.title.length>300)problems.push('題名');
  if(!/^\d+$/.test(amount)||!Number.isSafeInteger(Number(amount)))problems.push('金額（0以上の整数）');
  if(seen.has(id))problems.push('同じ import_id');seen.add(id);
  if(problems.length){out.push({importId:id,result:'held',reason:'形が違います：'+problems.join('・')});continue}
  const note=[r.account&&('口座：'+r.account),r.memo&&('メモ：'+r.memo),'ナミ取込：'+(r.written_by||'ナミ')+(r.written_at?' '+r.written_at:'')].filter(Boolean).join('／');
  out.push({importId:id,value:{kind:r.kind,title:r.title,subjectMonth:null,plannedDate:r.date,plannedAmount:Number(amount),actuals:[],done:false,source:{type:'nami-import',importId:id,approvedAt:new Date(input.approval.at).toISOString(),approvedNote:input.approval.note.trim()},businessKey:'nami:'+id,note:note.slice(0,4000)}});
 }
 return out;
}
async function plan(input){
 if(!C.safeId(input.runId||''))return fail('runId を入れてください（英数字と _ . : -）');
 const at=input.at||new Date().toISOString();if(!Number.isFinite(Date.parse(at)))return fail('at（日時）を確認してください');
 const {state,migration}=await load(input);
 /* 全体として止める条件 */
 if(!migration.active||migration.plans.some(p=>p.status!=='ready'))return fail('共通台帳への移行が有効でないため止めました（移行前は取り込みません）');
 if(Number.isInteger(input.previousQuarantineCount)&&state.quarantine.length>input.previousQuarantineCount)return fail('前回の照合より隔離（未確認の行）が増えています。台帳を確かめるまで止めました');
 const baseline={checkpoint:state.checkpoint,notReady:notReady(state),quarantine:state.quarantine.length,revisionCount:state.revisionCount};
 const warnings=[];if(migration.sourceDrift?.length)warnings.push('端末の元データに未照合の変更があります（第1段階は止めずに報告します）');
 const results=[],revisions=[];
 for(const c of candidates(input)){
  if(!c.value){results.push(c);continue}
  const recordId='nami:'+c.importId,revisionId='import:'+c.importId;
  const r=await C.seal({format:C.FORMAT,version:C.VERSION,recordId,revisionId,parents:[],action:'create',device:C.copy(NAMI),at,reason:'ナミ取込（トシさん確認済み）',value:c.value});
  const old=state.revisions.find(x=>x.revisionId===revisionId);
  if(old){results.push({importId:c.importId,result:old.fingerprint===r.fingerprint?'already':'held',reason:old.fingerprint===r.fingerprint?'取込済み（同じ内容）':'同じ取込IDの記録が台帳に違う内容であります',recordId,revisionId});continue}
  if(state.rows.some(x=>x.recordId===recordId||x.value?.businessKey===c.value.businessKey||x.alternatives?.some(a=>a.value?.businessKey===c.value.businessKey))){results.push({importId:c.importId,result:'held',reason:'同じ記録ID・対応キーの記録があります',recordId});continue}
  const same=state.rows.find(x=>{const v=x.value||x.alternatives?.[0]?.value;return v&&v.kind===c.value.kind&&norm(v.title)===norm(c.value.title)&&(x.status!=='ready'||v.plannedDate===c.value.plannedDate&&v.plannedAmount===c.value.plannedAmount);});
  if(same){results.push({importId:c.importId,result:'held',reason:same.status!=='ready'?'競合・未確認の記録と件名が重なります':'同じ件名・予定日・金額の記録があります（二重の恐れ）',recordId});continue}
  /* 件名が違っても、同じ区分・同じ予定額で、予定日が前後10日以内（予定日がなければ同じ対象月）の記録は、既存の予定に当たる恐れがある（実績の追加は第2段階） */
  const near=state.rows.find(x=>x.status==='ready'&&x.value&&x.value.kind===c.value.kind&&x.value.plannedAmount===c.value.plannedAmount&&(x.value.plannedDate?Math.abs(Date.parse(x.value.plannedDate+'T00:00:00Z')-Date.parse(c.value.plannedDate+'T00:00:00Z'))<=10*86400000:x.value.subjectMonth===c.value.plannedDate.slice(0,7)));
  if(near){results.push({importId:c.importId,result:'held',reason:'既存の予定と重なる恐れ（実績の追加は第2段階）。記録ID '+near.recordId,recordId,existingRecordId:near.recordId});continue}
  revisions.push(r);results.push({importId:c.importId,result:'add',reason:'',recordId,revisionId});
 }
 /* 足したあとの状態を、端末と同じ検証で作ってみる */
 const after=await C.audit([...state.revisions,...revisions]),bad=revisions.filter(r=>C.current(after,r.recordId)?.status!=='ready');
 if(bad.length||C.canonical(notReady(after))!==C.canonical(baseline.notReady)||after.quarantine.length!==baseline.quarantine)return fail('足すと競合・未確認が増えるため、何も作っていません');
 const rows=revisions.map(C.toRow);
 return {format:'papa-money-nami-import-plan',version:1,runId:input.runId,at,ledgerId:input.expectedLedgerId,baseline,expectedCheckpoint:after.checkpoint,warnings,results,
  append:{tab:'入出金履歴',valueInputOption:'RAW',chunks:Array.from({length:Math.ceil(rows.length/CHUNK)},(_,i)=>rows.slice(i*CHUNK,i*CHUNK+CHUNK))},
  revisions:revisions.map(r=>({revisionId:r.revisionId,recordId:r.recordId,fingerprint:r.fingerprint}))};
}
/* 追記したあとに全部を読み直したもの（2回分）で照合し、「入出金の取込結果」に書く行を作る */
async function verify(input,planned){
 if(planned?.format!=='papa-money-nami-import-plan')return fail('plan の出力を指定してください');
 const first=await load(input),second=input.historyRows2?await load({...input,historyRows:input.historyRows2}):first;
 if(first.state.checkpoint!==second.state.checkpoint)return fail('読み直しの途中で台帳が変わりました（端末が同期中の可能性）。時間をおいて照合し直してください');
 const {state}=first,problems=[];
 for(const p of planned.revisions){const r=state.revisions.find(x=>x.revisionId===p.revisionId);if(!r)problems.push(p.revisionId+'：台帳に見つかりません（足りない行だけ、同じ行で追記し直してください）');else if(r.fingerprint!==p.fingerprint)problems.push(p.revisionId+'：SHA256が一致しません');else if(C.current(state,p.recordId)?.status!=='ready')problems.push(p.recordId+'：ready ではありません');}
 const extra=notReady(state).filter(id=>!planned.baseline.notReady.includes(id));if(extra.length)problems.push('競合・未確認が増えました：'+extra.join(', '));
 if(state.quarantine.length>planned.baseline.quarantine)problems.push('隔離が増えました');
 const ok=!problems.length,exact=state.checkpoint===planned.expectedCheckpoint,at=input.at||new Date().toISOString();
 const rows=planned.results.map(r=>[r.importId,r.result==='add'?(ok?'added':'unverified'):r.result,(r.result==='add'?'記録ID '+r.recordId+'／照合ID '+state.checkpoint:r.reason)+(r.result==='add'&&!exact?'／ほかの追記あり':''),at,'nami']);
 return {format:'papa-money-nami-import-verification',version:1,runId:planned.runId,ok,exactCheckpoint:exact,checkpoint:state.checkpoint,problems,
  existingNotReady:planned.baseline.notReady.length,added:ok?planned.revisions.length:0,held:planned.results.filter(r=>r.result==='held').length,already:planned.results.filter(r=>r.result==='already').length,
  resultTab:{tab:'入出金の取込結果',headers:RESULT_HEADERS,rows},
  note:'台帳への追記は確認済み。Flip8・Fold8 に届いたかは、端末の同期のあと「照合表示」が新しい照合IDになったかで確かめます。'};
}
module.exports={plan,verify,CAND_HEADERS,RESULT_HEADERS};
if(require.main===module)(async()=>{
 const [mode,a,b]=process.argv.slice(2),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 if(mode==='plan'&&a)process.stdout.write(JSON.stringify(await plan(read(a)),null,2)+'\n');
 else if(mode==='verify'&&a&&b){const r=await verify(read(a),read(b));process.stdout.write(JSON.stringify(r,null,2)+'\n');if(!r.ok)process.exitCode=2;}
 else fail('Usage: plan <input.json> | verify <reread.json> <plan.json>');
})().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
