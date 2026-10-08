'use strict';
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('test-output/format-selection-'+Date.now());await fs.mkdir(root,{recursive:true});
 const packaged=!!process.env.ATL_FORMAT_EXE;
 const app=await _electron.launch({executablePath:process.env.ATL_FORMAT_EXE||path.resolve('node_modules/electron/dist/electron.exe'),args:[...packaged?[]:[path.resolve('.')],'--user-data-dir='+path.join(root,'profile')],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 const checks=[],errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#start');
  await page.waitForFunction(()=>document.getElementById('start-help').textContent.includes('กรุณาเลือกรูปแบบเสียง'));
  assert.equal(await page.locator('input[name="format"]:checked').count(),0);assert(await page.locator('#start').isDisabled());
  checks.push('Download starts with no format selected and Start disabled');
  const invalid=await page.evaluate(()=>window.localMedia.startDownload({sourceId:crypto.randomUUID(),folderId:crypto.randomUUID(),requestId:crypto.randomUUID(),encoding:null}));
  assert.equal(invalid.ok,false);assert.equal(invalid.error.code,'INVALID_REQUEST');checks.push('Real native handler rejects missing encoding');
  // Synthetic source and submission capture exercise UI gating only, without contacting a media provider.
  await app.evaluate(({app,dialog},root)=>{
   const load=process.mainModule.require.bind(process.mainModule),base=app.getAppPath(),{Engine}=load(load('path').join(base,'src/engine.cjs')),{startRequest}=load(load('path').join(base,'src/common.cjs'));
   dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});global.__formatSubmissions=[];
   Engine.prototype.inspect=async()=>({sourceId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',displayName:'UI readiness fixture',metadata:null});
   Engine.prototype.start=async function(mode,request){startRequest(request,mode);global.__formatSubmissions.push(request.encoding);return null;};
  },root);
  await page.locator('#source-url').fill('https://youtu.be/abcdefghijk');await page.locator('#check-link').click();
  await page.waitForFunction(()=>document.getElementById('link-error').textContent==='ตรวจสอบต้นทางแล้ว');
  await page.locator('#pick-folder').click();await page.waitForFunction(()=>document.getElementById('folder-path').textContent!=='ยังไม่ได้เลือกโฟลเดอร์');
  assert(await page.locator('#start').isDisabled());assert.match(await page.locator('#start-help').innerText(),/เลือกรูปแบบเสียง/);
  await page.evaluate(()=>document.getElementById('start').dispatchEvent(new MouseEvent('click')));
  assert.equal(await app.evaluate(()=>global.__formatSubmissions.length),0);
  checks.push('Valid source and folder cannot start without format, including dispatched click');
  const choices=[['Original Audio','original'],['MP3','mp3'],['WAV','wav'],['FLAC','flac'],['ALAC','alac']];
  for(const [label,expected] of choices){
   await page.locator(`input[name="format"][value="${label}"]`).check();assert.equal(await page.locator('#start').isDisabled(),false);
   await page.locator('#start').click();await page.waitForFunction(()=>!document.getElementById('start').disabled);
   assert.equal(await app.evaluate(()=>global.__formatSubmissions.at(-1).format),expected);
  }
  checks.push('Each of five explicit selections enables Start and submits that format');
  await page.reload();await page.waitForSelector('#start');assert.equal(await page.locator('input[name="format"]:checked').count(),0);assert(await page.locator('#start').isDisabled());
  await page.goto('atl-media://app/convert.html');await page.waitForSelector('#start');assert.equal(await page.locator('input[name="format"]:checked').inputValue(),'FLAC');
  checks.push('Reload requires selection again; Convert retains FLAC default');assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,packaged,checks,evidenceScope:'Synthetic source/submission for UI only; missing-encoding validation uses real native handler; no download or provider acceptance'},null,2));console.log('FORMAT SELECTION PASS',root);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
