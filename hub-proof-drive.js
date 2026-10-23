(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubProofDrive=api;})(globalThis,function(){
 'use strict';
 const SCOPE='https://www.googleapis.com/auth/drive.file',FOLDER='PAPA HUB 同期確認',TAG='papa-hub-sync-proof-v1';
 const CODES=new Set(['TRANSMISSION_NOT_APPROVED','DIFFERENT_DEVICE','FLIP8_TEST_ONLY','DRIVE_AUTH_REQUIRED','DRIVE_NETWORK_UNCONFIRMED','DRIVE_HTTP_ERROR','DRIVE_RESPONSE_INVALID','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE','GOOGLE_AUTH_UNAVAILABLE','GOOGLE_POPUP_BLOCKED','GOOGLE_POPUP_CLOSED','GOOGLE_AUTH_FAILED','GOOGLE_ACCESS_DENIED','GOOGLE_INVALID_SCOPE','GOOGLE_AUTH_RESPONSE_INVALID','GOOGLE_ACCOUNT_REQUIRED','GOOGLE_ACCOUNT_MISMATCH','GOOGLE_ACCOUNT_VERIFY_FAILED','GOOGLE_ACCOUNT_UNVERIFIED','GOOGLE_ACCOUNT_READ_REQUIRED']);
 const STAGES={LOCAL:'端末内の確認',AUTH:'Google接続',FOLDER_SEARCH:'保存先の検索',FOLDER_ID:'保存先の準備',FOLDER_READ:'保存先の確認',FOLDER_CREATE:'保存先の作成',FOLDER_VERIFY:'保存先の非公開確認',RECORD_ID:'確認記録の準備',RECORD_READ:'確認記録の照合',RECORD_UPLOAD:'確認記録の送信',RECORD_VERIFY:'送信後の読み戻し',DRIVE:'Driveへの接続'};
 const REASONS=new Set(['SERVICE_DISABLED','accessNotConfigured','insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT','PERMISSION_DENIED','forbidden','appNotAuthorizedToFile','rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','storageQuotaExceeded','quotaExceeded','badRequest','invalid','notFound','authError']);
 function diagnostic(error,fallback='DRIVE'){
  return {code:CODES.has(error?.code)?error.code:'UNCONFIRMED',stage:Object.hasOwn(STAGES,error?.stage)?error.stage:Object.hasOwn(STAGES,fallback)?fallback:'DRIVE',status:Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:null,reason:REASONS.has(error?.reason)?error.reason:null};
 }
 function describe(error,fallback){
  const d=diagnostic(error,fallback);let message='送信テストを完了したか確認できません。';
  if(d.reason==='SERVICE_DISABLED'||d.reason==='accessNotConfigured')message='Google側でDrive APIが有効になっていません。接続設定の確認が必要です。';
  else if(['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(d.reason)||d.code==='DRIVE_AUTH_REQUIRED')message='確認記録を保存するためのGoogle権限を確認できません。';
  else if(d.code==='GOOGLE_POPUP_BLOCKED')message='Googleの接続画面がブラウザに止められました。';
  else if(d.code==='GOOGLE_POPUP_CLOSED')message='Googleの接続画面が閉じられ、接続を完了できませんでした。';
  else if(d.code==='GOOGLE_ACCESS_DENIED')message='Googleの接続が許可されていません。';
  else if(d.code==='GOOGLE_AUTH_UNAVAILABLE')message='Googleの認証機能を読み込めていません。';
  else if(d.code==='GOOGLE_INVALID_SCOPE')message='Googleの権限要求が受け付けられませんでした。接続設定の確認が必要です。';
  else if(d.code.startsWith('GOOGLE_ACCOUNT_'))message='本人設定と接続アカウントを確認できないため送信を停止しました。ホームの同期用Googleアカウントを確認してください。';
  else if(d.code==='FOLDER_NOT_PRIVATE')message='本人だけの非公開フォルダと確認できません。';
  else if(d.code==='FOLDER_AMBIGUOUS')message='専用フォルダが複数あるため、保存先を確定できません。';
  else if(d.code==='DRIVE_NETWORK_UNCONFIRMED')message='Driveとの通信を確認できません。';
  else if(d.status===403)message='Google側でこの操作が許可されませんでした。';
  else if(d.status===401)message='Google接続の有効期限を確認できません。';
  return {diagnostic:d,message,detail:'止まった段階：'+STAGES[d.stage]+'。確認コード：'+[d.stage,d.code,d.status?'HTTP'+d.status:null,d.reason].filter(Boolean).join(' / ')};
 }
 async function responseReason(response){
  // Only provider enums are retained. Never expose raw messages, request URLs,
  // resource names, tokens, stack traces or arbitrary response fields.
  try{const value=await response.json(),error=value?.error;
   const reasons=[...(Array.isArray(error?.details)?error.details.slice(0,20).map(x=>x?.reason):[]),...(Array.isArray(error?.errors)?error.errors.slice(0,20).map(x=>x?.reason):[]),error?.status];
   return reasons.find(x=>REASONS.has(x))||null;
  }catch{return null;}
 }
 function create({approved,authorize,store,core,fetch:request=globalThis.fetch,beforeRequest=async()=>true}){
  const running=new Map();
  const failure=(code,status,stage,reason)=>Object.assign(Error(code),{code,status,stage,reason});
  function send(record){
   // Approval is checked before auth, database changes or any network request.
   if(approved()!==true)return Promise.reject(failure('TRANSMISSION_NOT_APPROVED'));
   core.validate(record);if(running.has(record.attemptId))return running.get(record.attemptId);
   const work=execute(record);running.set(record.attemptId,work);work.finally(()=>running.delete(record.attemptId)).catch(()=>{});return work;
  }
  async function session(){
   if(approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
   let grant;try{grant=await authorize();}catch(error){throw failure(CODES.has(error?.code)?error.code:'GOOGLE_AUTH_FAILED',undefined,'AUTH');}
   if(typeof grant?.access_token!=='string'||!grant.access_token||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now()||!String(grant.scope||'').split(/\s+/).includes(SCOPE))throw failure('DRIVE_AUTH_REQUIRED',undefined,'AUTH');
   if(typeof grant.assertValid!=='function')throw failure('GOOGLE_ACCOUNT_UNVERIFIED',undefined,'AUTH');
   grant.assertValid();
   const api=async(path,options={},stage='DRIVE')=>{
    if(approved()!==true||await beforeRequest()!==true||approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
    grant.assertValid();
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
    try{let r;try{r=await request('https://www.googleapis.com/'+path,{...options,cache:'no-store',signal:c.signal,headers:{...options.headers,Authorization:'Bearer '+grant.access_token}});}catch{throw failure('DRIVE_NETWORK_UNCONFIRMED',undefined,stage);}
     if(!r.ok)throw failure('DRIVE_HTTP_ERROR',r.status,stage,await responseReason(r));try{return await r.json();}catch{throw failure('DRIVE_RESPONSE_INVALID',undefined,stage);}
    }finally{clearTimeout(timer);}
   };
   return api;
  }
  const privateFile=(f,type)=>!!f&&f.mimeType===type&&f.ownedByMe===true&&f.shared===false&&f.trashed!==true&&Array.isArray(f.permissions)&&f.permissions.length===1&&f.permissions[0].type==='user'&&f.permissions[0].role==='owner';
  const fields='id,name,mimeType,ownedByMe,shared,trashed,permissions(type,role),parents,appProperties';
  async function discover(api){
   const matches=[];let page='';do{const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='papaHubProof' and value='"+TAG+"' }";
    const list=await api('drive/v3/files?'+new URLSearchParams({q,spaces:'drive',fields:'nextPageToken,files(id)',pageSize:'100',...(page?{pageToken:page}:{})}),{},'FOLDER_SEARCH');matches.push(...(list.files||[]));page=list.nextPageToken||'';
   }while(page);
   if(matches.length>1)throw failure('FOLDER_AMBIGUOUS',undefined,'FOLDER_SEARCH');return matches[0]?.id||null;
  }
  async function setup(){
   if(approved()!==true)throw failure('TRANSMISSION_NOT_APPROVED');
   const device=await store.settings();if(device?.name!=='Flip8')throw failure('FLIP8_TEST_ONLY');
   const api=await session();let folder=(await store.deliveryState('folder'))?.fileId;
   if(!folder){const found=await discover(api);let candidate=found;
    if(!candidate){const generated=await api('drive/v3/files/generateIds?count=1&space=drive&type=files',{},'FOLDER_ID');candidate=generated.ids?.[0];if(typeof candidate!=='string'||!candidate)throw failure('FILE_ID_MISSING',undefined,'FOLDER_ID');}
    folder=await store.reserveFile('folder',candidate);
   }
   if(typeof folder!=='string'||!folder)throw failure('FOLDER_INVALID');
   const read=()=>api('drive/v3/files/'+encodeURIComponent(folder)+'?fields='+encodeURIComponent(fields),{},'FOLDER_READ');let fm;
   try{fm=await read();}catch(e){if(e.status!==404)throw e;
    // Only this explicit setup step may create a folder. A pre-reserved ID
    // makes uncertain completion/retries and concurrent tabs idempotent.
    try{await api('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:folder,name:FOLDER,mimeType:'application/vnd.google-apps.folder',parents:['root'],appProperties:{papaHubProof:TAG}})},'FOLDER_CREATE');}catch(error){if(error.status!==409)throw error;}
    fm=await read();
   }
   if(fm.id!==folder||fm.name!==FOLDER||!privateFile(fm,'application/vnd.google-apps.folder')||fm.appProperties?.papaHubProof!==TAG)throw failure('FOLDER_NOT_PRIVATE',undefined,'FOLDER_VERIFY');
   await store.delivery('folder',{fileId:folder,state:'confirmed'});if((await store.deliveryState('folder'))?.fileId!==folder)throw failure('LOCAL_DELIVERY_READBACK_FAILED');
   return {ok:true,folderId:folder};
  }
  async function execute(record){
   const device=await store.settings();if(device?.deviceId!==record.device.id)throw failure('DIFFERENT_DEVICE');
   const api=await session();
   const meta=(id,stage)=>api('drive/v3/files/'+encodeURIComponent(id)+'?fields='+encodeURIComponent(fields),{},stage);
   try{
    let folder=(await store.deliveryState('folder'))?.fileId;
    if(!folder){folder=await discover(api);
     // Folder setup is a separate, explicitly approved, single-device step.
     // A retry never creates a destination implicitly (including across devices).
     if(!folder)throw failure('FOLDER_NOT_CONFIGURED');
    }
    if(typeof folder!=='string'||!folder)throw failure('FOLDER_INVALID');
    const fm=await meta(folder,'FOLDER_READ');if(!privateFile(fm,'application/vnd.google-apps.folder')||fm.appProperties?.papaHubProof!==TAG)throw failure('FOLDER_NOT_PRIVATE',undefined,'FOLDER_VERIFY');await store.delivery('folder',{fileId:folder});
    let delivery=await store.deliveryState(record.attemptId),id=delivery?.fileId;
    if(!id){const generated=await api('drive/v3/files/generateIds?count=1&space=drive&type=files',{},'RECORD_ID');const candidate=generated.ids?.[0];if(typeof candidate!=='string'||!candidate)throw failure('FILE_ID_MISSING',undefined,'RECORD_ID');id=await store.reserveFile(record.attemptId,candidate);if((await store.deliveryState(record.attemptId))?.fileId!==id)throw failure('LOCAL_DELIVERY_READBACK_FAILED',undefined,'LOCAL');}
    async function existing(){try{const m=await meta(id,'RECORD_READ');if(!privateFile(m,'application/json')||!m.parents?.includes(folder)||m.appProperties?.attemptId!==record.attemptId||m.appProperties?.deviceId!==record.device.id||m.appProperties?.papaHubProof!==TAG)throw failure('REMOTE_RECORD_IDENTITY_MISMATCH',undefined,'RECORD_READ');const actual=await api('drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{},'RECORD_VERIFY');core.validate(actual);if(core.canonical(actual)!==core.canonical(record))throw failure('REMOTE_RECORD_READBACK_MISMATCH',undefined,'RECORD_VERIFY');return true;}catch(e){if(e.status===404)return false;throw e;}}
    if(!await existing()){
     const boundary='papa_hub_'+crypto.randomUUID(),metadata={id,name:'PAPA-HUB-'+record.device.name+'-'+record.attemptId+'.json',mimeType:'application/json',parents:[folder],appProperties:{papaHubProof:TAG,attemptId:record.attemptId,deviceId:record.device.id}};
     const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(record)+'\r\n--'+boundary+'--\r\n';
     if(new TextEncoder().encode(body).length>4*1024*1024)throw failure('RECORD_TOO_LARGE');
     try{await api('upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body},'RECORD_UPLOAD');}catch(e){if(e.status!==409)throw e;}
     if(!await existing())throw failure('REMOTE_RECORD_NOT_FOUND');
    }
    await store.delivery(record.attemptId,{fileId:id,state:'confirmed',confirmedAt:new Date().toISOString(),errorCode:null});
    return {ok:true,fileId:id};
   }catch(e){await store.delivery(record.attemptId,{state:'pending',errorCode:['TRANSMISSION_NOT_APPROVED','FOLDER_AMBIGUOUS','FOLDER_NOT_CONFIGURED','FOLDER_INVALID','FOLDER_NOT_PRIVATE','FILE_ID_MISSING','LOCAL_DELIVERY_READBACK_FAILED','REMOTE_RECORD_IDENTITY_MISMATCH','REMOTE_RECORD_READBACK_MISMATCH','REMOTE_RECORD_NOT_FOUND','RECORD_TOO_LARGE'].includes(e.code)?e.code:'DRIVE_SEND_UNCONFIRMED'}).catch(()=>{});throw e;}
  }
  return {send,setup};
 }
 return {SCOPE,FOLDER,create,diagnostic,describe};
});
