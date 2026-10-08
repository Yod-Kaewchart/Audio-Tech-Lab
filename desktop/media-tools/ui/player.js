'use strict';
(() => {
 const $=id=>document.getElementById(id),adapter=window.createMediaAdapter(),queue=new window.PlayerQueue();
 const audio=document.createElement('audio');audio.id='player-audio';audio.preload='metadata';audio.volume=.8;audio.hidden=true;document.body.append(audio);
 const events=new AbortController();let tracks=[],current=null,status='idle',loading=false,adding=false,operation=0,playVersion=0,intent=false,dragged=null,resetting=false;
 const time=seconds=>Number.isFinite(seconds)?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'—:—';
 const ids=()=>tracks.map(t=>t.trackId),notice=message=>{$('notice').textContent=message||'';};
 const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:events.signal});
 function update(){
  const spinning=!!current&&status==='playing'&&!audio.paused&&!audio.ended&&!loading&&audio.readyState>=3;
  $('disc').dataset.spinning=String(spinning);
  $('playback-status').textContent=({idle:'พร้อมเริ่ม',stopped:'หยุดแล้ว',paused:'พัก',playing:'กำลังเล่น',ended:'จบเพลง',error:'เล่นไม่ได้'})[status];
  $('loading-status').hidden=!loading;$('import-status').hidden=!adding;
  $('play-pause').textContent=intent&&!audio.paused?'พัก':'เล่น';
  for(const name of ['previous','play-pause','next','stop'])$(name).disabled=!tracks.length||resetting;
  $('add-files').disabled=$('add-folder').disabled=adding||resetting;
  $('seek').disabled=!current||!Number.isFinite(audio.duration)||audio.duration<=0;
  for(const row of $('playlist').children){const active=row.dataset.id===current?.trackId;row.setAttribute('aria-current',String(active));row.querySelector('.playlist-state').textContent=active?' · '+$('playback-status').textContent:'';}
 }
 function progress(){const duration=Number.isFinite(audio.duration)?audio.duration:current?.metadata.durationSeconds;$('elapsed').textContent=time(current?audio.currentTime:0);$('duration').textContent=time(duration);$('seek').max=Number.isFinite(duration)&&duration>0?duration:1;$('seek').value=current?audio.currentTime:0;$('seek').setAttribute('aria-valuetext',`${$('elapsed').textContent} / ${$('duration').textContent}`);}
 function artwork(){
  const cover=$('artwork-mode').value==='cover'&&current?.artworkUrl;
  $('disc-artwork').hidden=!cover;$('disc-logo').hidden=!!cover;
  if(cover)$('disc-artwork').src=current.artworkUrl;else $('disc-artwork').removeAttribute('src');
  $('disc').setAttribute('aria-label',cover?'แผ่น CD ปกเพลง '+current.title:'แผ่น CD โลโก้ Audio Tech Labs');
  $('artwork-help').textContent=cover?'แสดงปกเพลง':$('artwork-mode').value==='cover'?'ไม่มีปกเพลง ใช้โลโก้ Audio Tech Labs':'ใช้โลโก้ Audio Tech Labs';
 }
 function metadata(){
  $('track-title').textContent=current?.title||'ยังไม่ได้เลือกเพลง';
  for(const field of ['artist','album']){$('track-'+field).hidden=!current?.[field];$('track-'+field).textContent=current?.[field]||'';}
  $('track-metadata').replaceChildren();const m=current?.metadata;if(m){
   for(const [label,value] of [['Format',m.codec&&m.container?`${m.codec} / ${m.container}`:m.codec||m.container],['Sample rate',m.sampleRateHz?`${m.sampleRateHz/1000} kHz`:null],['Bit depth',m.bitsPerSample?`${m.bitsPerSample} bit`:null],['Channels',m.channels]])if(value){const wrapper=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;wrapper.append(dt,dd);$('track-metadata').append(wrapper);}
  }artwork();progress();update();
 }
 function playlist(){
  const focus=document.activeElement?.closest('[data-id]')?.dataset.id,action=document.activeElement?.dataset.action;
  $('playlist').replaceChildren();$('track-count').textContent=`${tracks.length} เพลง`;$('playlist-empty').hidden=!!tracks.length;
  tracks.forEach((track,index)=>{
   const row=document.createElement('li');row.className='playlist-row';row.dataset.id=track.trackId;row.draggable=true;row.tabIndex=0;row.setAttribute('aria-label',`${index+1} ${track.title} · Enter เพื่อเล่น`);
   const number=document.createElement('span');number.className='playlist-number';number.textContent=index+1;
   const title=document.createElement('div');title.className='playlist-title';const strong=document.createElement('strong');strong.textContent=track.title;
   const detail=document.createElement('small');detail.textContent=track.artist||track.fileName;const state=document.createElement('span');state.className='playlist-state';detail.append(state);title.append(strong,detail);
   const duration=document.createElement('span');duration.className='playlist-duration';duration.textContent=time(track.metadata.durationSeconds);
   const actions=document.createElement('div');actions.className='playlist-actions';
   for(const [action,label] of [['play','เล่นเพลงนี้'],['up','เลื่อนขึ้น'],['down','เลื่อนลง'],['remove','ลบ']]){const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.action=action;button.textContent=label;button.setAttribute('aria-label',`${label} ${track.title}`);button.disabled=action==='up'&&index===0||action==='down'&&index===tracks.length-1;actions.append(button);}
   row.append(number,title,duration,actions);$('playlist').append(row);
  });update();if(focus){const row=$('playlist').querySelector(`[data-id="${focus}"]`);(action?row?.querySelector(`[data-action="${action}"]`):row)?.focus();}
 }
 function detach(){playVersion++;intent=false;audio.pause();audio.removeAttribute('src');audio.load();loading=false;}
 function select(trackId){
  const track=tracks.find(t=>t.trackId===trackId);if(!track)return;
  detach();current=track;queue.select(trackId);status='stopped';audio.src=track.mediaUrl;metadata();
 }
 async function play(trackId){
  if(!trackId&&!current&&tracks.length)trackId=tracks[0].trackId;
  if(trackId&&current?.trackId!==trackId)select(trackId);
  if(!current)return;
  const version=++playVersion;intent=true;notice('');
  if(current.mimeType&&!audio.canPlayType(current.mimeType)){status='error';intent=false;loading=false;notice(`เล่น “${current.fileName}” ไม่ได้: ตัวเล่นในรุ่นนี้ไม่รองรับ ${current.metadata.codec||'รูปแบบเสียงนี้'} กรุณาแปลงไฟล์ในหน้า Convert Audio`);update();return;}
  if(audio.ended)audio.currentTime=0;
  loading=audio.readyState<3;update();
  try{await audio.play();if(version!==playVersion)return;status='playing';loading=audio.readyState<3;update();}
  catch(e){if(version!==playVersion||e.name==='AbortError')return;intent=false;loading=false;status='error';notice(`เล่น “${current.fileName}” ไม่ได้: ไฟล์อาจถูกย้าย เสีย หรือใช้ codec ที่รุ่นนี้ไม่รองรับ ลองเลือกไฟล์ใหม่หรือแปลงใน Convert Audio`);update();}
 }
 function pause(){playVersion++;intent=false;audio.pause();status=current?'paused':'idle';loading=false;update();}
 function stop(){playVersion++;intent=false;audio.pause();if(audio.readyState)audio.currentTime=0;status=current?'stopped':'idle';loading=false;progress();update();}
 async function importTracks(method,files){
  if(adding)return;const version=++operation;adding=true;notice('');update();
  try{const result=await adapter.call(method,files);if(version!==operation)return;tracks=result.tracks;queue.sync(ids());playlist();notice(result.errors.join('\n'));}
  catch(e){if(version===operation)notice(e.message);}
  finally{if(version===operation){adding=false;update();}}
 }
 async function remove(trackId){
  const wasCurrent=current?.trackId===trackId,index=tracks.findIndex(t=>t.trackId===trackId);
  try{if(wasCurrent){detach();current=null;status='idle';}tracks=await adapter.call('playerRemove',trackId);queue.sync(ids());if(wasCurrent&&tracks.length)select(tracks[Math.min(index,tracks.length-1)].trackId);playlist();metadata();}
  catch(e){notice(e.message);metadata();}
 }
 async function reorder(trackId,targetId){
  const order=ids(),from=order.indexOf(trackId),to=order.indexOf(targetId);if(from<0||to<0||from===to)return;
  order.splice(to,0,order.splice(from,1)[0]);try{tracks=await adapter.call('playerReorder',order);queue.sync(ids());playlist();}catch(e){notice(e.message);}
 }
 async function reset(){
  if(resetting)return;resetting=true;update();
  try{if(!(await adapter.call('playerConfirmReset')))return;
   operation++;adding=false;detach();tracks=await adapter.call('playerReset');current=null;status='idle';queue.reset();$('repeat').value='off';$('shuffle').setAttribute('aria-pressed','false');$('artwork-mode').value='logo';audio.volume=.8;audio.muted=false;$('volume').value=.8;volume();$('file-input').value='';notice('');playlist();metadata();
   for(const animation of $('disc').getAnimations())animation.currentTime=0;
  }catch(e){notice(e.message);}finally{resetting=false;update();}
 }
 function volume(){audio.volume=Number($('volume').value);$('volume-value').textContent=Math.round(audio.volume*100)+'%';$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').textContent=audio.muted?'เปิดเสียง':'ปิดเสียง';}
 listen($('play-pause'),'click',()=>intent&&!audio.paused?pause():play());
 listen($('previous'),'click',()=>{if(tracks.length)play(queue.previous(ids()));});
 listen($('next'),'click',()=>play(queue.next(ids())));listen($('stop'),'click',stop);
 listen($('seek'),'input',()=>{if(!Number.isFinite(audio.duration))return;audio.currentTime=Math.min(audio.duration,Number($('seek').value));progress();});
 listen($('volume'),'input',volume);listen($('mute'),'click',()=>{audio.muted=!audio.muted;volume();});
 listen($('shuffle'),'click',()=>{queue.shuffle=!queue.shuffle;queue.bag=[];queue.visited=new Set(current?[current.trackId]:[]);queue.history=[];$('shuffle').setAttribute('aria-pressed',String(queue.shuffle));});
 listen($('repeat'),'change',()=>{queue.repeat=$('repeat').value;});listen($('artwork-mode'),'change',artwork);
 listen($('disc-artwork'),'error',()=>{if(current){current.artworkUrl=null;artwork();}});
 listen($('add-files'),'click',()=>importTracks('playerPickFiles'));listen($('add-folder'),'click',()=>importTracks('playerPickFolder'));
 listen($('file-input'),'change',()=>{const files=Array.from($('file-input').files);$('file-input').value='';importTracks('playerDrop',files);});listen($('new-job'),'click',reset);
 listen($('playlist'),'dblclick',event=>{if(event.target.closest('button'))return;const row=event.target.closest('[data-id]');if(row)play(row.dataset.id);});
 listen($('playlist'),'keydown',event=>{if(event.target.closest('button'))return;const row=event.target.closest('[data-id]');if(row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();play(row.dataset.id);}});
 listen($('playlist'),'click',event=>{const button=event.target.closest('[data-action]'),row=button?.closest('[data-id]');if(!row)return;const trackId=row.dataset.id,action=button.dataset.action,index=ids().indexOf(trackId);if(action==='play')play(trackId);else if(action==='remove')remove(trackId);else reorder(trackId,ids()[index+(action==='up'?-1:1)]);});
 listen($('playlist'),'dragstart',event=>{dragged=event.target.closest('[data-id]')?.dataset.id||null;if(dragged){event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';}});
 listen($('playlist'),'dragover',event=>{if(!dragged)return;event.preventDefault();event.stopPropagation();$('playlist').querySelectorAll('.drag-target').forEach(row=>row.classList.remove('drag-target'));event.target.closest('[data-id]')?.classList.add('drag-target');});
 listen($('playlist'),'drop',event=>{if(!dragged)return;event.preventDefault();event.stopPropagation();const target=event.target.closest('[data-id]')?.dataset.id;if(target)reorder(dragged,target);dragged=null;});
 listen($('playlist'),'dragend',()=>{dragged=null;$('playlist').querySelectorAll('.drag-target').forEach(row=>row.classList.remove('drag-target'));});
 listen(document,'dragover',event=>{event.preventDefault();if(Array.from(event.dataTransfer.types).includes('Files'))$('drop-zone').classList.add('drop-active');});
 listen(document,'dragleave',event=>{if(!event.relatedTarget)$('drop-zone').classList.remove('drop-active');});
 listen(document,'drop',event=>{event.preventDefault();$('drop-zone').classList.remove('drop-active');if(event.dataTransfer.files.length)importTracks('playerDrop',Array.from(event.dataTransfer.files));});
 for(const event of ['loadstart','waiting','seeking'])listen(audio,event,()=>{if(!current)return;loading=intent;update();});
 listen(audio,'stalled',()=>{if(!current)return;loading=intent&&audio.readyState<3;update();});
 for(const event of ['canplay','seeked','playing'])listen(audio,event,()=>{if(!current)return;loading=intent&&audio.readyState<3;if(intent&&!audio.paused&&!audio.ended)status='playing';update();});
 listen(audio,'pause',()=>{if(!audio.paused)return;if(intent){intent=false;status=current?'paused':'idle';}loading=false;update();});
 listen(audio,'timeupdate',progress);listen(audio,'durationchange',()=>{progress();update();});listen(audio,'loadedmetadata',()=>{progress();update();});
 listen(audio,'ended',()=>{intent=false;loading=false;status='ended';progress();update();const target=queue.next(ids(),true);if(target)play(target);});
 listen(audio,'error',()=>{if(!current||!audio.getAttribute('src'))return;intent=false;loading=false;status='error';notice(`เล่น “${current.fileName}” ไม่ได้: ตรวจว่าไฟล์ยังอยู่และไม่เสีย หรือลองแปลงรูปแบบในหน้า Convert Audio`);update();});
 listen(window,'pagehide',()=>{events.abort();detach();audio.remove();});
 metadata();playlist();adapter.call('playerList').then(result=>{tracks=result;queue.sync(ids());playlist();}).catch(e=>{notice(e.message);for(const name of ['add-files','add-folder','play-pause'])$(name).disabled=true;});
})();
