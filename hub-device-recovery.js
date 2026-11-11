/* Immutable device recovery protocol. No credentials or financial history in manifests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubDeviceRecovery=api;})(globalThis,function(){
'use strict';
const FORMAT='papa-device-recovery-v1',fail=m=>{throw Error(m);},copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('控えに未対応の項目があります');};
async function hash(bytes){const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function validate(m){
 exact(m,['format','id','owner','deviceName','createdAt','settings','assets','counts','fingerprint']);
 if(m.format!==FORMAT||!id(m.id)||!stamp(m.createdAt)||!['Fold8','Flip8'].includes(m.deviceName)||typeof m.owner!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.owner))fail('控えの形式・本人・端末を確認できません');
 exact(m.settings,['diarySheetId','moneySheetId','calendarFrom','calendarTo']);
 if(!id(m.settings.diarySheetId)||!id(m.settings.moneySheetId)||!/^\d{4}-\d{2}-\d{2}$/.test(m.settings.calendarFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(m.settings.calendarTo)||m.settings.calendarFrom>m.settings.calendarTo)fail('復元先の台帳・カレンダー期間が不正です');
 if(!Array.isArray(m.assets)||m.assets.length>20000)fail('資料一覧の上限を確認してください');const keys=new Set();
 for(const a of m.assets){exact(a,['id','kind','payloadHash','blobHashes']);if(!id(a.id)||keys.has(a.id)||!['board','receipt'].includes(a.kind)||!hex(a.payloadHash)||!Array.isArray(a.blobHashes)||a.blobHashes.some(h=>!hex(h)))fail('資料の識別子・ハッシュが不正です');keys.add(a.id);}
 exact(m.counts,['board','receipt']);for(const kind of ['board','receipt'])if(m.counts[kind]!==m.assets.filter(a=>a.kind===kind).length)fail('控えの件数が一致しません');
 return m;
}
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
async function seal(input){const m=copy(input);delete m.fingerprint;validate(m);return {...m,fingerprint:await hash(JSON.stringify(m))};}
async function verify(m){validate(m);if(!hex(m.fingerprint)||(await seal(m)).fingerprint!==m.fingerprint)fail('控えの内容がハッシュと一致しません');return m;}
function privacy(meta,owner){if(!meta||meta.trashed||meta.shared!==false||meta.owners?.length!==1||meta.owners[0].emailAddress?.toLowerCase()!==owner.toLowerCase()||!Array.isArray(meta.permissions)||meta.permissions.length!==1||meta.permissions[0].role!=='owner'||meta.permissions[0].emailAddress?.toLowerCase()!==owner.toLowerCase())fail('本人だけの非共有の控えを確認できません');}
function reduction(previous,next){if(previous.owner!==next.owner||previous.deviceName!==next.deviceName)fail('別の本人・端末の控えです');const ids=new Set(next.assets.map(a=>a.id));if(previous.assets.some(a=>!ids.has(a.id)))fail('前の控えより資料が減っています。以前の控えを保持し送信を停止しました');}
/* Adapters must implement read-only inspection, append-only local staging, and
   explicit read-only cloud restore. A normal bidirectional sync is never used. */
function create({cloud,local,onProgress=()=>{}}){let busy=false;async function locked(fn){if(busy)fail('控え・復元の処理中です');busy=true;try{return await fn();}finally{busy=false;}}
 async function backup(input,objects){return locked(async()=>{
  const m=await seal(input);if(await local.hasUnsentEdits())fail('未送信の編集があります。控えを完全とは扱いません');
  const prior=await cloud.list(m.owner,m.deviceName);for(const p of prior){privacy(p.meta,m.owner);const old=await verify(await cloud.getManifest(p.id));reduction(old,m);}
  await cloud.beginBackup();
  const expected=new Set(m.assets.flatMap(a=>[a.payloadHash,...a.blobHashes]));let n=0;
  for(const h of expected){const bytes=await objects(h);if(await hash(bytes)!==h)fail('資料原本のハッシュが一致しません');await cloud.putObject(h,bytes,m.owner);if(await hash(await cloud.getObject(h,m.owner))!==h)fail('資料の読み戻しが一致しません');onProgress({phase:'backup',completed:++n,total:expected.size});}
  // Fixed manifest ID: unknown POST outcomes are inspected before any retry.
  const existing=await cloud.findManifest(m.id,m.owner);let file;
  if(existing){privacy(existing.meta,m.owner);if(!same(await cloud.getManifest(existing.id),m))fail('同じ控えIDに別の内容があります');file=existing;}
  else{try{file=await cloud.putManifest(m);}catch(e){const found=await cloud.findManifest(m.id,m.owner);if(!found)throw Error('控え保存の結果不明。元のIDで読み戻してください');file=found;}}
  privacy(file.meta,m.owner);if(!same(await verify(await cloud.getManifest(file.id)),m))fail('控えの読み戻しを確認できません');await local.recordBackup({id:m.id,fileId:file.id,fingerprint:m.fingerprint});return {ok:true,id:m.id,fileId:file.id};
 });}
 async function preview(fileId,owner){const meta=await cloud.metadata(fileId);privacy(meta,owner);const m=await verify(await cloud.getManifest(fileId));if(m.owner!==owner)fail('接続本人と控えが違います');return {manifest:m,local:await local.inspect(),fileId};}
 async function restore(plan,{confirmed=false}={}){return locked(async()=>{
  if(!confirmed)fail('選んだ控えの本人確認が必要です');const fresh=await preview(plan.fileId,plan.manifest.owner);
  if(!same(fresh.manifest,plan.manifest)||!same(fresh.local,plan.local))fail('確認後に控えまたは端末が変わりました');
  // Never overwrite live data. Keep a separate archive even when stopping.
  const resuming=!fresh.local.empty&&await local.resumeAllowed?.(fresh.manifest,fresh.local);
  if(!fresh.local.empty&&!resuming){await local.archiveCurrent();fail('端末に記録があります。別保管しました。自動上書きせず照合が必要です');}
  const m=fresh.manifest,expected=new Set(m.assets.flatMap(a=>[a.payloadHash,...a.blobHashes]));
  if(!resuming)await local.begin(m);let n=0;
  for(const h of expected){const bytes=await cloud.getObject(h,m.owner);if(await hash(bytes)!==h)fail('原本不足または内容不一致。復元完了ではありません');await local.stage(h,bytes);onProgress({phase:'download',completed:++n,total:expected.size});}
  // Local adapter keeps a durable journal and is idempotent. Identity and send
  // consent are newly assigned, never copied from the old device.
  if(!resuming)await local.apply(m);await local.verifyApplied(m);
  const results=[];for(const kind of ['calendar','diary','money']){const r=await local.readCloud(kind,m);results.push({kind,...r});if(r?.ok===true)await local.recordProgress?.(m);if(r?.ok!==true)fail(kind+'の読戻しが未完了です。復元済みの内容と控えを保持しています');}
  await local.finish(m);return {ok:true,results,cloudWrites:0,deviceDisplayVerified:false};
 });}
 return {backup,preview,restore,busy:()=>busy};
}
return {FORMAT,hash,seal,verify,validate,privacy,reduction,create};
});
