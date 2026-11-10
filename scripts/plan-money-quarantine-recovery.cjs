#!/usr/bin/env node
/* Read-only recovery proposal. Never edits a store or sends a request. */
'use strict';
const fs=require('fs'),C=require('../hub-money-ledger.js');
async function plan({localEvents,remoteEvents,secondRemoteEvents}){
 if(C.canonical(remoteEvents)!==C.canonical(secondRemoteEvents))throw Error('Googleの2回の読取りが変わりました');
 const local=await C.audit(localEvents),remote=await C.audit(remoteEvents);
 if(remote.quarantine.length||remote.conflictCount)throw Error('Googleの有効履歴が未確認です');
 if(C.canonical(local.revisions)!==C.canonical(remote.revisions))throw Error('未送信または異なる有効履歴があります');
 const items=[];
 for(const q of local.quarantine){const raw=q.raw,row=raw.invalidRow;
  if(!Array.isArray(row)||row.length!==7||row[0]!==raw.revisionId||row[1]!==raw.recordId)throw Error('SHA欠落だけと確認できません');
  const matches=remote.revisions.filter(r=>r.revisionId===raw.revisionId&&r.recordId===raw.recordId&&C.canonical(C.toRow(r).slice(0,7))===C.canonical(row));
  if(matches.length!==1)throw Error('隔離原文と有効履歴の全7列が一致しません');
  items.push({raw:C.copy(raw),rawHash:await C.hash(raw),verifiedRevisionId:matches[0].revisionId,verifiedFingerprint:matches[0].fingerprint});
 }
 if(!items.length)throw Error('修復対象がありません');
 const body={format:'papa-money-quarantine-recovery-proposal',version:1,status:'proposal-only-no-writes',beforeCheckpoint:local.checkpoint,expectedCheckpoint:remote.checkpoint,validHistoryCount:remote.revisions.length,items};
 return {...body,planHash:await C.hash(body),next:'原本を削除せず別保管し、有効履歴との対応を固定する適用処理のレビューが必要。これは適用済み記録ではありません。'};
}
module.exports={plan};
if(require.main===module)plan(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
