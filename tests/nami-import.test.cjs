'use strict';
/* ナミ取込（第1段階）。架空のデータだけ。本物の台帳ID・金額・口座は使わない。 */
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../hub-money-ledger.js'),I=require('../scripts/import-money-ledger.cjs');
const owner='synthetic@example.invalid',ledgerId='synthetic-ledger',flip={id:'synthetic-flip',name:'Flip8'},fold={id:'synthetic-fold',name:'Fold8'},at='2026-11-05T00:00:00.000Z';
const base=()=>({kind:'income',title:'SYNTHETIC RENT',subjectMonth:'2026-11',plannedDate:'2026-11-30',plannedAmount:100,actuals:[],done:false,source:{type:'hub'},businessKey:'synthetic:rent:2026-11',note:''});
const approval={at:'2026-11-05T09:00:00+09:00',note:'会話で確認（架空）'};
async function ledger({migrated=true,conflict=true}={}){
 const raw={_key:'legacy-money:0',kind:'income',title:'SYNTHETIC RENT',amount:100,date:'2026-11-30',done:false};
 const pack=async(id,device)=>C.packSample({id,device,at,payload:{format:'papa-money-comparison',version:1,money:[raw],previousSampleIds:[]}});
 const pa=await pack('sample-flip',flip),pb=await pack('sample-fold',fold),[a,b]=[(await C.unpackSamples(pa.rows)).samples[0],(await C.unpackSamples(pb.rows)).samples[0]];
 const revisions=[];
 if(migrated){const plan={format:'papa-money-migration-plan',version:1,id:'plan-1',samplePins:[a,b].map(s=>({id:s.id,fingerprint:s.fingerprint})),groups:[{recordId:'stable-money',sources:[{sampleId:a.id,key:raw._key},{sampleId:b.id,key:raw._key}],value:base()}]};revisions.push(...(await C.prepareMigration(plan,[a,b],await C.audit([]),flip,at)).revisions);}
 if(conflict){/* 既にある競合（同じ親から2つの編集） */
  const v={...base(),title:'SYNTHETIC CONFLICT',businessKey:'synthetic:conflict',plannedAmount:5},root=await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-root',parents:[],action:'create',device:flip,at,reason:'',value:v});
  revisions.push(root,await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-a',parents:['c-root'],action:'edit',device:flip,at,reason:'',value:{...v,plannedAmount:6}}),await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-b',parents:['c-root'],action:'edit',device:fold,at,reason:'',value:{...v,plannedAmount:7}}));
 }
 return {settingsRows:[['項目','値'],['format',C.FORMAT],['version','1'],['owner',owner],['ledgerId',ledgerId]],expectedOwner:owner,expectedLedgerId:ledgerId,
  historyRows:[C.HEADERS,...revisions.map(C.toRow)],sampleRows:[C.SAMPLE_HEADERS,...pa.rows,...pb.rows],projectionRows:[C.VIEW_HEADERS]};
}
const cand=(id,date='2026-12-10',kind='payment',title='SYNTHETIC PAYMENT '+id,amount='1,200')=>[id,date,kind,title,amount,'架空口座','架空メモ','2026-11-05T08:00:00+09:00','ナミ'];
const input=async(rows,approved,opt)=>({...(await ledger(opt)),runId:'run-1',at,approval,approvedImportIds:approved,candidateRows:[I.CAND_HEADERS,...rows]});
const appended=(inp,plan,chunks=plan.append.chunks)=>({...inp,historyRows:[...inp.historyRows,...chunks.flat()]});

