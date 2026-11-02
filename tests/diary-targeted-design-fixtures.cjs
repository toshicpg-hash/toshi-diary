'use strict';
// Specification fixtures only. No adapter, transaction runner or network calls.
// All IDs, text and statuses below are fictional, or derived from synthetic data.
const base=require('./diary-repair-fixture.cjs'),R=require('../diary-repair.js'),C=require('../diary-core.js');
const cases=[
 {name:'happy',observation:'all exact after; both owner receipts',expected:'RESUME_ELIGIBLE',retry:false},
 {name:'google-not-sent',observation:'definitely not sent; exact before',expected:'REVALIDATE_BEFORE_SEND',retry:true},
 {name:'google-terminal-rejection',observation:'terminal rejection; exact before',expected:'REVALIDATE_BEFORE_SEND',retry:true},
 {name:'google-disconnect-before',observation:'timeout; exact before; request may arrive later',expected:'UNKNOWN_FROZEN',retry:false},
 {name:'google-disconnect-after',observation:'timeout; exact after; termination unconfirmed',expected:'AWAIT_TERMINATION_FROZEN',retry:false},
 {name:'google-partial',observation:'mixed before/after inconsistent with atomic batch',expected:'STOP_PRESERVE_OBSERVATION',retry:false},
 {name:'google-outside-change',observation:'one baseline record changed',expected:'STOP_PRESERVE_OBSERVATION',retry:false},
 {name:'local-quota-abort',observation:'atomic transaction aborted; exact before',expected:'REVALIDATE_LOCAL',retry:true},
 {name:'local-commit-reply-lost',observation:'exact after and same operation journal',expected:'NOOP_READBACK',retry:false},
 {name:'one-device-failed',observation:'Google and first device after; second device before',expected:'ALL_FROZEN_RESUME_SECOND',retry:false},
 {name:'archive-unreadable',observation:'independent archive readback unavailable',expected:'STOP_BEFORE_APPLY',retry:false},
 {name:'old-writer-unaccounted',observation:'A0 old client can still merge and append',expected:'STOP_BEFORE_APPLY',retry:false},
 {name:'draft-base-ambiguous',observation:'draft references changed original ID without base evidence',expected:'DRAFT_READ_ONLY',retry:false},
 {name:'cancel-after-apply',observation:'one or more stores after',expected:'FROZEN_FORWARD_OR_NEW_PLAN',retry:false},
 {name:'rollback-new-edits',observation:'new revision after resume',expected:'BACKUP_ALL_STOP_NO_DELETE',retry:false},
 {name:'coordinator-journal-lost',observation:'Google operation outcome unknown',expected:'STOP_NO_RESEND',retry:false}
];
module.exports=async function(){
 const {manifest,current}=base(),plan=await R.dryRun(manifest,current);
 const targets=manifest.targets.map(t=>t.revisionId),participants={};
 for(const [name,before] of Object.entries(current)){
  const after=plan.copies[name],byId=new Map(before.revisions.map(r=>[r.revisionId,r]));
  participants[name]={beforeHash:await R.digest(before),afterHash:await R.digest(after),
   allowedBefore:Object.fromEntries(targets.map(id=>[id,byId.has(id)?C.canonical(byId.get(id)):null])),
   replacements:after.revisions.filter(r=>byId.has(r.revisionId)&&C.canonical(byId.get(r.revisionId))!==C.canonical(r)).map(r=>r.revisionId),
   additions:after.revisions.filter(r=>!byId.has(r.revisionId)).map(r=>r.revisionId)};
 }
 const rawBefore=[C.headers,...current.google_copy.revisions.map(C.toRow)];
 const beforeIds=new Set(current.google_copy.revisions.map(r=>r.revisionId)),afterById=new Map(plan.copies.google_copy.revisions.map(r=>[r.revisionId,r]));
 const rawAfter=[C.headers,...current.google_copy.revisions.map(r=>C.toRow(afterById.get(r.revisionId))),...plan.copies.google_copy.revisions.filter(r=>!beforeIds.has(r.revisionId)).map(C.toRow)];
 return {manifest,current,plan,execution:{executionId:'synthetic_execution_001',operationId:'synthetic_operation_001',planId:plan.planId,participants,google:{spreadsheetId:'synthetic_sheet_000000000000',tabId:123,rawBefore,rawAfter,beforeHash:await R.digest(rawBefore),afterHash:await R.digest(rawAfter),targetRowIndexes:[87,88],appendStartRowIndex:89,appendRowCount:5}},cases:structuredClone(cases)};
};
