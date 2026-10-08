'use strict';
(() => {
 const $=id=>document.getElementById(id),adapter=window.createMediaAdapter();
 const events=new AbortController(),failedArtwork=new Set();let tracks=[],current=null,adding=false,operation=0,dragged=null,resetting=false,active=true,playlistKey='';
 let state={sequence:0,status:'idle',loading:false,paused:true,intent:false,currentTime:0,duration:null,volume:.8,muted:false,shuffle:false,repeat:'off',artworkMode:'logo',spinning:false,discMs:0,importing:false,error:''};
 const time=seconds=>Number.isFinite(seconds)?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'—:—';
 const ids=()=>tracks.map(t=>t.trackId),notice=message=>{$('notice').textContent=message||'';};
 const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:events.signal});
 function update(){
  $('disc').dataset.spinning=String(state.spinning);
  const elapsed=state.discMs+(state.spinning?Math.max(0,performance.timeOrigin+performance.now()-state.sampledAt):0);
  for(const animation of $('disc').getAnimations())animation.currentTime=elapsed;
  $('playback-status').textContent=({idle:'พร้อมเริ่ม',stopped:'หยุดแล้ว',paused:'พัก',playing:'กำลังเล่น',ended:'จบเพลง',error:'เล่นไม่ได้'})[state.status];
  $('loading-status').hidden=!state.loading;$('import-status').hidden=!(adding||state.importing);
  $('play-pause').textContent=state.intent&&!state.paused?'พัก':'เล่น';
  for(const name of ['previous','play-pause','next','stop'])$(name).disabled=!tracks.length||resetting;
  $('add-files').disabled=$('add-folder').disabled=adding||state.importing||resetting;
  $('seek').disabled=!current||!Number.isFinite(state.duration)||state.duration<=0;
  for(const row of $('playlist').children){const active=row.dataset.id===current?.trackId;row.setAttribute('aria-current',String(active));row.querySelector('.playlist-state').textContent=active?' · '+$('playback-status').textContent:'';}
 }
 function progress(){const duration=state.duration;$('elapsed').textContent=time(state.currentTime);$('duration').textContent=time(duration);$('seek').max=Number.isFinite(duration)&&duration>0?duration:1;$('seek').value=state.currentTime;$('seek').setAttribute('aria-valuetext',`${$('elapsed').textContent} / ${$('duration').textContent}`);}
 function artwork(){
  const cover=$('artwork-mode').value==='cover'&&current?.artworkUrl&&!failedArtwork.has(current.artworkUrl);
  $('disc-artwork').hidden=!cover;$('disc-logo').hidden=!!cover;
  if(cover){if($('disc-artwork').getAttribute('src')!==current.artworkUrl)$('disc-artwork').src=current.artworkUrl;}else $('disc-artwork').removeAttribute('src');
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
 function receive(next){
  if(!active||!next||next.sequence<=state.sequence)return;
  const changed=next.currentId!==state.currentId,previousError=state.error;
  state=next;tracks=state.tracks;current=tracks.find(t=>t.trackId===state.currentId)||null;
  $('repeat').value=state.repeat;$('shuffle').setAttribute('aria-pressed',String(state.shuffle));$('artwork-mode').value=state.artworkMode;
  $('volume').value=state.volume;$('volume-value').textContent=Math.round(state.volume*100)+'%';$('mute').setAttribute('aria-pressed',String(state.muted));$('mute').textContent=state.muted?'เปิดเสียง':'ปิดเสียง';
  const key=JSON.stringify(tracks);if(key!==playlistKey){playlistKey=key;playlist();}
  if(changed)metadata();else artwork();progress();update();if(state.error!==previousError)notice(state.error);
 }
 async function command(type,extra={}){try{receive(await adapter.call('playerCommand',{type,...extra}));}catch(e){if(active)notice(e.message);}}
 const play=trackId=>command('play',trackId?{trackId}:{});
 async function importTracks(method,files){
  if(adding)return;const version=++operation;adding=true;notice('');update();
  try{const result=await adapter.call(method,files);if(version!==operation||!active)return;notice(result.errors.join('\n'));}
  catch(e){if(version===operation)notice(e.message);}
  finally{if(version===operation&&active){adding=false;update();}}
 }
 async function remove(trackId){
  try{await adapter.call('playerRemove',trackId);}catch(e){if(active)notice(e.message);}
 }
 async function reorder(trackId,targetId){
  const order=ids(),from=order.indexOf(trackId),to=order.indexOf(targetId);if(from<0||to<0||from===to)return;
  order.splice(to,0,order.splice(from,1)[0]);try{await adapter.call('playerReorder',order);}catch(e){if(active)notice(e.message);}
 }
 async function reset(){
  if(resetting)return;resetting=true;update();
  try{if(!(await adapter.call('playerConfirmReset')))return;
   operation++;adding=false;await adapter.call('playerReset');if(!active)return;failedArtwork.clear();$('file-input').value='';notice('');receive(await adapter.call('playerGetState'));
  }catch(e){if(active)notice(e.message);}finally{resetting=false;if(active)update();}
 }
 listen($('play-pause'),'click',()=>command('toggle'));
 listen($('previous'),'click',()=>command('previous'));
 listen($('next'),'click',()=>command('next'));listen($('stop'),'click',()=>command('stop'));
 listen($('seek'),'input',()=>command('seek',{value:Number($('seek').value)}));
 listen($('volume'),'input',()=>command('volume',{value:Number($('volume').value)}));listen($('mute'),'click',()=>command('mute',{value:!state.muted}));
 listen($('shuffle'),'click',()=>command('shuffle',{value:!state.shuffle}));
 listen($('repeat'),'change',()=>command('repeat',{value:$('repeat').value}));listen($('artwork-mode'),'change',()=>command('artwork',{value:$('artwork-mode').value}));
 listen($('disc-artwork'),'error',()=>{if(current?.artworkUrl){failedArtwork.add(current.artworkUrl);artwork();}});
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
 const unsubscribe=adapter.subscribePlayer(receive);
 listen(window,'pagehide',()=>{active=false;operation++;events.abort();unsubscribe();});
 metadata();playlist();adapter.call('playerGetState').then(receive).catch(e=>{if(!active)return;notice(e.message);for(const name of ['add-files','add-folder','play-pause'])$(name).disabled=true;});
})();
