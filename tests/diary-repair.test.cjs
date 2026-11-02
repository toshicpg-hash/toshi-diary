'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../diary-repair.js'),C=require('../diary-core.js'),fixture=require('./diary-repair-fixture.cjs');
test('A0/A1 and missing B/B0/B4 converge in copies; all seven originals and intermediates recover exactly',async()=>{
 const {manifest,current}=fixture(),before=structuredClone({manifest,current});
 assert.deepEqual(Object.values(current).map(x=>x.revisions.length),[87,88,88]);
 assert.throws(()=>C.merge(current.device_one.revisions,current.google_copy.revisions),/同じ履歴ID/);
 const p=await R.dryRun(manifest,current),result=await R.executeCopies(manifest,current,{backupReadback:JSON.parse(JSON.stringify(p.archive)),confirmedPlanId:p.planId});
 assert.deepEqual({manifest,current},before);assert.equal(p.summary.unaffected,86);assert.equal(p.summary.revisions,93);
 const histories=Object.values(result.copies).map(x=>x.revisions);
 assert.deepEqual(histories[0],histories[1]);assert.deepEqual(histories[1],histories[2]);assert.equal(C.merge(...histories).length,93);
 for(const [name,state] of Object.entries(current)){assert.deepEqual({...result.copies[name],revisions:state.revisions},state);assert.deepEqual(result.copies[name].revisions.slice(0,86),manifest.baseline);}
 assert.deepEqual(p.archive.mapping.map(x=>x.original),manifest.targets.flatMap(t=>t.variants));
 assert.deepEqual(p.archive.originalSnapshots,current);
 const heads=C.heads(histories[0]);assert(heads.some(r=>r.body==='Fictional A1'));assert(heads.some(r=>r.body==='Fictional B4'));assert.equal(C.conflicts(histories[0]).length,0);
 for(const item of p.archive.mapping){assert(histories[0].some(r=>C.canonical(r)===C.canonical(item.normalized)));const {revisionId,parents,...content}=item.normalized;const {revisionId:old,parents:oldParents,...original}=item.original;assert.deepEqual(content,original);}
 assert.deepEqual(result.status,{copyPrepared:true,googleSaved:false,deviceReflectionConfirmed:false});
});
test('confirmation and independent full backup readback are mandatory; repeated copy generation is deterministic',async()=>{
 const {manifest,current}=fixture(),p=await R.dryRun(manifest,current);
 await assert.rejects(R.executeCopies(manifest,current),/backup/);
 await assert.rejects(R.executeCopies(manifest,current,{backupReadback:p.archive,confirmedPlanId:'wrong'}),/confirmation/);
 const corrupt=structuredClone(p.archive);corrupt.manifest.targets[1].variants.splice(2,1);
 await assert.rejects(R.executeCopies(manifest,current,{backupReadback:corrupt,confirmedPlanId:p.planId}),/backup/);
 const opts={backupReadback:p.archive,confirmedPlanId:p.planId};assert.deepEqual(await R.executeCopies(manifest,current,opts),await R.executeCopies(manifest,current,opts));
 const fresh=JSON.parse(JSON.stringify({manifest,current,opts}));assert.deepEqual(await R.executeCopies(fresh.manifest,fresh.current,fresh.opts),await R.executeCopies(manifest,current,opts));
 current.device_one.meta.draft.body='changed';await assert.rejects(R.executeCopies(manifest,current,opts),/source changed/);
});
const mutations={
 'unknown variant':f=>{f.manifest.sources[1].snapshot.revisions.at(-1).body='unknown';},
 'outside target edit':f=>{f.manifest.sources[0].snapshot.revisions[0].body='unknown';},
 'duplicate':f=>{f.manifest.sources[0].snapshot.revisions.push(f.manifest.sources[0].snapshot.revisions[0]);},
 'missing parent':f=>{f.manifest.sources[0].snapshot.revisions[0].parents=['missing_parent'];},
 'cross entry parent':f=>{f.manifest.baseline[0].parents=[f.manifest.baseline[1].revisionId];},
 'cycle':f=>{f.manifest.baseline[0].entryId=f.manifest.baseline[1].entryId;f.manifest.baseline[0].parents=[f.manifest.baseline[1].revisionId];f.manifest.baseline[1].parents=[f.manifest.baseline[0].revisionId];},
 'replacement collision':f=>{f.manifest.targets[0].replacementIds[0]=f.manifest.baseline[0].revisionId;},
 'target overlap':f=>{f.manifest.targets[1]=f.manifest.targets[0];},
 'third target':f=>{f.manifest.targets.push(f.manifest.targets[0]);},
 'extra fields':f=>{f.manifest.targets[0].variants[0].unknown='value';},
 'parent anomaly variant':f=>{f.manifest.targets[0].variants[1].parents=['baseline_000'];},
 'unexpected source':f=>{f.current.extra=f.current.device_one;},
 'Google changed':f=>{f.current.google_copy.revisions.at(-1).people='Changed';},
 'device changed':f=>{f.current.device_two.revisions.at(-1).body='Changed';},
 'unreviewed metadata':f=>{f.current.device_one.other.money.push('Changed');},
 'Google absent target':f=>{f.manifest.sources[2].snapshot.revisions.pop();f.current.google_copy=structuredClone(f.manifest.sources[2].snapshot);},
 'non JSON':f=>{f.current.device_one.invalid=undefined;}
};
for(const [name,mutate] of Object.entries(mutations))test('stop: '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(R.dryRun(f.manifest,f.current));});
test('old incompatible clients still protective-stop; Google-only restoration does not repair both devices',async()=>{
 const {manifest,current}=fixture(),p=await R.dryRun(manifest,current);
 assert.throws(()=>C.merge(current.device_two.revisions,p.copies.google_copy.revisions),/同じ履歴ID/);
 assert.throws(()=>C.merge(current.device_two.revisions,[...manifest.baseline,...manifest.targets.map(t=>t.variants[0])]),/同じ履歴ID/);
});
test('append lint forbids updates; verifies schema, lineage, pre-read and full readback; retries only missing IDs',async()=>{
 const {manifest,current}=fixture(),before=current.device_one.revisions;
 const next=C.create({date:'2030-01-01',body:'Fictional new revision'},{base:before.at(-1),deviceId:'device_synthetic',uuid:()=> 'new_revision_01',now:'2030-01-02T00:00:00Z'});
 const expectedBefore=await R.digest(before),plan=await R.lintAppend(before,[next],{expectedBefore});assert.deepEqual(plan.append,[next]);
 await assert.rejects(R.lintAppend(before,manifest.targets[0].variants.slice(1),{expectedBefore}),/同じ履歴ID/);
 await assert.rejects(R.lintAppend(before,[next],{expectedBefore:'stale'}),/pre-read/);
 await assert.rejects(R.lintAppend(before,[{...next,parents:['missing_parent']}],{expectedBefore}));
 await assert.rejects(R.lintAppend(before,[{...next,title:1}],{expectedBefore}));
 assert.throws(()=>R.verifyAppendReadback(plan.expected,before),/readback/);
 assert.deepEqual(R.verifyAppendReadback(plan.expected,plan.expected),{googleSaved:true,deviceReflectionConfirmed:false});
 assert.deepEqual((await R.lintAppend(plan.expected,[next],{expectedBefore:await R.digest(plan.expected)})).append,[]);
});
for(const key of C.keys)test('every canonical field is pinned: '+key,async()=>{
 const f=fixture(),r=f.manifest.sources[1].snapshot.revisions.at(-1);
 if(key==='parents')r[key]=['baseline_000'];
 else if(key==='date')r[key]='2030-01-02';
 else if(key==='createdAt'||key==='updatedAt')r[key]='2030-01-01T00:00:01Z';
 else r[key]+='_changed';
 f.current.device_two=structuredClone(f.manifest.sources[1].snapshot);
 await assert.rejects(R.dryRun(f.manifest,f.current));
});
test('copy output itself cannot masquerade as a reviewed original source',async()=>{
 const f=fixture(),p=await R.dryRun(f.manifest,f.current);
 await assert.rejects(R.executeCopies(f.manifest,p.copies,{backupReadback:p.archive,confirmedPlanId:p.planId}),/source changed/);
});
