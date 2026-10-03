'use strict';
// Browser regressions: isolated accounts/storage, real local API and audio workers.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../server/upload-server.js');
const {createWebServer}=require('../server/web-server.cjs');
const output=path.resolve(__dirname,'runtime/stability-qa');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
async function close(s){if(s?.listening){s.closeAllConnections();await new Promise(r=>s.close(r))}}
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atl-stability-'));
 let backend,web,browser;
 const results=[],errors=[];
 try{
  backend=createServer({root});await listen(backend);const port=backend.address().port;
  web=createWebServer({backendPort:port});await listen(web);const base='http://127.0.0.1:'+web.address().port;
  fs.writeFileSync(path.join(root,'tools/runtime/state.json'),JSON.stringify({webUrl:base}));
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext(),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  const state=s=>page.waitForFunction(s=>window.demoServer?.state===s,s);
  const button=page.locator('#login-form button[type=submit]');
  const online=async()=>{await state('online');await page.waitForFunction(()=>!document.querySelector('#login-form button[type=submit]').disabled)};
  await page.goto(base+'/demo/');await online();
  await page.locator('#show-register').click();
  await page.locator('#register-username').fill('stabilitytest');await page.locator('#register-email').fill('stability@example.invalid');
  await page.locator('#register-password').fill('Synthetic-Stability-123');await page.locator('#register-confirm-password').fill('Synthetic-Stability-123');
  await page.locator('#register-form button[type=submit]').click();await page.locator('#login-panel').waitFor({state:'visible'});
  await page.locator('#login-username').fill('stabilitytest');await page.locator('#login-password').fill('wrong-password');await button.click();
  await page.waitForFunction(()=>document.querySelector('#auth-message').textContent.includes('ไม่ถูกต้อง'));
  const message=await page.locator('#auth-message').textContent();
  await page.evaluate(()=>window.demoServer.check());assert.equal(await page.locator('#auth-message').textContent(),message);
  const stopped=Date.now();await close(backend);await state('offline');
  results.push({check:'real local backend stop detected by automatic polling',ms:Date.now()-stopped});
  assert.equal(await button.isDisabled(),true);assert.equal(await page.locator('#auth-message').textContent(),message);
  let loginRequests=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/login'))loginRequests++});
  await page.locator('#login-password').press('Enter');assert.equal(loginRequests,0);
  await page.screenshot({path:path.join(output,'offline-desktop.png'),fullPage:true});
  const offlinePage=await context.newPage();await offlinePage.goto(base+'/demo/');await offlinePage.waitForFunction(()=>window.demoServer?.state==='offline');
  assert.equal(await offlinePage.locator('#login-form button[type=submit]').isDisabled(),true);
  const started=Date.now();backend=createServer({root});await new Promise(r=>backend.listen(port,'127.0.0.1',r));
  await online();await offlinePage.waitForFunction(()=>window.demoServer?.state==='online');
  results.push({check:'automatic recovery on both existing and offline-first pages',ms:Date.now()-started});await offlinePage.close();
  assert.equal(await page.locator('#auth-message').textContent(),message);

  // Concurrent form submits must make exactly one POST, even with a delayed reply.
  let release, intercepted;const interception=new Promise(r=>intercepted=r);
  await page.route('**/api/auth/login',async route=>{const blocked=new Promise(r=>release=r);intercepted();await blocked;await route.continue()});
  await page.locator('#login-password').fill('Synthetic-Stability-123');
  const submitted=page.waitForRequest('**/api/auth/login');
  await page.evaluate(()=>{const f=document.querySelector('#login-form');f.requestSubmit();f.requestSubmit()});
  await submitted;
  await interception;
  assert.equal(loginRequests,1);release();await page.locator('#demo-workspace').waitFor({state:'visible'});await page.unroute('**/api/auth/login');
  results.push({check:'login single flight and real authentication',passed:true});

  // Lose a mutation reply after the backend accepts it. Never replay on recovery.
  let mutations=0;await page.route('**/api/analyze',async route=>{mutations++;await route.abort('failed')});
  await page.evaluate(async()=>{try{await runProcessingJob('/analyze',{fileId:'00000000-0000-4000-8000-000000000000'},()=>{})}catch{}});
  await state('offline');await page.evaluate(()=>window.demoServer.check());await state('online');
  await page.evaluate(()=>window.demoServer.check());assert.equal(mutations,1);await page.unroute('**/api/analyze');
  results.push({check:'failed Analyze POST is never replayed on recovery',passed:true});

  // Keep selected local data while offline, expire the session, then resume.
  await page.locator('#audio-file').setInputFiles({name:'preserved.wav',mimeType:'audio/wav',buffer:Buffer.alloc(44)});
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await state('offline');
  assert.equal(await page.locator('#upload-button').isDisabled(),true);assert.match(await page.locator('#file-name').textContent(),/preserved/);
  await context.clearCookies();await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'))});
  await online();assert.equal(await page.locator('#demo-workspace').isHidden(),true);assert.match(await page.locator('#auth-message').textContent(),/เซสชันหมดอายุ/);
  results.push({check:'offline preserves selection; resumed expired session returns to login',passed:true});

  // Old health must not authorize a login. Advance only the app's wall clock.
  await page.evaluate(()=>{const real=Date.now;Date.now=()=>real()+21000});
  await page.route('**/api/health?*',route=>route.fulfill({status:200,contentType:'text/html',body:'<html>tunnel error</html>'}));
  await page.locator('#login-password').fill('Synthetic-Stability-123');const before=loginRequests;await button.click();
  await state('offline');assert.equal(loginRequests,before);assert.equal(await button.isDisabled(),true);
  await page.unroute('**/api/health?*');await page.evaluate(()=>window.demoServer.check());await online();
  results.push({check:'stale health and HTML response block credential submission',passed:true});

  // The login request fails in flight; finally must leave controls disabled.
  await page.route('**/api/auth/login',route=>route.abort('failed'));await button.click();await state('offline');
  assert.equal(await button.isDisabled(),true);await page.unroute('**/api/auth/login');
  await page.evaluate(()=>window.demoServer.check());await online();
  results.push({check:'offline during login leaves button disabled and sends no retry',passed:true});
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(output,'login-'+width+'.png'),fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.evaluate(()=>[...document.styleSheets].every(s=>s.cssRules.length>0)));
  }
  assert.deepEqual(errors,[]);results.push({check:'desktop/mobile styles and JavaScript errors',passed:true});
 }finally{await browser?.close();await close(web);await close(backend);fs.rmSync(root,{recursive:true,force:true});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({timestamp:new Date().toISOString(),results,errors},null,2))}
 console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
