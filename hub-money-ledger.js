/* Personal money revision protocol. Pure data operations; never writes a bank, rent master or legacy store. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyLedger=api;})(globalThis,function(){
 'use strict';
 const FORMAT='papa-money-ledger',VERSION=1;
 const HEADERS=['履歴ID','記録ID','元の履歴ID','操作','操作日時','端末JSON','入出金JSON','SHA256'];
 const SAMPLE_HEADERS=['比較ID','分割番号','分割数','端末ID','端末名','取得日時','比較データ','SHA256'];
 const VIEW_HEADERS=['照合ID','記録ID','状態','対象月','入出金','件名','予定日','予定額','実入出金日','実績額','消込状態','確認根拠','正本','最新履歴ID','入出金JSON'];
 const SYNC_HEADERS=['送信ID','端末ID','端末名','確認日時','照合ID','履歴件数','記録件数','競合件数','端末比較ID','注記'];
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const fail=message=>{throw Error(message);};
 const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(x);
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const month=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 const integer=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
 const nullable=(x,validate)=>x===null||validate(x);
 const text=(x,max=500)=>typeof x==='string'&&x.length<=max;
 function canonical(value){
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(!plain(value))return fail('JSONの記録形式を確認できません');
  const keys=Object.keys(value).sort();if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return fail('保存できないキーがあります');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 }
 async function hash(value){return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:canonical(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
 function valueCheck(v){
  if(!plain(v)||!['income','payment','unconfirmed'].includes(v.kind)||!text(v.title,300)||!v.title.trim()||!nullable(v.subjectMonth,month)||!nullable(v.plannedDate,date)||!nullable(v.plannedAmount,integer)||typeof v.done!=='boolean'||!Array.isArray(v.actuals)||v.actuals.length>1000||!['hub','rent-master','legacy-unclassified'].includes(v.source?.type))return fail('入出金の区分・対象月・予定日・金額・消込状態を確認してください');
  const ids=new Set();for(const x of v.actuals){if(!plain(x)||!safeId(x.id)||ids.has(x.id)||!nullable(x.date,date)||!nullable(x.amount,integer)||!['unconfirmed','reported','bank-verified','ledger-verified'].includes(x.evidence?.status)||!text(x.evidence?.note||'',2000)||!text(x.evidence?.ref||'',2000))return fail('実績・確認根拠の形式または実績IDが不正です');ids.add(x.id);}
  if(v.businessKey!==null&&!text(v.businessKey,500))return fail('対応キーを確認してください');
  if(!text(v.note||'',4000)||canonical(v).length>40000)return fail('入出金の1件が大きすぎます。元の記録を保持して停止しました');return v;
 }
 function revisionCheck(r){
  if(!plain(r)||r.format!==FORMAT||r.version!==VERSION||!safeId(r.recordId)||!safeId(r.revisionId)||!Array.isArray(r.parents)||r.parents.length>50||r.parents.some(p=>!safeId(p)||p===r.revisionId)||new Set(r.parents).size!==r.parents.length||!['create','edit','settle','reopen','resolve','migrate','rent-refresh'].includes(r.action)||!text(r.at,50)||!Number.isFinite(Date.parse(r.at))||!safeId(r.device?.id)||!text(r.device?.name,80)||!text(r.reason||'',2000))return fail('入出金の履歴ID・元履歴・端末・日時を確認できません');
  valueCheck(r.value);if(!r.parents.length&&!['create','migrate','rent-refresh'].includes(r.action)||r.parents.length&&['create','migrate'].includes(r.action))return fail('履歴の親子関係を確認できません');return r;
 }
 function unsigned(r){const v={...r};delete v.fingerprint;return v;}
 async function seal(r){r={reason:'',...r};revisionCheck(r);return {...copy(unsigned(r)),fingerprint:await hash(unsigned(r))};}
 async function verify(r){revisionCheck(r);if(typeof r.fingerprint!=='string'||await hash(unsigned(r))!==r.fingerprint)return fail('同じ履歴IDの内容またはSHA256が一致しません');return r;}
 function analyze(revisions){
  const byId=new Map(),issues=[],blocked=new Set();
  for(const r of revisions){try{revisionCheck(r);}catch(e){issues.push({recordId:r?.recordId||null,revisionId:r?.revisionId||null,message:e.message});if(r?.recordId)blocked.add(r.recordId);continue;}
   const old=byId.get(r.revisionId);if(old&&canonical(old)!==canonical(r)){blocked.add(old.recordId);blocked.add(r.recordId);issues.push({recordId:r.recordId,revisionId:r.revisionId,message:'同じ履歴IDに違う内容があります。両方を保全し、この記録を未確認にしています'});}else byId.set(r.revisionId,r);
  }
  const ids=new Map();for(const r of byId.values()){if(!ids.has(r.recordId))ids.set(r.recordId,[]);ids.get(r.recordId).push(r);}
  for(const r of byId.values())for(const p of r.parents){const parent=byId.get(p);if(!parent||parent.recordId!==r.recordId){blocked.add(r.recordId);issues.push({recordId:r.recordId,revisionId:r.revisionId,message:'元の履歴が欠けているか、別の記録です'});}}
  // No timestamp wins: cycles, multiple roots and concurrent heads remain explicit conflicts.
  const visiting=new Set(),visited=new Set();function visit(id){if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);const r=byId.get(id);let ok=true;for(const p of r?.parents||[])if(byId.has(p)&&!visit(p))ok=false;visiting.delete(id);visited.add(id);return ok;}
  for(const r of byId.values())if(!visit(r.revisionId)){blocked.add(r.recordId);issues.push({recordId:r.recordId,message:'履歴の循環を検出しました'});}
  const rows=[];for(const [id,history]of ids){const parents=new Set(history.flatMap(r=>r.parents)),heads=history.filter(r=>!parents.has(r.revisionId)).sort((a,b)=>a.revisionId.localeCompare(b.revisionId));let invalid=blocked.has(id);
   for(const r of history){const ps=r.parents.map(p=>byId.get(p)).filter(Boolean);if(ps.some(p=>p.value._migration&&canonical(r.value._migration??null)!==canonical(p.value._migration))){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'移行元の対応履歴が変更されています'});}if(ps.some(p=>p.value.done)&&!r.value.done&&(r.action!=='reopen'&&r.action!=='resolve'||!r.reason?.trim())){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'消込済みを古い未消込で戻す変更を止めました'});}if(r.value.source.type==='rent-master'&&!['rent-refresh','resolve'].includes(r.action)){invalid=true;issues.push({recordId:id,revisionId:r.revisionId,message:'家賃正本の参照記録をHUBの編集として更新できません'});}}
   rows.push({recordId:id,status:invalid?'unverified':heads.length!==1?'conflict':'ready',heads:heads.map(r=>r.revisionId),value:heads.length===1?copy(heads[0].value):null,alternatives:heads.map(copy),history:history.map(copy)});
  }
  const business=new Map();for(const row of rows){const key=row.value?.businessKey;if(key){if(!business.has(key))business.set(key,[]);business.get(key).push(row);}}
  for(const same of business.values())if(same.length>1)for(const row of same){row.status='conflict';issues.push({recordId:row.recordId,message:'同じ対象月・対応キーの記録が複数あります。自動合算していません'});}
  rows.sort((a,b)=>a.recordId.localeCompare(b.recordId));return {rows,issues,revisionCount:byId.size,conflictCount:rows.filter(r=>r.status!=='ready').length};
 }
 async function audit(input){const valid=[],quarantine=[];for(const row of new Map(input.map(x=>[canonical(x),x])).values()){try{await verify(row);valid.push(copy(row));}catch(error){quarantine.push({recordId:row?.recordId||null,revisionId:row?.revisionId||null,message:error.message,raw:copy(row)});}}
  const state=analyze(valid),bad=new Set(quarantine.map(x=>x.recordId).filter(Boolean));for(const row of state.rows)if(bad.has(row.recordId))row.status='unverified';for(const id of bad)if(!state.rows.some(r=>r.recordId===id))state.rows.push({recordId:id,status:'unverified',heads:[],value:null,alternatives:[],history:[]});state.rows.sort((a,b)=>a.recordId.localeCompare(b.recordId));
  const unique=[...new Map(valid.map(r=>[r.revisionId+':'+r.fingerprint,r])).values()].sort((a,b)=>a.revisionId.localeCompare(b.revisionId)||a.fingerprint.localeCompare(b.fingerprint));
  return {...state,conflictCount:state.rows.filter(r=>r.status!=='ready').length,revisions:unique,quarantine,checkpoint:await hash({format:FORMAT,version:VERSION,revisions:unique,quarantine:quarantine.map(q=>({revisionId:q.revisionId,recordId:q.recordId,raw:q.raw})).sort((a,b)=>canonical(a).localeCompare(canonical(b)))})};
 }
 function current(state,id){return state.rows.find(r=>r.recordId===id);}
 async function change(state,{recordId,revisionId,parents,value,action,device,at,reason=''}){
  const before=current(state,recordId),expected=before?.heads||[];if(canonical([...parents].sort())!==canonical([...expected].sort()))return fail('別の編集があります。入力を保持して最新状態を確認してください');
  if(before&&!['ready','conflict'].includes(before.status))return fail('未確認の履歴があります。元の記録を保持して編集を停止しました');
  if(before?.status==='conflict'&&action!=='resolve')return fail('同時編集を確認してから統合してください');
  if(before?.value?.source?.type==='rent-master'&&!['rent-refresh','resolve'].includes(action))return fail('家賃は正本の月別表で修正し、読み直してください');
  if(before?.value?._migration&&canonical(value._migration??null)!==canonical(before.value._migration))return fail('移行元の対応履歴は変更できません');
  const r=await seal({format:FORMAT,version:VERSION,recordId,revisionId,parents:[...parents].sort(),action,device:copy(device),at,reason,value:copy(value)});const after=analyze([...state.revisions,r]),row=current(after,recordId);if(row?.status==='unverified')return fail(after.issues.find(x=>x.recordId===recordId)?.message||'履歴の更新を確認できません');return r;
 }
 function toRow(r){revisionCheck(r);return [r.revisionId,r.recordId,canonical(r.parents),r.action,r.at,canonical(r.device),canonical({format:r.format,version:r.version,value:r.value,reason:r.reason||''}),r.fingerprint];}
 function fromRow(row){if(!Array.isArray(row)||row.length!==8)return fail('履歴の列数が違います');const body=JSON.parse(row[6]);return {format:body.format,version:body.version,revisionId:String(row[0]),recordId:String(row[1]),parents:JSON.parse(row[2]),action:String(row[3]),at:String(row[4]),device:JSON.parse(row[5]),value:body.value,reason:body.reason||'',fingerprint:String(row[7])};}
 function legacyValue(row){return {kind:['income','payment'].includes(row.kind)?row.kind:'unconfirmed',title:typeof row.title==='string'&&row.title.trim()?row.title:'旧記録（要確認）',subjectMonth:month(row.subjectMonth)?row.subjectMonth:null,plannedDate:date(row.date)?row.date:null,plannedAmount:integer(row.amount)?row.amount:null,actuals:[],done:!!row.done,source:{type:'legacy-unclassified'},businessKey:null,note:'旧記録の対象月・実績・正本との対応は未確認です',legacy:copy(row)};}
 function summary(state,subjectMonth=null){const rows=state.rows.filter(r=>r.status==='ready'&&(!subjectMonth||r.value.subjectMonth===subjectMonth)),sum=kind=>{const pending=rows.filter(r=>r.value.kind===kind&&!r.value.done),unknown=pending.filter(r=>r.value.plannedAmount===null).length;return {count:pending.length,amount:pending.reduce((n,r)=>n+(r.value.plannedAmount||0),0),unknown}};return {recordCount:state.rows.length,readyCount:rows.length,conflictCount:state.conflictCount,income:sum('income'),payment:sum('payment'),unassignedMonth:state.rows.filter(r=>r.value&&!r.value.subjectMonth).length};}
 function viewRows(state){return state.rows.map(r=>{const v=r.value,actuals=v?.actuals||[],dates=[...new Set(actuals.map(x=>x.date).filter(Boolean))].sort(),known=actuals.every(x=>x.amount!==null),amount=actuals.length&&known?actuals.reduce((n,x)=>n+x.amount,0):'';return [state.checkpoint,r.recordId,r.status==='ready'?'照合可':r.status==='conflict'?'同時編集・対応重複':'履歴未確認',v?.subjectMonth||'未確認',v?.kind==='income'?'入金':v?.kind==='payment'?'支払':'未確認',v?.title||'',v?.plannedDate||'',v?.plannedAmount??'',dates.join(' / '),amount,v?(v.done?'消込済み':'未消込'):'未確認',actuals.map(x=>x.evidence.status+':'+(x.evidence.note||'')).join(' / '),v?.source?.type||'',canonical(r.heads),canonical(v||{alternatives:r.alternatives})];});}
 async function packSample({id,device,at,payload}){if(!safeId(id)||!safeId(device.id)||!text(device.name,80)||!Number.isFinite(Date.parse(at)))return fail('端末比較のID・端末・日時を確認してください');const json=canonical(payload);if(json.length>8*1024*1024)return fail('お金の比較データが大きすぎます。元の記録を保持しました');const fingerprint=await hash(json),chunks=[];for(let i=0;i<json.length;i+=18000)chunks.push(json.slice(i,i+18000));return {id,device:copy(device),at,fingerprint,rows:chunks.map((chunk,i)=>[id,i,chunks.length,device.id,device.name,at,chunk,fingerprint])};}
 async function unpackSamples(rows){const groups=new Map(),result=[],issues=[];for(const row of rows){if(!Array.isArray(row)||row.length!==8){issues.push('端末比較の列が不正です');continue;}const id=String(row[0]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
  for(const [id,group]of groups){try{const first=group[0],n=Number(first[2]),parts=new Map();if(!safeId(id)||!Number.isSafeInteger(n)||n<1||n>1000)return fail('端末比較の分割数が不正です');for(const r of group){const index=Number(r[1]);if(!Number.isSafeInteger(index)||index<0||index>=n||[2,3,4,5,7].some(k=>String(r[k])!==String(first[k]))||parts.has(index)&&parts.get(index)!==r[6])return fail('同じ端末比較IDの内容が違います');parts.set(index,String(r[6]));}if(parts.size!==n)return fail('端末比較の送信が途中です。再試行が必要です');const json=Array.from({length:n},(_,i)=>parts.get(i)).join('');if(await hash(json)!==first[7])return fail('端末比較の読戻しが一致しません');result.push({id,device:{id:String(first[3]),name:String(first[4])},at:String(first[5]),fingerprint:String(first[7]),payload:JSON.parse(json)});}catch(error){issues.push(id+': '+error.message);}}
  return {samples:result,issues};
 }
  function sampleHeads(samples){const byId=new Map(samples.map(s=>[s.id,s])),groups=new Map(),issues=[];for(const s of samples){if(!groups.has(s.device.id))groups.set(s.device.id,[]);groups.get(s.device.id).push(s);}const heads=[];for(const [deviceId,rows]of groups){const parents=new Set();for(const s of rows)for(const id of s.payload.previousSampleIds||[]){const parent=byId.get(id);if(!parent||parent.device.id!==deviceId)issues.push('端末比較の元データが不足または別端末です：'+s.id);parents.add(id);}heads.push(...rows.filter(s=>!parents.has(s.id)));}return {heads,issues};}
 function planBody(plan){return {format:'papa-money-migration-plan',version:1,id:plan.id,samplePins:copy(plan.samplePins||[]),groups:Array.isArray(plan.groups)?plan.groups.map(g=>({recordId:g.recordId,sources:copy(g.sources||[]),value:copy(g.value),reason:g.reason||'',reopenApproved:g.reopenApproved===true})):[]};}
 async function prepareMigration(input,samples,state,device,at,{requireLatest=true}={}){
  const plan=planBody(input);if(input.format!==plan.format||input.version!==1||!safeId(plan.id)||!Array.isArray(plan.samplePins)||plan.samplePins.length!==2||!Array.isArray(plan.groups)||plan.groups.length>10000)return fail('Flip・Foldの2件の比較IDを指定した移行プランを確認してください');
  const selected=plan.samplePins.map(pin=>samples.find(s=>s.id===pin.id&&s.fingerprint===pin.fingerprint));if(selected.some(s=>!s)||new Set(selected.map(s=>s.device.id)).size!==2||new Set(selected.map(s=>s.device.name)).size!==2)return fail('異なる2端末の比較元が見つからないか、端末名を区別できません');
  for(const s of selected)if(await hash(s.payload)!==s.fingerprint||s.payload.format!=='papa-money-comparison'||!Array.isArray(s.payload.money))return fail('比較元のお金データの照合が一致しません');
  if(requireLatest){const latest=sampleHeads(samples);if(latest.issues.length||selected.some(s=>latest.heads.filter(x=>x.device.id===s.device.id).length!==1||!latest.heads.some(x=>x.id===s.id)))return fail('比較後に端末データが更新されたか、比較元が競合しています。移行プランを作り直してください');}
  const members=new Map();for(const s of selected)for(const r of s.payload.money){const k=s.id+'\u0000'+r._key;if(typeof r._key!=='string'||members.has(k))return fail('端末内の記録の対応が重複しています');members.set(k,{sample:s,row:r});}
  const covered=new Set(),recordIds=new Set(),planHash=await hash(plan),existing=state.revisions.filter(r=>r.value?._migration?.planId===plan.id&&!r.parents.length&&['migrate','rent-refresh'].includes(r.action)),actor=existing[0]?.device||device,recordedAt=existing[0]?.at||at,revisionList=[];
  for(let index=0;index<plan.groups.length;index++){const g=plan.groups[index];if(!safeId(g.recordId)||recordIds.has(g.recordId)||!Array.isArray(g.sources)||!g.sources.length||!text(g.reason||'',2000)||g.value?._migration)return fail('移行先ID・対応元・理由を確認してください');recordIds.add(g.recordId);valueCheck(g.value);const originals=[];for(const ref of g.sources){const k=ref.sampleId+'\u0000'+ref.key;if(!members.has(k)||covered.has(k))return fail('移行元が見つからないか複数回使われています');covered.add(k);originals.push(members.get(k).row);}if(originals.some(r=>!!r.done)&&!g.value.done&&(g.reopenApproved!==true||!g.reason?.trim()))return fail('消込済みを未消込へ戻す移行には、本人の取消確認と理由が必要です');
   const value={...copy(g.value),_migration:{planId:plan.id,planHash,index,groupCount:plan.groups.length,samplePins:copy(plan.samplePins),sources:copy(g.sources),reopenApproved:g.reopenApproved===true}};
   const revisionId='migration:'+plan.id+':'+g.recordId,r=await seal({format:FORMAT,version:VERSION,recordId:g.recordId,revisionId,parents:[],action:value.source.type==='rent-master'?'rent-refresh':'migrate',at:recordedAt,device:copy(actor),reason:g.reason||'',value});
   const old=state.revisions.find(x=>x.revisionId===revisionId);if(old&&canonical(old)!==canonical(r))return fail('同じ移行プランIDの内容が変わっています。元の履歴は変更していません');if(!old&&state.rows.some(x=>x.recordId===g.recordId))return fail('移行先の記録IDは既に別の記録に使われています');revisionList.push(old||r);
  }
  if(covered.size!==members.size)return fail('移行元のお金データに対応先のない記録があります。削除せず確認してください');
  const projected=await audit([...state.revisions,...revisionList]);if(revisionList.filter(r=>!state.revisions.some(old=>old.revisionId===r.revisionId)).some(r=>current(projected,r.recordId)?.status!=='ready'))return fail('移行先の対応キーや履歴に競合があります。内容を確認してください');
  return {plan,planHash,revisions:revisionList,sourceCount:members.size,recordCount:revisionList.length,alreadyApplied:revisionList.every(r=>state.revisions.some(x=>x.revisionId===r.revisionId))};
 }
 async function migrations(state,samples){
  const groups=new Map();for(const r of state.revisions)if(r.value?._migration&&!r.parents.length&&['migrate','rent-refresh'].includes(r.action)){const id=r.value._migration.planId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}const plans=[],aliases=[];
  for(const [id,roots]of groups){const m=roots[0].value._migration;try{if(roots.length!==m.groupCount||new Set(roots.map(r=>r.value._migration.index)).size!==roots.length||roots.some(r=>r.value._migration.planHash!==m.planHash))return fail('移行の履歴がまだ全件届いていません');const ordered=roots.slice().sort((a,b)=>a.value._migration.index-b.value._migration.index),plan={format:'papa-money-migration-plan',version:1,id,samplePins:m.samplePins,groups:ordered.map(r=>{const value=copy(r.value),metadata=value._migration;delete value._migration;return {recordId:r.recordId,sources:metadata.sources,value,reason:r.reason||'',reopenApproved:metadata.reopenApproved===true};})};if(await hash(planBody(plan))!==m.planHash)return fail('移行プランの照合が一致しません');await prepareMigration(plan,samples,state,roots[0].device,roots[0].at,{requireLatest:false});for(const r of roots)for(const ref of r.value._migration.sources){const sample=samples.find(s=>s.id===ref.sampleId);aliases.push({recordId:r.recordId,deviceId:sample.device.id,key:ref.key,sampleId:sample.id,original:copy(sample.payload.money.find(x=>x._key===ref.key))});}plans.push({id,status:'ready',recordCount:roots.length,samplePins:m.samplePins});}catch(error){plans.push({id,status:'pending',message:error.message,recordCount:roots.length});}}
  const sourceDrift=[];const heads=sampleHeads(samples);for(const plan of plans.filter(p=>p.status==='ready'))for(const pin of plan.samplePins){const before=samples.find(s=>s.id===pin.id);for(const latest of heads.heads.filter(s=>s.device.id===before?.device.id))if(latest.payload.financialFingerprint!==before.payload.financialFingerprint)sourceDrift.push({planId:plan.id,device:copy(latest.device),sampleId:latest.id,at:latest.at});}
  return {plans,aliases,sourceDrift,active:plans.length>0&&plans.every(p=>p.status==='ready')};
 }

 return {sampleHeads,planBody,prepareMigration,migrations,FORMAT,VERSION,HEADERS,SAMPLE_HEADERS,VIEW_HEADERS,SYNC_HEADERS,canonical,copy,hash,safeId,date,month,integer,valueCheck,revisionCheck,seal,verify,analyze,audit,current,change,toRow,fromRow,legacyValue,summary,viewRows,packSample,unpackSamples};
});
