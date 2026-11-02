/* Scope: this repair tool only. No fetch interception, caching or data writes. */
'use strict';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='FOLD_REPAIR_WINDOWS'||!event.ports[0]||!event.source?.id)return;
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});event.ports[0].postMessage({otherWindows:windows.filter(c=>c.id!==event.source.id).length});})());
});
