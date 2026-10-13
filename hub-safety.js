(function(root){
'use strict';
const keys=storage=>{const result=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&key.startsWith('toshi_'))result.push(key);}return result.sort();};
function localSnapshot(storage){return keys(storage).map(key=>[key,storage.getItem(key)]);}
async function capture(){const local=localSnapshot(localStorage),diary=await DiarySafety.capture(indexedDB,location.origin);if(JSON.stringify(local)!==JSON.stringify(localSnapshot(localStorage)))throw Error('他の画面でHUBが更新されました。閉じてからやり直してください。');return {format:'toshi-hub-safety-backup',version:1,sourceOrigin:location.origin,createdAt:new Date().toISOString(),localStorage:local,diary};}
function same(a,b){return a?.format==='toshi-hub-safety-backup'&&b?.format===a.format&&a.version===1&&b.version===1&&a.sourceOrigin===b.sourceOrigin&&JSON.stringify(a.localStorage)===JSON.stringify(b.localStorage)&&DiarySafety.sameData(a.diary,b.diary);}
const hasData=s=>s.localStorage.some(([k,v])=>!['toshi_hub_safe_gate_v1','toshi_diary_clean_app_ready_v1'].includes(k)&&v!==null)||DiarySafety.hasData(s.diary);
root.HubSafety={capture,same,hasData,localSnapshot};
})(globalThis);
