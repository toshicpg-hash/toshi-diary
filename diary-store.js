(function(root){
 'use strict';
 class DiaryStore{
  constructor(name='toshi_diary_v1'){this.name=name;this.db=null;}
  async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const q=indexedDB.open(this.name,1);q.onupgradeneeded=()=>{q.result.createObjectStore('revisions',{keyPath:'revisionId'});q.result.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('日記の保存領域が他の画面で使用中です'));});this.db.onversionchange=()=>{this.db.close();this.db=null;};return this;}
  async state(){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readonly'),a=tx.objectStore('revisions').getAll(),b=tx.objectStore('meta').getAll();tx.oncomplete=()=>{try{resolve({revisions:ToshiDiaryCore.merge(a.result),meta:Object.fromEntries(b.result.map(x=>[x.key,x.value]))});}catch(e){reject(e);}};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('日記の読み取りを中断しました'));});}
  async commit(incoming=[],metadata={}){
   await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(['revisions','meta'],'readwrite'),store=tx.objectStore('revisions'),q=store.getAll();let failure=null;
    q.onsuccess=()=>{try{const merged=ToshiDiaryCore.merge(q.result,incoming),existing=new Set(q.result.map(r=>r.revisionId));for(const r of merged)if(!existing.has(r.revisionId))store.add(r);for(const [key,value] of Object.entries(metadata))tx.objectStore('meta').put({key,value});}catch(e){failure=e;tx.abort();}};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||Error('日記を保存できませんでした'));
   });
  }
 }
 root.ToshiDiaryStore=DiaryStore;
})(globalThis);

