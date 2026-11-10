'use strict';
/* ナミ取込（第1段階）。架空のデータだけ。本物の台帳ID・金額・口座は使わない。 */
const C=require('../hub-money-ledger.js'),I=require('../scripts/import-money-ledger.cjs');
const owner='synthetic@example.invalid',ledgerId='synthetic-ledger',flip={id:'synthetic-flip',name:'Flip8'},fold={id:'synthetic-fold',name:'Fold8'},at='2026-11-05T00:00:00.000Z';
const base=()=>({kind:'income',title:'SYNTHETIC RENT',subjectMonth:'2026-11',plannedDate:'2026-11-30',plannedAmount:100,actuals:[],done:false,source:{type:'hub'},businessKey:'synthetic:rent:2026-11',note:''});
const approval={at:'2026-11-05T09:00:00+09:00',note:'会話で確認（架空）'};
async function ledger({migrated=true,conflict=true}={}){
 const raw={_key:'legacy-money:0',kind:'income',title:'SYNTHETIC RENT',amount:100,date:'2026-11-30',done:false};
 const pack=async(id,device)=>C.packSample({id,device,at,payload:{format:'papa-money-comparison',version:1,money:[raw],previousSampleIds:[]}});
 const pa=await pack('sample-flip',flip),pb=await pack('sample-fold',fold),[a,b]=[(await C.unpackSamples(pa.rows)).samples[0],(await C.unpackSamples(pb.rows)).samples[0]];
 const revisions=[];
 if(migrated){const plan={format:'papa-money-migration-plan',version:1,id:'plan-1',samplePins:[a,b].map(s=>({id:s.id,fingerprint:s.fingerprint})),groups:[{recordId:'stable-money',sources:[{sampleId:a.id,key:raw._key},{sampleId:b.id,key:raw._key}],value:base()}]};revisions.push(...(await C.prepareMigration(plan,[a,b],await C.audit([]),flip,at)).revisions);}
 if(conflict){/* 既にある競合（同じ親から2つの編集） */
  const v={...base(),title:'SYNTHETIC CONFLICT',businessKey:'synthetic:conflict',plannedAmount:5},root=await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-root',parents:[],action:'create',device:flip,at,reason:'',value:v});
  revisions.push(root,await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-a',parents:['c-root'],action:'edit',device:flip,at,reason:'',value:{...v,plannedAmount:6}}),await C.seal({format:C.FORMAT,version:1,recordId:'conflict-1',revisionId:'c-b',parents:['c-root'],action:'edit',device:fold,at,reason:'',value:{...v,plannedAmount:7}}));
 }
 return {settingsRows:[['項目','値'],['format',C.FORMAT],['version','1'],['owner',owner],['ledgerId',ledgerId]],expectedOwner:owner,expectedLedgerId:ledgerId,
  historyRows:[C.HEADERS,...revisions.map(C.toRow)],sampleRows:[C.SAMPLE_HEADERS,...pa.rows,...pb.rows],projectionRows:[C.VIEW_HEADERS]};
}

module.exports={ledger,base,at,flip,fold};
