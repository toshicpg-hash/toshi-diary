'use strict';
// Isolated Chromium DB only. Never opens the user's live browser profile.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const arg=process.argv[2];let input;
 if(arg==='--synthetic')input=await require('../tests/diary-local-repair-fixture.cjs')();
 else {if(!arg||!path.isAbsolute(arg)||path.resolve(arg).startsWith(root+path.sep))throw Error('Use --synthetic or an absolute private path outside the checkout');input=JSON.parse(fs.readFileSync(arg,'utf8'));}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{const ctx=await browser.newContext(),page=await ctx.newPage();await ctx.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated copy test</title>'}):route.abort());await page.goto('https://isolated-fold-copy.example.test/');
 for(const file of ['diary-core.js','diary-repair.js','diary-local-repair.js','diary-store.js'])await page.addScriptTag({path:path.join(root,file)});
 const result=await page.evaluate(async f=>{
  const L=FoldLocalRepair,C=ToshiDiaryCore,assert=(v)=>{if(!v)throw Error('Copy assertion failed');};
  await new Promise((resolve,reject)=>{const q=indexedDB.open(L.DATABASE,1);q.onupgradeneeded=()=>{q.result.createObjectStore('revisions',{keyPath:'revisionId'});q.result.createObjectStore('meta',{keyPath:'key'});};q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction(['revisions','meta'],'readwrite');for(const r of f.live.revisions)tx.objectStore('revisions').add(r);for(const [key,value] of Object.entries(f.live.meta))tx.objectStore('meta').add({key,value});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  const a=L.createAdapter({assertSolo:async()=>{},sourceOrigin:f.manifest.sourceOrigin});
  const p=await a.inspect(f.manifest,f.google,f.backup),options={backupReadback:JSON.parse(JSON.stringify(p.archive)),confirmedPlanId:p.planId,stoppedWriters:true};
  await a.apply(f.manifest,f.google,f.backup,options);const first=await a.read();await a.apply(f.manifest,f.google,f.backup,options);const second=await a.read();assert(JSON.stringify(first)===JSON.stringify(second));assert(first.state.revisions.length===94);assert(C.merge(first.state.revisions,f.google.revisions).length===94);
  for(const [key,value] of Object.entries(f.live.meta))assert(JSON.stringify(first.state.meta[key])===JSON.stringify(value));assert(C.canonical(first.state.meta[L.ARCHIVE].mapping.original)===C.canonical(f.manifest.target.before));
  const store=new ToshiDiaryStore();await store.commit(f.google.revisions);assert((await store.state()).revisions.length===94);store.db.close();
  return {copyAdapterVerified:true,revisions:94,idempotent:true,originalRetained:true,liveMetadataValuesRetained:true,normalMergeVerified:true,realDevice:false,googleNetwork:false};
 },input);console.log(JSON.stringify(result));await ctx.close();
 }finally{await browser.close();}
})().catch(()=>{console.error('Copy verification failed. Private input details were not printed. Check the manifest, backup, snapshot and explicit live metadata in the private workspace.');process.exitCode=1;});
