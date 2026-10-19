/* Read-only local preview. No stored record, key or original byte is changed. */
(function(root){
 'use strict';
 const base=new URL('.',document.currentScript?.src||location.href),pdfBase=new URL('vendor/pdfjs-6.4.299/',base);
 const types={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 async function inspect(blob,name='',declared=''){
  const bytes=new Uint8Array(await blob.slice(0,1024).arrayBuffer()),at=(values,start=0)=>values.every((v,i)=>bytes[i+start]===v),ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end)),ext=String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]||'';let format='unknown';
  if(ascii(0,1024).includes('%PDF-'))format='pdf';
  else if(at([137,80,78,71,13,10,26,10]))format='png';
  else if(at([255,216,255]))format='jpg';
  else if(['GIF87a','GIF89a'].includes(ascii(0,6)))format='gif';
  else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')format='webp';
  else if(ascii(4,8)==='ftyp'&&/avif|avis/.test(ascii(8,32)))format='avif';
  else if(at([80,75])&&['docx','xlsx'].includes(ext))format=ext;
  else if(at([208,207,17,224,161,177,26,225])&&['doc','xls'].includes(ext))format=ext;
  const mime=types[format]||'',stored=String(blob.type||declared||'').split(';')[0].toLowerCase();
  return {format,mime,stored,preview:format==='pdf'?'pdf':['png','jpg','gif','webp','avif'].includes(format)?'image':'external',mismatch:!!mime&&stored!==mime,extension:format==='unknown'?'':format};
 }
 let pdfModule;
 function library(){if(!pdfModule)pdfModule=import(new URL('build/pdf.mjs',pdfBase).href).then(m=>{m.GlobalWorkerOptions.workerSrc=new URL('build/pdf.worker.mjs',pdfBase).href;return m;}).catch(e=>{pdfModule=null;throw e;});return pdfModule;}
 function mount(content,blob,record={}){
  let closed=false,urls=[],loading=null,doc=null,rendering=null,drawing=false,pdfBusy=false,pageNo=1,zoom=1;
  const session={close(){if(closed)return;closed=true;rendering?.cancel();const task=loading;loading=null;if(task)Promise.resolve(task.destroy()).catch(()=>{});else if(doc)Promise.resolve(doc.destroy()).catch(()=>{});doc=null;for(const url of urls)URL.revokeObjectURL(url);urls=[];}};
  const info=node('p','形式を確認しています…','muted'),status=node('p','原本は端末内で読み取り、外部の変換サービスには送信しません。','feature-preview-status'),area=node('div',undefined,'feature-preview-area'),actions=node('div',undefined,'feature-preview-actions'),help=node('p','','muted');status.setAttribute('role','status');content.append(info,status,actions,help,area);
  const save=node('button','原本を保存');save.type='button';let detected=null;
  const originalName=String(record.fileName||blob.name||record.id||'original'),getName=()=>{const name=originalName==='original'&&detected?.extension?'original.'+detected.extension:originalName;return HubExport.filename(name);};
  save.onclick=()=>{HubExport.download(blob,getName());help.textContent='ダウンロード後、Androidの「マイファイル」→「ダウンロード」から対応アプリで開いてください。';};
  const external=node('button','外部アプリで開く・共有');external.type='button';external.disabled=true;external.onclick=async()=>{if(!detected||closed)return;const file=new File([blob],getName(),{type:detected.mime||blob.type||'application/octet-stream'});try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:String(record.title||record.vendor||'原本')});if(!closed)help.textContent='外部アプリへの操作を開始しました。閲覧できたかは開いたアプリで確認してください。';}else{HubExport.download(blob,getName());help.textContent='このブラウザでは直接のアプリ選択に対応していません。保存後、Androidの「マイファイル」→「ダウンロード」で原本を開いてください。';}}catch(e){if(closed)return;help.textContent=e.name==='AbortError'?'外部アプリの選択を取り消しました。原本はそのままです。':'外部アプリを開けませんでした。「原本を保存」して、ダウンロードしたファイルを対応アプリで開いてください。';}};
  actions.append(external,save);
  function unavailable(message){if(closed)return;area.replaceChildren();status.textContent=message+' 原本の破損を意味するものではありません。「外部アプリで開く・共有」または「原本を保存」を利用してください。';}
  async function showPDF(){if(closed||pdfBusy)return;pdfBusy=true;status.textContent='PDFを端末内で開いています…';area.replaceChildren();try{
   if(blob.size>50*1024*1024)throw Object.assign(Error(),{name:'PreviewSizeLimit'});
   const lib=await library();if(closed)return;const data=new Uint8Array(await blob.arrayBuffer());if(closed)return;
   loading=lib.getDocument({data,cMapUrl:new URL('cmaps/',pdfBase).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',pdfBase).href,wasmUrl:new URL('wasm/',pdfBase).href,iccUrl:new URL('iccs/',pdfBase).href,isEvalSupported:false,enableXfa:false,useSystemFonts:true,canvasMaxAreaInBytes:16*1024*1024,stopAtErrors:true});
   let password=false;loading.onPassword=()=>{password=true;unavailable('パスワード付きPDFはHUB内で表示できません。');Promise.resolve(loading?.destroy()).catch(()=>{});};
   try{doc=await loading.promise;}catch(e){if(password)return;throw e;}if(closed)return;
   const controls=node('div',undefined,'feature-preview-controls'),previous=node('button','前のページ'),next=node('button','次のページ'),label=node('label','ページ '),input=node('input'),count=node('span',' / '+doc.numPages),smaller=node('button','縮小'),larger=node('button','拡大'),caption=node('p','','muted'),canvas=node('canvas');input.type='number';input.min='1';input.max=String(doc.numPages);input.value='1';input.setAttribute('aria-label','表示するページ');label.append(input,count);for(const b of [previous,next,smaller,larger])b.type='button';controls.append(previous,label,next,smaller,larger);area.append(controls,caption,canvas);canvas.setAttribute('role','img');
   async function draw(target=pageNo,newZoom=zoom){if(closed||drawing)return;drawing=true;pageNo=target;zoom=newZoom;previous.disabled=next.disabled=smaller.disabled=larger.disabled=input.disabled=true;status.textContent='PDF '+pageNo+' / '+doc.numPages+'ページを表示しています…';let page;
    try{page=await doc.getPage(pageNo);if(closed)return;const first=page.getViewport({scale:1}),width=Math.min(1200,Math.max(220,content.clientWidth-24)),fit=width/first.width,cssScale=fit*zoom,ratio=Math.min(devicePixelRatio||1,2),limit=Math.sqrt(4*1024*1024/(first.width*first.height)),scale=Math.min(cssScale*ratio,limit),viewport=page.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width=width*zoom+'px';canvas.style.height='auto';canvas.setAttribute('aria-label','PDF '+pageNo+' / '+doc.numPages+'ページ');input.value=String(pageNo);rendering=page.render({canvasContext:canvas.getContext('2d'),viewport});await rendering.promise;if(closed)return;caption.textContent=pageNo+' / '+doc.numPages+'ページ｜'+Math.round(zoom*100)+'%';status.textContent='PDFをHUB内に表示しました。';}
    catch(e){if(!closed&&e.name!=='RenderingCancelledException'){canvas.hidden=true;unavailable('このPDFのページをHUB内で表示できませんでした。');}}
    finally{rendering=null;drawing=false;page?.cleanup();if(!closed){previous.disabled=pageNo<=1;next.disabled=pageNo>=doc.numPages;smaller.disabled=zoom<=1;larger.disabled=zoom>=3;input.disabled=false;}}
   }
   previous.onclick=()=>draw(Math.max(1,pageNo-1));next.onclick=()=>draw(Math.min(doc.numPages,pageNo+1));smaller.onclick=()=>draw(pageNo,Math.max(1,zoom-.5));larger.onclick=()=>draw(pageNo,Math.min(3,zoom+.5));input.onchange=()=>{const n=Number(input.value);if(Number.isInteger(n)&&n>=1&&n<=doc.numPages)draw(n);else input.value=String(pageNo);};await draw();
  }catch(e){if(!closed)unavailable(e.name==='PreviewSizeLimit'?'50MBを超えるPDFは、端末の負担を抑えるためHUB内に表示しません。':'PDFの表示処理を完了できませんでした。通信または端末の表示機能を確認してください。');}finally{pdfBusy=false;}}
  (async()=>{try{detected=await inspect(blob,originalName,record.mime||record.imageType);if(closed)return;external.disabled=false;info.textContent='形式：'+(detected.format==='unknown'?'未判定':detected.format.toUpperCase())+'｜保存時の種類：'+(detected.stored||'未設定')+(detected.mismatch?'｜表示用の形式を原本から判定しました':'');
   if(detected.preview==='image'){const image=node('img');image.className='feature-image';image.alt=String(record.title||record.vendor||'原本画像');image.onload=()=>{if(!closed)status.textContent='画像をHUB内に表示しました。';};image.onerror=()=>unavailable('この画像形式または画像をHUB内で表示できませんでした。');const url=URL.createObjectURL(new Blob([blob],{type:detected.mime}));urls.push(url);image.src=url;area.append(image);status.textContent='画像を開いています…';}
   else if(detected.preview==='pdf')await showPDF();
   else unavailable(['doc','docx','xls','xlsx'].includes(detected.format)?'Word・ExcelはHUB内プレビューの対象外です。対応する外部アプリで開いてください。':'保存ファイルの形式をHUB内プレビュー用に判定できませんでした。');
  }catch{if(!closed){external.disabled=false;detected={mime:'',extension:''};unavailable('保存ファイルの読み取りまたは形式の確認を完了できませんでした。');}}})();
  return session;
 }
 root.HubFilePreview={inspect,mount};
})(globalThis);
