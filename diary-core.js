/* Append-only private journal protocol, shared by HUB and the Nami connector. */
(function(root){
 'use strict';
 const keys=['revisionId','entryId','parents','date','title','body','people','golfGood','golfImprove','golfNext','createdAt','updatedAt','source','deviceId'];
 const headers=['revision_id','entry_id','parent_revision_ids','event_date','title','body','people','golf_good','golf_improve','golf_next','created_at','updated_at','source','device_id'];
 const idPattern=/^[A-Za-z0-9_-]{8,100}$/;
 function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
 function validate(record){
  if(!record||typeof record!=='object')throw Error('日記データの形式が違います');
  const r={};
  for(const k of keys){if(k==='parents')continue;if(typeof record[k]!=='string')throw Error('日記の項目が不足しています：'+k);r[k]=record[k];}
  if(!idPattern.test(r.revisionId)||!idPattern.test(r.entryId)||!idPattern.test(r.deviceId))throw Error('日記IDの形式が違います');
  if(!Array.isArray(record.parents)||record.parents.length>100||record.parents.some(p=>typeof p!=='string'||!idPattern.test(p)||p===r.revisionId))throw Error('編集履歴の形式が違います');
  r.parents=[...new Set(record.parents)].sort();
  if(!validDate(r.date))throw Error('出来事の日付を確認してください');
  for(const k of ['createdAt','updatedAt'])if(!/^\d{4}-\d{2}-\d{2}T/.test(r[k])||!Number.isFinite(Date.parse(r[k])))throw Error('入力・更新日時の形式が違います');
  if(Date.parse(r.updatedAt)<Date.parse(r.createdAt))throw Error('更新日時が入力日時より前です');
  for(const k of ['title','body','people','golfGood','golfImprove','golfNext'])if(r[k].length>(k==='title'?300:k==='people'?1000:20000))throw Error('日記の文字数が上限を超えています');
  if(r.source.length>60||![r.title,r.body,r.golfGood,r.golfImprove,r.golfNext].some(v=>v.trim()))throw Error('一言でも入力してください');
  return Object.fromEntries(keys.map(k=>[k,r[k]]));
 }
 function canonical(r){return JSON.stringify(validate(r));}
 function merge(...groups){
  const records=new Map();
  for(const group of groups){if(!Array.isArray(group))throw Error('日記一覧の形式が違います');for(const raw of group){const r=validate(raw),old=records.get(r.revisionId);if(old&&canonical(old)!==canonical(r))throw Error('同じ履歴IDに違う内容があります。元の記録を保持し、同期を停止しました');records.set(r.revisionId,r);}}
  // Validate lineage without relying on device clocks or last-write-wins.
  const remaining=new Map(),children=new Map(),queue=[];
  for(const r of records.values()){
   remaining.set(r.revisionId,r.parents.length);if(!r.parents.length)queue.push(r.revisionId);
   for(const id of r.parents){const p=records.get(id);if(!p||p.entryId!==r.entryId)throw Error('親の編集履歴が不足しています。バックアップ全体を復元してください');if(!children.has(id))children.set(id,[]);children.get(id).push(r.revisionId);}
  }
  for(let i=0;i<queue.length;i++)for(const id of children.get(queue[i])||[]){remaining.set(id,remaining.get(id)-1);if(remaining.get(id)===0)queue.push(id);}
  if(queue.length!==records.size)throw Error('編集履歴が循環しています');
  return [...records.values()];
 }
 function heads(records){const superseded=new Set(records.flatMap(r=>r.parents));return records.filter(r=>!superseded.has(r.revisionId));}
 function conflicts(records){const groups=new Map();for(const r of heads(records)){if(!groups.has(r.entryId))groups.set(r.entryId,[]);groups.get(r.entryId).push(r);}return [...groups.values()].filter(g=>g.length>1);}
 function toRow(raw){const r=validate(raw);return keys.map(k=>k==='parents'?JSON.stringify(r.parents):r[k]);}
 function fromRows(rows){
  if(!Array.isArray(rows)||headers.some((h,i)=>rows[0]?.[i]!==h))throw Error('日記台帳の列構成が違います。専用台帳を選んでください');
  return rows.slice(1).filter(row=>row.some(v=>v!==''&&v!=null)).map((row,i)=>{try{if(row.some(v=>v!=null&&typeof v!=='string'))throw Error('文字列以外の項目');const r=Object.fromEntries(keys.map((k,j)=>[k,k==='parents'?JSON.parse(row[j]||'[]'):row[j]||'']));return validate(r);}catch(e){throw Error('台帳'+(i+2)+'行目：'+e.message);}});
 }
 function create(fields,{base=null,parents=null,deviceId,now=new Date().toISOString(),source='hub',uuid=()=>crypto.randomUUID()}={}){
  return validate({revisionId:uuid(),entryId:base?.entryId||uuid(),parents:parents|| (base?[base.revisionId]:[]),date:fields.date,title:fields.title||'',body:fields.body||'',people:fields.people||'',golfGood:fields.golfGood||'',golfImprove:fields.golfImprove||'',golfNext:fields.golfNext||'',createdAt:base?.createdAt||now,updatedAt:Date.parse(now)<Date.parse(base?.createdAt||now)?base.createdAt:now,source,deviceId});
 }
 function search(records,{month='',query='',ascending=false}={}){const q=query.normalize('NFKC').toLocaleLowerCase();return heads(records).filter(r=>(!month||r.date.slice(0,7)===month)&&(!q||[r.title,r.body,r.people,r.golfGood,r.golfImprove,r.golfNext].join('\n').normalize('NFKC').toLocaleLowerCase().includes(q))).sort((a,b)=>(ascending?1:-1)*a.date.localeCompare(b.date)||b.updatedAt.localeCompare(a.updatedAt));}
 function backup(records,draft=null){return {format:'toshi-hub-diary',schemaVersion:1,exportedAt:new Date().toISOString(),revisions:merge(records),draft};}
 function restore(value){if(value?.format!=='toshi-hub-diary'||value.schemaVersion!==1||!Array.isArray(value.revisions))throw Error('HUB日記のバックアップではありません');return merge(value.revisions);}
 function related(items,date){return {events:items.filter(x=>x.type==='event'&&x.date<=date&&(x.endDate||x.date)>=date),completed:items.filter(x=>x.type==='todo'&&x.done&&x.completedDate===date),unknown:items.filter(x=>x.type==='todo'&&x.done&&!x.completedDate&&(x.end||x.start||x.date)===date)};}
 const api={keys,headers,validDate,validate,canonical,merge,heads,conflicts,toRow,fromRows,create,search,backup,restore,related};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ToshiDiaryCore=api;
})(typeof globalThis==='object'?globalThis:this);

