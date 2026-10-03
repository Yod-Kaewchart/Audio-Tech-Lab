'use strict';

const API='/api';
const input=document.querySelector('#merge-files'),list=document.querySelector('#merge-tracks');
const upload=document.querySelector('#upload-tracks'),merge=document.querySelector('#merge-button'),error=document.querySelector('#merge-error');
const uploadStatus=document.querySelector('#upload-status'),mergeStatus=document.querySelector('#merge-status'),download=document.querySelector('#merge-download');
let tracks=[],csrf='',epoch=0,deleteBusy=false,currentExportId=null,uploadBusy=false,mergeBusy=false,playingTrack=null,playUrl=null,previewPreparing=false;
const player=document.querySelector('#merge-player');
function updatePlaybackUi(){if(!playingTrack)return;const rows=[...list.querySelectorAll('.merge-track')],i=tracks.indexOf(playingTrack),row=rows[i];if(!row)return;const state=row.querySelector('.merge-play-state'),play=row.querySelector('.play'),stop=row.querySelector('.stop');if(state)state.textContent=(player.paused?'PAUSED':'PLAYING')+' · '+clock(player.currentTime)+' / '+clock(player.duration);if(play)play.textContent=player.paused?'▶ Play':'❚❚ Pause';if(stop){stop.disabled=false;stop.removeAttribute('disabled')}}
player.ontimeupdate=updatePlaybackUi;
player.onplay=updatePlaybackUi;
player.onpause=updatePlaybackUi;
player.onended=()=>{if(playingTrack){player.currentTime=0;player.pause();updatePlaybackUi()}};
player.onerror=()=>{const t=playingTrack;if(!t)return;const ext=(t.file.name.split('.').pop()||'').toLowerCase();if(t.previewMode==='stream'&&ext==='m4a'&&t.uploaded){prepareTrackPreview(t);return}t.previewStatus='PLAYBACK UNAVAILABLE';render()};

