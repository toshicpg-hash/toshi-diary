/* Presentation only: never patches a record, stores a filter, or infers a date. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyList=api;})(globalThis,function(){
 'use strict';
 const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 function totals(rows){
  const result={count:rows.length,income:{amount:0,unknown:0},payment:{amount:0,unknown:0},excluded:0};
  for(const row of rows){const v=row.value;if(row.status!=='ready'||!['income','payment'].includes(v?.kind)){result.excluded++;continue;}
   if(Number.isSafeInteger(v.plannedAmount)&&v.plannedAmount>=0)result[v.kind].amount+=v.plannedAmount;else result[v.kind].unknown++;
  }
  return result;
 }
 function model(rows,month,status='pending'){
  if(!['pending','settled','all'].includes(status))status='pending';
  const result={dated:[],undated:[],undatedTotal:0};
  for(const row of rows){const value=row.value||{},dated=validDate(value.plannedDate);if(!dated)result.undatedTotal++;
   if(status==='pending'&&value.done===true||status==='settled'&&value.done!==true)continue;
   if(!dated){result.undated.push(row);continue;}
   if(month&&(!validMonth(month)||value.plannedDate.slice(0,7)!==month))continue;
   result.dated.push(row);
  }
  result.dated.sort((a,b)=>a.value.plannedDate.localeCompare(b.value.plannedDate));
  result.summary=totals(result.dated);
  return result;
 }
 return {model};
});