test('plan：トシさんが確認した候補だけ、端末と同じ形の create を作る。形が違う・重なる候補は保留',async()=>{
 const inp=await input([cand('n-001'),cand('n-bad','2026/12/10'),cand('n-dup','2026-11-30','income','SYNTHETIC RENT','100'),cand('n-cf','2026-12-01','income','synthetic conflict','5'),cand('n-not-approved')],['n-001','n-bad','n-dup','n-cf','n-missing']);
 const p=await I.plan(inp),by=id=>p.results.find(r=>r.importId===id);
 assert.equal(by('n-001').result,'add');assert.equal(by('n-001').recordId,'nami:n-001');assert.equal(by('n-001').revisionId,'import:n-001');
 assert.match(by('n-bad').reason,/日付/);assert.match(by('n-dup').reason,/二重の恐れ/);assert.match(by('n-cf').reason,/競合・未確認/);assert.match(by('n-missing').reason,/見つかりません/);
 assert.ok(!p.results.some(r=>r.importId==='n-not-approved'),'not approved → not touched');
 assert.deepEqual(p.baseline.notReady,['conflict-1'],'the existing conflict is recorded, not a reason to stop');
 const rows=p.append.chunks.flat();assert.equal(rows.length,1);const r=C.fromRow(rows[0]);await C.verify(r);
 assert.deepEqual(r.device,{id:'nami',name:'ナミ'});assert.equal(r.action,'create');assert.deepEqual(r.parents,[]);
 assert.equal(r.value.source.type,'nami-import');assert.equal(r.value.source.importId,'n-001');assert.equal(r.value.plannedAmount,1200);assert.equal(r.value.done,false);assert.equal(r.value.subjectMonth,null,'not inferred');assert.match(r.value.note,/架空口座/);
 assert.ok(rows[0].every(v=>typeof v==='string'),'RAW strings');
});
test('verify：追記して全部を読み直すと合格。端末と同じ検証で ready・合計に入る。もう一度 plan すると「取込済み」',async()=>{
 const inp=await input([cand('n-001'),cand('n-002')],['n-001','n-002']),p=await I.plan(inp),after=appended(inp,p);
 const v=await I.verify({...after,historyRows2:after.historyRows},p);
 assert.equal(v.ok,true);assert.equal(v.exactCheckpoint,true);assert.equal(v.added,2);assert.equal(v.existingNotReady,1);
 assert.deepEqual(v.resultTab.headers,['import_id','result','reason','at','device_id']);assert.deepEqual(v.resultTab.rows.map(r=>[r[0],r[1],r[4]]),[['n-001','added','nami'],['n-002','added','nami']]);
 const state=await C.audit(after.historyRows.slice(1).map(C.fromRow));assert.equal(C.current(state,'nami:n-001').status,'ready');assert.equal(C.summary(state).payment.amount,2400);
 const again=await I.plan({...after,runId:'run-2'});assert.deepEqual(again.results.map(r=>r.result),['already','already']);assert.equal(again.append.chunks.flat().length,0);
});
test('途中で止まった追記は「見つかりません」。足りない行だけ同じ行で足すと合格（二重にならない）',async()=>{
 const rows=Array.from({length:25},(_,i)=>cand('n-'+String(i).padStart(3,'0')));
 const inp=await input(rows,rows.map(r=>r[0])),p=await I.plan(inp);
 assert.deepEqual(p.append.chunks.map(c=>c.length),[20,5],'20 rows per append');
 const half=appended(inp,p,[p.append.chunks[0]]),v1=await I.verify(half,p);assert.equal(v1.ok,false);assert.match(v1.problems.join(),/見つかりません/);
 assert.deepEqual([...new Set(v1.resultTab.rows.map(r=>r[1]))],['unverified']);
 const twice=appended(half,p,[p.append.chunks[0],p.append.chunks[1]]),v2=await I.verify(twice,p);assert.equal(v2.ok,true,v2.problems.join());
 const state=await C.audit(twice.historyRows.slice(1).map(C.fromRow));assert.equal(state.rows.filter(r=>r.recordId.startsWith('nami:')).length,25,'retry of the same rows does not duplicate');
});
test('同じ取込IDで中身が違う行・読み直しの途中の変化・隔離の増加は、合格にしない',async()=>{
 const inp=await input([cand('n-001')],['n-001']),p=await I.plan(inp),row=C.copy(p.append.chunks[0][0]);
 const body=JSON.parse(row[6]);body.value.plannedAmount=9;row[6]=C.canonical(body);
 const bad=await I.verify({...inp,historyRows:[...inp.historyRows,row]},p);assert.equal(bad.ok,false);
 const changed=await I.plan({...inp,candidateRows:[I.CAND_HEADERS,cand('n-001','2026-12-10','payment','SYNTHETIC PAYMENT n-001','999')],historyRows:[...inp.historyRows,...p.append.chunks.flat()]});
 assert.equal(changed.results[0].result,'held');assert.match(changed.results[0].reason,/違う内容/);
 const after=appended(inp,p);await assert.rejects(I.verify({...after,historyRows2:inp.historyRows},p),/読み直しの途中で台帳が変わりました/);
 await assert.rejects(I.plan({...inp,previousQuarantineCount:-1}),/隔離/);
});
test('移行前・本人や台帳IDが違う・確認がないときは、何も作らずに止める',async()=>{
 await assert.rejects(I.plan(await input([cand('n-001')],['n-001'],{migrated:false})),/移行が有効でない/);
 const inp=await input([cand('n-001')],['n-001']);
 await assert.rejects(I.plan({...inp,expectedOwner:'other@example.invalid'}),/本人・台帳ID/);
 await assert.rejects(I.plan({...inp,approvedImportIds:[]}),/確認した importId/);
 await assert.rejects(I.plan({...inp,approval:{at:'x',note:''}}),/トシさんの確認/);
 assert.equal((await I.plan(await input([cand('bad|id')],['bad|id']))).results[0].result,'held','"|" is not allowed in IDs');
});
test('端末：出どころ nami-import を受け付ける（取込ID・確認日時が必要）。知らない出どころは今までどおり受け付けない',async()=>{
 const v={...base(),businessKey:'nami:x1',source:{type:'nami-import',importId:'x1',approvedAt:approval.at,approvedNote:'架空'}};
 assert.doesNotThrow(()=>C.valueCheck(C.copy(v)));
 assert.throws(()=>C.valueCheck({...v,source:{type:'nami-import',importId:'x|1',approvedAt:approval.at}}),/ナミ取込/);
 assert.throws(()=>C.valueCheck({...v,source:{type:'nami-import',importId:'x1'}}),/ナミ取込/);
 assert.throws(()=>C.valueCheck({...v,source:{type:'nami-import',importId:'x1',approvedAt:approval.at,extra:1}}),/ナミ取込/);
 assert.throws(()=>C.valueCheck({...v,source:{type:'nami-other'}}),/区分/);
});
test('件名が違っても、同じ区分・同額・予定日が前後10日以内（または同じ対象月）の既存の予定があれば保留（二重計上を防ぐ）',async()=>{
 /* 既存：移行した SYNTHETIC RENT（income・100・2026-11-30） */
 const inp=await input([cand('n-near','2026-12-08','income','銀行明細の別表記の入金','100'),cand('n-far','2026-12-11','income','銀行明細の別表記の入金2','100'),cand('n-other-amount','2026-12-01','income','別の金額','101'),cand('n-other-kind','2026-12-01','payment','別の区分','100')],['n-near','n-far','n-other-amount','n-other-kind']);
 const p=await I.plan(inp),by=id=>p.results.find(r=>r.importId===id);
 assert.equal(by('n-near').result,'held');assert.match(by('n-near').reason,/既存の予定と重なる恐れ（実績の追加は第2段階）。記録ID stable-money/);assert.equal(by('n-near').existingRecordId,'stable-money');
 assert.equal(by('n-far').result,'add','11 days apart');assert.equal(by('n-other-amount').result,'add');assert.equal(by('n-other-kind').result,'add');
 /* 予定日のない既存の記録は、同じ対象月で判定する */
 const v={...base(),title:'予定日なし',plannedDate:null,subjectMonth:'2027-01',plannedAmount:77,businessKey:'synthetic:undated'},r=await C.seal({format:C.FORMAT,version:1,recordId:'undated-1',revisionId:'u-1',parents:[],action:'create',device:flip,at,reason:'',value:v});
 const inp2=await input([cand('n-month','2027-01-25','income','別表記','77')],['n-month']);inp2.historyRows=[...inp2.historyRows,C.toRow(r)];
 const p2=await I.plan(inp2);assert.equal(p2.results[0].result,'held');assert.match(p2.results[0].reason,/記録ID undated-1/);
});
