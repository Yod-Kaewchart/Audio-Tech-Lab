const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {wave}=require('./fixtures.cjs');
(async()=>{
 const release=JSON.parse(await fs.readFile('release/latest.json','utf8'));
 const root=path.resolve('test-output/portable-'+Date.now());await fs.mkdir(root,{recursive:true});
 const input=path.join(root,'เสียงทดสอบ portable.wav');await wave(input,3);
 const before=crypto.createHash('sha256').update(await fs.readFile(input)).digest('hex');
 const restrictedPath=path.join(process.env.SystemRoot,'System32');
 const app=await electron.launch({executablePath:release.executable,args:['--user-data-dir='+path.join(root,'profile')],env:{...process.env,PATH:restrictedPath,Path:restrictedPath,NODE_PATH:'',NODE_OPTIONS:'',ELECTRON_RUN_AS_NODE:undefined}});
 try{
  const runtime=await app.evaluate(({app})=>({isPackaged:app.isPackaged,appPath:app.getAppPath(),userData:app.getPath('userData'),path:process.env.PATH}));assert.equal(runtime.isPackaged,true);assert.equal(runtime.path,restrictedPath);
  // Packaged windows disable DevTools. Evaluate via the main-process WebContents without enabling it.
  const js=code=>app.evaluate(({BrowserWindow},code)=>BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(code),code);
  const until=async code=>{for(let i=0;i<600;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+code);};
  await app.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].loadURL('atl-media://app/convert.html');});
  await until("document.querySelector('#capability-status')?.textContent.includes('1.0.0')");
  const caps=await js('window.localMedia.getCapabilities()');assert.equal(caps.ok,true);assert.equal(caps.value.convertReady,true);assert.equal(caps.value.downloadReady,true);
  // Test-only picker responses; the separately recorded manual Windows dialogs prove native picker behavior.
  await app.evaluate(({dialog},{input,folder})=>{dialog.showOpenDialog=async(_w,o)=>({canceled:false,filePaths:[o.properties.includes('openFile')?input:folder]});},{input,folder:root});
  await js("document.querySelector('#pick-file').click()");await until("document.querySelector('#source-title').textContent.includes('portable.wav')");
  await js("document.querySelector('#pick-folder').click()");
  await until("!document.querySelector('#start').disabled");await js("document.querySelector('input[value=ALAC]').click()");assert.equal(await js("document.querySelector('input[name=format]:checked').value"),'ALAC');await js("document.querySelector('#start').click()");
  await until("window.localMedia.getCurrentJob().then(r=>r.ok&&['succeeded','failed','cleanup-required'].includes(r.value?.status))");
  const job=(await js('window.localMedia.getCurrentJob()')).value;assert.equal(job.status,'succeeded',JSON.stringify(job.error));assert.equal(job.output.metadata.codec,'alac');assert.ok((await fs.stat(job.output.displayPath)).size>0);
  assert.equal(crypto.createHash('sha256').update(await fs.readFile(input)).digest('hex'),before);
  const geometry=[];for(const mode of ['download','convert'])for(const width of [360,768,1440]){await app.evaluate(async({BrowserWindow},{width,mode})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(width,1000);await w.loadURL('atl-media://app/'+mode+'.html');},{width,mode});await until("document.querySelector('#job-badge')?.textContent==='สำเร็จ'");await js('document.fonts.ready.then(()=>true)');assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);geometry.push({mode,width,actualWidth:await js('innerWidth'),overflow:false});if(width===360){const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await fs.writeFile('evidence/portable-'+mode+'-360.png',Buffer.from(png,'base64'));}}
  const toolVersions=await app.evaluate(async({app})=>{const load=process.mainModule.require.bind(process.mainModule),p=load('path');const {Dependencies}=load(p.join(app.getAppPath(),'src/dependencies.cjs'));const {Runner}=load(p.join(app.getAppPath(),'src/runner.cjs'));const deps=await new Dependencies(p.join(process.resourcesPath,'vendor')).load(),runner=new Runner(deps);return {node:(await runner.run('jsRuntime',['--version'])).stdout.trim(),ytDlp:(await runner.run('ytDlp',['--version'])).stdout.trim()};});
  assert.equal(toolVersions.node,'v24.19.0');assert.equal(toolVersions.ytDlp,'2026.08.19');
  await fs.writeFile('evidence/portable-smoke.json',JSON.stringify({passed:true,at:new Date().toISOString(),executable:release.executable,runtime,caps,toolVersions,job,sourceSha256:before,geometry,limitations:['Developer Windows with restricted PATH, not a clean VM','Picker responses substituted for this test; real native dialogs have separate evidence','No live provider download tested','Renderer and worker network evidence recorded by separate acceptance tests']},null,2));console.log('PORTABLE PASS',root);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
