'use strict';
// Fault injection AFTER a real Windows guard has closed. This is a folder
// recovery regression only, never evidence of live YouTube acceptance.
const {app,BrowserWindow,dialog}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {Engine}=require('../src/engine.cjs'),{MediaError}=require('../src/common.cjs');
const run=path.resolve('test-output/folder-recovery-ui-'+Date.now()),out=path.resolve('evidence/public-beta');let engine;
const init=Engine.prototype.init;
Engine.prototype.init=async function(){await init.call(this);engine=this;const guard=this.runner.guard.bind(this.runner);this.runner.guard=async(paths)=>{const real=await guard(paths);return {...real,release:async()=>{await real.release();throw new MediaError('CLEANUP_REQUIRED','injected missing release acknowledgement after real guard close');}};};return this;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<160;i++){if(await fn())return;await sleep(75);}throw Error('Recovery UI timeout');}
(async()=>{
 require('node:fs').mkdirSync(run,{recursive:true});require('node:fs').mkdirSync(out,{recursive:true});app.setPath('userData',path.join(run,'profile'));dialog.showOpenDialog=async()=>({canceled:false,filePaths:[run]});
 require('../src/main.cjs');await app.whenReady();let win;
 await until(()=>{win=BrowserWindow.getAllWindows().find(w=>/atl-media:\/\/app\/download.html/.test(w.webContents.getURL()));return !!win;});
 const js=code=>win.webContents.executeJavaScript(code);await until(()=>js("!!document.querySelector('#pick-folder')"));
 await js("document.querySelector('#pick-folder').click()");await until(()=>engine?.job?.status==='cleanup-required');await engine.persistChain;
 const rows=[];for(const [size,width,height] of [['minimum',360,600],['normal',1280,940]])for(const mode of ['download','convert']){
  win.setSize(width,height);await win.loadURL('atl-media://app/'+mode+'.html');await until(()=>js("document.querySelector('#job-badge')?.textContent==='ต้องตรวจ cleanup'"));
  await js("document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");await sleep(200);
  const dto=await js("({badge:document.querySelector('#job-badge').textContent,message:document.querySelector('#job-description').textContent,startDisabled:document.querySelector('#start').disabled,resetHidden:document.querySelector('#new-job').hidden,overflow:document.documentElement.scrollWidth>innerWidth})");
  assert.match(dto.message,/การเลือกโฟลเดอร์ต้องกู้คืน/);assert.equal(dto.startDisabled,true);assert.equal(dto.resetHidden,true);assert.equal(dto.overflow,false);
  assert.equal((await js('window.localMedia.chooseOutputDirectory()')).error.code,'BUSY');assert.equal((await js('window.localMedia.resetFinishedJob()')).error.code,'BUSY');
  console.log('PASS recovery '+mode+' '+size);await fs.writeFile(path.join(out,'recovery-'+mode+'-'+size+'.png'),(await win.webContents.capturePage()).toPNG());rows.push({mode,size,...dto});
 }
 assert.equal(engine.setupBusy,false);assert.equal(engine.folders.size,0);const saved=JSON.parse(await fs.readFile(path.join(run,'profile/local-media/current-job.json'),'utf8'));assert.equal(saved.job.recovery.kind,'folder-selection');
 await fs.writeFile(path.join(out,'folder-recovery-ui.json'),JSON.stringify({status:'PASS',scope:'folder recovery fault injection after actual Windows guard release; native picker substituted; no live Download',rows,setupBusy:engine.setupBusy,folderTokens:engine.folders.size,persistedRecovery:saved.job.recovery},null,2));
 console.log('FOLDER RECOVERY NATIVE UI PASS');await win.close();
})().catch(e=>{console.error(e);app.exit(1);});
