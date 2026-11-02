'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),fixture=require('./diary-repair-fixture.cjs');
const root=path.resolve(__dirname,'..'),R=require('../diary-repair.js');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const ctx=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],outside=[];
 page.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.continue();outside.push(r.request().url());return r.abort();});
 await page.goto(base+'/tools/diary-repair/index.html');
 const {manifest,current}=fixture(),plan=await R.dryRun(manifest,current);
 const upload=(id,value)=>page.locator('#'+id).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
 assert(await page.locator('#execute').isDisabled());await upload('manifest',manifest);await upload('current',current);await page.locator('#dry').click();await page.waitForFunction(()=>!document.getElementById('backup').disabled);
 assert((await page.locator('#summary').textContent()).includes(plan.planId));
 const backupEvent=page.waitForEvent('download');await page.locator('#backup').click();const downloadedArchive=JSON.parse(fs.readFileSync(await (await backupEvent).path(),'utf8'));assert.deepEqual(downloadedArchive,plan.archive);
 await page.locator('#execute').click();assert.match(await page.locator('#summary').textContent(),/内容確認/);
 await page.locator('#review').check();await page.locator('#execute').click();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('ファイル'));assert.match(await page.locator('#summary').textContent(),/ファイル/);
 await upload('readback',downloadedArchive);await page.locator('#confirmation').fill('wrong');await page.locator('#execute').click();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('confirmation'));
 await page.locator('#confirmation').fill(plan.planId);const event=page.waitForEvent('download');await page.locator('#execute').click();const download=await event;const output=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.deepEqual(output.copies,plan.copies);assert.equal(output.status.googleSaved,false);
 // New input invalidates the reviewed plan. Cancel also clears files and gates.
 await upload('current',current);assert(await page.locator('#execute').isDisabled());await page.locator('#dry').click();await page.waitForFunction(()=>!document.getElementById('backup').disabled);await page.locator('#cancel').click();assert(await page.locator('#execute').isDisabled());assert.equal(await page.locator('#manifest').inputValue(),'');
 assert.deepEqual(await page.evaluate(async()=>({local:localStorage.length,databases:(await indexedDB.databases()).length})),{local:0,databases:0});assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
 console.log('PASS copy UI: dry-run, backup/readback and confirmation gates, deterministic output, invalidation, cancel, no network/storage writes');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
