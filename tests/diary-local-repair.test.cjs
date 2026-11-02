'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../diary-local-repair.js'),C=require('../diary-core.js'),R=require('../diary-repair.js'),fixture=require('./diary-local-repair-fixture.cjs');
const prepare=f=>L.prepare(f.manifest,f.google,f.backup,f.live,{sourceOrigin:'https://synthetic.example.test'});
test('fresh 94 plan retains exact live metadata, one original, and six missing revisions without input mutation',async()=>{
 const f=await fixture(),saved=structuredClone(f),p=await prepare(f);
 assert.equal(p.phase,'before');assert.equal(p.afterRevisions.length,94);assert.equal(p.additions.length,6);assert.deepEqual(p.before.meta,f.live.meta);assert.deepEqual(p.archive.mapping.original,f.manifest.target.before);
 assert.deepEqual(f,saved);const outside=p.before.revisions.filter(r=>r.revisionId!==p.target.revisionId);assert.equal(outside.length,87);for(const r of outside)assert.deepEqual(p.afterRevisions.find(a=>a.revisionId===r.revisionId),r);
 assert.deepEqual(C.merge(p.afterRevisions,f.google.revisions),p.afterRevisions);assert(C.heads(p.afterRevisions).some(r=>r.body==='Fictional later addition'));
});
test('restart plans from archived live metadata, not metadata guessed from diary backup',async()=>{
 const f=await fixture(),p=await prepare(f);assert(!Object.hasOwn(f.backup,'meta'));
 for(const phase of ['applied','verified']){const live=L.expectedState(p,phase),retry=await L.prepare(f.manifest,f.google,f.backup,live,{sourceOrigin:f.manifest.sourceOrigin});assert.equal(retry.planId,p.planId);assert.equal(retry.phase,phase);}
});
for(const [name,edit] of Object.entries({
 origin:f=>{f.manifest.sourceOrigin='https://wrong.example.test'},
 count:f=>{f.google.revisions.pop()},
 original:f=>{f.live.revisions.find(r=>r.revisionId===f.manifest.target.before.revisionId).body='Unknown'},
 otherHistory:f=>{f.live.revisions[0].title='Changed'},
 draft:f=>{f.live.meta.draft={fields:{body:'Do not lose'}}},
 hash:f=>{f.manifest.googleSnapshotHash='bad'},
 oldMapping:f=>{f.manifest.target.remappedRevisionId='repaired_A01'},
 duplicate:f=>{f.google.revisions[0]=f.google.revisions[1]},
 extraKey:f=>{f.manifest.liveOverride=true},
 namespace:f=>{f.live.meta[L.ARCHIVE]={unexpected:true}}
}))test('reject '+name,async()=>{const f=await fixture();edit(f);await assert.rejects(prepare(f));});
test('metadata captured in plan is pinned during apply; unknown changes fail classification',async()=>{const f=await fixture(),p=await prepare(f);f.live.meta.sheet='changed';assert.throws(()=>L.classify(p,f.live),/changed/);});
test('non-null draft is preserved exactly when reviewed backup agrees',async()=>{const f=await fixture();f.live.meta.draft={fields:{body:'Fictional unsaved draft'},baseRevisionId:null,parents:null,at:'2030-01-03T00:00:00Z'};f.backup.draft=structuredClone(f.live.meta.draft);f.manifest.backupHash=await R.digest(f.backup);const p=await prepare(f);assert.deepEqual(L.expectedState(p,'verified').meta.draft,f.live.meta.draft);});
test('draft with ambiguous replaced base is retained but repair must stop',async()=>{const f=await fixture();f.live.meta.draft={fields:{body:'Fictional draft'},baseRevisionId:f.manifest.target.before.revisionId};f.backup.draft=structuredClone(f.live.meta.draft);f.manifest.backupHash=await R.digest(f.backup);await assert.rejects(prepare(f),/draft refers/);});
