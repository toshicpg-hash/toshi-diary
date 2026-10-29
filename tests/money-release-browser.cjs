/* Fresh local synthetic release/offline test. External requests are blocked. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..');let serving=root,server,browser,offline=false;
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'hub-offline-worker.js'),'utf8');
 const version=/安全復帰版 (\d+\.\d+\.\d+)/.exec(html)[1];
 assert(html.includes('hub-app-'+version+'.js'));assert(html.includes('hub-money-sync.css?v='+version));
 assert(worker.includes("VERSION='"+version+"'"));assert(worker.includes("'hub-app-"+version+".js'"));assert(worker.includes("'hub-money-sync.css?v="+version+"'"));
 server=http.createServer((req,res)=>{if(offline)return req.socket.destroy();const name=new URL(req.url,'http://local').pathname;const file=path.resolve(serving,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(serving+'/'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext(),p=await context.newPage(),errors=[];
 p.setDefaultTimeout(20000);p.setDefaultNavigationTimeout(20000);
 p.on('pageerror',e=>errors.push(e.message));await context.route(url=>url.origin!==base,r=>r.abort());
 await p.addInitScript(()=>{if(!localStorage.getItem('toshi_v5')){localStorage.setItem('toshi_v5',JSON.stringify({items:[],money:[]}));localStorage.setItem('toshi_hub_complete_gate_v1','1');}});
 await p.goto(base);await p.waitForFunction(()=>globalThis.HubApp?.canWrite()&&globalThis.HubMoneySync?.state().ready);
 await p.evaluate(async()=>{const C=HubMoneyLedger;await HubMoneyStore.append([await C.seal({format:C.FORMAT,version:1,recordId:'synthetic-release',revisionId:'synthetic-release-r1',parents:[],action:'create',at:'2026-10-29T00:00:00Z',device:{id:'synthetic',name:'SYNTHETIC'},value:{kind:'income',title:'Synthetic upgrade',subjectMonth:'2026-10',plannedDate:'2026-10-29',plannedAmount:10,actuals:[],done:false,source:{type:'hub'},businessKey:null,note:''}})]);});
 await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const snapshot=()=>p.evaluate(async()=>JSON.stringify({raw:await HubMoneyStore.raw(),local:Object.entries(localStorage).sort()})),before=await snapshot();
 const cacheReady=()=>p.waitForFunction(async version=>{const c=await caches.open('papa-hub-static-'+version);return !!await c.match(new URL('hub-app-'+version+'.js',location.href));},version);
 const activeVersion=()=>p.waitForFunction(async version=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data.version===version&&e.data.core);};navigator.serviceWorker.controller.postMessage({kind:'PAPA_HUB_OFFLINE_STATUS'},[channel.port2]);}),version);

 await p.reload();await p.waitForFunction(()=>globalThis.HubMoneySync?.state().ready);await cacheReady();
 assert.equal(await p.locator('header .badge').textContent(),'安全復帰版 '+version);assert.equal(await snapshot(),before);
 await activeVersion();
 // Leave local traffic to the real worker; simulate loss of the server at its socket.
 offline=true;await p.reload();await p.waitForFunction(()=>globalThis.HubMoneySync?.state().ready);
 assert.equal(await p.locator('header .badge').textContent(),'安全復帰版 '+version);assert.equal(await snapshot(),before);
 assert.equal(await p.evaluate(()=>[...document.scripts].find(s=>/hub-app-/.test(s.src)).src),base+'/hub-app-'+version+'.js');
 assert(await p.evaluate(version=>[...document.styleSheets].some(s=>s.href?.endsWith('hub-money-sync.css?v='+version)),version));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,version,offlineReload:true,syntheticLedgerHistoryAndLocalStorageUnchanged:true}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
