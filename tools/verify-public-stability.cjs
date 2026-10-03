'use strict';
// Explicitly requested production outage test. Refuse work in flight and always restart.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),runtime=path.join(__dirname,'runtime'),output=path.join(runtime,'public-stability');
const base='https://demo.audiotechlabs.com';
const ps=code=>execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; "+code],{cwd:root,windowsHide:true,encoding:'utf8',timeout:20000}).trim();
async function main(){
 if(!process.argv.includes('--allow-backend-stop'))throw new Error('Requires --allow-backend-stop');
 fs.mkdirSync(output,{recursive:true});
 let browser,stopped=false;
 const report={at:new Date().toISOString(),checks:[]};
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();
  const page=await context.newPage();page.setDefaultTimeout(25000);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'/demo/');await page.waitForFunction(()=>window.demoServer?.state==='online');
  assert.ok(await page.evaluate(()=>typeof window.demoServer.ensureOnline==='function'),'Deploy the reviewed frontend first');
  const prior=JSON.parse(fs.readFileSync(path.join(runtime,'state.json')));assert.equal(prior.mode,'cloudflare-pages-backend');
  const jobs=JSON.parse(fs.readFileSync(path.join(runtime,'security/processing-jobs.json'))).jobs;
  assert.equal(jobs.filter(j=>['queued','running'].includes(j.status)).length,0,'Active jobs; refusing outage');
  function parts(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?parts(path.join(dir,e.name)):e.name.endsWith('.part')?[e.name]:[])}
  assert.equal(parts(path.join(root,'uploads')).length,0,'Incomplete uploads; refusing outage');
  const maintenance=await fetch('http://127.0.0.1:8787/internal/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"enabled":true}'});
  if(maintenance.status!==200){
   assert.ok(process.argv.includes('--bootstrap-old-backend')&&maintenance.status===401,'Maintenance refused; nothing stopped');
   report.bootstrap='Old backend lacks maintenance. Immediately checked persisted queue and partial uploads before first activation.';
  }
  const stoppedAt=Date.now();stopped=true;
  ps("$s=Get-Content -LiteralPath 'tools/runtime/state.json' -Raw|ConvertFrom-Json; $ids=@($s.supervisorPid,$s.services.backend.pid); foreach($id in $ids){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id);if(-not $p -or $p.Name -ne 'node.exe' -or $p.CommandLine -notlike '*D:\\Sites\\Audio Tech Labs\\*'){throw 'Process identity mismatch'}}; $j=(Get-Content -LiteralPath 'tools/runtime/security/processing-jobs.json' -Raw|ConvertFrom-Json).jobs;if(@($j|Where-Object {$_.status -in 'queued','running'}).Count){throw 'Active jobs'};if(@(Get-ChildItem -LiteralPath 'uploads' -Recurse -Filter '*.part' -File).Count){throw 'Partial uploads'};Stop-ScheduledTask -TaskName 'Audio Tech Lab Backend';foreach($id in $ids){if(Get-Process -Id $id -ErrorAction SilentlyContinue){Stop-Process -Id $id -Force}}; 'stopped'");
  await page.waitForFunction(()=>window.demoServer.state==='offline');report.offlineMs=Date.now()-stoppedAt;
  assert.equal(await page.locator('#login-form button[type=submit]').isDisabled(),true);
  await page.screenshot({path:path.join(output,'public-offline-desktop.png'),fullPage:true});
  const nonce='offline-'+Date.now(),health=await fetch(base+'/api/health?nonce='+nonce,{cache:'no-store'});
  report.offlineHealth={status:health.status,cache:health.headers.get('cache-control')};assert.ok(!health.ok);
  report.staticOffline=await Promise.all(['/','/demo/','/demo/qc/','/demo/merge/','/styles.css'].map(async route=>{
   const r=await fetch(base+route,{cache:'no-store'});const body=await r.text();assert.equal(r.status,200,route);return {route,status:r.status,bytes:Buffer.byteLength(body)};
  }));
  const fresh=await context.newPage();await fresh.goto(base+'/demo/');await fresh.waitForFunction(()=>window.demoServer?.state==='offline');
  const session=await context.newCDPSession(fresh);await session.send('Network.setCacheDisabled',{cacheDisabled:true});await fresh.reload();await fresh.waitForFunction(()=>window.demoServer?.state==='offline');
  assert.equal(await fresh.locator('#login-form button[type=submit]').isDisabled(),true);
  await fresh.setViewportSize({width:390,height:844});await fresh.screenshot({path:path.join(output,'public-offline-mobile.png'),fullPage:true});
  report.assets=await fresh.evaluate(()=>({sheets:[...document.styleSheets].map(s=>({url:s.href,rules:s.cssRules.length})),overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(document.body).fontFamily}));assert.equal(report.assets.overflow,false);assert.ok(report.assets.sheets.every(s=>s.rules>0));
  // Main site assets/fonts remain available while the backend is stopped.
  const main=await context.newPage();const failures=[];main.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));await main.goto('https://www.audiotechlabs.com/');await main.evaluate(()=>document.fonts.ready);
  report.main=await main.evaluate(()=>({title:document.title,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),images:[...document.images].filter(i=>!i.loading||i.loading!=='lazy').every(i=>i.complete&&i.naturalWidth>0)}));report.main.failures=failures;
  await main.screenshot({path:path.join(output,'main-backend-offline.png'),fullPage:true});await main.close();
  const startedAt=Date.now();ps("Start-ScheduledTask -TaskName 'Audio Tech Lab Backend'; 'started'");stopped=false;
  await page.waitForFunction(()=>window.demoServer.state==='online');await fresh.waitForFunction(()=>window.demoServer.state==='online');
  await page.waitForFunction(()=>!document.querySelector('#login-form button[type=submit]').disabled);
  await fresh.waitForFunction(()=>!document.querySelector('#login-form button[type=submit]').disabled);
  report.recoveryMs=Date.now()-startedAt;report.noReloadRecovery=true;
  await page.screenshot({path:path.join(output,'public-recovered.png'),fullPage:true});
  const after=JSON.parse(fs.readFileSync(path.join(runtime,'state.json')));assert.notEqual(after.services.backend.pid,prior.services.backend.pid);
  report.backendPid=after.services.backend.pid;report.pageErrors=pageErrors;assert.deepEqual(pageErrors,[]);
  const local=await fetch('http://127.0.0.1:8787/internal/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"enabled":false}'});assert.equal(local.status,200);
  const idle=await fetch('http://127.0.0.1:8787/internal/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"enabled":true}'});assert.equal(idle.status,200,'Busy backend; crash test refused');
  const crashedAt=Date.now();
  ps("$s=Get-Content -LiteralPath 'tools/runtime/state.json' -Raw|ConvertFrom-Json;$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$s.services.backend.pid);if(-not $p -or $p.CommandLine -notlike '*D:\\Sites\\Audio Tech Labs\\server\\upload-server.js*'){throw 'Backend identity mismatch'};Stop-Process -Id $p.ProcessId -Force;'backend stopped for recovery test'");
  await page.evaluate(()=>window.demoServer.check());
  const deadline=Date.now()+30000;
  for(;;){
   try{const r=await fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(1000)});if(r.ok)break}catch{}
   if(Date.now()>deadline)throw new Error('Supervisor did not recover backend');await new Promise(r=>setTimeout(r,200));
  }
  report.crashLocalRecoveryMs=Date.now()-crashedAt;
  await page.waitForFunction(()=>window.demoServer.state==='online');report.crashPublicRecoveryMs=Date.now()-crashedAt;
  report.recoveredBackendPid=JSON.parse(fs.readFileSync(path.join(runtime,'state.json'))).services.backend.pid;
  assert.notEqual(report.recoveredBackendPid,after.services.backend.pid);
  report.checks.push('Public Pages offline load/hard reload, automatic recovery, login gating, main-site assets, actual hidden Scheduled Task launch');
 }finally{
  if(stopped)ps("Start-ScheduledTask -TaskName 'Audio Tech Lab Backend'; 'restored'");
  await fetch('http://127.0.0.1:8787/internal/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"enabled":false}',signal:AbortSignal.timeout(3000)}).catch(()=>{});
  await browser?.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
