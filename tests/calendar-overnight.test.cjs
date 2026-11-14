const test=require('node:test'),assert=require('node:assert/strict'),K=require('../hub-calendar.js');
const event=(id,date,time,endDate=date,endTime='01:00')=>({safeId:id,type:'event',date,time,endDate,endTime,title:id});
test('overnight event precedes return home without mutating source dates or identity',()=>{
 const rows=[event('night','2026-11-13','22:49','2026-11-14'),event('home','2026-11-14','01:01'),event('work','2026-11-14','08:00'),{...event('trip','2026-11-14',''),allDay:true}];
 const raw=JSON.stringify(rows),got=K.entries(rows,[],'2026-11-14');
 assert.deepEqual(got.map(x=>x.safeId),['trip','night','home','work']);assert.equal(got[1].time_label,'前日22:49〜01:00');assert.equal(got[1].date,'2026-11-13');assert.equal(got[1].time,'22:49');assert.equal(JSON.stringify(rows),raw);
 assert.equal(K.entries(rows,[],'2026-11-13')[0].time_label,'22:49〜01:00');
});
test('year/month/leap boundaries and multi-day continuation retain full dates',()=>{
 for(const [start,end]of [['2026-12-31','2027-01-01'],['2028-02-29','2028-03-01'],['2026-11-30','2026-12-01']]){const row=K.entries([event('night',start,'23:30',end)],[],end)[0];assert.equal(row.time_label,'前日23:30〜01:00');}
 const row=K.entries([event('long','2026-11-12','22:00','2026-11-15','04:00')],[],'2026-11-14')[0];assert.equal(row.time_label,'2026-11-12 22:00〜2026-11-15 04:00');
});
test('same-day, unknown time, todo and money order stays unchanged; ties stable',()=>{
 const rows=[event('z','2026-11-13','23:00','2026-11-14'),event('a','2026-11-13','22:00','2026-11-14'),event('unknown','2026-11-14',''),event('morning','2026-11-14','08:00'),{safeId:'todo',type:'todo',start:'2026-11-13',deadlineDate:'2026-11-14',deadlineTime:'09:00'}];
 const money=[{safeId:'cash',date:'2026-11-14',time:'07:00',kind:'income',amount:10}];
 const got=K.entries(rows,money,'2026-11-14');assert.deepEqual(got.map(x=>x.safeId),['a','z','cash','morning','todo','unknown']);assert.equal(got[4].continued_from_previous_day,false);
 assert.deepEqual(K.entries(rows.slice().reverse(),money,'2026-11-14').map(x=>x.safeId),got.map(x=>x.safeId));
});
