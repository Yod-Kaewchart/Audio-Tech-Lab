const {_electron:electron,chromium}=require('playwright');const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');const {wave}=require('./fixtures.cjs');
(async()=>{
 const root=path.resolve('test-output/ui-acceptance-'+Date.now());await fs.mkdir(root,{recursive:true});const input=path.join(root,'เสียงภาษาไทย สำหรับตรวจ bridge.wav');await wave(input,12);
 const app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('.'),'--user-data-dir='+path.join(root,'profile')],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 const errors=[],requests=[],checks=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.waitForSelector('#capability-status');
  await page.waitForFunction(()=>document.querySelector('#capability-status').textContent.includes('1.0.0'));
  const preferences=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());assert.equal(preferences.sandbox,true);assert.equal(preferences.contextIsolation,true);assert.equal(preferences.nodeIntegration,false);checks.push('sandbox/contextIsolation/nodeIntegration');
  await page.goto('atl-media://app/convert.html');await page.waitForSelector('#pick-file');assert.equal(await page.evaluate(()=>typeof require),'undefined');
  // Inject only picker responses in this test process. Engine, IPC, worker, codec, and storage remain real.
  await app.evaluate(({dialog},{input,folder})=>{dialog.showOpenDialog=async(_win,opts)=>({canceled:false,filePaths:[opts.properties.includes('openFile')?input:folder]});},{input,folder:root});
  await page.locator('#pick-file').click();await page.waitForFunction(()=>document.querySelector('#source-title').textContent.includes('bridge.wav'));
  await page.locator('#pick-folder').click();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  const invalid=await page.evaluate(()=>window.localMedia.startConvert({sourceId:'C:/file.wav',folderId:'x',requestId:'x',encoding:{format:'original'}}));assert.equal(invalid.ok,false);assert.equal(invalid.error.code,'INVALID_REQUEST');checks.push('strict-native-IPC-rejects-arbitrary-path');
  // Slow only the test process worker input to exercise navigation with a live job.
  await app.evaluate(({app})=>{const load=process.mainModule.require.bind(process.mainModule);const {Runner}=load(load('path').join(app.getAppPath(),'src/runner.cjs'));const original=Runner.prototype.run;Runner.prototype.run=function(tool,args,opts){if(tool==='ffmpeg'){args=[...args];args.splice(args.indexOf('-i'),0,'-re');}return original.call(this,tool,args,opts);};});
  await page.locator('#start').click();await page.waitForFunction(async()=>{const r=await window.localMedia.getCurrentJob();return r.ok&&r.value?.progress.stage==='converting';});
  const active=await page.evaluate(async()=> (await window.localMedia.getCurrentJob()).value);await page.goto('atl-media://app/download.html');await page.waitForSelector('#job-title');assert.equal((await page.evaluate(async()=> (await window.localMedia.getCurrentJob()).value)).jobId,active.jobId);assert.equal(await page.locator('#start').isDisabled(),true);
  await page.reload();await page.waitForSelector('#cancel');assert.equal((await page.evaluate(async()=> (await window.localMedia.getCurrentJob()).value)).jobId,active.jobId);await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#job-badge').textContent==='ยกเลิกแล้ว');checks.push('real-convert-shared-across-navigation-reload-and-cancel');
  // Actual local IPC still works after keyboard skip link changes the fragment.
  await page.goto('atl-media://app/convert.html');await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.localMedia.getCapabilities())).ok,true);checks.push('keyboard-skip-link-fragment-IPC');
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});assert.equal((await page.evaluate(()=>window.localMedia.chooseInputFile())).value,null);assert.equal((await page.evaluate(()=>window.localMedia.chooseOutputDirectory())).value,null);checks.push('cancelled-picker-replies');
  // Geometry-only status DTOs are explicitly synthetic; not engine/provider evidence.
  for(const mode of ['download','convert'])for(const width of [360,768,1440]){
   await page.setViewportSize({width,height:1000});await page.goto('atl-media://app/'+mode+'.html');await page.waitForSelector('#job-title');await page.evaluate(()=>document.fonts.ready);
   for(const [index,status] of ['starting','running','succeeded','failed','cleanup-required','interrupted'].entries()){
    const dto={...active,jobId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',sequence:index+100,status,mode,progress:{...active.progress,stage:status==='succeeded'?'complete':'converting',stagePercent:status==='running'?null:status==='succeeded'?100:0},error:['failed','cleanup-required','interrupted'].includes(status)?{code:'CLEANUP_REQUIRED',message:'ข้อความสถานะสำหรับตรวจการจัดหน้าและการตัดบรรทัดภาษาไทย ชื่อไฟล์และโฟลเดอร์ที่ยาว',retryable:false}:null,output:status==='succeeded'?{resultId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',fileName:'เสียงภาษาไทยยาวสำหรับตรวจผลลัพธ์.flac',displayPath:path.join(root,'เสียงภาษาไทยยาวสำหรับตรวจผลลัพธ์.flac'),metadata:{durationSeconds:12,bytes:50000,codec:'flac',container:'flac',sampleRateHz:48000,bitsPerSample:24,channels:2},available:true}:null};
    await app.evaluate(({BrowserWindow},dto)=>BrowserWindow.getAllWindows()[0].webContents.send('atl:job',dto),dto);
    await page.waitForFunction(s=>document.querySelector('#job-badge').textContent===s,({starting:'กำลังเตรียมงาน',running:'กำลังทำงาน',succeeded:'สำเร็จ',failed:'ล้มเหลว','cleanup-required':'ต้องตรวจ cleanup',interrupted:'ถูกขัดจังหวะ'})[status]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${mode}/${width}/${status}`);
    if(status==='succeeded')await page.screenshot({path:path.join(root,`${mode}-${width}.png`),fullPage:true});
   }
  }
  checks.push('36-native-view-geometry-cases-synthetic-status-only');
  assert.deepEqual(errors,[]);assert.equal(requests.filter(url=>!url.startsWith('atl-media:')).length,0);checks.push('renderer-zero-remote-requests');
  await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,checks,errors,requests,preferences:{sandbox:preferences.sandbox,contextIsolation:preferences.contextIsolation,nodeIntegration:preferences.nodeIntegration},nativeActiveJob:active},null,2));console.log('UI BRIDGE PASS',root);
 }finally{await app.close();}
 // Normal browser with absent bridge stays unavailable and does not simulate success.
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage();await page.goto('file:///'+path.resolve('ui/convert.html').replaceAll('\\','/'));await page.waitForSelector('#notice');assert.match(await page.locator('#notice').innerText(),/Native bridge/);assert.equal(await page.locator('#start').isDisabled(),true);await fs.writeFile(path.join(root,'no-bridge.json'),JSON.stringify({passed:true,message:await page.locator('#notice').innerText()}));}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
