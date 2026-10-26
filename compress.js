/* Compress user-selected downloads locally. No IDB, localStorage, network or original-file writes. */
(function(){
'use strict';
const input=document.getElementById('files'),status=document.getElementById('progress'),results=document.getElementById('results'),limit=256*1024*1024;
let busy=false;const urls=[];
input.onchange=async()=>{
 if(busy)return;const files=[...input.files];if(!files.length)return;busy=true;input.disabled=true;results.replaceChildren();for(const u of urls)URL.revokeObjectURL(u);urls.length=0;
 try{
  if(typeof CompressionStream!=='function')throw Error('このブラウザは圧縮に対応していません。Chromeで開いてください');
  for(let i=0;i<files.length;i++){
   const f=files[i];if(!/\.json$/i.test(f.name)||f.size===0)throw Error('保存済みの.jsonバックアップを選んでください');
   let bytes=0,last=0;const report=()=>{status.textContent=(i+1)+' / '+files.length+'：'+f.name+'\n圧縮中 '+Math.min(100,Math.floor(bytes/f.size*100))+'%';};report();
   const meter=new TransformStream({transform(chunk,controller){bytes+=chunk.byteLength;const now=performance.now();if(now-last>200){last=now;report();}controller.enqueue(chunk);}});
   const blob=await new Response(f.stream().pipeThrough(meter).pipeThrough(new CompressionStream('gzip'))).blob();
   if(bytes!==f.size)throw Error('元ファイルを最後まで読み取れませんでした');
   const name=f.name+'.gz',p=document.createElement('p');p.textContent=f.name+'：'+Math.ceil(f.size/1024/1024)+' MB → '+Math.ceil(blob.size/1024/1024)+' MB';results.append(p);
   const a=document.createElement('a');a.textContent='圧縮したコピーを保存：'+name;a.download=name;a.href=URL.createObjectURL(blob);a.className='compressed-download';urls.push(a.href);results.append(a);
   if(blob.size>limit){const note=document.createElement('p');note.textContent='圧縮後も取得上限256MBを超えています。ファイルの大きさをコーディへ伝えてください。';results.append(note);}
  }
  status.textContent='圧縮したコピーを作成しました。青い保存リンクを押し、保存後にDriveの「00_一時保存」へ入れてください。';
 }catch(e){status.textContent='圧縮未完了：'+e.message+'。元ファイルは変更していません。';}
 finally{busy=false;input.disabled=false;input.value='';}
};
})();
