'use strict';
const {app,BrowserWindow,dialog}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {Engine}=require('../src/engine.cjs'),{id}=require('../src/common.cjs');
const mode=process.env.ATL_RESET_PAGE==='convert'?'convert':'download';
const root=path.resolve('test-output/new-job-reset-forms-'+mode+'-'+Date.now());
const output=path.join(root,'ผู้ใช้-งานก่อนหน้า.flac'), profile=path.join(root,'profile');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const originalInit=Engine.prototype.init;
let liveEngine;
Engine.prototype.init=async function(){
 await originalInit.call(this);liveEngine=this;
 this.job={jobId:id(),sequence:5,mode,status:'succeeded',sourceName:'งานก่อนหน้า',output:{resultId:id(),fileName:path.basename(output),displayPath:output,metadata:{codec:'flac',container:'flac',sampleRateHz:44100,bitsPerSample:16,bytes:21,durationSeconds:4,channels:2},available:true},error:null,progress:{stage:'complete',stagePercent:100,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:4}};
 await this.persist();return this;
};
Engine.prototype.inspect=async function(){
 const dto={sourceId:id(),mode:'download',displayName:'ตรวจลิงก์ทดสอบ',metadata:{codec:'opus',container:'webm',durationSeconds:180},validUntil:new Date(Date.now()+60000).toISOString()};
 this.sources.set(dto.sourceId,{dto,url:'https://www.youtube.com/watch?v=abcdefghijk'});return dto;
};
Engine.prototype.registerFile=async function(){
 const dto={sourceId:id(),mode:'convert',displayName:'ต้นฉบับ-ทดสอบ.wav',metadata:{codec:'pcm_s16le',container:'wav',durationSeconds:3},validUntil:new Date(Date.now()+60000).toISOString()};
 this.sources.set(dto.sourceId,{dto});return dto;
};
Engine.prototype.registerFolder=async function(){
 const dto={folderId:id(),displayPath:path.join(root,'chosen-output'),writable:true,freeBytes:1000000000};
 this.folders.set(dto.folderId,{dto});return dto;
};
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});
async function until(check,label){for(let n=0;n<120;n++){try{if(await check())return;}catch{}await sleep(80);}throw Error('Timeout: '+label);}
(async()=>{
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(output,'PRESERVE_AUDIO_ORIGINAL');
 app.setPath('userData',profile);
 require('../src/main.cjs');await app.whenReady();
 await until(()=>BrowserWindow.getAllWindows().length,'window');
 const win=BrowserWindow.getAllWindows()[0];
 const run=js=>win.webContents.executeJavaScript(js);
 await until(()=>run("document.querySelector('#new-job')&&!document.querySelector('#new-job').hidden"),'terminal job');
 if(mode==='convert'){
  await win.loadURL('atl-media://app/convert.html');
  await until(()=>run("document.querySelector('#new-job')&&!document.querySelector('#new-job').hidden"),'Convert loaded');
  await run("document.querySelector('#pick-file').click()");
  await until(()=>run("document.querySelector('#source-title').textContent==='ต้นฉบับ-ทดสอบ.wav'"),'file selected');
 }else{
  await run("(() => {let u=document.querySelector('#source-url');u.value='https://youtu.be/abcdefghijk';u.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#check-link').click();})()");
  await until(()=>run("document.querySelector('#source-title').textContent==='ตรวจลิงก์ทดสอบ'"),'URL inspected');
  await run("(()=>{let n=document.querySelector('#output-name');n.value='อัลบั้มใหม่';n.dispatchEvent(new Event('input',{bubbles:true}));})()");
 }
 await run("document.querySelector('#pick-folder').click()");
 await until(()=>run("document.querySelector('#folder-path').textContent.includes('chosen-output')"),'folder selected');
 await run("(()=>{document.querySelector('input[name=format][value=MP3]').click();let el=document.querySelector('#bitrate');el.value='320 kbps';el.dispatchEvent(new Event('change',{bubbles:true}));})()");
 const before=await run("({source:document.querySelector('#source-title').textContent,folder:document.querySelector('#folder-path').textContent,format:document.querySelector('input[name=format]:checked')?.value})");
 assert.equal(before.format,'MP3');assert.ok(before.folder.includes('chosen-output'));assert.notEqual(before.source,'ยังไม่ได้เลือกแหล่งเสียง');
 assert.equal(liveEngine.sources.size,1);assert.equal(liveEngine.folders.size,1);
 await run("document.querySelector('#new-job').click()");
 await until(()=>run("document.querySelector('#job-badge').textContent==='พร้อมเริ่ม'&&document.querySelector('#new-job').hidden"),'reset done');
 const info=await run("(() => ({url:document.querySelector('#source-url')?.value??null,customName:document.querySelector('#output-name')?.value??null,sourceTitle:document.querySelector('#source-title').textContent,sourceMetadata:document.querySelector('#source-metadata').children.length,folder:document.querySelector('#folder-path').textContent,selectedFormats:document.querySelectorAll('input[name=format]:checked').length,bitrate:document.querySelector('#bitrate').value,sampleRate:document.querySelector('#sample-rate').value,bitDepth:document.querySelector('#bit-depth').value,startDisabled:document.querySelector('#start').disabled,startHelp:document.querySelector('#start-help').textContent,resultHidden:document.querySelector('#result').hidden,resultName:document.querySelector('#result-name').textContent,progressHidden:document.querySelector('#progress-area').hidden,progressStage:document.querySelector('#progress-stage').textContent,jobTitle:document.querySelector('#job-title').textContent,message:document.querySelector('#notice').textContent}))()");
 assert.equal(info.url,mode==='download'?'':null,mode+' URL');
 assert.equal(info.customName,mode==='download'?'':null,mode+' filename');
 assert.equal(info.sourceTitle,'ยังไม่ได้เลือกแหล่งเสียง');
 assert.equal(info.sourceMetadata,0);
 assert.equal(info.folder,'ยังไม่ได้เลือกโฟลเดอร์');
 assert.equal(info.selectedFormats,0);
 assert.equal(info.bitrate,'192 kbps');assert.equal(info.sampleRate,'source');assert.equal(info.bitDepth,'16 bit');
 assert.equal(info.startDisabled,true);assert.equal(info.resultHidden,true);assert.equal(info.resultName,'');
 assert.equal(info.progressHidden,true);assert.equal(info.progressStage,'');
 assert.equal(info.jobTitle,'ยังไม่มีงานปัจจุบัน');
 assert.equal(info.message,'');
 assert.equal(liveEngine.sources.size,0);assert.equal(liveEngine.folders.size,0);
 assert.equal(await fsp.readFile(output,'utf8'),'PRESERVE_AUDIO_ORIGINAL');
 assert.equal(JSON.parse(await fsp.readFile(path.join(profile,'local-media','current-job.json'),'utf8')).job,null);
 if(mode==='download'){
  await win.loadURL('atl-media://app/convert.html');
  await until(()=>run("document.querySelector('#job-badge').textContent==='พร้อมเริ่ม'"),'cross page');
  assert.equal(await run("document.querySelector('#source-title').textContent"),'ยังไม่ได้เลือกแหล่งเสียง');
  assert.equal(await run("document.querySelector('#folder-path').textContent"),'ยังไม่ได้เลือกโฟลเดอร์');
 }
 const result={passed:true,mode,checks:['section 01 cleared','section 02 cleared','section 03 cleared','saved output preserved','native selections invalidated','disk state cleared','cross page ready'],data:info};
 await fsp.writeFile(path.join(root,'results.json'),JSON.stringify(result,null,2));
 console.log('RESET-FORMS ELECTRON PASS '+mode+' '+root);app.quit();
})().catch(async e=>{console.error(e);await fsp.mkdir(root,{recursive:true});await fsp.writeFile(path.join(root,'results.json'),JSON.stringify({passed:false,mode,error:e.stack},null,2));app.exit(1);});
