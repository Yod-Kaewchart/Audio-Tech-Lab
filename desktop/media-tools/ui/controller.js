'use strict';
(() => {
 const adapter=window.createMediaAdapter(),mode=document.body.dataset.page,$=id=>document.getElementById(id),set=(id,v)=>{$(id).textContent=v;};
 let source=null,folder=null,caps=null,job=null,pending=false,inspection=null,startId=null,eventVersion=0;
 const uuid=()=>crypto.randomUUID(),format=()=>document.querySelector('input[name="format"]:checked')?.value||null;
 const busy=()=>job&&['starting','running','cancelling','cleanup-required'].includes(job.status);
 const known=v=>v===null||v===undefined?'ไม่ทราบ':v;
 const duration=s=>s==null?'ไม่ทราบ':Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
 const bytes=n=>n==null?'ไม่ทราบ':(n/1048576).toLocaleString('en-US',{maximumFractionDigits:2})+' MB';
 const notice=text=>set('notice',text||'');
 const requestedName=()=>mode==='download'?$('output-name').value.trim():'';
 function nameError(){
  if(mode!=='download')return '';
  const name=requestedName().normalize('NFC');
  if(!name)return '';
  if(name.length>110||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/i.test(name))return 'ชื่อไฟล์ไม่ถูกต้อง: กรุณาใช้ชื่อที่ Windows อนุญาต';
  if(/\.(?:flac|mp3|wav|m4a|aac|ogg|opus|aif|aiff|wma|webm)$/i.test(name))return 'ไม่ต้องใส่นามสกุลไฟล์ โปรแกรมจะเติมให้อัตโนมัติ';
  return '';
 }
 function controls(){const locked=!!busy()||pending;const badName=nameError();if(mode==='download'){set('filename-error',badName);$('output-name').setAttribute('aria-invalid',String(!!badName));}$('source-controls').disabled=locked;$('output-controls').disabled=locked;$('start').disabled=locked||!!badName||!source||!folder||!format()||!(mode==='download'?caps?.downloadReady:caps?.convertReady);$('refresh-tools').disabled=locked;
  $('retry').disabled=$('start').disabled;$('new-job').disabled=locked||pending;set('start-help',busy()?'งานปัจจุบันใช้ร่วมกันทั้ง Download และ Convert':!caps?'กำลังตรวจ native bridge และเครื่องมือ':!(mode==='download'?caps.downloadReady:caps.convertReady)?'เครื่องมือไม่พร้อม กรุณาตรวจข้อความด้านล่าง':!format()?'กรุณาเลือกรูปแบบเสียงก่อนดาวน์โหลด':!source?'เลือกไฟล์หรือตรวจสอบลิงก์ก่อนเริ่ม':!folder?'เลือกโฟลเดอร์ปลายทางก่อนเริ่ม':badName||'ทำงานภายในเครื่องครั้งละหนึ่งรายการ');
 }
 function renderSource(){set('source-title',source?.displayName||'ยังไม่ได้เลือกแหล่งเสียง');set('source-caption',source?'ข้อมูลจากการตรวจในเครื่อง':'เพิ่มแหล่งเสียงเพื่อเริ่มงาน');const m=source?.metadata;$('source-metadata').replaceChildren();if(m){for(const [label,value] of [['ระยะเวลา',duration(m.durationSeconds)],['ขนาด',bytes(m.bytes)],['Codec / container',[known(m.codec),known(m.container)].join(' / ')],['Sample rate',m.sampleRateHz?m.sampleRateHz/1000+' kHz':'ไม่ทราบ'],['Bit depth',m.bitsPerSample?m.bitsPerSample+' bit':'ไม่ทราบ'],['ช่องเสียง',known(m.channels)]]){const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);$('source-metadata').append(div);}}
  set('source-note',mode==='download'?'คุณภาพเสียงที่ยังไม่ทราบจะแสดงหลังดาวน์โหลดและตรวจด้วย FFprobe':'อ่านข้อมูลด้วย FFprobe ในเครื่อง ไม่อัปโหลดไฟล์');controls();
 }
 function quality(){const f=format();$('original-note').hidden=f!=='Original Audio';$('mp3-quality').hidden=f!=='MP3';$('lossless-quality').hidden=!['WAV','FLAC','ALAC'].includes(f);$('alac-note').hidden=f!=='ALAC';$('bitrate').disabled=f!=='MP3';$('sample-rate').disabled=$('bit-depth').disabled=!['WAV','FLAC','ALAC'].includes(f);startId=null;controls();}
 function encoding(){const f=format();if(!f)throw Object.assign(new Error('กรุณาเลือกรูปแบบเสียงก่อนเริ่ม'),{code:'INVALID_REQUEST'});if(f==='Original Audio')return {format:'original'};if(f==='MP3')return {format:'mp3',bitrateKbps:parseInt($('bitrate').value,10)};return {format:f.toLowerCase(),sampleRateHz:$('sample-rate').value==='source'?'source':Math.round(parseFloat($('sample-rate').value)*1000),bitsPerSample:parseInt($('bit-depth').value,10)};}
 const stages={inspecting:'กำลังตรวจต้นทาง',downloading:'กำลังดาวน์โหลด', 'probing-input':'กำลังตรวจไฟล์ต้นฉบับ',converting:'กำลังแปลงเสียง','probing-output':'กำลังตรวจผลลัพธ์',saving:'กำลังบันทึกไฟล์',stopping:'กำลังหยุด process และ cleanup',complete:'ตรวจสอบและบันทึกเรียบร้อย'};
 const labels={starting:'กำลังเตรียมงาน',running:'กำลังทำงาน',cancelling:'กำลังยกเลิก',succeeded:'สำเร็จ',failed:'ล้มเหลว',cancelled:'ยกเลิกแล้ว',interrupted:'ถูกขัดจังหวะ','cleanup-required':'ต้องตรวจ cleanup'};
 function renderJob(next){if(next&&job?.jobId===next.jobId&&next.sequence<job.sequence)return;job=next;
  const s=job?.status;if(['succeeded','failed','cancelled','interrupted'].includes(s))startId=null;set('job-badge',s?labels[s]:'พร้อมเริ่ม');set('job-title',job?.sourceName||'ยังไม่มีงานปัจจุบัน');
  set('job-description',job?job.error?.message||(stages[job.progress.stage]+' · '+(job.mode==='download'?'Download Audio':'Convert Audio')):'เลือกแหล่งเสียง รูปแบบ และโฟลเดอร์ปลายทางก่อนเริ่ม');
  $('cancel').hidden=!['starting','running','cancelling'].includes(s);$('cancel').disabled=s==='cancelling'||job?.progress.stage==='saving';
  $('retry').hidden=!['failed','cancelled','interrupted'].includes(s);$('new-job').hidden=!['succeeded','failed','cancelled','interrupted'].includes(s);$('progress-area').hidden=!['starting','running','cancelling','succeeded'].includes(s);
  if(job){const p=job.progress;if(p.stagePercent===null){$('progress').removeAttribute('value');set('progress-value','ไม่ทราบ %');}else{$('progress').value=p.stagePercent;set('progress-value',Math.floor(p.stagePercent)+'%');}set('progress-stage',stages[p.stage]+(p.bytesDownloaded!==null?' · '+bytes(p.bytesDownloaded):'')+' · ความคืบหน้าของขั้นตอนนี้');}
  $('result').hidden=!job?.output;if(job?.output){const o=job.output,m=o.metadata;set('result-name',o.fileName);set('result-path',o.displayPath);set('result-format',[known(m.codec),known(m.container),m.sampleRateHz?m.sampleRateHz/1000+' kHz':'ไม่ทราบ sample rate',m.bitsPerSample?m.bitsPerSample+' bit':'ไม่ทราบ bit depth',bytes(m.bytes),duration(m.durationSeconds)].join(' · '));$('open-file').disabled=$('open-folder').disabled=!o.available;}
  controls();
 }
 async function perform(fn){if(pending)return;pending=true;controls();notice('');try{return await fn();}catch(e){notice(e.message);if(['DEPENDENCY_MISSING','DEPENDENCY_INVALID','UNAVAILABLE'].includes(e.code)){caps=null;set('capability-status',e.message);}if(e.code==='STALE_SOURCE'){source=null;renderSource();}}finally{pending=false;controls();}}
 async function refresh(){try{caps=await adapter.call('getCapabilities');const names={ytDlp:'yt-dlp',ffmpeg:'FFmpeg',ffprobe:'FFprobe',jsRuntime:'Node / EJS',processHelper:'Process helper'};set('capability-status',Object.entries(caps.tools).map(([k,v])=>names[k]+': '+(v.verified?v.version:v.reason)).join(' · '));}catch(e){caps=null;notice(e.message);set('capability-status',e.message);}controls();}
 const unsubscribe=adapter.subscribeJob(next=>{eventVersion++;renderJob(next);});
 async function current(){const before=eventVersion;try{const next=await adapter.call('getCurrentJob');if(before===eventVersion)renderJob(next);}catch(e){notice(e.message);}}
 async function start(){if($('start').disabled||!format())return;await perform(async()=>{startId ||= uuid();const req={sourceId:source.sourceId,folderId:folder.folderId,requestId:startId,encoding:encoding()};if(mode==='download')req.outputName=requestedName();const next=await adapter.call(mode==='download'?'startDownload':'startConvert',req);renderJob(next);$('job-heading').scrollIntoView({block:'center',behavior:'instant'});});}
 $('start').addEventListener('click',start);$('retry').addEventListener('click',()=>{startId=null;start();});
 $('new-job').addEventListener('click',()=>perform(async()=>{await adapter.call('resetFinishedJob');startId=null;renderJob(null);}));
 $('cancel').addEventListener('click',async()=>{try{const r=await adapter.call('cancelJob',{jobId:job.jobId});if(!r.accepted)notice('ขั้นตอนบันทึกผลเริ่มแล้ว รอให้บันทึกเสร็จก่อน');}catch(e){notice(e.message);}});
 $('pick-folder').addEventListener('click',()=>perform(async()=>{const result=await adapter.call('chooseOutputDirectory');if(result){folder=result;startId=null;set('folder-path',folder.displayPath);}}));
 for(const target of ['file','folder'])$('open-'+target).addEventListener('click',()=>perform(()=>adapter.call('openResult',{resultId:job.output.resultId,target})));
 document.querySelectorAll('input[name="format"]').forEach(r=>r.addEventListener('change',quality));for(const id of ['bitrate','sample-rate','bit-depth'])$(id).addEventListener('change',()=>{startId=null;});
 $('refresh-tools').addEventListener('click',refresh);
 if(mode==='download')$('output-name').addEventListener('input',()=>{startId=null;controls();});
 if(mode==='convert')$('pick-file').addEventListener('click',()=>perform(async()=>{const result=await adapter.call('chooseInputFile');if(result){source=result;startId=null;renderSource();}}));
 else {
  let pasting=false;
  $('paste-link').addEventListener('click',async()=>{
   if(pasting||pending||busy())return;
   pasting=true;notice('');const input=$('source-url');input.focus();input.select();
   try{await adapter.call('pasteSourceUrl');}catch(e){set('link-error',e.message);}
   finally{pasting=false;}
  });
  async function cancelInspection(){const requestId=inspection;inspection=null;source=null;startId=null;renderSource();$('check-cancel').hidden=true;$('check-link').disabled=false;if(requestId){try{await adapter.call('cancelInspection',{requestId});}catch(e){notice(e.message);}}}
  $('source-url').addEventListener('input',()=>{cancelInspection();set('link-error','');$('source-url').removeAttribute('aria-invalid');});
  $('check-cancel').addEventListener('click',()=>{cancelInspection();set('link-error','ยกเลิกการตรวจสอบแล้ว');});
  $('check-link').addEventListener('click',async()=>{if(inspection)await cancelInspection();const requestId=uuid(),url=$('source-url').value.trim();inspection=requestId;source=null;renderSource();$('check-link').disabled=true;$('check-cancel').hidden=false;set('link-error','กำลังตรวจลิงก์จากเครื่องคุณ…');
   try{const result=await adapter.call('inspectUrl',{requestId,url});if(inspection!==requestId)return;source=result;startId=null;renderSource();set('link-error','ตรวจสอบต้นทางแล้ว');}
   catch(e){if(inspection===requestId){notice(e.message);set('link-error',e.message);if(['INVALID_REQUEST','UNSUPPORTED_SOURCE'].includes(e.code))$('source-url').setAttribute('aria-invalid','true');}}
   finally{if(inspection===requestId){$('check-link').disabled=false;$('check-cancel').hidden=true;}}
  });
  $('source-url').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('check-link').click();}});
 }
 window.addEventListener('pagehide',()=>{unsubscribe();if(inspection)adapter.call('cancelInspection',{requestId:inspection}).catch(()=>{});});
 set('folder-path','ยังไม่ได้เลือกโฟลเดอร์');renderSource();quality();renderJob(null);refresh();current();
})();
