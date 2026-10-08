'use strict';
(() => {
 const bridge=window.playbackHost,queue=new window.PlayerQueue(),events=new AbortController();
 const audio=document.createElement('audio');audio.id='player-audio';audio.preload='metadata';audio.volume=.8;document.body.append(audio);
 const instanceId=crypto.randomUUID();let tracks=[],current=null,status='idle',loading=false,importing=false,intent=false,version=0,sequence=0,error='',artworkMode='logo';
 let discMs=0,discStarted=null;
 const ids=()=>tracks.map(t=>t.trackId),listen=(type,fn)=>audio.addEventListener(type,fn,{signal:events.signal});
 const spinning=()=>!!current&&status==='playing'&&!audio.paused&&!audio.ended&&!loading&&audio.readyState>=3;
 function snapshot(){
  const now=performance.now(),running=spinning();
  if(discStarted!==null&&!running){discMs+=now-discStarted;discStarted=null;}else if(discStarted===null&&running)discStarted=now;
  return {instanceId,sequence:++sequence,tracks,currentId:current?.trackId||null,status,loading,importing,error,paused:audio.paused,intent,currentTime:current?audio.currentTime:0,duration:Number.isFinite(audio.duration)?audio.duration:current?.metadata.durationSeconds??null,volume:audio.volume,muted:audio.muted,shuffle:queue.shuffle,repeat:queue.repeat,artworkMode,spinning:running,discMs:discMs+(discStarted===null?0:now-discStarted),sampledAt:performance.timeOrigin+now};
 }
 function emit(){const state=snapshot();bridge.publish({kind:'state',state});return state;}
 function detach(){version++;intent=false;audio.pause();audio.removeAttribute('src');audio.load();loading=false;}
 function select(trackId){const track=tracks.find(t=>t.trackId===trackId);if(!track)throw Error('ไม่พบเพลงนี้ใน Playlist');detach();current=track;queue.select(trackId);status='stopped';error='';audio.src=track.mediaUrl;emit();}
 async function play(trackId){
  if(!trackId&&!current&&tracks.length)trackId=tracks[0].trackId;
  if(trackId&&current?.trackId!==trackId)select(trackId);if(!current)return;
  const request=++version;intent=true;error='';
  if(current.mimeType&&!audio.canPlayType(current.mimeType)){status='error';intent=false;loading=false;error=`เล่น “${current.fileName}” ไม่ได้: ตัวเล่นในรุ่นนี้ไม่รองรับ ${current.metadata.codec||'รูปแบบเสียงนี้'} กรุณาแปลงไฟล์ในหน้า Convert Audio`;emit();return;}
  if(audio.ended)audio.currentTime=0;loading=audio.readyState<3;emit();
  try{await audio.play();if(request!==version)return;status='playing';loading=audio.readyState<3;emit();}
  catch(e){if(request!==version||e.name==='AbortError')return;intent=false;loading=false;status='error';error=`เล่น “${current.fileName}” ไม่ได้: ไฟล์อาจถูกย้าย เสีย หรือใช้ codec ที่รุ่นนี้ไม่รองรับ ลองเลือกไฟล์ใหม่หรือแปลงใน Convert Audio`;emit();}
 }
 function pause(){version++;intent=false;audio.pause();status=current?'paused':'idle';loading=false;}
 function stop(){version++;intent=false;audio.pause();if(audio.readyState)audio.currentTime=0;status=current?'stopped':'idle';loading=false;}
 function setTracks(next){
  const oldIndex=tracks.findIndex(t=>t.trackId===current?.trackId),removed=!!current&&!next.some(t=>t.trackId===current.trackId);
  if(removed){detach();current=null;status='idle';error='';}tracks=next;queue.sync(ids());
  if(removed&&tracks.length)select(tracks[Math.min(oldIndex,tracks.length-1)].trackId);
  else if(current)current=tracks.find(t=>t.trackId===current.trackId);
 }
 function reset(){detach();tracks=[];current=null;status='idle';queue.reset();error='';importing=false;artworkMode='logo';audio.volume=.8;audio.muted=false;discMs=0;discStarted=null;}
 async function command(c){
  switch(c.type){
   case 'state':break;
   case 'tracks':setTracks(c.tracks);break;
   case 'importing':importing=c.value;break;
   case 'play':await play(c.trackId);break;
   case 'toggle':if(intent&&!audio.paused)pause();else await play();break;
   case 'pause':pause();break;
   case 'stop':stop();break;
   case 'next':await play(queue.next(ids()));break;
   case 'previous':await play(queue.previous(ids()));break;
   case 'seek':if(current&&Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,c.value);break;
   case 'volume':audio.volume=c.value;break;
   case 'mute':audio.muted=c.value;break;
   case 'shuffle':queue.shuffle=c.value;queue.bag=[];queue.visited=new Set(current?[current.trackId]:[]);queue.history=[];break;
   case 'repeat':queue.repeat=c.value;break;
   case 'artwork':artworkMode=c.value;break;
   case 'reset':reset();break;
   case 'shutdown':reset();events.abort();unsubscribe();audio.remove();break;
   default:throw Error('คำสั่ง Player ไม่ถูกต้อง');
  }return emit();
 }
 // Commands may await play(), but Stop/Reset must still interrupt that pending play promise.
 const unsubscribe=bridge.receive(async({id,command:c})=>{try{bridge.publish({kind:'reply',id,state:await command(c)});}catch(e){bridge.publish({kind:'reply',id,error:{message:e.message}});}});
 for(const type of ['loadstart','waiting','seeking'])listen(type,()=>{if(current){loading=intent;emit();}});
 listen('stalled',()=>{if(current){loading=intent&&audio.readyState<3;emit();}});
 for(const type of ['canplay','seeked','playing'])listen(type,()=>{if(current){loading=intent&&audio.readyState<3;if(intent&&!audio.paused&&!audio.ended)status='playing';emit();}});
 listen('pause',()=>{if(!audio.paused)return;if(intent){intent=false;status=current?'paused':'idle';}loading=false;emit();});
 for(const type of ['timeupdate','durationchange','loadedmetadata','volumechange'])listen(type,emit);
 listen('ended',()=>{intent=false;loading=false;status='ended';emit();const target=queue.next(ids(),true);if(target)play(target);});
 listen('error',()=>{if(!current||!audio.getAttribute('src'))return;intent=false;loading=false;status='error';error=`เล่น “${current.fileName}” ไม่ได้: ตรวจว่าไฟล์ยังอยู่และไม่เสีย หรือลองแปลงรูปแบบในหน้า Convert Audio`;emit();});
 window.addEventListener('pagehide',()=>{reset();events.abort();unsubscribe();},{once:true});emit();
})();
