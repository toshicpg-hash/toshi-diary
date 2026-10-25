const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../hub-core.js'),D=require('../hub-deadline.js');
const calendar={id:'synthetic-calendar',summary:'TASK'};
const event=(id='synthetic-october',date='2026-10-26',original='2026-10-25')=>({id,etag:'"fixture-version"',summary:'【ToDo】合成の月次作業',status:'confirmed',start:{date},end:{date:C.addDays(date,1)},originalStartTime:{date:original},recurringEventId:'synthetic-series',description:'preserve description',extendedProperties:{private:{toshiHubType:'todo',toshiHubDone:'false',toshiHubDeadlineDate:original,toshiHubEnd:original,toshiHubStart:original,toshiHubDeadlineTime:'15:30',unknown:'preserve'},shared:{other:'keep'}}});
const proof=e=>({event:e,eventId:e.id,calendarId:calendar.id,calendar,row:C.fromGoogle(e,calendar)});
const empty=()=>C.parseOverlay(null),legacy={items:[],money:[]};
test('deadline payload changes only both deadline metadata fields',()=>{
 const e=event(),before=structuredClone(e),patch=C.deadlinePatch(e,calendar,'2026-10-26');
 assert.deepEqual(Object.keys(patch),['extendedProperties']);
 assert.deepEqual(patch.extendedProperties.private,{...e.extendedProperties.private,toshiHubDeadlineDate:'2026-10-26',toshiHubEnd:'2026-10-26'});assert.deepEqual(e,before);
 assert.equal(patch.extendedProperties.private.toshiHubDone,'false');assert.equal(patch.extendedProperties.private.toshiHubDeadlineTime,'15:30');
});
test('Google start changes alone never turn into an implicit deadline',()=>{
 const e=event();delete e.extendedProperties.private.toshiHubDeadlineDate;delete e.extendedProperties.private.toshiHubEnd;
 assert.equal(C.deadline(C.fromGoogle(e,calendar)),'');
});
test('completed, cancelled, task and contradictory classification are rejected',()=>{
 for(const change of [e=>e.extendedProperties.private.toshiHubDone='true',e=>e.status='cancelled',e=>e.summary='【タスク】合成',e=>e.extendedProperties.private.toshiHubType='task',e=>e.extendedProperties.private.toshiHubDone='unknown']){
  const e=event();change(e);assert.throws(()=>C.deadlinePatch(e,calendar,'2026-10-26'));
 }
 assert.throws(()=>C.deadlinePatch(event(),calendar,'2026-02-30'));
});
test('Sunday and holidays skip forward while ordinary Saturday stays',()=>{
 const h=date=>date==='2026-11-23';
 assert.equal(D.shifted('2026-10-25',h),'2026-10-26');assert.equal(D.shifted('2027-04-25',h),'2027-04-26');assert.equal(D.shifted('2027-07-25',h),'2027-07-26');
 assert.equal(D.shifted('2027-09-25',h),'2027-09-25');assert.equal(D.shifted('2026-11-22',h),'2026-11-24');assert.equal(D.shifted('2026-11-23',h),'2026-11-24');assert.equal(D.shifted('2028-01-01',()=>null),null);
});
test('audit selects current override and same-series moved dates but never Saturday-only movement',()=>{
 const es=[event(),event('synthetic-april','2027-04-26','2027-04-25'),event('synthetic-july','2027-07-26','2027-07-25'),event('synthetic-saturday','2027-09-27','2027-09-25')],o=empty();o.google=es.map(e=>C.fromGoogle(e,calendar));const key=C.key(o.google[0]);o.edits[key]={deadlineDate:'2026-10-25',done:false,unknown:'local'};
 const plans=D.candidates(es.map(proof),key,C.list(legacy,o),o,()=>false);
 assert.deepEqual(plans.map(x=>[x.proof.eventId,x.date,x.selected]),[['synthetic-october','2026-10-26',true],['synthetic-april','2027-04-26',true],['synthetic-july','2027-07-26',true]]);
});
test('only target deadline aliases change; other edits, state, IDs and history remain',()=>{
 const e=event(),o=empty(),row=C.fromGoogle(e,calendar),key=C.key(row);o.google=[row];o.history=[{kind:'existing',value:'keep'}];o.edits[key]={title:'local title',done:false,deadlineDate:'2026-10-25',end:'2026-10-25',start:'2026-10-01',scheduledDate:'2026-10-01',unknown:{keep:true}};o.edits['google:other:other']={deadlineDate:'2026-01-01'};const before=structuredClone(o);
 const plan=D.candidates([proof(e)],key,C.list(legacy,o),o,()=>false)[0];D.assertLocal(o,plan,C.list(legacy,o));
 const fixed={...e,extendedProperties:{...e.extendedProperties,private:C.deadlinePatch(e,calendar,plan.date).extendedProperties.private}};D.apply(o,plan,C.fromGoogle(fixed,calendar));
 assert.deepEqual(o.edits[key],{...before.edits[key],deadlineDate:'2026-10-26',end:'2026-10-26'});assert.deepEqual(o.edits['google:other:other'],before.edits['google:other:other']);assert.deepEqual(o.history,before.history);assert.equal(o.google.length,1);assert.equal(o.google[0].googleId,e.id);assert.equal(C.list(legacy,o)[0].done,false);assert.equal(C.deadline(C.list(legacy,o)[0]),'2026-10-26');
 const merged=C.mergeGoogle(legacy,o,[C.fromGoogle(fixed,calendar)],[calendar],'2026-10-01','2026-10-31');assert.equal(C.deadline(C.list(legacy,C.parseOverlay(JSON.stringify(merged)))[0]),'2026-10-26');
});
test('a stale local plan stops instead of erasing a concurrent edit',()=>{
 const e=event(),o=empty(),row=C.fromGoogle(e,calendar),key=C.key(row);o.google=[row];o.edits[key]={deadlineDate:'2026-10-25'};const plan=D.candidates([proof(e)],key,C.list(legacy,o),o,()=>false)[0];o.edits[key].title='new edit';const before=structuredClone(o);
 assert.throws(()=>D.assertLocal(o,plan,C.list(legacy,o)),/変わりました/);assert.throws(()=>D.apply(o,plan,row),/確認できません|変わりました/);assert.deepEqual(o,before);
});
test('repairing an uncached selected occurrence adds its same ID once without creating an override',()=>{
 const e=event(),o=empty(),key=C.key(proof(e).row),plan=D.candidates([proof(e)],key,[],o,()=>false)[0];const fixed={...e,extendedProperties:{private:C.deadlinePatch(e,calendar,plan.date).extendedProperties.private}};D.apply(o,plan,C.fromGoogle(fixed,calendar));assert.equal(o.google.length,1);assert.equal(o.edits[key],undefined);assert.equal(o.google[0].googleId,e.id);
});
