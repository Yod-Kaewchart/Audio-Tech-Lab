'use strict';
// Real local backend/audio worker, isolated admin; no production or external AI credentials.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../server/upload-server.js'), {createWebServer}=require('../server/web-server.cjs');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
const close=async s=>{if(s?.listening){s.closeAllConnections();await new Promise(r=>s.close(r));}};
function wave(){const n=12*8000,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(5000*Math.sin(2*Math.PI*440*i/8000)),44+i*2);return b;}
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atl-perf-ui-')),out=path.resolve(__dirname,'runtime/performance-ui');fs.mkdirSync(out,{recursive:true});
 let backend,web,browser; const report={layouts:[],errors:[],failures:[],unexpectedResponses:[]};
 try{
  backend=createServer({root});await listen(backend);web=createWebServer({backendPort:backend.address().port});await listen(web);
  const base='http://127.0.0.1:'+web.address().port;fs.writeFileSync(path.join(root,'tools/runtime/state.json'),JSON.stringify({webUrl:base}));
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.failures.push(new URL(r.url()).pathname));
  page.on('response',r=>{if(r.status()>=400)report.unexpectedResponses.push({path:new URL(r.url()).pathname,status:r.status()});});
  const temporary=fs.readFileSync(path.join(root,'tools/runtime/security/first-login.txt'),'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
  let r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'yod',password:temporary}});assert.equal(r.status(),200);const me=await r.json();
  r=await context.request.post(base+'/api/auth/password',{headers:{Origin:base,'X-CSRF-Token':me.csrf},data:{currentPassword:temporary,newPassword:'Synthetic-Perf-Admin-123'}});assert.equal(r.status(),200);
  let storageReads=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/admin/storage')storageReads++;});
  await page.goto(base+'/demo/');await page.locator('#demo-workspace').waitFor({state:'visible'});assert.equal(storageReads,0);
  await page.locator('#audio-file').setInputFiles({name:'performance.wav',mimeType:'audio/wav',buffer:wave()});
  await page.locator('#upload-button').click();await page.waitForFunction(()=>!document.querySelector('#analyze-button').disabled);
  await page.locator('#analyze-button').click();await page.locator('#waveform-panel').waitFor({state:'visible',timeout:45000});
  await page.locator('#uploads-list .upload-file-row').filter({hasText:'performance.wav'}).waitFor({timeout:10000});
  await page.evaluate(async()=>{await refreshProcessingJobs();window.queueChanges=0;new MutationObserver(m=>window.queueChanges+=m.length).observe(document.querySelector('#processing-jobs'),{childList:true,subtree:true});await refreshProcessingJobs();await refreshProcessingJobs();});
  report.unchangedQueueMutations=await page.evaluate(()=>window.queueChanges);assert.equal(report.unchangedQueueMutations,0);
  report.resizeDraws=await page.evaluate(async()=>{await new Promise(requestAnimationFrame);const c=waveformCanvas.getContext('2d'),original=c.clearRect;let draws=0;c.clearRect=function(...args){draws++;return original.apply(this,args)};for(let i=0;i<40;i++)window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);c.clearRect=original;return draws;});assert.equal(report.resizeDraws,1);
  async function layout(name,width){
   await page.setViewportSize({width,height:900});
   const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    offscreen:[...document.querySelectorAll('main button,main input,main select,.demo-tool-nav a')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left < -1 || r.right>innerWidth+1);}).map(e=>e.id||e.className)}));
   assert.ok(result.scroll<=width,name+' overflow at '+width);assert.deepEqual(result.offscreen,[],name+' controls at '+width);
   await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});report.layouts.push({name,...result});
  }
  for(const width of [390,768,1024,1440]){
   await layout('split-history',width);
   for(const [toggle,name,panel] of [['#ai-integrations-toggle','integrations','#ai-integrations-panel'],['#storage-toggle','storage','#admin-storage-panel'],['#activity-toggle','activity','#admin-activity-panel']]){
    await page.locator(toggle).click();await page.locator(panel).waitFor({state:'visible'});
    await page.waitForLoadState('networkidle');await layout(name,width);await page.locator(toggle).click();
   }
  }
  for(const [route,id,name] of [['merge/','#merge-workspace','merge'],['qc/','#qc-workspace','qc']]){
   await page.goto(base+'/demo/'+route);await page.locator(id).waitFor({state:'visible'});
   for(const width of [390,768,1024,1440])await layout(name,width);
  }
  await page.goto(base+'/demo/');await page.locator('#demo-workspace').waitFor({state:'visible'});await page.locator('#logout-button').click();await page.locator('#login-panel').waitFor({state:'visible'});
  for(const width of [390,768,1024,1440])await layout('login',width);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failures,[]);assert.deepEqual(report.unexpectedResponses,[]);
 }finally{
  await browser?.close();await close(web);await close(backend);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
  assert.ok(root.startsWith(path.join(os.tmpdir(),'atl-perf-ui-')));await fs.promises.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
