/* Presentation only: never patches a record, stores a filter, or infers a date. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyList=api;})(globalThis,function(){
 'use strict';
 const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 function totals(rows){
  const result={count:rows.length,income:{amount:0,unknown:0},payment:{amount:0,unknown:0},excluded:0};
  for(const row of rows){const v=row.value;if(row.status!=='ready'||!['income','payment'].includes(v?.kind)){result.excluded++;continue;}
   if(Number.isSafeInteger(v.plannedAmount)&&v.plannedAmount>=0){const part=result[v.kind];if(part.amount!==null){const sum=part.amount+v.plannedAmount;part.amount=Number.isSafeInteger(sum)?sum:null;}}else result[v.kind].unknown++;
  }
  return result;
 }
 function model(rows,month,status='pending',kind='all'){
  if(!['pending','settled','all'].includes(status))status='pending';
  if(!['all','income','payment'].includes(kind))kind='all';
  const result={dated:[],undated:[],withdrawn:[],transfers:[],undatedTotal:0},cumulative=[];let cumulativeUndated=0;
  for(const row of rows){const value=row.value||{},dated=validDate(value.plannedDate);if(value.kind==='transfer'){if(!month||validMonth(month)&&value.plannedDate?.slice(0,7)===month)result.transfers.push(row);continue;}if(row.status==='ready'&&value.withdrawal){if(kind==='all'||value.kind===kind)result.withdrawn.push(row);continue;}if(!dated)result.undatedTotal++;
   if(kind!=='all'&&value.kind!==kind)continue;
   if(value.done!==true){if(!dated)cumulativeUndated++;else if(!month||validMonth(month)&&value.plannedDate.slice(0,7)<=month)cumulative.push(row);}
   if(status==='pending'&&value.done===true||status==='settled'&&value.done!==true)continue;
   if(!dated){result.undated.push(row);continue;}
   if(month&&(!validMonth(month)||value.plannedDate.slice(0,7)!==month))continue;
   result.dated.push(row);
  }
  result.dated.sort((a,b)=>a.value.plannedDate.localeCompare(b.value.plannedDate));
  result.transfers.sort((a,b)=>a.value.plannedDate.localeCompare(b.value.plannedDate)||a.recordId.localeCompare(b.recordId));
  result.summary=totals(result.dated);
  result.cumulative={...totals(cumulative),undated:cumulativeUndated};
  return result;
 }
 return {model};
});
