(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubRecovery=api;})(globalThis,function(){
 'use strict';
 const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const text=x=>typeof x==='string'&&!!x&&x.length<=1000;
 const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 function fields(x,allowed){if(!record(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('補正ファイルの形式を確認してください');}
 function plan(value,items,money,origin){
  fields(value,['format','version','sourceOrigin','basis','operations']);
  if(value.format!=='toshi-hub-status-correction'||value.version!==1||value.sourceOrigin!==origin||value.basis!=='user-confirmed'||!Array.isArray(value.operations)||!value.operations.length||value.operations.length>100)throw Error('このHUB用の本人確認済み補正ファイルを選んでください');
  const changes=[],skipped=[],seen=new Set();
  for(const op of value.operations){
   fields(op,['kind','target','expected','completedDate']);
   if(!['work','money'].includes(op.kind)||!record(op.expected)||!(op.completedDate===''||day(op.completedDate)))throw Error('項目の種類・実施日を確認してください');
   let matches;
   if(op.kind==='work'){
    fields(op.target,['googleCalendarId','googleId']);fields(op.expected,['title','date']);
    if(!text(op.target.googleCalendarId)||!text(op.target.googleId)||!text(op.expected.title)||!day(op.expected.date))throw Error('作業のID・件名・予定日を確認してください');
    matches=items.filter(x=>x.source==='google'&&x.googleCalendarId===op.target.googleCalendarId&&x.googleId===op.target.googleId);
   }else{
    fields(op.target,['importId']);fields(op.expected,['title','date','kind','amount']);
    if(!text(op.target.importId)||!text(op.expected.title)||!day(op.expected.date)||!['income','payment'].includes(op.expected.kind)||!Number.isSafeInteger(op.expected.amount)||op.expected.amount<0||!day(op.completedDate))throw Error('入出金の取込ID・件名・金額・消込日を確認してください');
    matches=money.filter(x=>x.importId===op.target.importId);
   }
   if(matches.length!==1)throw Error('対応する記録がないか複数あります。全項目の補正を停止しました');
   const row=matches[0];
   if(!text(row._key)||row.cancelled||op.kind==='work'&&!['todo','task'].includes(row.type))throw Error('対応する記録が作業ではないか、非表示です。全項目の補正を停止しました');
   if(Object.entries(op.expected).some(([k,v])=>row[k]!==v))throw Error('記録の件名・日付・金額が変わっています。全項目の補正を停止しました');
   const identity=JSON.stringify([op.kind,row._key]);if(seen.has(identity))throw Error('同じ記録が重複指定されています');seen.add(identity);
   const dateField=op.kind==='work'?'completedDate':'settledDate';
   if(row[dateField]&&row[dateField]!==op.completedDate)throw Error('既存の実施日・消込日と食い違います。上書きせず停止しました');
   if(op.kind==='work'&&row.completedAt&&!row.completedDate)throw Error('完了日時が残っています。実施日を確認してから補正してください');
   if(row.done===true&&(row[dateField]||'')===op.completedDate){skipped.push({kind:op.kind,before:row});continue;}
   changes.push({kind:op.kind,before:structuredClone(row),completedDate:op.completedDate});
  }
  return {changes,skipped};
 }
 function apply(next,plan,at){
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw Error('補正の更新日時を確認してください');
  for(const c of plan.changes){
   const old=c.before,key=old._key;
   next.history.push({kind:c.kind==='work'?'previous-item':'previous-money',at,value:structuredClone(old)});
   if(c.kind==='work')next.edits[key]={...next.edits[key],done:true,completedDate:c.completedDate,completedAt:old.completedAt||'',completionDecision:'restored',completionCorrection:{basis:'user-confirmed',recordedAt:at}};
   else next.moneyEdits[key]={...next.moneyEdits[key],done:true,settledDate:c.completedDate,settlementCorrection:{basis:'user-confirmed',recordedAt:at}};
  }
 }
 return {plan,apply};
});
