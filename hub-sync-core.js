(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubSyncCore=api;})(globalThis,function(){
 'use strict';
 function create(){
  let running=null;
  function run({jobs,authorize,onChange=()=>{}}){
   if(running)return running;
   const states=jobs.map(job=>({key:job.key,label:job.label,status:job.eligible?'waiting':'skipped',message:job.eligible?'待機中':job.reason}));
   const emit=()=>onChange(states.map(x=>({...x})));
   const execute=async()=>{
    emit();const eligible=jobs.filter(x=>x.eligible);
    if(!eligible.length)return states;
    let grant;
    try{grant=await authorize(eligible);}catch(error){for(const s of states)if(s.status==='waiting'){s.status='failed';s.message='Google接続未完了：'+error.message;}emit();return states;}
    const allowed=new Set(String(grant?.scope||'').split(/\s+/));
    for(let i=0;i<jobs.length;i++){
     const job=jobs[i],s=states[i];if(!job.eligible)continue;
     if(!job.scopes.every(scope=>allowed.has(scope))){s.status='failed';s.message='必要なGoogle接続を確認できません。端末の記録は保持しています';emit();continue;}
     s.status='running';s.message='同期中…';emit();
     try{const result=await job.sync(grant);s.evidence=result?.evidence||null;s.status=result?.ok===true?'success':'failed';s.message=result?.message||(s.status==='success'?'同期完了':'同期を確認できません。記録は保持しています');}
     catch(error){s.status='failed';s.message='同期失敗・未確認：'+error.message;}
     emit();
    }
    return states;
   };
   const current=execute();running=current;current.then(()=>{if(running===current)running=null},()=>{if(running===current)running=null});return current;
  }
  return {run,active:()=>!!running};
 }
 return {create};
});
