const API="https://had-instant-coupons-license.trycloudflare.com";
const MAX_BYTES=2000*1000*1000,allowed=new Set(["wav","flac","m4a"]);
const input=document.querySelector("#audio-file"),zone=document.querySelector("#drop-zone"),result=document.querySelector("#file-result"),error=document.querySelector("#upload-error"),nameEl=document.querySelector("#file-name"),metaEl=document.querySelector("#file-meta"),preview=document.querySelector("#preview-player"),audio=document.querySelector("#audio-preview"),previewStatus=document.querySelector("#preview-status"),uploadButton=document.querySelector("#upload-button"),progress=document.querySelector("#upload-progress"),fill=document.querySelector("#progress-fill"),percent=document.querySelector("#progress-percent"),progressText=document.querySelector("#progress-text");
let objectUrl=null,selectedFile=null;
function setProgress(value,text){const p=Math.max(0,Math.min(100,value));fill.style.width=p+"%";percent.textContent=Math.floor(p)+"%";progressText.textContent=text}
function showFile(file){const ext=(file.name.split(".").pop()||"").toLowerCase();let message="";
if(!allowed.has(ext))message="รองรับเฉพาะ WAV, FLAC และ ALAC (.m4a)";else if(file.size>MAX_BYTES)message="ไฟล์ใหญ่เกิน 2,000 MB";
error.hidden=!message;error.textContent=message;result.hidden=Boolean(message);progress.hidden=true;uploadButton.disabled=Boolean(message);
if(message){selectedFile=null;input.value="";preview.style.display="none";audio.removeAttribute("src");audio.load();return}
selectedFile=file;nameEl.textContent=file.name;metaEl.textContent=(file.size/1000000).toFixed(2)+" MB · "+ext.toUpperCase();
if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);audio.src=objectUrl;audio.load();preview.style.display="block";previewStatus.textContent="พร้อมเล่นจากไฟล์ในอุปกรณ์โดยตรง";
}
input.addEventListener("change",()=>input.files[0]&&showFile(input.files[0]));
["dragenter","dragover"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add("is-dragging")}));
["dragleave","drop"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove("is-dragging")}));
zone.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)showFile(f)});
async function jsonPost(url,data,headers={}){const r=await fetch(API+url,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}
uploadButton.addEventListener("click",async()=>{if(!selectedFile)return;uploadButton.disabled=true;progress.hidden=false;setProgress(0,"กำลังสร้าง Upload session…");
try{const init=await jsonPost("/upload/init",{name:selectedFile.name,size:selectedFile.size});const chunkSize=init.chunkSize;let sent=0,index=0;
while(sent<selectedFile.size){const end=Math.min(sent+chunkSize,selectedFile.size),blob=selectedFile.slice(sent,end);const r=await fetch(API+"/upload/chunk",{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Upload-Id":init.uploadId,"X-Chunk-Index":String(index)},body:blob});const j=await r.json();if(!r.ok)throw new Error(j.error||("HTTP "+r.status));sent=end;index++;setProgress(sent/selectedFile.size*100,"ส่งแล้ว "+(sent/1000000).toFixed(1)+" / "+(selectedFile.size/1000000).toFixed(1)+" MB")}
const done=await jsonPost("/upload/complete",{uploadId:init.uploadId});setProgress(100,"UPLOAD COMPLETE · "+done.name+" · พร้อมสำหรับ Analyze");uploadButton.textContent="Uploaded to Modify";
}catch(e){error.hidden=false;error.textContent="Upload failed: "+e.message;setProgress(0,"Upload ไม่สำเร็จ");uploadButton.disabled=false}
});
audio.addEventListener("loadedmetadata",()=>{const s=Math.floor(audio.duration||0),m=Math.floor(s/60),ss=String(s%60).padStart(2,"0");previewStatus.textContent="Duration "+m+":"+ss+" · Local playback"});
audio.addEventListener("error",()=>previewStatus.textContent="Browser ไม่สามารถเล่น codec ของไฟล์นี้ได้");
window.addEventListener("beforeunload",()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});
