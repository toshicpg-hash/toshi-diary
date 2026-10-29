/* Synthetic release validation. Optional MONEY_PREVIOUS_ROOT must be an unmodified 8d6282e archive. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),previous=process.env.MONEY_PREVIOUS_ROOT;
let serving=previous||root,server,browser,offline=false;
const log=[],record=(kind,value)=>log.push({at:Date.now(),kind,value});
async function poll(work,label){const deadline=Date.now()+20000;let result;while(Date.now()<deadline){result=await work();if(result===true)return;await new Promise(r=>setTimeout(r,200));}throw Error(label+' timed out; '+JSON.stringify(result));}
async function appReady(p){await p.waitForFunction(()=>globalThis.HubApp?.canWrite()&&globalThis.HubMoneySync?.state().ready);}
const snapshot=p=>p.evaluate(async()=>JSON.stringify({raw:await HubMoneyStore.raw(),local:Object.entries(localStorage).sort()}));
async function controlledVersion(p,version){await poll(async()=>{const state=await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(),c=navigator.serviceWorker.controller;const state={controller:c?.state,active:r?.active?.state,installing:r?.installing?.state,waiting:r?.waiting?.state};if(!c||c!==r?.active||c.state!=='activated'||r.installing||r.waiting)return state;const reply=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};c.postMessage({kind:'PAPA_HUB_OFFLINE_STATUS'},[channel.port2]);});return {...state,reply,sameController:c===navigator.serviceWorker.controller,sameActive:c===r.active};});record('controller',state);return state.reply?.ok&&state.reply.version===version&&state.reply.core&&state.sameController&&state.sameActive?true:state;},'Activated controller '+version);}
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'hub-offline-worker.js'),'utf8');
 const version=/安全復帰版 (\d+\.\d+\.\d+)/.exec(html)[1];
 for(const ref of ['hub-app-'+version+'.js','hub-money-sync.css?v='+version]){assert(html.includes(ref));assert(worker.includes("'"+ref+"'"));}assert(worker.includes("VERSION='"+version+"'"));
 if(previous)for(const file of ['index.html','hub-app-1.2.38.js','hub-offline.js','hub-offline-worker.js']){const bytes=fs.readFileSync(path.join(previous,file));assert.deepEqual(bytes,execFileSync('git',['show','8d6282e3538098e37a0e8f480fd742899f4fdcf4:'+file],{cwd:root,maxBuffer:2000000}));record('unchangedBaseline',{file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 server=http.createServer((req,res)=>{if(offline)return req.socket.destroy();const name=new URL(req.url,'http://local').pathname,file=path.resolve(serving,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(serving+'/'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');if(serving===root&&process.env.MONEY_RELEASE_DELAY&&name.endsWith('papa-hub-icon-maskable-512.png'))setTimeout(()=>res.end(b),Number(process.env.MONEY_RELEASE_DELAY));else res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext(),errors=[];
 await context.route(url=>url.origin!==base,r=>r.abort());const makePage=async()=>{const p=await context.newPage();p.setDefaultTimeout(20000);p.setDefaultNavigationTimeout(20000);p.on('pageerror',e=>errors.push(e.message));return p;};const original=await makePage();
 await original.addInitScript(()=>{if(!localStorage.getItem('toshi_v5')){localStorage.setItem('toshi_v5',JSON.stringify({items:[],money:[]}));localStorage.setItem('toshi_hub_complete_gate_v1','1');localStorage.setItem('synthetic-preserve','{"unknown":"keep"}');}});
 await original.goto(base);await appReady(original);
 await original.evaluate(async()=>{const C=HubMoneyLedger,device={id:'synthetic-release',name:'SYNTHETIC'},first=await C.seal({format:C.FORMAT,version:1,recordId:'synthetic-release',revisionId:'synthetic-release-r1',parents:[],action:'create',at:'2026-10-29T00:00:00Z',device,value:{kind:'income',title:'Synthetic upgrade',subjectMonth:'2026-10',plannedDate:'2026-10-29',plannedAmount:10,actuals:[],done:false,source:{type:'hub'},businessKey:null,note:''}});await HubMoneyStore.append([first]);const second=await C.change(await HubMoneyStore.state(),{recordId:first.recordId,revisionId:'synthetic-release-r2',parents:[first.revisionId],action:'edit',at:'2026-10-29T00:01:00Z',device,value:{...first.value,note:'Synthetic preserved history'}});await HubMoneyStore.append([second]);await HubMoneySync.render();});
 await controlledVersion(original,previous?'1.2.38':version);const before=await snapshot(original);let p=original;
 if(previous){serving=root;p=await makePage();await p.goto(base);await appReady(p);assert.equal(await original.locator('header .badge').textContent(),'安全復帰版 1.2.38');assert(!original.isClosed());record('oldTabRetained',true);}
 record('candidateOnlineVersion',await p.locator('header .badge').textContent());
 if(previous){
  assert.equal(await snapshot(original),before);assert.equal(await snapshot(p),before);
  // Normal release policy: close every same-origin tab, then open online in the same context.
  for(const tab of context.pages().filter(tab=>new URL(tab.url()).origin===base))await tab.close({runBeforeUnload:true});
  await poll(async()=>context.pages().length===0,'Normal tab closure');record('allOriginTabsClosed',true);
  p=await makePage();await p.goto(base);await appReady(p);
 }
 await controlledVersion(p,version);assert.equal(await snapshot(p),before);
 await p.reload();await appReady(p);await controlledVersion(p,version);assert.equal(await p.locator('header .badge').textContent(),'安全復帰版 '+version);assert.equal(await snapshot(p),before);record('onlineReloadPreserved',true);
 offline=true;await p.reload();await appReady(p);await controlledVersion(p,version);assert.equal(await p.locator('header .badge').textContent(),'安全復帰版 '+version);assert.equal(await snapshot(p),before);record('offlineReloadPreserved',true);

 const cached=await p.evaluate(async version=>{const name='papa-hub-static-'+version,c=await caches.open(name),out=[];for(const file of ['index.html','hub-app-'+version+'.js','hub-money-sync.css?v='+version]){const key=new URL(file,location.href).href,r=await c.match(key);const hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());out.push({name,key,file,sha256:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')});}return out;},version);
 for(const item of cached)assert.equal(item.sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file.split('?')[0]))).digest('hex'));record('cacheBytesMatch',cached);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,version,unchangedOldVersion:previous?'1.2.38':null,normalCloseAndReopen:!!previous,onlineReload:true,offlineReload:true,dataAndHistoryUnchanged:true}));
})().catch(e=>{record('failure',e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server){server.closeAllConnections();server.close();}fs.writeFileSync(process.env.MONEY_RELEASE_LOG||path.join(root,'..','money-release-results.json'),JSON.stringify(log,null,2));});
