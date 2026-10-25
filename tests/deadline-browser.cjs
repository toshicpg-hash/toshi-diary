const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),C=require('../hub-core.js'),calendar={id:'synthetic-calendar',summary:'TASK',accessRole:'owner'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/seed.html')return res.end('<!doctype html>');const f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b)});});
const event=(id,date,original)=>({id,summary:'【ToDo】合成の月次作業',etag:'"v1"',status:'confirmed',start:{date},end:{date:C.addDays(date,1)},originalStartTime:{date:original},recurringEventId:'synthetic-series',description:'keep original',htmlLink:'https://calendar.google.com/calendar/event?eid=synthetic-'+id,extendedProperties:{private:{toshiHubType:'todo',toshiHubDone:'false',toshiHubStart:original,toshiHubDeadlineDate:original,toshiHubEnd:original,toshiHubDeadlineTime:'15:30',unknown:'keep'},shared:{other:'keep'}}});
const events=[event('synthetic-october','2026-10-26','2026-10-25'),event('synthetic-april','2027-04-26','2027-04-25'),event('synthetic-july','2027-07-26','2027-07-25'),event('synthetic-saturday','2027-09-25','2027-09-25')];
const rows=events.map(e=>C.fromGoogle(e,calendar)),key=C.key(rows[0]),legacy={items:[],money:[],unknown:'keep-original'},overlay={...C.parseOverlay(null),google:rows,unknown:'keep-overlay',history:[{kind:'existing-history',value:'keep'}]};
overlay.edits[key]={deadlineDate:'2026-10-25',end:'2026-10-25',done:false,title:'合成の月次作業',scheduledDate:'2026-10-25',unknown:{keep:true}};overlay.edits[C.key(rows[3])]={title:'土曜の合成作業',unknown:'keep-other'};
const report=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const scenario of [{width:320},{width:390},{width:822},{width:390,mode:'one-only'},{width:390,mode:'save-fail'},{width:390,mode:'readback-fail'},{width:390,mode:'etag-412'},{width:390,mode:'account-change'},{width:390,mode:'concurrent-local'}]){
   const {width,mode='happy'}=scenario,ctx=await browser.newContext({viewport:{width,height:850},isMobile:true,hasTouch:true,timezoneId:'Asia/Tokyo',serviceWorkers:'block'}),remote=new Map(events.map(e=>[e.id,structuredClone(e)])),calls=[],errors=[];let patched=false;
   await ctx.route(/^https:/,r=>r.abort());
   await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:'/* mock Google OAuth */'}));
   await ctx.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient(o){return {requestAccessToken(){queueMicrotask(()=>o.callback({access_token:'SYNTHETIC-ONLY',expires_in:3600,scope:o.scope}))}}}}}};});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await ctx.route('https://www.googleapis.com/calendar/v3/**',async route=>{
    const req=route.request(),u=new URL(req.url()),method=req.method();calls.push({path:u.pathname,method});let value;
    if(u.pathname.includes('/calendarList/primary'))value={id:'owner@example.test',primary:true,accessRole:'owner'};
    else if(u.pathname.endsWith('/calendarList'))value={items:[calendar]};
    else if(u.pathname.endsWith('/instances'))value={items:[...remote.values()]};
    else if(u.pathname.endsWith('/events'))value={items:[...remote.values()]};
    else{
     const id=decodeURIComponent(u.pathname.split('/').at(-1)),current=remote.get(id);assert.ok(current,'Unexpected ID '+id);
     if(method==='PATCH'){
      assert.equal(req.headers()['if-match'],current.etag);const patch=req.postDataJSON();assert.deepEqual(Object.keys(patch),['extendedProperties']);assert.deepEqual(Object.keys(patch.extendedProperties),['private']);
      assert.equal(await page.evaluate(id=>HubApp.overlay().history.some(h=>h.kind==='previous-google-event'&&h.eventId===id),id),true);
      if(mode==='etag-412')return route.fulfill({status:412,contentType:'application/json',body:JSON.stringify({error:{message:'synthetic conflict'}})});
      const next={...current,etag:'"v2"',extendedProperties:{...current.extendedProperties,private:patch.extendedProperties.private}};remote.set(id,next);patched=true;value=next;
     }else{
      value=current;
      if(mode==='readback-fail'&&patched)value={...current,extendedProperties:{...current.extendedProperties,private:{...current.extendedProperties.private,toshiHubDeadlineDate:'2026-10-25'}}};
     }
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
   });
   await page.goto(origin+'/seed.html');await page.evaluate(({legacy,overlay})=>{localStorage.setItem('toshi_v5',JSON.stringify(legacy));localStorage.setItem('toshi_hub_safe_v1',JSON.stringify(overlay));localStorage.setItem('toshi_hub_complete_gate_v1','1');localStorage.setItem('toshi_google_sync_account_v1',JSON.stringify({version:1,email:'owner@example.test',confirmed:true,revision:'synthetic-setting'}));},{legacy,overlay});
   await page.goto(origin+'/#work');await page.waitForFunction(()=>HubApp.canWrite());
   const target=()=>page.locator('#hubWorkRows article[data-item-key="'+key+'"]');
   assert.match(await target().textContent(),/期限 2026-10-25/);assert.equal(calls.length,0);
   await target().getByRole('button',{name:'期限をGoogleと照合'}).click();
   const dialog=page.locator('dialog[open]');await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] p')].some(x=>x.textContent==='内容を確認し、修正する発生分を選んでください。'));
   assert.equal(await dialog.locator('input[type=checkbox]').count(),3);assert.equal(await dialog.locator('input[type=checkbox]:checked').count(),3);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(calls.some(x=>x.method!=='GET'),false);
   if(width===390&&mode==='happy')await page.screenshot({path:path.join(root,'../deadline-audit-390.png'),fullPage:true});
   if(mode==='one-only'){await dialog.locator('input[type=checkbox]').nth(1).uncheck();await dialog.locator('input[type=checkbox]').nth(2).uncheck();}
   if(mode==='save-fail')await page.evaluate(()=>{HubApp.verifyCalendarReadback=async()=>{throw Error('synthetic history readback failed')}});
   if(mode==='account-change')await page.evaluate(()=>{const save=HubApp.commit;HubApp.commit=async(kind,work)=>{const result=await save(kind,work);if(kind==='deadline-before-update')HubGoogle.saveAccount('changed@example.test',{confirmed:true});return result;};});
   if(mode==='concurrent-local')await page.evaluate(key=>HubApp.commit('synthetic-other-edit',next=>{next.edits[key].title='concurrent local title'}),key);
   await dialog.getByRole('button',{name:'選択した期限を整合する'}).click();
   if(mode==='happy'||mode==='one-only'){
    const count=mode==='one-only'?1:3;await page.waitForFunction(n=>[...document.querySelectorAll('dialog[open] p')].some(x=>x.textContent.startsWith(n+'件の期限をGoogleで読み戻し')),count);
    assert.equal(calls.filter(x=>x.method==='PATCH').length,count);
    const saved=await page.evaluate(()=>HubApp.overlay());assert.equal(saved.history[0].kind,'existing-history');assert.ok(saved.history.some(x=>x.kind==='previous-deadline-edit'&&x.value.deadlineDate==='2026-10-25'));
    assert.deepEqual(saved.edits[key],{...overlay.edits[key],deadlineDate:'2026-10-26',end:'2026-10-26'});assert.deepEqual(saved.edits[C.key(rows[3])],overlay.edits[C.key(rows[3])]);
    assert.equal(saved.google.length,4);assert.equal(saved.unknown,'keep-overlay');assert.equal(await page.evaluate(()=>localStorage.getItem('toshi_v5')),JSON.stringify(legacy));
    for(let i=0;i<count;i++){const original=events[i],changed=remote.get(original.id);assert.equal(changed.id,original.id);assert.equal(changed.summary,original.summary);assert.deepEqual(changed.start,original.start);assert.deepEqual(changed.end,original.end);assert.equal(changed.extendedProperties.private.toshiHubDone,'false');assert.equal(changed.extendedProperties.private.unknown,'keep');assert.equal(changed.extendedProperties.private.toshiHubDeadlineDate,original.start.date);assert.equal(changed.extendedProperties.private.toshiHubEnd,original.start.date);assert.deepEqual(changed.extendedProperties.shared,original.extendedProperties.shared);}
    assert.deepEqual(remote.get('synthetic-saturday'),events[3]);
    if(mode==='one-only'){assert.deepEqual(remote.get('synthetic-april'),events[1]);assert.deepEqual(remote.get('synthetic-july'),events[2]);}
    await dialog.getByRole('button',{name:'閉じる',exact:true}).click();assert.match(await target().textContent(),/期限 2026-10-26/);
    await page.evaluate(()=>HubApp.navigate('calendar'));await page.locator('#hubYear').selectOption('2026');await page.locator('#hubMonthNumber').selectOption('10');await page.locator('#hubWeekView').click();
    for(let i=0;i<4;i++)await page.locator('#hubNext').click();
    assert.match(await page.locator('#hubCalendar [data-date="2026-10-26"] article[data-item-key="'+key+'"]').textContent(),/期限 2026-10-26/);
    if(mode==='happy')for(const [month,id]of [['2027-04','synthetic-april'],['2027-07','synthetic-july']]){
     await page.locator('#hubYear').selectOption(month.slice(0,4));await page.locator('#hubMonthNumber').selectOption(String(Number(month.slice(5,7))));for(let i=0;i<4;i++)await page.locator('#hubNext').click();
     const k='google:synthetic-calendar:'+id;assert.match(await page.locator('#hubCalendar [data-date="'+month+'-26"] article[data-item-key="'+k+'"]').textContent(),new RegExp('期限 '+month+'-26'));
    }
    await page.evaluate(()=>HubApp.navigate('work'));await page.evaluate(async()=>{const a=document.getElementById('hubSyncFrom'),b=document.getElementById('hubSyncTo');a.value='2026-10-01';b.value='2027-10-31';const r=await HubApp.syncCalendar();if(!r.ok)throw Error(r.message)});
    await page.reload();await page.waitForFunction(()=>HubApp.canWrite());assert.match(await target().textContent(),/期限 2026-10-26/);assert.equal(await page.evaluate(()=>HubApp.items().filter(x=>x.googleId==='synthetic-october').length),1);assert.equal(await page.evaluate(()=>HubApp.items().find(x=>x.googleId==='synthetic-october').done),false);
   }else{
    await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] p')].some(x=>x.textContent.includes('残りは完了していません')));
    const saved=await page.evaluate(()=>HubApp.overlay());assert.equal(saved.edits[key].deadlineDate,'2026-10-25');assert.deepEqual(saved.edits[C.key(rows[3])],overlay.edits[C.key(rows[3])]);
    assert.equal(calls.filter(x=>x.method==='PATCH').length,['etag-412','readback-fail'].includes(mode)?1:0);
   }
   assert.ok(calls.every(x=>['GET','PATCH'].includes(x.method)));assert.deepEqual(errors,[]);report.push({width,mode,passed:true});await ctx.close();
  }
  fs.writeFileSync(path.join(root,'../deadline-browser-results.json'),JSON.stringify({passed:true,scenarios:report,actualGoogleMutations:false,actualPhones:false},null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