async function request(route,options={}){
  window.demoServer?.requireOnline();
  const h=new Headers(options.headers||{});
  if(options.method&&options.method!=='GET'&&csrf)h.set('X-CSRF-Token',csrf);
  let r;
  try { r=await fetch(API+route,{...options,headers:h,credentials:'same-origin',cache:'no-store'}); }
  catch(cause){ void window.demoServer?.check(); throw Object.assign(new Error(window.demoServer?.offlineText||'เซิร์ฟเวอร์ประมวลผลออฟไลน์ชั่วคราว'),{offline:true,cause}); }
  const j=await r.json();
  if(!r.ok)throw Object.assign(new Error(j.error||'Request failed'),{status:r.status});
  return j;
}
const post=(route,data)=>request(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const size=n=>(n/1000000).toFixed(1)+' MB';
const format=file=>(file.name.split('.').pop()||'').toUpperCase();

function clearMergeResult(){
  epoch++;
  currentExportId=null;download.replaceChildren();
  if(!mergeBusy)mergeStatus.textContent=tracks.length<2?'เพิ่มอย่างน้อย 2 Tracks เพื่อเริ่ม':tracks.every(t=>t.uploaded)?'พร้อม Merge Audio':'Upload Tracks to Modify ก่อน Merge';
}

const clock=s=>{if(!Number.isFinite(s))return'0:00';const m=Math.floor(s/60),sec=String(Math.floor(s%60)).padStart(2,'0');return m+':'+sec};
function stopPlayback(reset=true){player.pause();if(reset)try{player.currentTime=0}catch{};if(playUrl){URL.revokeObjectURL(playUrl);playUrl=null}player.removeAttribute('src');player.load();playingTrack=null;render()}
function setPlayerSource(track,url,mode){player.pause();player.src=url;player.load();playingTrack=track;track.previewMode=mode;player.play().then(updatePlaybackUi).catch(()=>{})}
async function playTrack(track){
  if(playingTrack===track&&!player.paused){player.pause();updatePlaybackUi();return}
  if(playingTrack===track&&player.paused&&player.src){player.play().then(updatePlaybackUi).catch(()=>{});return}
  if(playUrl){URL.revokeObjectURL(playUrl);playUrl=null}
  if(track.uploaded){setPlayerSource(track,API+'/audio/'+encodeURIComponent(track.id),'stream');return}
  playUrl=URL.createObjectURL(track.file);setPlayerSource(track,playUrl,'local');
}
async function prepareTrackPreview(track){if(previewPreparing||!track.uploaded)return;previewPreparing=true;track.previewStatus='PREPARING PREVIEW';render();try{let job=await post('/preview',{fileId:track.id,requestId:crypto.randomUUID()});for(;;){if(!tracks.includes(track))return;if(job.status==='succeeded')break;if(job.status==='failed'||job.status==='cancelled')throw new Error(job.error||'Preview conversion failed');await new Promise(r=>setTimeout(r,1200));job=await request('/jobs/'+job.jobId)}if(!tracks.includes(track))return;track.previewStatus='';setPlayerSource(track,API+job.result.url,'converted')}catch(e){track.previewStatus='PREVIEW FAILED';error.hidden=false;error.textContent='Preview failed · '+e.message;render()}finally{previewPreparing=false}}
function render(){
  list.replaceChildren();
  const busy=uploadBusy||mergeBusy||deleteBusy;
  const serverOffline=window.demoServer?.isOnline()!==true;
  const hasUploaded=tracks.some(t=>t.uploaded);
  tracks.forEach((t,i)=>{
    const row=document.createElement('div');row.className='merge-track';
    const order=document.createElement('b');order.className='merge-order';order.textContent=String(i+1).padStart(2,'0');

    const info=document.createElement('div');info.className='merge-track-info';
    const name=document.createElement('strong');name.textContent=t.file.name;
    const meta=document.createElement('div');meta.className='merge-track-meta';
    const detail=document.createElement('span');detail.textContent=size(t.file.size)+' · '+format(t.file);
    const location=document.createElement('small');location.className='merge-location';location.textContent=t.uploaded?'ON MODIFY':'READY';
    meta.append(detail,location);
    const playState=document.createElement('small');playState.className='merge-play-state';
    if(t.previewStatus)playState.textContent=t.previewStatus;
    else if(playingTrack===t)playState.textContent=(player.paused?'PAUSED':'PLAYING')+' · '+clock(player.currentTime)+' / '+clock(player.duration);
    info.append(name,meta,playState);

    const actions=document.createElement('div');actions.className='merge-actions';
    [['↑',-1],['↓',1]].forEach(([label,delta])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.disabled=busy||hasUploaded||i+delta<0||i+delta>=tracks.length;
      b.onclick=()=>{[tracks[i],tracks[i+delta]]=[tracks[i+delta],tracks[i]];clearMergeResult();render()};
      actions.append(b);
    });

    const play=document.createElement('button');play.type='button';play.className='play';play.textContent=playingTrack===t&&!player.paused?'❚❚ Pause':'▶ Play';play.disabled=busy;play.onclick=()=>playTrack(t);actions.append(play);
    const stop=document.createElement('button');stop.type='button';stop.className='stop';stop.textContent='■ Stop';stop.disabled=busy;stop.onclick=()=>{if(playingTrack)stopPlayback()};actions.append(stop);

    const del=document.createElement('button');del.type='button';del.className='remove';
    del.textContent=t.uploaded?'Remove from Modify':'Remove';del.disabled=busy;
    del.onclick=()=>removeTrack(t,del);
    actions.append(del);
    row.append(order,info,actions);list.append(row);
  });

  document.querySelector('#track-summary').textContent=tracks.length?tracks.length+' Tracks · '+size(tracks.reduce((a,t)=>a+t.file.size,0)):'ยังไม่ได้เลือกเพลง';
  input.disabled=busy;
  upload.disabled=serverOffline||busy||tracks.length<2||tracks.every(t=>t.uploaded);
  merge.disabled=serverOffline||busy||tracks.length<2||tracks.some(t=>!t.uploaded);
  if(!busy&&tracks.length<2)mergeStatus.textContent='เพิ่มอย่างน้อย 2 Tracks เพื่อเริ่ม';
  else if(!busy&&tracks.some(t=>!t.uploaded))mergeStatus.textContent='Upload Tracks to Modify ก่อน Merge';
  else if(!busy&&!download.childElementCount)mergeStatus.textContent='พร้อม Merge Audio';
}

