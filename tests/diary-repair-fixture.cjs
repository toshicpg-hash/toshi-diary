'use strict';
// Entirely fictional fixture; never substitute private data in this repository.
const C=require('../diary-core.js');
function record(id,body){return C.validate({revisionId:id,entryId:'entry_'+id,parents:[],date:'2030-01-01',title:'Fictional test',body,people:'Fictional person',golfGood:'',golfImprove:'',golfNext:'',createdAt:'2030-01-01T00:00:00Z',updatedAt:'2030-01-01T00:00:00Z',source:'synthetic',deviceId:'device_synthetic'});}
module.exports=function(){
 const baseline=Array.from({length:86},(_,i)=>record('baseline_'+String(i).padStart(3,'0'),'Synthetic baseline '+i));
 const a=[0,1].map(i=>({...record('target_A00','Fictional A'+i),updatedAt:`2030-01-01T00:0${i}:00Z`}));
 const b=[0,1,2,3,4].map(i=>({...record('target_B00','Fictional B'+i),updatedAt:`2030-01-01T00:0${i}:00Z`}));
 const sources=[{name:'device_one',kind:'device',snapshot:{revisions:[...baseline,a[0]],meta:{draft:{body:'Old fictional draft'},opaque:'keep'},other:{money:['untouched'],calendar:['untouched']}}},{name:'device_two',kind:'device',snapshot:{revisions:[...baseline,a[1],b[0]],meta:{draft:null},other:{opaque:'unchanged'}}},{name:'google_copy',kind:'google',snapshot:{revisions:[...baseline,a[1],b[4]],headers:C.headers,other:{opaque:'unchanged'}}}];
 const manifest={format:'papa-diary-private-repair-v1',repairId:'synthetic_repair_001',targets:[{revisionId:a[0].revisionId,variants:a,replacementIds:['repaired_A01']},{revisionId:b[0].revisionId,variants:b,replacementIds:[1,2,3,4].map(i=>'repaired_B0'+i)}],baseline,sources};
 return JSON.parse(JSON.stringify({manifest,current:Object.fromEntries(sources.map(s=>[s.name,s.snapshot]))}));
};
