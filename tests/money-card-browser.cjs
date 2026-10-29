/* Synthetic records only; all non-local requests blocked. No real account or ledger. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.env.MONEY_TEST_ROOT||path.join(__dirname,'..'),baseline=process.env.MONEY_TEST_BASELINE==='1';
const output=process.env.MONEY_TEST_OUTPUT||path.join(root,'..','money-card-results');
let server,browser;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname;if(name==='/seed.html')return res.end('<!doctype html>');const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'}),errors=[],network=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>{if(r.request().url().startsWith(base))return r.continue();network.push(r.request().url());return r.abort();});
 await p.goto(base+'/seed.html');await p.evaluate(()=>{localStorage.setItem('toshi_v5',JSON.stringify({items:[],money:[]}));localStorage.setItem('toshi_hub_complete_gate_v1','1');});
 await p.goto(base);await p.waitForFunction(()=>HubApp?.canWrite()&&HubMoneySync?.state().ready);
 await p.evaluate(async()=>{
  const C=HubMoneyLedger,device={id:'synthetic-card',name:'SYNTHETIC'},events=[];
  for(const [key,done,month] of [['pending',false,'2026-10'],['settled',true,'2026-10'],['unknown',false,null]]){
   events.push(await C.seal({format:C.FORMAT,version:1,recordId:'synthetic-'+key+'-'+('abcdefghij'.repeat(6)),revisionId:'r:'+key,parents:[],action:'create',at:'2026-10-29T00:00:00Z',device,value:{kind:'income',title:key==='settled'?'合成：消込済み':'合成：長い件名で入出金カードの折返しと操作領域を確認するためのテスト記録',subjectMonth:month,plannedDate:'2026-10-20',plannedAmount:1200,actuals:[{id:'a:'+key,date:'2026-10-21',amount:1200,evidence:{status:'reported',note:'synthetic',ref:''}}],done,source:{type:'hub'},businessKey:null,note:''}}));
  }
  await HubMoneyStore.append(events);await HubMoneyStore.putMeta('config',{enabled:true,owner:'synthetic@example.invalid',sheetId:'synthetic_sheet_not_real_12345',ledgerId:'synthetic-ledger'});await HubMoneySync.render();
 });
 await p.locator('.hub-nav [data-panel=money]').click();await p.locator('#moneyShowLedger').evaluate(e=>{let n=e.parentElement;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}});await p.locator('#moneyShowLedger').click();await p.locator('#moneySettings').evaluate(e=>{e.open=false;e.querySelectorAll('details').forEach(d=>d.open=false);});
 await p.locator('#moneySubjectMonth').fill('2026-10');await p.locator('#moneySubjectMonth').dispatchEvent('change');await p.locator('#moneySettlementFilter').selectOption('all');
 const snapshot=()=>p.evaluate(async()=>JSON.stringify({raw:await HubMoneyStore.raw(),local:Object.entries(localStorage).sort()})),before=await snapshot();
 const pending=p.locator('#moneyLedgerRows article').first(),settled=p.locator('#moneyLedgerRows article').nth(1),metrics=[];
 for(const width of [280,320,360,390,822]){
  await p.setViewportSize({width,height:1000});
  const measure=()=>p.locator('#moneyLedgerRows article').evaluateAll(es=>es.map(e=>({cardHeight:e.getBoundingClientRect().height,buttons:[...e.querySelectorAll('.actions button')].map(b=>{const r=b.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(b);return {text:b.textContent,width:r.width,height:r.height,top:r.top,lines:range.getClientRects().length};})})));
  const cards=await measure();metrics.push({width,cards});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow at '+width);
  if(!baseline){for(const c of cards){assert(c.buttons.every(b=>b.width>=44&&b.height>=44&&b.lines===1));assert(c.buttons.every(b=>b.top===c.buttons[0].top));}assert.deepEqual(cards[0].buttons.map(b=>b.text),['編集','実績','消込']);assert.equal(cards[1].buttons[2].text,'消込取消');}
  await pending.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(output,'cards-'+width+'.png')});
  for(const card of [pending,settled]){
   const details=card.locator('details');assert(!await details.evaluate(e=>e.open));
   const id=card.locator('p').filter({hasText:/^記録ID /});if(!baseline)assert(!await id.isVisible());
   await details.locator('summary').focus();await p.keyboard.press('Enter');assert(await details.evaluate(e=>e.open));assert(await id.isVisible());
   assert.equal(await id.textContent(),'記録ID '+await card.getAttribute('data-money-record'));
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'open details overflow');
   await details.locator('summary').click();assert(!await details.evaluate(e=>e.open));
  }
 }
 // Unknown-month cards use exactly the same compact renderer.
 await p.locator('#moneyLedgerUnassigned>summary').click();if(!baseline)assert.equal(await p.locator('#moneyLedgerUnassignedRows .money-record-actions').count(),1);
 await p.locator('#moneyLedgerUnassigned>summary').click();await p.setViewportSize({width:320,height:1000});
 for(const card of [pending,settled])for(const [name,field] of [['編集','#moneyPlannedFields'],['実績を追記','#moneyActualFields']]){
  await card.getByRole('button',{name,exact:true}).click();assert(await p.locator('#moneyLedgerEditor').isVisible());assert(await p.locator(field).isVisible());
  if(!baseline)assert(await p.locator('#moneyLedgerEditor').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'editor overflow');
  p.once('dialog',d=>d.dismiss());await p.locator('#moneyEditorClose').click();assert(await p.locator('#moneyLedgerEditor').isVisible());
  p.once('dialog',d=>d.accept());await p.keyboard.press('Escape');assert(!await p.locator('#moneyLedgerEditor').isVisible());
 }
 for(const [card,name,type] of [[pending,'消込済みにする','confirm'],[settled,'消込を取り消す','prompt']]){
  const dialogPromise=new Promise(resolve=>p.once('dialog',async d=>{assert.equal(d.type(),type);await d.dismiss();resolve();}));await card.getByRole('button',{name,exact:true}).click();await dialogPromise;
 }
 assert.equal(await snapshot(),before,'details and canceled operations must not change data');assert.deepEqual(errors,[]);
 assert(!network.some(u=>/sheets.googleapis.com|www.googleapis.com/.test(u)),'no ledger or auth API request');
 const report={passed:true,baseline,syntheticOnly:true,metrics,checks:['pending/settled/long title','280/320/360/390/822 widths','44px targets and single line (candidate)','ID details keyboard open/close','editor close canceled then Escape confirmed','settle/reopen dialogs canceled','raw ledger/history/localStorage unchanged','external network blocked']};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
