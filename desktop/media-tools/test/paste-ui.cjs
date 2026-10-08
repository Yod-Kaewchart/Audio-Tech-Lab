'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');

(async()=>{
 const executable=process.env.ATL_PASTE_EXE||path.resolve('node_modules/electron/dist/electron.exe');
 const root=path.resolve('test-output/paste-'+Date.now());await fs.mkdir(root,{recursive:true});
 const args=process.env.ATL_PASTE_EXE?[]:[path.resolve('.')];args.push('--user-data-dir='+path.join(root,'profile'));
 const app=await _electron.launch({executablePath:executable,args,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 const checks=[],requests=[],errors=[];
 try{
  // Use the existing clipboard without writing to it. No clipboard content enters logs, files or network requests.
  assert(await app.evaluate(async({clipboard})=>!!(await clipboard.readText()).trim()),'Copy text before running the paste check');
  const page=await app.firstWindow();page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('#paste-link');await page.waitForFunction(()=>!document.querySelector('#source-url').matches(':disabled'));
  await page.locator('#source-url').focus();await page.keyboard.press('Control+V');
  await page.waitForFunction(()=>!!document.querySelector('#source-url').value);
  const matchesClipboard=()=>app.evaluate(async({clipboard,BrowserWindow})=>{
   const value=await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.getElementById('source-url').value");
   // URL inputs strip line breaks and surrounding ASCII whitespace.
   return value===(await clipboard.readText()).replace(/[\r\n]/g,'').trim();
  });
  assert(await matchesClipboard());checks.push('Ctrl+V native clipboard paste');
  await page.locator('#source-url').fill('https://youtu.be/abcdefghijk');
  await page.locator('#paste-link').click();await page.waitForFunction(()=>document.activeElement.id==='source-url');
  await page.waitForFunction(()=>document.getElementById('source-url').value!=='https://youtu.be/abcdefghijk');
  assert(await matchesClipboard());checks.push('Paste button replaces existing URL using native clipboard');
  await page.locator('#check-link').focus();assert.equal((await page.evaluate(()=>window.localMedia.pasteSourceUrl())).ok,false);
  await page.locator('#source-url').focus();await page.evaluate(()=>document.getElementById('source-controls').disabled=true);
  assert.equal((await page.evaluate(()=>window.localMedia.pasteSourceUrl())).ok,false);
  await page.evaluate(()=>document.getElementById('source-controls').disabled=false);
  checks.push('Native paste rejects wrong focus and disabled source controls');
  // Exercise the real context-menu handler; invoke its generated native paste role without OS menu navigation.
  await app.evaluate(({Menu})=>{Menu.prototype.popup=function(options){global.__pasteTestMenu=this;global.__pasteTestWindow=options.window;};});
  await page.locator('#source-url').fill('https://youtu.be/abcdefghijk');await page.locator('#source-url').selectText();
  await page.locator('#source-url').click({button:'right'});
  const menuOk=await app.evaluate(()=>{const item=global.__pasteTestMenu?.items.find(i=>i.role==='paste');if(!item?.enabled||item.label!=='วาง')return false;item.click(undefined,global.__pasteTestWindow,global.__pasteTestWindow.webContents);return true;});
  assert(menuOk);await page.waitForFunction(()=>document.getElementById('source-url').value!=='https://youtu.be/abcdefghijk');
  assert(await matchesClipboard());checks.push('Right-click context handler and generated paste role');
  for(const mode of ['download','convert'])for(const width of [360,768,1440]){
   await page.setViewportSize({width,height:1000});await page.goto('atl-media://app/'+mode+'.html');await page.waitForSelector('#source-controls');await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}/${width}`);
   if(mode==='convert')assert.equal((await page.evaluate(()=>window.localMedia.pasteSourceUrl())).ok,false);
  }
  checks.push('Both pages fit 360/768/1440px; Convert rejects URL paste');
  const preferences=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert(preferences.sandbox&&preferences.contextIsolation&&!preferences.nodeIntegration);
  assert.equal(requests.filter(url=>!url.startsWith('atl-media://app/')).length,0);assert.deepEqual(errors,[]);
  checks.push('Sandbox preserved; no remote renderer requests; no provider inspection/download attempted');
  await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,packaged:!!process.env.ATL_PASTE_EXE,checks},null,2));
  console.log('PASTE PASS',root);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
