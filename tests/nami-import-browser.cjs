/* 1.2.45 ナミ取込：一覧の「ナミ取込」の印と「未確認 n件」。架空のデータだけ。外への通信と Service Worker は止める。 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const root=path.join(__dirname,'..');let server,browser;
(async()=>{
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname;if(name==='/seed.html')return res.end('<!doctype html>');const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:390,height:1000},locale:'ja-JP',serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await p.goto(base+'/seed.html');await p.evaluate(()=>{localStorage.setItem('toshi_v5',JSON.stringify({items:[],money:[]}));localStorage.setItem('toshi_hub_complete_gate_v1','1');localStorage.setItem('toshi_google_sync_from_v1','2020-01-01');});
 await p.goto(base);await p.waitForFunction(()=>HubApp?.canWrite()&&HubMoneySync?.state().ready);
 const month=await p.evaluate(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).slice(0,7));
 await p.evaluate(async month=>{const C=HubMoneyLedger,at='2026-11-05T00:00:00Z',v=(kind,title,amount,source,key)=>({kind,title,subjectMonth:null,plannedDate:month+'-15',plannedAmount:amount,actuals:[],done:false,source,businessKey:key,note:''});
  const events=[await C.seal({format:C.FORMAT,version:1,recordId:'hub-1',revisionId:'r:hub-1',parents:[],action:'create',at,device:{id:'synthetic-flip',name:'Flip8'},value:v('payment','合成：端末で入れた支払',100,{type:'hub'},null)}),
   await C.seal({format:C.FORMAT,version:1,recordId:'nami:n-001',revisionId:'import:n-001',parents:[],action:'create',at,device:{id:'nami',name:'ナミ'},reason:'ナミ取込（トシさん確認済み）',value:v('payment','合成：ナミが取り込んだ支払',300,{type:'nami-import',importId:'n-001',approvedAt:'2026-11-05T09:00:00+09:00',approvedNote:'会話で確認（架空）'},'nami:n-001')})];
  await HubMoneyStore.append(events);await HubMoneySync.render();},month);
 const snapshot=()=>p.evaluate(async()=>JSON.stringify(await HubMoneyStore.raw())),before=await snapshot();
 await p.locator('.hub-nav [data-panel=money]').click();await p.locator('#moneyShowLedger').evaluate(e=>{let n=e.parentElement;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}});await p.locator('#moneyShowLedger').click();await p.locator('#moneySettings').evaluate(e=>{e.open=false;e.querySelectorAll('details').forEach(d=>d.open=false);});
 const nami=p.locator('[data-money-record="nami:n-001"]'),hub=p.locator('[data-money-record="hub-1"]');
 assert.match(await nami.locator('.badge.money-nami').textContent(),/ナミ取込/);assert.match(await nami.innerText(),/取込ID n-001｜取込承認日時/);
 assert.equal(await hub.locator('.money-nami').count(),0,'other records have no Nami mark');
 const notice=p.locator('#moneyNamiNotice');assert.equal(await notice.isVisible(),true);assert.match(await notice.textContent(),/この端末で未確認 1件/);
 assert.match(await p.locator('#moneyLedgerSummary').textContent(),/出金 ¥400/,'the Nami record is in the totals');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('#moneyLedgerView').screenshot({path:path.join(process.env.MONEY_TEST_OUTPUT||require('node:os').tmpdir(),'nami-import-390.png')});
 const seen=nami.locator('.money-nami-seen');assert((await seen.boundingBox()).height>=44);await seen.click();
 assert.match(await notice.textContent(),/この端末で未確認 0件/);assert.match(await nami.innerText(),/この端末で確認済み/);assert.equal(await nami.locator('.money-nami-seen').count(),0);assert.match(await p.locator('#moneyLedgerSummary').textContent(),/出金 ¥400/,'totals unchanged');
 assert.equal(await snapshot(),before,'the mark never changes the ledger or its history');
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('papa_money_nami_seen_v1'))),['nami:n-001']);
 await p.reload();await p.waitForFunction(()=>HubApp?.canWrite()&&HubMoneySync?.state().ready);await p.locator('.hub-nav [data-panel=money]').click();await p.locator('#moneyShowLedger').evaluate(e=>{let n=e.parentElement;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}});await p.locator('#moneyShowLedger').click();
 assert.match(await p.locator('[data-money-record="nami:n-001"]').innerText(),/この端末で確認済み/,'seen mark kept on this device');

 // A local mark does not become a shared acknowledgement. Simulate another device's empty mark store.
 await p.evaluate(()=>localStorage.removeItem('papa_money_nami_seen_v1'));await p.evaluate(()=>HubMoneySync.render());
 assert.match(await nami.innerText(),/この端末で未確認/);
 // A failed local write must never claim success.
 await p.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='papa_money_nami_seen_v1')throw new Error('synthetic quota');return window.originalSetItem.call(this,k,v);};});
 await nami.locator('.money-nami-seen').click();assert.match(await nami.innerText(),/この端末で未確認/);
 await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
 // The discovery list includes records outside current month and settlement filters.
 await p.locator('#moneySubjectMonth').fill('2000-01');await p.locator('#moneySubjectMonth').dispatchEvent('change');
 assert.equal(await nami.count(),0);
 await notice.locator('summary').click();await notice.getByRole('button',{name:'合成：ナミが取り込んだ支払の記録を開く',exact:true}).click();
 assert.equal(await p.locator('#moneySubjectMonth').inputValue(),month);
 assert.equal(await p.locator('#moneySettlementFilter').inputValue(),'all');assert.equal(await p.locator('#moneyKindFilter').inputValue(),'all');
 assert.equal(await nami.isVisible(),true);
 for(const width of [320,390,822]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert((await nami.locator('.money-nami-seen').boundingBox()).height>=44);await p.locator('#moneyLedgerView').screenshot({path:'/tmp/nami-clarity-'+width+'.png'});}
 assert.equal(await snapshot(),before,'discovery and failed acknowledgement preserve all history');

 await p.evaluate(async()=>{const C=HubMoneyLedger;for(const [id,date,done] of [['past','2020-02-29',true],['undated',null,false]]){const e=await C.seal({format:C.FORMAT,version:1,recordId:'nami:'+id,revisionId:'import:'+id,parents:[],action:'create',at:'2026-11-05T00:00:00Z',device:{id:'synthetic',name:'架空'},value:{kind:'income',title:'合成：'+id,subjectMonth:null,plannedDate:date,plannedAmount:0,actuals:[],done,source:{type:'nami-import',importId:id,approvedAt:'2026-11-05T00:00:00Z'},businessKey:'nami:'+id,note:''}});await HubMoneyStore.append([e]);}await HubMoneySync.render();});
 const expanded=await snapshot();
 for(const [id,expectedMonth] of [['past','2020-02'],['undated','']]){
  await notice.locator('details').evaluate(e=>e.open=true);await notice.getByRole('button',{name:'合成：'+id+'の記録を開く',exact:true}).click();
  assert.equal(await p.locator('#moneySubjectMonth').inputValue(),expectedMonth);assert.equal(await p.locator('[data-money-record="nami:'+id+'"]').isVisible(),true);
 }
 assert.equal(await snapshot(),expanded,'settled and undated discovery preserves data');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,syntheticOnly:true,checks:['Nami mark and import ID/approval on the record','unseen count notice','included in totals','seen mark is device-only and leaves ledger/history unchanged','kept after reload','320/390/822px no horizontal overflow, 44px button','local storage failure stays unseen','all-period discovery opens past settled and undated records without modifying history']}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
