'use strict';
const old=require('./diary-repair-fixture.cjs'),R=require('../diary-repair.js'),L=require('../diary-local-repair.js'),C=require('../diary-core.js');
module.exports=async function(sourceOrigin='https://synthetic.example.test'){
 const f=old();
 // Deliberately different replacement IDs from the earlier 93-row copy plan.
 f.manifest.targets[0].replacementIds=['actual_synthetic_A1'];
 f.manifest.targets[1].replacementIds=[1,2,3,4].map(i=>'actual_synthetic_B'+i);
 const copy=await R.dryRun(f.manifest,f.current),rows=copy.copies.google_copy.revisions;
 const b4=rows.find(r=>r.revisionId==='actual_synthetic_B4');
 const b5=C.create({date:'2030-01-02',title:'Synthetic B5',body:'Fictional later addition'},{base:b4,deviceId:'synthetic_device_b5',now:'2030-01-03T00:00:00Z',uuid:()=> 'actual_synthetic_B5'});
 const google={format:'fold-google-snapshot-v1',revisions:[...rows,b5]};
 const live={revisions:f.current.device_two.revisions,meta:{deviceId:'synthetic_fold_device',draft:null,sheet:'synthetic_existing_sheet_0001',opaque:{keep:['unknown',7]},'remote:synthetic_existing_sheet_0001':{ids:['synthetic_old_ack']}}};
 const backup={format:'toshi-hub-diary',schemaVersion:1,exportedAt:'2030-01-03T00:00:00Z',revisions:live.revisions,draft:live.meta.draft};
 const ids=new Set(live.revisions.map(r=>r.revisionId));
 const manifest={format:'fold-local-restore-v1',repairId:'synthetic_fold_repair_001',sourceOrigin,database:L.DATABASE,beforeHistoryHash:await L.historyHash(backup.revisions),afterHistoryHash:await L.historyHash(google.revisions),backupHash:await R.digest(backup),googleSnapshotHash:await R.digest(google),target:{before:f.manifest.targets[0].variants[1],after:f.manifest.targets[0].variants[0],remappedRevisionId:'actual_synthetic_A1'},secondEntryId:f.manifest.targets[1].variants[0].entryId,additionIds:google.revisions.filter(r=>!ids.has(r.revisionId)).map(r=>r.revisionId)};
 return JSON.parse(JSON.stringify({manifest,google,backup,live}));
};
