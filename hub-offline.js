(function(root){
 'use strict';const base=new URL('.',document.currentScript?.src||location.href),listeners=[];let registration=null,preparing=null;
 const emit=m=>listeners.forEach(fn=>fn(m));
 async function query(kind){if(!navigator.serviceWorker||!registration)return null;const worker=registration.active;if(!worker)return null;return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},kind==='PAPA_HUB_PREPARE_PDF'?600000:10000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};worker.postMessage({kind},[channel.port2]);});}
 function show(value){emit(value?.core?(value.pdf?'オフライン起動・端末内PDF表示：準備済み':'オフライン起動：準備済み。PDF表示用データは準備待ちです。'):'オフライン起動は準備中または未対応です。今開いている画面の端末データは利用できます。');}
 async function refresh(){show(await query('PAPA_HUB_OFFLINE_STATUS'));}
 async function preparePDF(){if(preparing)return preparing;if(!navigator.onLine){await refresh();return;}if(!registration?.active){emit('オフライン起動の準備中です。少し待ってもう一度押してください。');return;}emit('オフラインPDF表示用のプログラムを準備しています。原本は送信しません。');preparing=query('PAPA_HUB_PREPARE_PDF').then(show).finally(()=>preparing=null);return preparing;}
 root.HubOffline={observe(fn){listeners.push(fn);refresh();},preparePDF,refresh};
 async function start(){if(!navigator.serviceWorker){await refresh();return;}try{registration=await navigator.serviceWorker.register(new URL('hub-offline-worker.js',base),{scope:base.pathname,updateViaCache:'none'});navigator.serviceWorker.addEventListener('controllerchange',refresh);await navigator.serviceWorker.ready;await refresh();}catch{show(null);}}
 const schedule=()=>setTimeout(start,2000);if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});window.addEventListener('online',refresh);
})(globalThis);
