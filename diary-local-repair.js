/* Fold-only offline restore. Not loaded by the application bundle. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const C=node?require('./diary-core.js'):root.ToshiDiaryCore;
 const H=node?require('./diary-repair.js'):root.ToshiDiaryRepair;
 const DATABASE='toshi_diary_v1',ARCHIVE='limitedRepairArchive',JOURNAL='limitedRepairJournal';
 function stop(m){throw Error('Fold repair stopped: '+m);}
 function stable(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  if(x&&Object.getPrototypeOf(x)===Object.prototype)return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
  stop('JSON-only values required; unknown metadata must not be converted');
 }
 const clone=x=>JSON.parse(stable(x));
 function same(a,b,m){if(stable(a)!==stable(b))stop(m);}
 function keys(x,wanted){if(!x||typeof x!=='object'||Array.isArray(x))stop('object required');same(Object.keys(x).sort(),wanted.slice().sort(),'unexpected fields');}
 function record(x){keys(x,C.keys);same(x,C.validate(x),'noncanonical record');return clone(x);}
 function history(rows){if(!Array.isArray(rows))stop('history required');const ids=new Set();for(const r of rows){record(r);if(ids.has(r.revisionId))stop('duplicate ID');ids.add(r.revisionId);}C.merge(rows);return clone(rows).sort((a,b)=>a.revisionId<b.revisionId?-1:a.revisionId>b.revisionId?1:0);}
 function snapshot(x){keys(x,['revisions','meta']);if(!x.meta||typeof x.meta!=='object'||Array.isArray(x.meta))stop('metadata required');return {revisions:history(x.revisions),meta:clone(x.meta)};}
 const historyHash=rows=>H.digest(history(rows));
 function content(r){const {revisionId,parents,...rest}=r;return rest;}
 function expectedState(plan,phase){return {revisions:plan.afterRevisions,meta:{...plan.before.meta,[ARCHIVE]:plan.archive,[JOURNAL]:{format:'fold-local-repair-journal-v1',planId:plan.planId,repairId:plan.archive.manifest.repairId,phase}}};}
 function classify(plan,current){const s=snapshot(current);if(stable(s)===stable(plan.before))return 'before';for(const phase of ['applied','verified'])if(stable(s)===stable(expectedState(plan,phase)))return phase;stop('live history, draft, metadata or repair receipt changed');}
 async function prepare(manifest,googleSnapshot,backup,live,{sourceOrigin}={}){
  const m=clone(manifest),g=clone(googleSnapshot),b=clone(backup),current=snapshot(live);
  keys(m,['format','repairId','sourceOrigin','database','beforeHistoryHash','afterHistoryHash','googleSnapshotHash','backupHash','target','secondEntryId','additionIds']);
  if(m.format!=='fold-local-restore-v1'||m.database!==DATABASE||!/^\w[\w-]{7,59}$/.test(m.repairId)||typeof sourceOrigin!=='string'||m.sourceOrigin!==sourceOrigin)stop('manifest destination or version');
  keys(m.target,['before','after','remappedRevisionId']);record(m.target.before);record(m.target.after);
  const t=m.target;if(t.before.revisionId!==t.after.revisionId||t.before.entryId!==t.after.entryId||t.before.parents.length||t.after.parents.length||C.canonical(t.before)===C.canonical(t.after))stop('exactly one differing root target required');
  keys(g,['format','revisions']);if(g.format!=='fold-google-snapshot-v1')stop('snapshot format');
  if(b.format!=='toshi-hub-diary'||b.schemaVersion!==1||!Object.hasOwn(b,'draft'))stop('full diary backup with draft required');
  keys(b,Object.hasOwn(b,'exportedAt')?['format','schemaVersion','exportedAt','revisions','draft']:['format','schemaVersion','revisions','draft']);
  const beforeRows=history(b.revisions),afterRows=history(g.revisions);
  if(beforeRows.length!==88||afterRows.length!==94)stop('expected Fold 88 and Google snapshot 94');
  if(await historyHash(beforeRows)!==m.beforeHistoryHash||await historyHash(afterRows)!==m.afterHistoryHash||await H.digest(g)!==m.googleSnapshotHash||await H.digest(b)!==m.backupHash)stop('input hash mismatch');
  const beforeMap=new Map(beforeRows.map(r=>[r.revisionId,r])),afterMap=new Map(afterRows.map(r=>[r.revisionId,r]));
  same(beforeMap.get(t.before.revisionId),t.before,'unknown original variant');same(afterMap.get(t.after.revisionId),t.after,'target after differs');
  for(const r of beforeRows)if(r.revisionId!==t.before.revisionId)same(afterMap.get(r.revisionId),r,'other 87 histories differ');
  const remapped=afterMap.get(t.remappedRevisionId);if(!remapped)stop('original variant mapping missing');same(content(remapped),content(t.before),'original variant not preserved');same(remapped.parents,[t.after.revisionId],'A lineage differs');
  const additions=afterRows.filter(r=>!beforeMap.has(r.revisionId));
  same(additions.map(r=>r.revisionId).sort(),m.additionIds.slice().sort(),'unexpected additions');if(new Set(m.additionIds).size!==6)stop('six exact additions required');
  const bRoots=beforeRows.filter(r=>r.entryId===m.secondEntryId);if(bRoots.length!==1||bRoots[0].parents.length||m.secondEntryId===t.before.entryId)stop('B root differs');
  const bNew=additions.filter(r=>r.entryId===m.secondEntryId);if(bNew.length!==5||additions.filter(r=>r.entryId===t.before.entryId).length!==1||!additions.some(r=>r.revisionId===remapped.revisionId))stop('additions outside A/B');
  let parent=bRoots[0].revisionId;const pending=new Map(bNew.map(r=>[r.revisionId,r]));while(pending.size){const children=[...pending.values()].filter(r=>r.parents.length===1&&r.parents[0]===parent);if(children.length!==1)stop('B chain differs');parent=children[0].revisionId;pending.delete(parent);}
  let before=current;
  if(Object.hasOwn(current.meta,ARCHIVE)||Object.hasOwn(current.meta,JOURNAL)){
   if(!current.meta[ARCHIVE]?.liveBefore||!current.meta[JOURNAL])stop('unknown repair metadata');
   before=snapshot(current.meta[ARCHIVE].liveBefore);
  }
  if(Object.hasOwn(before.meta,ARCHIVE)||Object.hasOwn(before.meta,JOURNAL))stop('reserved metadata collision');
  same(before.revisions,beforeRows,'live histories differ from reviewed backup');same(before.meta.draft??null,b.draft,'live draft differs from backup');
  if(before.meta.draft&&(before.meta.draft.baseRevisionId===t.before.revisionId||before.meta.draft.parents?.includes(t.before.revisionId)))stop('draft refers to replaced variant; separate review required');
  const archive={format:'fold-local-repair-archive-v1',manifest:m,googleSnapshot:g,backup:b,liveBefore:before,mapping:{original:t.before,normalized:remapped},afterHistoryHash:m.afterHistoryHash};
  const planId=await H.digest(archive),plan={planId,before,archive,afterRevisions:afterRows,target:t.after,additions};
  plan.phase=classify(plan,current);
  return clone(plan);
 }
 function schema(db,tx){same([...db.objectStoreNames].sort(),['meta','revisions'],'unknown stores');if(tx.objectStore('revisions').keyPath!=='revisionId'||tx.objectStore('meta').keyPath!=='key'||tx.objectStore('revisions').indexNames.length||tx.objectStore('meta').indexNames.length)stop('unknown database schema');}
 function rowsToState(revisions,rows){const meta=Object.fromEntries(rows.map(r=>{keys(r,['key','value']);if(typeof r.key!=='string')stop('metadata key');return [r.key,r.value];}));return snapshot({revisions,meta});}
 function createAdapter({indexedDB=root.indexedDB,locks=root.navigator?.locks,assertSolo,sourceOrigin=root.location?.origin}={}){
  if(typeof assertSolo!=='function')stop('independent window census required');
  async function read(){return new Promise((resolve,reject)=>{
   const q=indexedDB.open(DATABASE);let failure;
   q.onupgradeneeded=()=>{failure=Error('Existing Fold diary database required');q.transaction.abort();};
   q.onerror=()=>reject(failure||q.error);q.onblocked=()=>reject(Error('Close every other HUB window'));
   q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>db.close();try{if(![1,2].includes(db.version))stop('unknown database version');const version=db.version,tx=db.transaction(['revisions','meta'],'readonly');schema(db,tx);const a=tx.objectStore('revisions').getAll(),b=tx.objectStore('meta').getAll();tx.oncomplete=()=>{db.close();try{resolve({version,state:rowsToState(a.result,b.result)});}catch(e){reject(e);}};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Read failed'));};}catch(e){db.close();reject(e);}};
  });}
  async function inspect(m,g,b){await assertSolo();const {version,state}=await read(),plan=await prepare(m,g,b,state,{sourceOrigin});if((plan.phase==='before'&&version!==1)||(plan.phase!=='before'&&version!==2))stop('version/receipt mismatch');return plan;}
  async function apply(m,g,b,{backupReadback,confirmedPlanId,stoppedWriters,signal,onBlocked=()=>{}}={}){
   // Clone every input before async work; input controls cannot change this run.
   const inputs=[m,g,b,backupReadback].map(x=>clone(x??null));
   if(stoppedWriters!==true||!locks?.request)stop('writer-stop confirmation and Web Locks required');
   const cancelled=()=>{if(signal?.aborted)stop('cancelled; inspect before retry');};
   return locks.request('fold-local-repair-exclusive',{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)stop('another repair is running');cancelled();
    const plan=await inspect(...inputs.slice(0,3));same(inputs[3],plan.archive,'saved archive readback differs');if(confirmedPlanId!==plan.planId)stop('plan confirmation differs');
    await assertSolo();cancelled();
    if(plan.phase==='before')await new Promise((resolve,reject)=>{
     const q=indexedDB.open(DATABASE,2);let failure,blocked=false;
     const abort=()=>{failure=Error('Cancelled; transaction will abort or must be inspected');try{q.transaction?.abort();}catch{}};
     signal?.addEventListener('abort',abort,{once:true});
     q.onblocked=()=>{blocked=true;failure=Error('Other HUB connection is open; close it and retry');onBlocked(failure.message);};
     q.onupgradeneeded=e=>{const tx=q.transaction;try{if(blocked||signal?.aborted)throw failure||Error('Cancelled');if(e.oldVersion!==1)stop('unexpected starting DB version');schema(q.result,tx);
      const a=tx.objectStore('revisions').getAll(),z=tx.objectStore('meta').getAll();
      z.onsuccess=()=>{try{const actual=rowsToState(a.result,z.result);if(classify(plan,actual)!=='before')stop('transaction precondition changed');const meta=tx.objectStore('meta'),store=tx.objectStore('revisions');meta.add({key:ARCHIVE,value:plan.archive});meta.add({key:JOURNAL,value:expectedState(plan,'applied').meta[JOURNAL]});store.put(plan.target);for(const r of plan.additions)store.add(r);}catch(e){failure=e;tx.abort();}};
     }catch(e){failure=e;tx.abort();}};
     q.onerror=()=>{signal?.removeEventListener('abort',abort);reject(failure||q.error);};
     q.onsuccess=()=>{signal?.removeEventListener('abort',abort);q.result.close();if(blocked||failure)reject(failure||Error('Blocked'));else resolve();};
    });
    // Reopen the committed DB. A crash/cancel here leaves 'applied' and blocks
    // normal writes until an identical retry verifies and finishes the receipt.
    cancelled();await assertSolo();let disk=await read();if(disk.version!==2)stop('upgrade not committed');const phase=classify(plan,disk.state);
    if(phase==='before')stop('repair did not commit');
    if(phase==='applied')await new Promise((resolve,reject)=>{
     const q=indexedDB.open(DATABASE,2);let failure;
     q.onerror=()=>reject(q.error);q.onupgradeneeded=()=>{failure=Error('Database disappeared');q.transaction.abort();};
     q.onsuccess=()=>{const db=q.result,tx=db.transaction(['revisions','meta'],'readwrite',{durability:'strict'});db.onversionchange=()=>db.close();const a=tx.objectStore('revisions').getAll(),z=tx.objectStore('meta').getAll();z.onsuccess=()=>{try{cancelled();if(classify(plan,rowsToState(a.result,z.result))!=='applied')stop('readback state changed');tx.objectStore('meta').put({key:JOURNAL,value:expectedState(plan,'verified').meta[JOURNAL]});}catch(e){failure=e;tx.abort();}};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(failure||tx.error||Error('Verification receipt failed'));};};
    });
    disk=await read();if(classify(plan,disk.state)!=='verified')stop('final readback differs');
    return {planId:plan.planId,phase:'verified',localProcessed:true,googleSnapshotMatched:true,googleLiveChecked:false,ownerScreenConfirmed:false};
   });
  }
  return {read,inspect,apply};
 }
 const api={DATABASE,ARCHIVE,JOURNAL,historyHash,prepare,classify,expectedState,createAdapter};
 if(node)module.exports=api;else root.FoldLocalRepair=api;
})(typeof globalThis==='object'?globalThis:this);
