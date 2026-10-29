const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const repo=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(repo,name),'utf8');
const bundled=read(/src="\.\/(hub-app-[^"]+\.js)"/.exec(read('index.html'))[1]);
const marker=';/* Source: hub-google.js */';
const start=bundled.indexOf(marker),end=bundled.indexOf(';/* Source:',start+1);
const KEY='toshi_google_sync_account_v1',EMAIL='owner@example.test';
const CAL='https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
const SHEET='https://www.googleapis.com/auth/spreadsheets',DRIVE='https://www.googleapis.com/auth/drive.file';
function harness(code){
 const data=new Map([['existing-data','keep']]),requests=[],auth=[];
 let serial=0,now=Date.now();
 const h={data,requests,auth,identity:{id:EMAIL,primary:true,accessRole:'owner'},status:200,expires:3600,scope:CAL+' '+SHEET+' '+DRIVE};
 const ctx={GOOGLE_CLIENT_ID:'synthetic-client',HubDiarySync:{SCOPE:SHEET},AbortController,setTimeout,clearTimeout,URLSearchParams,console,Date:class extends Date{static now(){return now;}},crypto:{randomUUID:()=>String(++serial)},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},google:{accounts:{oauth2:{initTokenClient(config){return {requestAccessToken(options){auth.push({scope:config.scope,...options});const respond=()=>config.callback(h.oauthError?{error:h.oauthError}:{access_token:'mock-token-'+auth.length,expires_in:h.expires,scope:h.scope});h.respond=respond;if(!h.deferOAuth)queueMicrotask(respond);}};}}}},fetch:async(url,options)=>{
  requests.push({url,options});
  if(h.networkError)throw Error('synthetic network failure');
  if(h.onFetch)return h.onFetch(url,options);
  return {ok:h.status===200,status:h.status,json:async()=>{if(h.badJSON)throw Error('JSON');return h.identity;}};
 }};
 vm.runInNewContext(code,ctx);h.api=ctx.HubGoogle;h.ctx=ctx;h.tick=()=>now+=3600000;
 h.configure=(email=EMAIL)=>h.api.saveAccount(email,{confirmed:true});
 return h;
}
for(const [name,code] of [['source',read('hub-google.js')],['bundle',bundled.slice(start,end)]]){
 test(name+': unset/corrupt settings stop before OAuth and network',async()=>{
  for(const value of [null,'{}','invalid',JSON.stringify({version:1,email:EMAIL,confirmed:false,revision:'x'})]){
   const h=harness(code);if(value)h.data.set(KEY,value);
   await assert.rejects(h.api.connectForSync({diary:true,proof:true}),{code:'GOOGLE_ACCOUNT_REQUIRED'});
   assert.equal(h.auth.length,0);assert.equal(h.requests.length,0);assert.equal(h.data.get('existing-data'),'keep');
  }
 });
 test(name+': setting requires explicit confirmation; only email and revision persist',()=>{
  const h=harness(code);assert.throws(()=>h.api.saveAccount(EMAIL),{code:'GOOGLE_ACCOUNT_CONFIRM_REQUIRED'});
  assert.equal(h.data.has(KEY),false);h.configure(' OWNER@example.test ');
  assert.equal(h.api.account().email,EMAIL);assert.deepEqual([...h.data.keys()],['existing-data',KEY]);
  assert.equal(h.auth.length,0);
 });
 test(name+': matching combined connection uses empty prompt and readonly primary verification',async()=>{
  const h=harness(code);h.configure();const grant=await h.api.connectForSync({diary:true,proof:true});
  assert.equal(h.auth[0].prompt,'');assert.equal(h.auth[0].scope,CAL+' '+SHEET+' '+DRIVE);
  assert.equal(h.requests.length,1);assert.ok(h.requests[0].url.includes('/calendarList/primary?'));
  assert.equal(h.requests[0].options.method,'GET');assert.equal(grant.assertValid(),true);
  assert.equal(JSON.stringify([...h.data]).includes('mock-token'),false);
 });
 test(name+': valid token reused, but each sync rechecks identity; calendar read retains grant',async()=>{
  const h=harness(code);h.configure();await h.api.connectForSync({diary:true,proof:true});
  const grant=await h.api.connectForSync({diary:true,proof:true});
  assert.equal(h.auth.length,1);assert.equal(h.requests.length,2);
  h.onFetch=async()=>({ok:true,status:200,json:async()=>({items:[]})});
  await h.api.read('2026-01-01','2026-01-02');assert.equal(grant.assertValid(),true);
 });
 test(name+': explicit reselection uses select_account without trusting first returned account',async()=>{
  const h=harness(code);h.configure();await h.api.connectForSync();
  h.identity.id='other@example.test';await assert.rejects(h.api.selectAccount(),{code:'GOOGLE_ACCOUNT_MISMATCH'});
  assert.equal(h.auth.length,2);assert.equal(h.auth[1].prompt,'select_account');assert.equal(h.api.account().email,EMAIL);
 });
 for(const mode of ['mismatch','http401','http403','network','json','missing-primary','not-owner','missing-id','missing-read-scope','missing-scopes','expired']){
  test(name+': '+mode+' cannot issue a grant or sync jobs',async()=>{
   const h=harness(code);h.configure();
   if(mode==='mismatch')h.identity.id='other@example.test';
   if(mode==='http401')h.status=401;if(mode==='http403')h.status=403;
   if(mode==='network')h.networkError=true;if(mode==='json')h.badJSON=true;
   if(mode==='missing-primary')delete h.identity.primary;if(mode==='not-owner')h.identity.accessRole='reader';
   if(mode==='missing-id')delete h.identity.id;
   if(mode==='missing-read-scope')h.scope=SHEET;if(mode==='missing-scopes')h.scope='';if(mode==='expired')h.expires=1;
   const core=require('../hub-sync-core.js');let jobs=0;
   const states=await core.create().run({concurrent:true,jobs:['calendar','diary'].map(key=>({key,label:key,eligible:true,scopes:[],sync(){jobs++;}})),authorize:()=>h.api.connectForSync({calendar:mode!=='missing-read-scope',diary:true,proof:false})});
   assert.equal(jobs,0);assert.ok(states.every(s=>s.status==='failed'));
   assert.throws(()=>h.api.currentProofGrant());assert.ok(h.requests.every(r=>r.options.method==='GET'));
   assert.equal(h.api.account().email,EMAIL);
  });
 }
 test(name+': failed recheck revokes old proof grant in memory',async()=>{
  const h=harness(code);h.configure();const grant=await h.api.connectForSync({proof:true});h.status=403;
  await assert.rejects(h.api.connectForSync({proof:true}));assert.throws(()=>grant.assertValid());assert.throws(()=>h.api.currentProofGrant());
 });
 test(name+': changed local or cross-tab setting invalidates in-flight grant; storage preserved',async()=>{
  const h=harness(code);h.configure();const g=await h.api.connectForSync();
  const saved=JSON.parse(h.data.get(KEY));h.data.set(KEY,JSON.stringify({...saved,revision:'cross-tab'}));
  assert.throws(()=>g.assertValid());assert.equal(h.data.get('existing-data'),'keep');
 });
 test(name+': settings changed during OAuth stop late response',async()=>{
  const h=harness(code);h.configure();h.deferOAuth=true;const work=h.api.connectForSync();
  h.configure('new@example.test');h.respond();await assert.rejects(work,{code:'GOOGLE_ACCOUNT_CHANGED'});assert.equal(h.requests.length,0);
 });
 test(name+': settings changed during identity GET stop the response',async()=>{
  const h=harness(code);h.configure();h.onFetch=async()=>{h.configure('changed@example.test');return {ok:true,json:async()=>h.identity};};
  await assert.rejects(h.api.connectForSync(),{code:'GOOGLE_ACCOUNT_VERIFY_FAILED'});assert.throws(()=>h.api.currentProofGrant());
 });
 test(name+': simultaneous connects share one OAuth interaction',async()=>{
  const h=harness(code);h.configure();const grants=await Promise.all([h.api.connectForSync({diary:true}),h.api.connectForSync({diary:true})]);
  assert.equal(h.auth.length,1);assert.ok(grants.every(g=>g.assertValid()));
 });
 test(name+': primary completion PATCH and changed-setting PATCH are stopped',async()=>{
  for(const calendar of ['primary',EMAIL,'task-calendar']){
   const h=harness(code);h.configure();await h.api.connectForSync();
   h.ctx.HubCore={completionPatch:()=>({extendedProperties:{private:{}}}),fromGoogle:e=>e};
   h.onFetch=async()=>({ok:true,status:200,json:async()=>({id:'event-id',etag:'etag'})});
   await assert.rejects(h.api.complete({type:'todo',googleCalendarId:calendar,googleId:'event-id'},true,{beforeUpdate:async()=>{if(calendar==='task-calendar')h.configure('changed@example.test');}}));
   assert.equal(h.requests.filter(r=>r.options.method==='PATCH').length,0);
  }
 });
 test(name+': missing verification scope does not request extra scope',async()=>{
  const h=harness(code);h.configure();h.scope=DRIVE;
  await assert.rejects(h.api.connectForProof(),{code:'GOOGLE_ACCOUNT_READ_REQUIRED'});
  assert.equal(h.auth[0].scope,DRIVE);assert.equal(h.requests.length,0);
 });
 test(name+': expired token reconnects',async()=>{
  const h=harness(code);h.configure();const g=await h.api.connectForSync();h.tick();assert.throws(()=>g.assertValid());
  await h.api.connectForSync();assert.equal(h.auth.length,2);assert.equal(h.auth[1].prompt,'');
 });
 test(name+': primary named TASK is never a publication target',async()=>{
  const h=harness(code);h.configure();await h.api.connectForSync();
  h.onFetch=async()=>({ok:true,status:200,json:async()=>({items:[{id:EMAIL,primary:true,summary:'TASK',accessRole:'owner'}]})});
  await assert.rejects(h.api.publish({type:'todo'}),/TASK/);assert.ok(h.requests.every(r=>!r.options.method||r.options.method==='GET'));
 });
}
for(const [name,code]of [['source',read('hub-google.js')],['bundle',bundled.slice(start,end)]])test(name+': money-only sign-in requires no broader Drive or calendar-write scope',async()=>{const h=harness(code);h.configure();const grant=await h.api.connectForMoney(),requested=new Set(h.auth[0].scope.split(/\s+/));assert.equal(requested.size,3);assert(requested.has('https://www.googleapis.com/auth/calendar.readonly'));assert(requested.has(SHEET));assert(requested.has(DRIVE));assert(!requested.has('https://www.googleapis.com/auth/drive'));assert(!requested.has('https://www.googleapis.com/auth/calendar.events'));grant.assertValid();assert(h.requests.every(r=>!r.options.method||r.options.method==='GET'));});
test('proof adapter checks identity again after asynchronous transmission approval',async()=>{
 const h=harness(read('hub-google.js'));h.configure();const grant=await h.api.connectForSync({proof:true});
 const drive=require('../hub-proof-drive.js');let requests=0;
 const transport=drive.create({approved:()=>true,authorize:async()=>grant,core:{},store:{settings:async()=>({name:'Flip8'}),deliveryState:async()=>({fileId:'existing-folder'})},beforeRequest:async()=>{h.configure('changed@example.test');return true;},fetch:async()=>{requests++;throw Error('Must not send');}});
 await assert.rejects(transport.setup(),{code:'GOOGLE_ACCOUNT_UNVERIFIED'});assert.equal(requests,0);
});
test('all generated sections equal source with original ordering and wrappers',()=>{
 const {execFileSync}=require('node:child_process');
 execFileSync(process.execPath,[path.join(repo,'scripts/build-bundle.cjs')]);
 const oldNames=[...read('hub-app-1.2.35.js').matchAll(/Source: ([^ ]+) \*/g)].map(m=>m[1]);
 const newNames=[...bundled.matchAll(/Source: ([^ ]+) \*/g)].map(m=>m[1]);assert.deepEqual(newNames,[...oldNames,'hub-money-ledger.js','hub-money-store.js','hub-money-cloud.js','hub-money-sync.js']);
});
