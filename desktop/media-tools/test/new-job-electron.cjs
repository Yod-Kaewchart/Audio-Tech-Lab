'use strict';
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {Engine}=require('../src/engine.cjs'),{id}=require('../src/common.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve('test-output/new-job-electron-'+Date.now());
const output=path.join(root,'Finished Thai Audio.flac');
const originalInit=Engine.prototype.init;
Engine.prototype.init=async function(){
 await originalInit.call(this);
 this.job={jobId:id(),sequence:1,mode:'download',status:'succeeded',sourceName:'อัลบั้มเสียงทดสอบ',output:{resultId:id(),fileName:path.basename(output),displayPath:output,metadata:{codec:'flac',container:'flac',sampleRateHz:44100,bitsPerSample:16,bytes:17,durationSeconds:4,channels:2},available:true},error:null,progress:{stage:'complete',stagePercent:100,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:4}};
 await this.persist();return this;
};
async function wait(check,label){for(let i=0;i<150;i++){try{if(await check())return;}catch{}await sleep(100);}throw Error('Timeout '+label);}
(async()=>{
 require('node:fs').mkdirSync(root,{recursive:true});require('node:fs').writeFileSync(output,'PRESERVE_RESULT_1234');
 app.setPath('userData',path.join(root,'profile'));
 require('../src/main.cjs');await app.whenReady();
 await wait(()=>BrowserWindow.getAllWindows().length>0,'window');
 const win=BrowserWindow.getAllWindows()[0];
 const run=js=>win.webContents.executeJavaScript(js);
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='สำเร็จ'"),'finished job');
 assert.equal(await run("!document.querySelector('#new-job').hidden"),true,'Download finished button visible');
 const before=await run("window.localMedia.getCurrentJob()");
 assert.equal(before.value.status,'succeeded');
 await win.loadURL('atl-media://app/convert.html');
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='สำเร็จ'"),'Convert finished job');
 assert.equal(await run("!document.querySelector('#new-job').hidden"),true,'Convert finished button visible');
 await win.loadURL('atl-media://app/download.html');
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='สำเร็จ'"),'Download finished again');
 for(const width of [360,390,768,1280]){
  win.setSize(width,880);await sleep(180);
  await run("document.getElementById('new-job').scrollIntoView({block:'center'})");
  assert.equal(await run("document.documentElement.scrollWidth <= innerWidth"),true,'no overflow '+width);
 }
 await run("document.querySelector('#new-job').click()");
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='พร้อมเริ่ม'"),'reset UI');
 assert.equal(await run("document.querySelector('#job-title').textContent"),'ยังไม่มีงานปัจจุบัน');
 assert.equal(await run("document.querySelector('#new-job').hidden"),true);
 const after=await run("window.localMedia.getCurrentJob()");
 assert.equal(after.ok,true);assert.equal(after.value,null);
 assert.equal(await fs.readFile(output,'utf8'),'PRESERVE_RESULT_1234');
 const disk=JSON.parse(await fs.readFile(path.join(root,'profile','local-media','current-job.json'),'utf8'));
 assert.deepEqual(disk,{job:null,staging:null});
 win.reload();
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='พร้อมเริ่ม'"),'reload ready');
 await win.loadURL('atl-media://app/convert.html');
 await wait(()=>run("document.querySelector('#job-badge')?.textContent==='พร้อมเริ่ม'"),'Convert reload ready');
 assert.equal(await run("document.querySelector('#new-job').hidden"),true);
 for(const status of ['starting','running','cancelling','cleanup-required']){
  win.webContents.send('atl:job',{...before.value,jobId:id(),sequence:20,status,progress:{...before.value.progress,stage:'stopping'}});
  await wait(()=>run("document.querySelector('#job-badge')?.textContent!== 'พร้อมเริ่ม'"),'synthetic '+status);
  assert.equal(await run("document.querySelector('#new-job').hidden"),true,'button hidden when '+status);
 }
 win.webContents.send('atl:job',null);await wait(()=>run("document.querySelector('#job-badge')?.textContent==='พร้อมเริ่ม'"),'restore ready');
 const checks=['Download and Convert show finished-job reset','real IPC resets persisted record','output preserved','UI ready after reload','active and cleanup-required hide reset','responsive widths 360/390/768/1280'];
 await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,checks,output},null,2));
 console.log('NEW JOB ELECTRON PASS '+root);app.quit();
})().catch(async e=>{console.error(e);try{await fs.mkdir(root,{recursive:true});await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:false,error:e.stack},null,2));}catch{}app.exit(1);});
