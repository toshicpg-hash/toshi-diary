(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubProofCore=api;})(globalThis,function(){
 'use strict';
 const phase=x=>['success','failed','not_attempted'].includes(x)?x:'not_attempted';
 const text=(x,max=1024)=>typeof x==='string'&&x.length>0&&x.length<=max?x:null;
 const stamp=x=>text(x,40)&&Number.isFinite(Date.parse(x))?x:null;
 const version=x=>({etag:text(x?.etag),updated:stamp(x?.updated),sequence:Number.isSafeInteger(x?.sequence)&&x.sequence>=0?x.sequence:null});
 const canonical=x=>JSON.stringify(x===null||typeof x!=='object'?x:Array.isArray(x)?x.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])));
 function evidence(value,key){
  const v=value||{},fetch=phase(v.fetch),save=phase(v.save),readback=phase(v.readback);
  if(save==='success'&&fetch!=='success'||readback==='success'&&save!=='success')throw Error('Invalid verification phases');
  const result={fetch,save,readback,verifiedAt:stamp(v.verifiedAt)};
  if(readback==='success'&&!result.verifiedAt)throw Error('Missing readback time');
  if(key==='calendar'){
   result.events=(Array.isArray(v.events)?v.events:[]).map(x=>{
    const calendarId=text(x?.calendarId),eventId=text(x?.eventId);if(!calendarId||!eventId)throw Error('Missing event identity');
    return {calendarId,eventId,...version(x),localOverride:x.localOverride===true};
   });
   const keys=result.events.map(x=>JSON.stringify([x.calendarId,x.eventId]));if(new Set(keys).size!==keys.length)throw Error('Ambiguous event identity');
  }else{
   result.sheetId=text(v.sheetId);result.revisionIds=(Array.isArray(v.revisionIds)?v.revisionIds:[]).map(x=>{if(!text(x))throw Error('Missing revision identity');return x;});
   if(new Set(result.revisionIds).size!==result.revisionIds.length)throw Error('Ambiguous revision identity');
  }
  return result;
 }
 function make({attemptId,device,sequence,appVersion,startedAt,finishedAt,states}){
  if(!text(attemptId,100)||!text(device?.id,100)||!['Flip8','Fold8'].includes(device?.name)||!Number.isSafeInteger(sequence)||sequence<1||!text(appVersion,30)||!stamp(startedAt)||!stamp(finishedAt)||Date.parse(finishedAt)<Date.parse(startedAt))throw Error('Invalid attempt identity or time');
  const jobs=['calendar','diary'].map(key=>{
   const s=states?.find(x=>x.key===key),status=['success','failed','skipped'].includes(s?.status)?s.status:'failed';
   return {key,status,...evidence(s?.evidence??s,key)};
  });
  if(jobs.some(x=>x.verifiedAt&&(Date.parse(x.verifiedAt)<Date.parse(startedAt)||Date.parse(x.verifiedAt)>Date.parse(finishedAt))))throw Error('Readback time is outside the attempt');
  return {format:'papa-hub-sync-proof',version:1,attemptId,device:{id:device.id,name:device.name},sequence,appVersion,startedAt,finishedAt,jobs,
   localSaveVerified:jobs.every(x=>x.status==='success'&&x.fetch==='success'&&x.save==='success'&&x.readback==='success'),
   googleVersionComparison:'unconfirmed',screenConfirmation:'not_checked'};
 }
 function validate(value){
  const made=make({...value,states:value?.jobs});
  if(canonical(made)!==canonical(value))throw Error('Unexpected or inconsistent proof fields');return made;
 }
 // Missing independent versions never match, including null compared to null.
 function compare(record,{deviceId,notBefore,now,maxAgeMs=30*60*1000,events,revisions,sheetId}={}){
  const unknown=reason=>({status:'HUB未確認',reason,screen:'未確認'});let r;try{r=validate(record);}catch{return unknown('invalid_record');}
  if(!text(deviceId)||r.device.id!==deviceId)return unknown('different_device');
  if(!stamp(notBefore)||!stamp(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||Date.parse(r.startedAt)<Date.parse(notBefore)||Date.parse(r.finishedAt)>Date.parse(now)||Date.parse(now)-Date.parse(r.finishedAt)>maxAgeMs)return unknown('old_or_unverifiable_time');
  if(!r.localSaveVerified)return unknown('partial_or_failed');
  const calendar=r.jobs.find(x=>x.key==='calendar'),diary=r.jobs.find(x=>x.key==='diary');
  if(!Array.isArray(events)||!Array.isArray(revisions)||!text(sheetId)||sheetId!==diary.sheetId)return unknown('independent_source_missing');
  const index=new Map(calendar.events.map(x=>[JSON.stringify([x.calendarId,x.eventId]),x]));
  const seen=new Set();for(const event of events){const key=JSON.stringify([event?.calendarId,event?.eventId]),saved=index.get(key);
   if(seen.has(key)||!text(event?.calendarId)||!text(event?.eventId)||!text(event?.etag)||!text(saved?.etag)||saved.etag!==event.etag||saved.localOverride)return unknown('version_missing_changed_or_overridden');seen.add(key);
  }
  const local=new Set(diary.revisionIds);if(revisions.some(id=>!text(id)||!local.has(id)))return unknown('revision_missing');
  if(events.length===0&&revisions.length===0)return unknown('no_verification_target');
  return {status:'指定記録の端末保存を確認',reason:'independent_versions_match',at:r.finishedAt,screen:'未確認'};
 }
 return {make,validate,compare,evidence,canonical};
});
