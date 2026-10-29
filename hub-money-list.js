/* Presentation only: never patches a record, stores a filter, or infers a month. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubMoneyList=api;})(globalThis,function(){
 'use strict';
 const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
 function model(rows,month,status='pending'){
  if(!['pending','settled','all'].includes(status))status='pending';
  const result={dated:[],undated:[],unassignedDated:[],unassignedUndated:[],unassignedTotal:rows.filter(r=>!validMonth(r.value?.subjectMonth)).length};
  for(const row of rows){const value=row.value||{};if(status==='pending'&&value.done===true||status==='settled'&&value.done!==true)continue;
   const knownMonth=validMonth(value.subjectMonth);if(knownMonth&&month&&value.subjectMonth!==month)continue;
   const key=knownMonth?(validDate(value.plannedDate)?'dated':'undated'):(validDate(value.plannedDate)?'unassignedDated':'unassignedUndated');result[key].push(row);
  }
  for(const key of ['dated','unassignedDated'])result[key].sort((a,b)=>a.value.plannedDate.localeCompare(b.value.plannedDate));
  return result;
 }
 return {model};
});
