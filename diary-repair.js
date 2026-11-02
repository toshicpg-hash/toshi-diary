/* Offline, copy-only repair planning. Never loaded by the production bundle. */
(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./diary-core.js'):root.ToshiDiaryCore;
 const clone=x=>JSON.parse(stable(x));
 function fail(message){throw Error('Repair stopped: '+message);}
 function stable(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  if(x&&Object.getPrototypeOf(x)===Object.prototype)return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
  fail('JSON values required');
 }
 async function digest(x){const bytes=new TextEncoder().encode(stable(x));const cryptoAPI=typeof module==='object'&&module.exports?require('node:crypto').webcrypto:root.crypto;return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
 function same(a,b,message){if(stable(a)!==stable(b))fail(message);}
 function exactKeys(x,keys){if(!x||typeof x!=='object'||Array.isArray(x))fail('object required');same(Object.keys(x).sort(),keys.slice().sort(),'unexpected or missing fields');}
 function record(raw){exactKeys(raw,C.keys);const r=C.validate(raw);same(raw,r,'noncanonical record shape');return r;}
 function history(records){if(!Array.isArray(records))fail('history required');const seen=new Set();for(const raw of records){const r=record(raw);if(seen.has(r.revisionId))fail('duplicate revision ID');seen.add(r.revisionId);}return C.merge(records);}
 const sorted=rs=>rs.map(C.canonical).sort();
 function snapshot(s){if(!s||!Array.isArray(s.revisions))fail('snapshot revisions required');stable(s);history(s.revisions);}
 async function dryRun(input,observed){
  // Clone before awaiting: callers cannot mutate inputs during hashing.
  const m=clone(input),current=clone(observed);
  exactKeys(m,['format','repairId','targets','baseline','sources']);
  if(m.format!=='papa-diary-private-repair-v1'||!/^[A-Za-z0-9_-]{8,60}$/.test(m.repairId))fail('manifest version or repair ID');
  if(!Array.isArray(m.targets)||m.targets.length!==2)fail('exactly two targets required');
  history(m.baseline);
  if(!Array.isArray(m.sources)||m.sources.length<3)fail('Google and at least two devices required');
  const names=new Set(),targetIds=new Set(),entries=new Set(),allIds=new Set(m.baseline.map(r=>r.revisionId));
  const normalized=[],mapping=[];
  for(const t of m.targets){
   exactKeys(t,['revisionId','variants','replacementIds']);
   if(targetIds.has(t.revisionId)||allIds.has(t.revisionId))fail('target overlap');
   targetIds.add(t.revisionId);allIds.add(t.revisionId);
   if(!Array.isArray(t.variants)||t.variants.length<2||!Array.isArray(t.replacementIds)||t.replacementIds.length!==t.variants.length-1)fail('variant mapping required');
   const canon=new Set();
   for(const raw of t.variants){const r=record(raw);if(r.revisionId!==t.revisionId||r.entryId!==t.variants[0].entryId)fail('variant identity');if(canon.has(C.canonical(r)))fail('duplicate variant');canon.add(C.canonical(r));}
   if(entries.has(t.variants[0].entryId))fail('targets must be distinct entries');entries.add(t.variants[0].entryId);
   // Limited to original leaf revisions. Do not reinterpret existing descendants.
   if(m.baseline.some(r=>r.parents.includes(t.revisionId)||r.entryId===t.variants[0].entryId))fail('target has existing lineage outside repair');
   for(const r of t.variants)if(r.parents.length)fail('only root target variants supported');
   normalized.push(clone(t.variants[0]));
   mapping.push({original:clone(t.variants[0]),normalized:clone(t.variants[0])});
   let parent=t.revisionId;
   for(let i=1;i<t.variants.length;i++){
    const id=t.replacementIds[i-1];if(allIds.has(id))fail('replacement ID collision');allIds.add(id);
    const r=record({...t.variants[i],revisionId:id,parents:[parent]});normalized.push(r);
    mapping.push({original:clone(t.variants[i]),normalized:clone(r)});parent=id;
   }
  }
  const finalHistory=history([...m.baseline,...normalized]);
  let google=0,devices=0;
  for(const s of m.sources){
   exactKeys(s,['name','kind','snapshot']);
   if(typeof s.name!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(s.name)||names.has(s.name))fail('source names');names.add(s.name);
   if(s.kind==='google')google++;else if(s.kind==='device')devices++;else fail('source kind');
   snapshot(s.snapshot);
   same(sorted(s.snapshot.revisions.filter(r=>!targetIds.has(r.revisionId))),sorted(m.baseline),'outside-target difference');
   for(const r of s.snapshot.revisions.filter(r=>targetIds.has(r.revisionId))){const t=m.targets.find(t=>t.revisionId===r.revisionId);if(!t.variants.some(v=>C.canonical(v)===C.canonical(r)))fail('unknown target variant');}
  }
  if(google!==1||devices<2)fail('one Google source and at least two devices required');
  exactKeys(current,[...names]);
  for(const s of m.sources){snapshot(current[s.name]);same(current[s.name],s.snapshot,'source changed since manifest review');}
  // Require each target at Google; missing on an explicitly reviewed device is allowed.
  const cloud=m.sources.find(s=>s.kind==='google');
  for(const id of targetIds)if(!cloud.snapshot.revisions.some(r=>r.revisionId===id))fail('Google target missing');
  const archive={format:'papa-diary-repair-archive-v1',manifest:m,originalSnapshots:current,mapping};
  const planId=await digest(archive);
  const copies=Object.fromEntries(m.sources.map(s=>[s.name,{...clone(s.snapshot),revisions:clone(finalHistory)}]));
  return {format:'papa-diary-repair-plan-v1',planId,archive,copies,summary:{targets:2,originalVariants:mapping.length,unaffected:m.baseline.length,revisions:finalHistory.length,googleSaved:false,deviceReflectionConfirmed:false},limitations:['COPY_ONLY','NO_LIVE_ADAPTER','OLD_CLIENTS_MUST_REMAIN_ISOLATED']};
 }
 async function executeCopies(manifest,current,{backupReadback,confirmedPlanId}={}){
  const readback=clone(backupReadback??null),confirmation=confirmedPlanId;
  const plan=await dryRun(manifest,current);
  same(readback,plan.archive,'backup readback differs or is missing');
  if(confirmation!==plan.planId)fail('explicit confirmation for this plan required');
  return {format:'papa-diary-repaired-copies-v1',planId:plan.planId,archive:plan.archive,copies:plan.copies,status:{copyPrepared:true,googleSaved:false,deviceReflectionConfirmed:false}};
 }
 // The guard only proposes missing appends; it never writes and never treats a
 // timeout as permission to resend. Run again against a fresh complete read.
 async function lintAppend(before,proposed,{expectedBefore}={}){
  const b=clone(before),p=clone(proposed);history(b);history(p.length?p.concat(b.filter(r=>!p.some(x=>x.revisionId===r.revisionId))):b);
  if(typeof expectedBefore!=='string'||await digest(b)!==expectedBefore)fail('pre-read snapshot changed');
  const merged=C.merge(b,p),existing=new Set(b.map(r=>r.revisionId));
  return {beforeDigest:expectedBefore,append:merged.filter(r=>!existing.has(r.revisionId)),expected:merged};
 }
 function verifyAppendReadback(expected,actual){history(expected);history(actual);same(sorted(expected),sorted(actual),'append readback mismatch');return {googleSaved:true,deviceReflectionConfirmed:false};}
 const api={dryRun,executeCopies,lintAppend,verifyAppendReadback,digest};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ToshiDiaryRepair=api;
})(typeof globalThis==='object'?globalThis:this);
