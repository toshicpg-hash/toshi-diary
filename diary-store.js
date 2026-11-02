(function(root){
 'use strict';
 function repairGate(meta){const a=meta.limitedRepairArchive,j=meta.limitedRepairJournal;if(a||j){if(!a||a.format!=='fold-local-repair-archive-v1'||!j||j.format!=='fold-local-repair-journal-v1'||j.phase!=='verified')throw Error('日記の限定修復は読戻し確認待ちです。専用修復画面で同じ計画を再開してください');}}
 class DiaryStore{
  constructor(name='toshi_diary_v1'){this.name=name;this.db=null;this.invalidated=false;}
  async open(){if(this.invalidated)throw Error('日記保存領域が切り替わりました。画面を再読み込みしてください');if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const q=indexedDB.open(this.name);q.onupgradeneeded=()=>{q.result.createObjectStore('revisions',{keyPath:'revisionId'});q.result.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>{if(![1,2].includes(q.result.version)){q.result.close();reject(Error('未対応の日記保存領域です'));return;}resolve(q.result);};q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('日記の保存領域が他の画面で使用中です'));});this.db.onversionchange=()=>{this.db.close();this.db=null;this.invalidated=true;};return this;}
  async state(){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readonly'),a=tx.objectStore('revisions').getAll(),b=tx.objectStore('meta').getAll();tx.oncomplete=()=>{try{const meta=Object.fromEntries(b.result.map(x=>[x.key,x.value]));repairGate(meta);resolve({revisions:ToshiDiaryCore.merge(a.result),meta});}catch(e){reject(e);}};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('日記の読み取りを中断しました'));});}
  async commit(incoming=[],metadata={}){
   await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readwrite'),store=tx.objectStore('revisions'),q=store.getAll(),m=tx.objectStore('meta').getAll();let failure=null;
    m.onsuccess=()=>{try{repairGate(Object.fromEntries(m.result.map(x=>[x.key,x.value])));if(Object.keys(metadata).some(k=>['limitedRepairArchive','limitedRepairJournal'].includes(k)))throw Error('修復記録は通常保存では変更できません');const merged=ToshiDiaryCore.merge(q.result,incoming),existing=new Set(q.result.map(r=>r.revisionId));for(const r of merged)if(!existing.has(r.revisionId))store.add(r);for(const [key,value] of Object.entries(metadata))tx.objectStore('meta').put({key,value});}catch(e){failure=e;tx.abort();}};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||Error('日記を保存できませんでした'));
   });
  }
 }
 root.ToshiDiaryStore=DiaryStore;
})(globalThis);

