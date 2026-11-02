'use strict';
const el=id=>document.getElementById(id),R=ToshiDiaryRepair;
let plan=null,generation=0;
const read=async id=>{const file=el(id).files[0];if(!file)throw Error('JSONファイルを選択してください');return JSON.parse(await file.text());};
function save(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clear(){generation++;plan=null;el('backup').disabled=true;el('execute').disabled=true;el('summary').textContent='';el('confirmation').value='';el('review').checked=false;el('readback').value='';}
for(const id of ['manifest','current'])el(id).addEventListener('change',clear);
el('cancel').onclick=()=>{clear();el('manifest').value='';el('current').value='';};
el('dry').onclick=async()=>{clear();const ticket=generation;try{const p=await R.dryRun(await read('manifest'),await read('current'));if(ticket!==generation)return;plan=p;el('summary').textContent=JSON.stringify({planId:p.planId,...p.summary,limitations:p.limitations},null,2);el('backup').disabled=false;el('execute').disabled=false;}catch(e){if(ticket===generation)el('summary').textContent=e.message;}};
el('backup').onclick=()=>{if(plan)save('private-diary-repair-archive.json',plan.archive);};
el('execute').onclick=async()=>{const ticket=generation,p=plan;if(!p)return;try{if(!el('review').checked)throw Error('原本と対応表の内容確認が必要です');const result=await R.executeCopies(await read('manifest'),await read('current'),{backupReadback:await read('readback'),confirmedPlanId:el('confirmation').value});if(ticket!==generation)return;if(result.planId!==p.planId)throw Error('計画が変わりました。dry-runをやり直してください');save('private-diary-repaired-copies.json',result);el('summary').textContent='コピー生成済み。Google保存: 未実施。本人端末反映確認: 未実施。';}catch(e){if(ticket===generation)el('summary').textContent=e.message;}};
