(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubProofDrive=api;})(globalThis,function(){
 'use strict';
 const SCOPE='https://www.googleapis.com/auth/drive.file',FOLDER='PAPA HUB 同期確認',TAG='papa-hub-sync-proof-v1';
 function create({approved,authorize,store,core,fetch:request=globalThis.fetch}){
  const running=new Map();
  const failure=(code,status)=>Object.assign(Error(code),{code,status});
  function send(record){
   // Approval is checked before auth, database changes or any network request.
   if(approved()!==true)return Promise.reject(failure('TRANSMISSION_NOT_APPROVED'));
   core.validate(record);if(running.has(record.attemptId))return running.get(record.attemptId);
   const work=execute(record);running.set(record.attemptId,work);work.finally(()=>running.delete(record.attemptId)).catch(()=>{});return work;
  }
  async function execute(record){
   const device=await store.settings();if(device?.deviceId!==record.device.id)throw failure('DIFFERENT_DEVICE');
   const grant=await authorize();if(typeof grant?.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes(SCOPE))throw failure('DRIVE_AUTH_REQUIRED');
   const api=async(path,options={})=>{
    if(approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
    try{let r;try{r=await request('https://www.googleapis.com/'+path,{...options,cache:'no-store',signal:c.signal,headers:{...options.headers,Authorization:'Bearer '+grant.access_token}});}catch{throw failure('DRIVE_NETWORK_UNCONFIRMED');}
     if(!r.ok)throw failure('DRIVE_HTTP_ERROR',r.status);try{return await r.json();}catch{throw failure('DRIVE_RESPONSE_INVALID');}
    }finally{clearTimeout(timer);}
   };
   const privateFile=(f,type)=>!!f&&f.mimeType===type&&f.ownedByMe===true&&f.shared===false&&f.trashed!==true&&Array.isArray(f.permissions)&&f.permissions.length===1&&f.permissions[0].type==='user'&&f.permissions[0].role==='owner';
   const fields='id,mimeType,ownedByMe,shared,trashed,permissions(type,role),parents,appProperties';
   const meta=id=>api('drive/v3/files/'+encodeURIComponent(id)+'?fields='+encodeURIComponent(fields));
   try{
    let folder=(await store.deliveryState('folder'))?.fileId;
    if(!folder){const matches=[];let page='';do{const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='papaHubProof' and value='"+TAG+"' }";
     const list=await api('drive/v3/files?'+new URLSearchParams({q,spaces:'drive',fields:'nextPageToken,files(id)',pageSize:'100',...(page?{pageToken:page}:{})}));matches.push(...(list.files||[]));page=list.nextPageToken||'';
    }while(page);
     if(matches.length>1)throw failure('FOLDER_AMBIGUOUS');folder=matches[0]?.id;
     // Folder setup is a separate, explicitly approved, single-device step.
     // A retry never creates a destination implicitly (including across devices).
     if(!folder)throw failure('FOLDER_NOT_CONFIGURED');
    }
    if(typeof folder!=='string'||!folder)throw failure('FOLDER_INVALID');
    const fm=await meta(folder);if(!privateFile(fm,'application/vnd.google-apps.folder')||fm.appProperties?.papaHubProof!==TAG)throw failure('FOLDER_NOT_PRIVATE');await store.delivery('folder',{fileId:folder});
    let delivery=await store.deliveryState(record.attemptId),id=delivery?.fileId;
    if(!id){const generated=await api('drive/v3/files/generateIds?count=1&space=drive&type=files');const candidate=generated.ids?.[0];if(typeof candidate!=='string'||!candidate)throw failure('FILE_ID_MISSING');id=await store.reserveFile(record.attemptId,candidate);if((await store.deliveryState(record.attemptId))?.fileId!==id)throw failure('LOCAL_DELIVERY_READBACK_FAILED');}
    async function existing(){try{const m=await meta(id);if(!privateFile(m,'application/json')||!m.parents?.includes(folder)||m.appProperties?.attemptId!==record.attemptId||m.appProperties?.deviceId!==record.device.id||m.appProperties?.papaHubProof!==TAG)throw failure('REMOTE_RECORD_IDENTITY_MISMATCH');const actual=await api('drive/v3/files/'+encodeURIComponent(id)+'?alt=media');core.validate(actual);if(core.canonical(actual)!==core.canonical(record))throw failure('REMOTE_RECORD_READBACK_MISMATCH');return true;}catch(e){if(e.status===404)return false;throw e;}}
    if(!await existing()){
     const boundary='papa_hub_'+crypto.randomUUID(),metadata={id,name:'PAPA-HUB-'+record.device.name+'-'+record.attemptId+'.json',mimeType:'application/json',parents:[folder],appProperties:{papaHubProof:TAG,attemptId:record.attemptId,deviceId:record.device.id}};
     const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(record)+'\r\n--'+boundary+'--\r\n';
     if(new TextEncoder().encode(body).length>4*1024*1024)throw failure('RECORD_TOO_LARGE');
     try{await api('upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});}catch(e){if(e.status!==409)throw e;}
     if(!await existing())throw failure('REMOTE_RECORD_NOT_FOUND');
    }
    await store.delivery(record.attemptId,{fileId:id,state:'confirmed',confirmedAt:new Date().toISOString(),errorCode:null});
    return {ok:true,fileId:id};
   }catch(e){await store.delivery(record.attemptId,{state:'pending',errorCode:['TRANSMISSION_NOT_APPROVED','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE'].includes(e.code)?e.code:'DRIVE_SEND_UNCONFIRMED'}).catch(()=>{});throw e;}
  }
  return {send};
 }
 return {SCOPE,FOLDER,create};
});
