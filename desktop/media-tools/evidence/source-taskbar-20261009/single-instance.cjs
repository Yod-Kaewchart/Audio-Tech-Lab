'use strict';
// Real candidate EXEs, isolated test profiles, no audio/download operations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {_electron}=require('playwright');
const {mainWindow}=require('../../test/electron-ui.cjs');
const root=path.resolve(__dirname,'../..'),kind=process.argv[2],exe=process.argv[3];
assert(['normal-installed','portable'].includes(kind));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex'),'94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d');
const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined));
const profile=path.join(root,'test-output/source-taskbar-round2',kind+'-profile');
const args=['--user-data-dir='+profile],receipt=path.join(__dirname,kind+'-single-instance.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let app;
 try{
  app=await _electron.launch({executablePath:exe,args,env,timeout:60000});
  const page=await mainWindow(app);await page.waitForLoadState();
  const before=await app.evaluate(({app,BrowserWindow})=>({pid:process.pid,exe:process.execPath,version:app.getVersion(),name:app.getName(),windows:BrowserWindow.getAllWindows().filter(w=>w.isVisible()).map(w=>({id:w.id,title:w.getTitle(),url:w.webContents.getURL()}))}));
  assert.equal(before.version,'0.2.2-beta.2');assert.equal(before.windows.length,1);
  const child=cp.spawn(exe,args,{env,windowsHide:false,stdio:'ignore'});const secondPid=child.pid;
  const second=await Promise.race([new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}),sleep(15000).then(()=>{throw Error('Second process failed to exit');})]);
  assert.equal(second.code,0);await sleep(1000);
  const after=await app.evaluate(({BrowserWindow})=>({pid:process.pid,windows:BrowserWindow.getAllWindows().filter(w=>w.isVisible()).map(w=>({id:w.id,title:w.getTitle(),focused:w.isFocused(),url:w.webContents.getURL()}))}));
  assert.equal(after.pid,before.pid);assert.equal(after.windows.length,1);assert.equal(after.windows[0].id,before.windows[0].id);assert(after.windows[0].focused);
  const result={status:'PASS',kind,scope:'actual EXE single-instance and focus only; taskbar icon/name/grouping visual BLOCKED',launchMethod:'EXE directly, with --user-data-dir test profile; first process controlled by Playwright',exe,exeSha256:'94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d',profile,before,secondPid,second,after,taskbarVisual:'BLOCKED',capturedAt:new Date().toISOString()};
  fs.writeFileSync(receipt,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(root,'test-output/source-taskbar-round2',kind+'-ready'),String(process.pid));
  // Keep visible briefly for the supported native-window capture tool.
  for(let i=0;i<180&&!fs.existsSync(path.join(root,'test-output/source-taskbar-round2',kind+'-close'));i++)await sleep(1000);
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