function addFiles(files){
  if(uploadBusy||mergeBusy||deleteBusy)return;
  let added=0;
  for(const file of files){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['wav','flac','m4a'].includes(ext)||file.size<=0||file.size>2000*1000*1000)continue;
    if(tracks.length<50){tracks.push({file,uploaded:false,id:null,previewMode:'local',previewStatus:''});added++}
  }
  if(added){clearMergeResult();uploadStatus.textContent=''}
  render();
}

async function removeTrack(track,button){
  if(uploadBusy||mergeBusy||deleteBusy)return;
  const index=tracks.indexOf(track);if(index<0)return;
  if(!track.uploaded&&!track.pendingId){
    if(playingTrack===track)stopPlayback();
    tracks.splice(index,1);clearMergeResult();uploadStatus.textContent='';render();return;
  }
  if(!confirm('Remove from Modify?\n\n'+track.file.name))return;
  deleteBusy=true;render();error.hidden=true;
  try{
    await post('/upload/remove',{fileId:track.id||track.pendingId});
    if(playingTrack===track)stopPlayback();
    const current=tracks.indexOf(track);if(current>=0)tracks.splice(current,1);
    clearMergeResult();uploadStatus.textContent='';window.demoResourcesChanged();render();
  }catch(e){
    error.hidden=false;error.textContent='Remove failed · '+e.message;
  }finally{deleteBusy=false;render()}
}

input.onchange=()=>{addFiles(input.files);input.value=''};
const drop=document.querySelector('#merge-drop');
drop.ondragover=e=>e.preventDefault();
drop.ondrop=e=>{e.preventDefault();if(!uploadBusy&&!mergeBusy)addFiles(e.dataTransfer.files)};

