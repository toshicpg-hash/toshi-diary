'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./diary-targeted-design-fixtures.cjs'),R=require('../diary-repair.js'),C=require('../diary-core.js');
const snapshotForHash=s=>({...s,revisions:[...s.revisions].sort((a,b)=>a.revisionId<b.revisionId?-1:a.revisionId>b.revisionId?1:0)});
test('targeted design fixture has exact per-source hashes and bounded write sets',async()=>{
 const f=await fixture(),p=f.execution.participants;
 assert.deepEqual(p.device_one.replacements,[]);assert.equal(p.device_one.additions.length,6);
 assert.deepEqual(p.device_two.replacements,['target_A00']);assert.equal(p.device_two.additions.length,5);
 assert.deepEqual(p.google_copy.replacements,['target_A00','target_B00']);assert.equal(p.google_copy.additions.length,5);
 for(const [name,s] of Object.entries(p)){
  assert.equal(s.beforeHash,await R.digest(snapshotForHash(f.current[name])));assert.equal(s.afterHash,await R.digest(snapshotForHash(f.plan.copies[name])));
  assert.notEqual(s.beforeHash,s.afterHash);
  assert(s.replacements.every(id=>f.manifest.targets.some(t=>t.revisionId===id)));
  assert.deepEqual(f.plan.copies[name].revisions.slice(0,86),f.current[name].revisions.slice(0,86));
  const {revisions:before,...beforeRest}=f.current[name],{revisions:after,...afterRest}=f.plan.copies[name];assert.deepEqual(beforeRest,afterRest);
 }
 assert.equal(p.device_one.allowedBefore.target_B00,null);
 assert.notEqual(p.device_one.allowedBefore.target_A00,p.device_two.allowedBefore.target_A00);
});
test('Google fixed-range fixture changes only two existing rows and adds five; raw strings preserved',async()=>{
 const {execution:{google:g}}=await fixture();
 assert.equal(g.rawBefore.length,89);assert.equal(g.rawAfter.length,94);
 const inPlace=g.rawAfter;
 assert.equal(g.afterHash,await R.digest(inPlace));
 assert.deepEqual(inPlace.slice(0,87),g.rawBefore.slice(0,87));
 assert.deepEqual(inPlace.slice(g.appendStartRowIndex).map(r=>r[0]),['repaired_A01','repaired_B01','repaired_B02','repaired_B03','repaired_B04']);
 assert.equal(C.merge(C.fromRows(inPlace)).length,93);
 assert(inPlace.every(row=>row.length===14&&row.every(v=>typeof v==='string')));
});
test('all original variants remain recoverable with original IDs and parents after hypothetical bounded writes',async()=>{
 const f=await fixture();assert.deepEqual(f.plan.archive.mapping.map(x=>x.original),f.manifest.targets.flatMap(t=>t.variants));
 assert.deepEqual(f.plan.archive.originalSnapshots,f.current);
 assert.equal(f.plan.archive.mapping.length,7);
});
test('old client counterexample: A0 client merges repaired cloud and can create a valid append; A1 client stops',async()=>{
 const f=await fixture(),after=f.plan.copies.google_copy.revisions;
 const merged=C.merge(f.current.device_one.revisions,after);assert.equal(merged.length,93);
 const record=C.create({date:'2030-01-03',body:'Fictional old client can still write'},{base:f.current.device_one.revisions.at(-1),deviceId:'synthetic_old_device',uuid:()=> 'synthetic_old_write_001',now:'2030-01-03T00:00:00Z'});
 assert.equal(C.merge(merged,[record]).length,94);
 assert.throws(()=>C.merge(f.current.device_two.revisions,after),/同じ履歴ID/);
});
test('design failure cases explicitly forbid retries on unknown outcomes and forbid deletion rollback',async()=>{
 const {cases}=await fixture(),byName=Object.fromEntries(cases.map(c=>[c.name,c]));
 assert.equal(new Set(cases.map(c=>c.name)).size,cases.length);
 for(const name of ['google-disconnect-before','google-disconnect-after','google-partial','coordinator-journal-lost'])assert.equal(byName[name].retry,false);
 assert.equal(byName['one-device-failed'].expected,'ALL_FROZEN_RESUME_SECOND');
 assert.equal(byName['rollback-new-edits'].expected,'BACKUP_ALL_STOP_NO_DELETE');
 // This checks specification coverage, NOT an implementation of these outcomes.
});
