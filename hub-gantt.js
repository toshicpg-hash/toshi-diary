(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hub-core.js'):root.HubCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HubGantt=api;})(typeof globalThis==='object'?globalThis:this,function(C){
'use strict';
// Read-only projection. Dates are displayed, never normalized back into saved records.
function model(items,today,project='all'){
 if(!C.day(today))throw Error('表示開始日を確認してください');
 const days=Array.from({length:14},(_,i)=>C.addDays(today,i)),last=days[13];let undated=0,invalid=0;const matches=[];
 for(const item of items){
  if(item.done||item.cancelled||item.linkedGoogleKey||!['event','todo'].includes(item.type)||(project!=='all'&&item.project!==project))continue;
  let start='',end='',description='',warning='',deadline='',scheduled='',separate=false;
  if(item.type==='event'){
   start=item.date||'';end=item.endDate||start;
   if(!start){undated++;continue;}if(!C.day(start)||!C.day(end)||end<start){invalid++;continue;}
   description=(start===end?start:start+' 〜 '+end)+(item.allDay?'｜終日':item.time?'｜'+item.time:'');
  }else{
   const rawScheduled=item.scheduledDate||item.start||'',rawDeadline=C.deadline(item);
   if((rawScheduled&&!C.day(rawScheduled))||(rawDeadline&&!C.day(rawDeadline))){invalid++;continue;}
   scheduled=rawScheduled;deadline=rawDeadline;
   if(!scheduled&&!deadline){undated++;continue;}
   start=scheduled||deadline;end=deadline||scheduled;
   description=(scheduled?'実施 '+scheduled+'｜':'')+(deadline?'期限 '+deadline:'期限 未設定');
   if(start>end){separate=true;warning='実施予定日が期限より後です';[start,end]=[end,start];}
  }
  const cells=days.map(date=>({date,active:separate?(date===scheduled||date===deadline):(date>=start&&date<=end),deadline:!!deadline&&date===deadline}));
  if(!cells.some(c=>c.active))continue;
  if(item.googleUnverified)warning+=(warning?'。':'')+'今回のGoogle取得で未確認';
  matches.push({item,start,end,description,warning,cells});
 }
 matches.sort((a,b)=>a.start.localeCompare(b.start));
 return {from:today,to:last,days,rows:matches.slice(0,20),total:matches.length,hidden:Math.max(0,matches.length-20),undated,invalid};
}
return {model};
});
