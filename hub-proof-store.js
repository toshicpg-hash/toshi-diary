(function(root){
 'use strict';
 const NAME='papa_hub_sync_proof_v1';
 class ProofStore{
  constructor(idb=root.indexedDB){this.idb=idb;}
  async open(create=false){
   if(!create&&typeof this.idb.databases==='function'&&!(await this.idb.databases()).some(x=>x.name===NAME))return null;
   return new Promise((resolve,reject)=>{const q=this.idb.open(NAME,1);let absent=false;
    q.onupgradeneeded=()=>{if(!create){absent=true;q.transaction.abort();return;}for(const name of ['settings','attempts','delivery'])q.result.createObjectStore(name,{keyPath:'id'});};
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>absent?resolve(null):reject(q.error);q.onblocked=()=>reject(Error('確認記録の保存領域を開けません'));
   });
  }
  async transaction(names,mode,work,create=false){const db=await this.open(create);if(!db)return null;try{return await new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let value,error;
   const fail=e=>{error=e;tx.abort();};try{work(tx,x=>{value=x},fail);}catch(e){fail(e);}
   tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(error||tx.error||Error('確認記録を保存できません'));
  });}finally{db.close();}}
  async settings(){return await this.transaction(['settings'],'readonly',(tx,done)=>{const q=tx.objectStore('settings').get('device');q.onsuccess=()=>done(q.result||null);})||null;}
  async register(name){
   if(!['Flip8','Fold8'].includes(name))throw Error('この端末を選択してください');
   const row=await this.transaction(['settings'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('settings'),q=s.get('device');q.onsuccess=()=>{if(q.result){if(q.result.name!==name){fail(Error('登録済みの端末名は変更できません。別端末の記録と混在させません'));return;}done(q.result);return;}const value={id:'device',deviceId:crypto.randomUUID(),name,sequence:0};s.add(value);done(value);};},true);
   if(JSON.stringify(await this.settings())!==JSON.stringify(row))throw Error('端末登録の読み戻しを確認できません');return row;
  }
  async begin(appVersion){return this.transaction(['settings','attempts'],'readwrite',(tx,done)=>{const s=tx.objectStore('settings'),q=s.get('device');q.onsuccess=()=>{const device=q.result;if(!device){done(null);return;}device.sequence++;s.put(device);const attempt={id:crypto.randomUUID(),device:{id:device.deviceId,name:device.name},sequence:device.sequence,appVersion,startedAt:new Date().toISOString(),record:null};tx.objectStore('attempts').add(attempt);done(attempt);};});}
  async finish(attempt,states){const record=HubProofCore.make({attemptId:attempt.id,device:attempt.device,sequence:attempt.sequence,appVersion:attempt.appVersion,startedAt:attempt.startedAt,finishedAt:new Date().toISOString(),states});
   await this.transaction(['attempts'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('attempts'),q=s.get(attempt.id);q.onsuccess=()=>{const before=q.result;if(!before||before.device.id!==record.device.id||before.startedAt!==record.startedAt||before.sequence!==record.sequence){fail(Error('確認記録の対応が変わりました'));return;}if(before.record&&HubProofCore.canonical(before.record)!==HubProofCore.canonical(record)){fail(Error('確定済みの確認記録は変更しません'));return;}s.put({...before,record});done();};});
   const saved=await this.get(attempt.id);if(HubProofCore.canonical(saved?.record)!==HubProofCore.canonical(record))throw Error('確認記録の読み戻しが一致しません');return record;
  }
  async get(id){return this.transaction(['attempts'],'readonly',(tx,done)=>{const q=tx.objectStore('attempts').get(id);q.onsuccess=()=>done(q.result||null);});}
  async rows(){return await this.transaction(['attempts'],'readonly',(tx,done)=>{const q=tx.objectStore('attempts').getAll();q.onsuccess=()=>done(q.result.sort((a,b)=>b.sequence-a.sequence));})||[];}
  async delivery(id,patch){return this.transaction(['delivery'],'readwrite',(tx,done,fail)=>{const s=tx.objectStore('delivery'),q=s.get(id);q.onsuccess=()=>{if(q.result?.fileId&&patch.fileId&&q.result.fileId!==patch.fileId){fail(Error('送信先の予約IDは変更しません'));return;}const value={...(q.result||{id}),...patch,id};s.put(value);done(value);};});}
  async reserveFile(id,candidate){return this.transaction(['delivery'],'readwrite',(tx,done)=>{const s=tx.objectStore('delivery'),q=s.get(id);q.onsuccess=()=>{if(q.result?.fileId){done(q.result.fileId);return;}s.put({...(q.result||{id}),fileId:candidate,state:'pending'});done(candidate);};});}
  async deliveryState(id){return this.transaction(['delivery'],'readonly',(tx,done)=>{const q=tx.objectStore('delivery').get(id);q.onsuccess=()=>done(q.result||null);});}
 }
 root.HubProofStore=ProofStore;
})(globalThis);
