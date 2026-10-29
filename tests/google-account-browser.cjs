// Run with Playwright and Chromium. All requests are intercepted; all records
// belong to a fresh browser context and use example.test addresses.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/g,'');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:html}):route.fulfill({status:200,body:''}));
  await page.goto('http://localhost:8123/');
  await page.evaluate(()=>{
   window.GOOGLE_CLIENT_ID='mock-client';window.requests=[];window.auth=[];window.finished=[];window.calendarRuns=0;
   window.connectedEmail='owner@example.test';window.verifyStatus=200;window.remoteRows=[];window.changeBeforeAppend=false;
   window.HubApp={checkWrite(){},canWrite:()=>true,syncCalendar:async()=>{calendarRuns++;await HubGoogle.read('2026-01-01','2026-01-02');return {ok:true};}};
   window.HubProof={begin:async()=>({id:'mock-attempt'}),finish:async(a,s,o)=>finished.push(o),transmissionApproved:()=>true};
   window.google={accounts:{oauth2:{initTokenClient(c){return {requestAccessToken(o){auth.push(o);queueMicrotask(()=>c.callback({access_token:'mock-token',expires_in:3600,scope:'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'}));}};}}}};
   window.fetch=async(url,o={})=>{
    requests.push({url,method:o.method||'GET'});let value;
    if(url.includes('/calendarList/primary'))return {ok:verifyStatus===200,status:verifyStatus,json:async()=>({id:connectedEmail,primary:true,accessRole:'owner'})};
    if(url.includes('/calendarList?'))value={items:[]};
    else if(url.includes('?fields=sheets.properties'))value={sheets:[{properties:{title:'日記履歴',gridProperties:{rowCount:100}}}]};
    else if(url.includes(':append')){remoteRows.push(...JSON.parse(o.body).values);value={};}
    else if(url.includes('/values/')){
     value={values:[ToshiDiaryCore.headers,...remoteRows]};
     if(changeBeforeAppend){changeBeforeAppend=false;HubGoogle.saveAccount('changed@example.test',{confirmed:true});}
    }else throw Error('Unexpected mock URL '+url);
    return {ok:true,status:200,json:async()=>value};
   };
   localStorage.setItem('existing-data','keep');
  });
  for(const file of ['hub-core.js','hub-google.js','diary-core.js','diary-store.js'])await page.addScriptTag({content:read(file)});
  await page.evaluate(async()=>{
   const store=new ToshiDiaryStore();await store.commit([ToshiDiaryCore.create({date:'2026-01-01',body:'Synthetic diary only'},{deviceId:'synthetic-device'})],{deviceId:'synthetic-device',sheet:'synthetic-sheet-1234567890'});
  });
  for(const file of ['diary.js','hub-sync-core.js','hub-sync.js'])await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>{document.dispatchEvent(new Event('diary-activate'));document.getElementById('hubSyncFrom').value='2026-01-01';document.getElementById('hubSyncTo').value='2026-01-02';});
  await page.waitForFunction(()=>HubDiarySync.state().ready);
  await page.evaluate(()=>HubSyncAll.sync());
  assert.deepEqual(await page.evaluate(()=>[auth.length,requests.length,calendarRuns,finished.at(-1).allowSend]),[0,0,0,false]);
  console.log('PASS: unset settings stop calendar, diary and proof transmission');
  await page.locator('#hubGoogleAccountSettings').evaluate(e=>e.open=true);
  await page.locator('#hubGoogleAccountSave').evaluate(e=>e.disabled=false);
  await page.locator('#hubGoogleAccountEmail').fill('owner@example.test');
  page.once('dialog',d=>d.dismiss());await page.locator('#hubGoogleAccountSave').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('toshi_google_sync_account_v1')),null);
  page.once('dialog',d=>d.accept());await page.locator('#hubGoogleAccountSave').click();
  assert.equal(await page.evaluate(()=>HubGoogle.account().email),'owner@example.test');
  console.log('PASS: local account setup needs explicit confirmation; cancel preserves unset state');
  await page.evaluate(()=>HubSyncAll.sync());
  assert.deepEqual(await page.evaluate(()=>[auth[0].prompt,calendarRuns,remoteRows.length,finished.at(-1).allowSend]),['',1,1,true]);
  assert.match(await page.locator('#hubSyncAllStatus').textContent(),/同期が完了/);
  const disk=await page.evaluate(async()=>new ToshiDiaryStore().state());assert.equal(disk.revisions.length,1);
  console.log('PASS: matching combined sync reads calendar and appends/verifies synthetic diary');
  await page.evaluate(()=>{connectedEmail='other@example.test';requests=[];});
  await page.evaluate(()=>HubSyncAll.sync());
  assert.deepEqual(await page.evaluate(()=>[requests.length,calendarRuns,remoteRows.length,finished.at(-1).allowSend]),[1,1,1,false]);
  assert.match(await page.locator('#hubSyncAllStatus').textContent(),/一致しません/);
  console.log('PASS: mismatched account blocks all sync jobs and proof transmission');
  await page.evaluate(()=>{requests=[];});
  await page.evaluate(()=>document.getElementById('diarySync').onclick());
  assert.equal(await page.evaluate(()=>requests.filter(r=>r.url.includes('sheets.googleapis.com')).length),0);
  console.log('PASS: standalone diary sync cannot bypass account mismatch');
  await page.locator('#hubGoogleAccountEmail').fill('changed@example.test');
  page.once('dialog',d=>d.dismiss());await page.locator('#hubGoogleAccountSave').click();
  assert.equal(await page.evaluate(()=>HubGoogle.account().email),'owner@example.test');
  console.log('PASS: cancelling account change retains the existing confirmed setting');
  await page.evaluate(()=>{connectedEmail='owner@example.test';verifyStatus=403;requests=[];});
  await page.evaluate(()=>HubSyncAll.sync());
  assert.deepEqual(await page.evaluate(()=>[requests.length,calendarRuns,remoteRows.length,finished.at(-1).allowSend]),[1,1,1,false]);
  console.log('PASS: failed identity read blocks all sync jobs and proof transmission');
  await page.evaluate(()=>{verifyStatus=200;document.getElementById('hubGoogleAccountSelect').disabled=false;});
  await page.locator('#hubGoogleAccountSelect').click();
  await page.waitForFunction(()=>document.getElementById('hubGoogleAccountStatus').textContent.includes('一致を確認'));
  assert.equal(await page.evaluate(()=>auth.at(-1).prompt),'select_account');
  assert.equal(await page.evaluate(()=>remoteRows.length),1);
  console.log('PASS: explicit account selection verifies without running sync');
  await page.evaluate(async()=>{
   const store=new ToshiDiaryStore();await store.commit([ToshiDiaryCore.create({date:'2026-01-02',body:'Second synthetic diary'},{deviceId:'synthetic-device'})]);
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>document.getElementById('diaryCount').textContent.includes('全体 2件'));
  await page.evaluate(()=>{changeBeforeAppend=true;requests=[];});
  await page.evaluate(()=>HubSyncAll.sync());
  assert.equal(await page.evaluate(()=>requests.filter(x=>x.method==='POST').length),0);
  assert.equal(await page.evaluate(()=>remoteRows.length),1);
  assert.equal(await page.evaluate(async()=>(await new ToshiDiaryStore().state()).revisions.length),2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('existing-data')),'keep');
  console.log('PASS: setting changed after read prevents diary append and preserves all local revisions');
  assert.deepEqual(errors,[]);
  // Smoke-test the actual full candidate bundle and existing safety gate.
  const smoke=await browser.newPage();const smokeErrors=[];smoke.on('pageerror',e=>smokeErrors.push(e.message));
  await smoke.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:html}):route.fulfill({status:200,body:''}));
  await smoke.goto('http://localhost:8124/');await smoke.addScriptTag({content:read(/src="\.\/(hub-app-[^"]+\.js)"/.exec(read('index.html'))[1])});
  await smoke.waitForFunction(()=>!!window.HubSyncAll&&!!window.HubGoogle);
  assert.deepEqual(smokeErrors,[]);
  assert.match(await smoke.locator('#hubGoogleAccountStatus').textContent(),/入力・確認/);
  console.log('PASS: complete candidate bundle initializes with unset identity and no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