async function uploadOne(t,index){
  if(t.pendingId){await post('/upload/remove',{fileId:t.pendingId});t.pendingId=null}
  const init=await post('/upload/init',{name:t.file.name,size:t.file.size});
  t.pendingId=init.uploadId;let sent=0,n=0;
  while(sent<t.file.size){
    const end=Math.min(sent+init.chunkSize,t.file.size);
    const r=await request('/upload/chunk',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Upload-Id':init.uploadId,'X-Chunk-Index':String(n)},body:t.file.slice(sent,end)});
    sent=end;n++;
    uploadStatus.textContent='Uploading '+(index+1)+' / '+tracks.length+' · '+Math.floor(sent/t.file.size*100)+'%';
  }
  const done=await post('/upload/complete',{uploadId:init.uploadId});
  t.pendingId=null;t.id=done.fileId;t.uploaded=true;if(playingTrack===t)stopPlayback();else render();
}

upload.onclick=async()=>{
  if(uploadBusy||mergeBusy||deleteBusy)return;
  uploadBusy=true;error.hidden=true;clearMergeResult();render();
  try{
    for(let i=0;i<tracks.length;i++)if(!tracks[i].uploaded)await uploadOne(tracks[i],i);
    uploadStatus.textContent='UPLOAD COMPLETE · '+tracks.length+' Tracks พร้อม Merge';
  }catch(e){
    error.hidden=false;error.textContent='Upload failed · '+e.message;
  }finally{
    uploadBusy=false;render();
  }
};

async function waitJob(job){
  for(;;){
    mergeStatus.textContent=job.status==='queued'?'WAITING IN QUEUE · '+job.position:'MERGING…';
    if(job.status==='succeeded')return job.result;
    if(job.status==='failed'||job.status==='cancelled')throw new Error(job.error||'Merge cancelled');
    await new Promise(r=>setTimeout(r,2000));
    try{job=await request('/jobs/'+job.jobId)}
    catch(e){if(!e.offline)throw e;mergeStatus.textContent='ขาดการเชื่อมต่อ · รอ Server กลับมาเพื่อโหลดสถานะงาน';await window.demoServer.whenOnline()}
  }
}

merge.onclick=async()=>{
  if(uploadBusy||mergeBusy||deleteBusy)return;
  mergeBusy=true;error.hidden=true;const my=++epoch;render();
  try{
    let job=await post('/merge',{fileIds:tracks.map(t=>t.id),format:document.querySelector('#merge-format').value,name:document.querySelector('#album-name').value.trim(),requestId:crypto.randomUUID()});
    const out=await waitJob(job);if(my!==epoch)return;
    const f=out.files[0];currentExportId=out.jobId;download.replaceChildren();
    const a=document.createElement('a');a.href=API+'/download/'+encodeURIComponent(out.jobId)+'/'+encodeURIComponent(f.name);a.target='_blank';a.rel='noopener';a.textContent='Download '+f.name+' · '+size(f.size);download.append(a);
    mergeStatus.textContent='MERGE COMPLETE · '+out.tracks+' Tracks · ไฟล์หมดอายุหลัง 59 นาที';
  }catch(e){
    error.hidden=false;error.textContent='Merge failed · '+e.message;
  }finally{
    mergeBusy=false;render();
  }
};

let authConnect=null;
function connectMerge(){
  if(authConnect||window.demoServer?.isOnline()!==true)return authConnect;
  authConnect=(async()=>{
    try{
      const me=await request('/auth/me');csrf=me.csrf;
      document.querySelector('#account-name').textContent=me.user.username;
      if(me.user.mustChange)throw Object.assign(new Error('กรุณาตั้งรหัสผ่านใหม่ที่หน้า Split Audio ก่อน'),{mustChange:true});
      document.querySelector('#auth-gate').hidden=true;
      document.querySelector('#merge-workspace').hidden=false;
      document.querySelector('#auth-status').textContent='';
      document.querySelector('#login-link').hidden=true;
      render();
    }catch(e){
      document.querySelector('#merge-workspace').hidden=true;
      document.querySelector('#auth-gate').hidden=false;
      document.querySelector('#auth-status').textContent=e.status===401?'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง':e.message||'กรุณาเข้าสู่ระบบก่อน';
      document.querySelector('#login-link').hidden=false;
    }
  })().finally(()=>{authConnect=null});
  return authConnect;
}
window.addEventListener('demo-server-state',({detail})=>{
  render();
  if(detail.state==='offline'){document.querySelector('#auth-status').textContent=window.demoServer.offlineText;return}
  if(detail.state==='online'&&detail.previous!=='online')void connectMerge();
});
render();
if(window.demoServer?.isOnline()===true)void connectMerge();
else if(window.demoServer?.state==='offline'){document.querySelector('#auth-status').textContent=window.demoServer.offlineText;document.querySelector('#login-link').hidden=false}

window.demoResourceView=()=>({ids:tracks.filter(t=>t.uploaded).map(t=>t.id),exportId:currentExportId});
window.addEventListener('demo-resources',({detail:{view,state}})=>{
 const removed=tracks.filter(t=>t.uploaded&&view.ids.includes(t.id)&&!state.files.includes(t.id));
 if(removed.length){if(removed.includes(playingTrack))stopPlayback();tracks=tracks.filter(t=>!removed.includes(t));clearMergeResult();render()}
 else if(view.exportId&&view.exportId===currentExportId&&!state.exports.includes(view.exportId)){clearMergeResult();render()}
});
