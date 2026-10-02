'use strict';
// Real UI, API, SQLite, filesystem and Python audio workers; isolated test accounts/storage.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../server/upload-server.js');
const {createWebServer}=require('../server/web-server.cjs');
const {RETENTION}=require('../server/file-lifecycle.cjs');
const output=path.resolve(__dirname,'../.site-build/delete-qa');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
const close=s=>new Promise(r=>s.close(r));
function wave(){const n=12*8000,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(5000*Math.sin(2*Math.PI*440*i/8000)),44+i*2);return b}
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atl-delete-ui-'));fs.mkdirSync(output,{recursive:true});
 let backend,web,browser;
 const results=[],errors=[];
 try{
  backend=createServer({root,freeBytes:()=>100e9});await listen(backend);web=createWebServer({backendPort:backend.address().port});await listen(web);
  const base='http://127.0.0.1:'+web.address().port;fs.writeFileSync(path.join(root,'tools/runtime/state.json'),JSON.stringify({webUrl:base}));
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext(),adminContext=await browser.newContext();
  const page=await context.newPage(),admin=await adminContext.newPage();
  for(const p of [page,admin]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept())}
  async function api(ctx,route,data){
   const me=await ctx.request.get(base+'/api/auth/me');const value=me.ok()?await me.json():{};
   const response=await ctx.request.fetch(base+'/api'+route,{method:data===undefined?'GET':'POST',headers:{Origin:base,...(value.csrf?{'X-CSRF-Token':value.csrf}:{})},...(data===undefined?{}:{data})});
   return {status:response.status(),data:await response.json()};
  }
  assert.equal((await api(context,'/auth/register',{username:'deleteowner',email:'deleteowner@example.invalid',password:'Synthetic-Delete-Password-123'})).status,201);
  await page.goto(base+'/demo/');await page.locator('#login-username').fill('deleteowner');await page.locator('#login-password').fill('Synthetic-Delete-Password-123');await page.locator('#login-form button[type=submit]').click();await page.locator('#demo-workspace').waitFor({state:'visible'});
  const owner=JSON.parse(fs.readFileSync(path.join(root,'tools/runtime/security/users.json'),'utf8')).users.find(u=>u.username==='deleteowner').id;
  const temp=fs.readFileSync(path.join(root,'tools/runtime/security/first-login.txt'),'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
  assert.equal((await api(adminContext,'/auth/login',{username:'yod',password:temp})).status,200);
  assert.equal((await api(adminContext,'/auth/password',{currentPassword:temp,newPassword:'Synthetic-Admin-Password-123'})).status,200);
  await admin.goto(base+'/demo/');await admin.locator('#demo-workspace').waitFor({state:'visible'});
  function source(id){return fs.readdirSync(path.join(root,'uploads',owner)).find(n=>n.startsWith(id+'-'))}
  const existsOutput=id=>fs.existsSync(path.join(root,'exports',owner,id));
  async function uploadSplit(name='split.wav'){
   await page.locator('#audio-file').setInputFiles({name,mimeType:'audio/wav',buffer:wave()});await page.locator('#upload-button').click();await page.waitForFunction(()=>uploadedFileId&&!document.querySelector('#file-remove').disabled);return page.evaluate(()=>uploadedFileId);
  }
  async function exportSplit(){await page.locator('#export-button').click();await page.waitForFunction(()=>currentExportJobId&&!document.querySelector('#export-button').disabled,{},{timeout:45000});return page.evaluate(()=>currentExportJobId)}
  async function done(route,data){let response=await api(context,route,data);assert.equal(response.status,202);let job=response.data;for(let n=0;['queued','running'].includes(job.status);n++){assert.ok(n<100);await new Promise(r=>setTimeout(r,100));job=(await api(context,'/jobs/'+job.jobId)).data}assert.equal(job.status,'succeeded');return job.result}
  async function failRemove(p,button,errorSelector,check){
   await p.route('**/api/upload/remove',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Injected delete failure'})}));
   await p.locator(button).first().click();await p.locator(errorSelector).filter({hasText:'Remove failed'}).waitFor();await check();await p.unroute('**/api/upload/remove');
  }
  const first=await uploadSplit();await page.locator('#analyze-button').click();await page.locator('#waveform-panel').waitFor({state:'visible',timeout:45000});
  await done('/preview',{fileId:first});assert.ok(fs.existsSync(path.join(root,'previews',owner,first+'.flac')));
  let exported=await exportSplit();assert.ok(existsOutput(exported));
  await page.route('**/api/export/delete',r=>r.fulfill({status:500,contentType:'application/json',body:'{"error":"Injected failure"}'}));
  await page.locator('#delete-export-button').click();await page.waitForFunction(()=>document.querySelector('#export-status').textContent.includes('DELETE FAILED'));
  assert.ok(existsOutput(exported));assert.ok(await page.locator('#download-list a').count()>0);await page.unroute('**/api/export/delete');
  await page.locator('#delete-export-button').click();await page.waitForFunction(()=>currentExportJobId===null);assert.ok(!existsOutput(exported));assert.ok(source(first));
  results.push('Split export: failure preserves UI/disk; successful delete removes disk/history');
  exported=await exportSplit();
  await failRemove(page,'#file-remove','#upload-error',async()=>{assert.ok(source(first));assert.equal(await page.locator('#file-result').isVisible(),true)});
  await page.locator('#file-remove').click();await page.locator('#file-result').waitFor({state:'hidden'});
  assert.ok(!source(first));assert.ok(!existsOutput(exported));assert.ok(!fs.existsSync(path.join(root,'previews',owner,first+'.flac')));
  assert.equal((await api(context,'/jobs')).data.jobs.length,0);assert.equal(await page.locator('#waveform-panel').isVisible(),false);assert.equal(await page.locator('#track-results').isVisible(),false);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#uploads-status').textContent==='No uploaded files on Modify');
  results.push('Split remove: source/preview/export/history gone, waveform/tracks reset, reload stays deleted');
  await page.goto(base+'/demo/merge/');await page.locator('#merge-workspace').waitFor({state:'visible'});
  await page.locator('#merge-files').setInputFiles([{name:'merge-a.wav',mimeType:'audio/wav',buffer:wave()},{name:'merge-b.wav',mimeType:'audio/wav',buffer:wave()}]);
  await page.locator('#upload-tracks').click();await page.waitForFunction(()=>tracks.length===2&&tracks.every(t=>t.uploaded));
  const ids=await page.evaluate(()=>tracks.map(t=>t.id));await page.locator('#album-name').fill('Delete merge');await page.locator('#merge-button').click();await page.locator('#merge-download a').waitFor({timeout:45000});
  const mergeOut=await page.evaluate(()=>currentExportId);assert.ok(existsOutput(mergeOut));
  await page.locator('.play').first().click();await page.waitForFunction(()=>!player.paused);
  await failRemove(page,'.remove','#merge-error',async()=>{assert.equal(await page.locator('.merge-track').count(),2);assert.ok(source(ids[0]))});
  await page.locator('.remove').first().click();await page.waitForFunction(()=>tracks.length===1);assert.ok(!source(ids[0]));assert.ok(source(ids[1]));assert.ok(!existsOutput(mergeOut));assert.equal(await page.locator('#merge-download a').count(),0);
  await page.locator('.remove').click();await page.waitForFunction(()=>tracks.length===0);await page.reload();assert.equal(await page.locator('.merge-track').count(),0);
  results.push('Merge remove: real merged output cascades; other source retained; failures preserve tracks');
  async function uploadQC(name){await page.locator('#qc-file').setInputFiles({name,mimeType:'audio/wav',buffer:wave()});await page.locator('#upload-button').click();await page.waitForFunction(()=>uploadedFileId&&!document.querySelector('#qc-button').disabled);return page.evaluate(()=>uploadedFileId)}
  await page.goto(base+'/demo/qc/');await page.locator('#qc-workspace').waitFor({state:'visible'});const qcId=await uploadQC('qc.wav');
  await page.locator('#qc-button').click();await page.locator('#qc-report').waitFor({state:'visible',timeout:45000});
  await failRemove(page,'#file-remove','#qc-error',async()=>{assert.ok(source(qcId));assert.equal(await page.locator('#qc-report').isVisible(),true)});
  await page.locator('#file-remove').click();await page.locator('#file-result').waitFor({state:'hidden'});assert.ok(!source(qcId));assert.equal(await page.locator('#qc-report').isVisible(),false);
  await page.reload();await page.locator('#qc-workspace').waitFor({state:'visible'});assert.equal(await page.locator('#file-result').isVisible(),false);
  results.push('QC remove: real report/preview reset, source/history deleted, failure preserves report');
  const adminTarget=await uploadQC('admin-delete-target.wav');await done('/qc',{fileId:adminTarget});
  const adminExport=await done('/export',{fileId:adminTarget,format:'flac',boundaries:[]});
  await admin.locator('#storage-toggle').click();await admin.locator('#refresh-admin-storage').click();
  await admin.route('**/api/admin/storage/delete',r=>r.fulfill({status:500,contentType:'application/json',body:'{"error":"Injected admin delete failure"}'}));
  await admin.locator('#admin-storage-list .uploaded-file-row').filter({hasText:'Export '+adminExport.jobId.slice(0,8)}).getByRole('button',{name:'Delete',exact:true}).click();
  await admin.waitForFunction(()=>document.querySelector('#admin-storage-summary').textContent.includes('Injected admin delete failure'));assert.ok(existsOutput(adminExport.jobId));
  await admin.unroute('**/api/admin/storage/delete');
  await admin.locator('#admin-storage-list .uploaded-file-row').filter({hasText:'Export '+adminExport.jobId.slice(0,8)}).getByRole('button',{name:'Delete',exact:true}).click();
  await admin.waitForFunction(id=>![...document.querySelectorAll('#admin-storage-list strong')].some(e=>e.textContent.includes(id.slice(0,8))),adminExport.jobId);assert.ok(!existsOutput(adminExport.jobId));assert.ok(source(adminTarget));
  await admin.locator('#admin-storage-list .uploaded-file-row').filter({hasText:'admin-delete-target.wav'}).getByRole('button',{name:'Delete',exact:true}).click();
  await page.locator('#file-result').waitFor({state:'hidden',timeout:15000});assert.ok(!source(adminTarget));assert.equal((await api(context,'/jobs')).data.jobs.length,0);
  const audit=(await api(adminContext,'/admin/audit?limit=100&type=delete')).data.entries;
  assert.ok(audit.some(e=>e.source==='admin-delete'&&e.resourceId===adminTarget&&e.actorUsername==='yod'&&e.ownerId===owner));
  results.push('Admin Storage: export and foreign-owner source deleted; other tab refreshes from backend; audit retained');
  const expired=await uploadQC('retention.wav');await done('/qc',{fileId:expired});const old=new Date(Date.now()-RETENTION-1000);fs.utimesSync(path.join(root,'uploads',owner,source(expired)),old,old);
  await page.locator('#file-result').waitFor({state:'hidden',timeout:15000});assert.ok(!source(expired));assert.equal((await api(context,'/jobs')).data.jobs.length,0);
  results.push('59-minute cleanup: real server sweep deletes aged source/history and resets active QC view');
  // Partial upload retained after network failure remains removable from the same card.
  await page.route('**/api/upload/chunk',r=>r.fulfill({status:500,contentType:'application/json',body:'{"error":"Injected upload failure"}'}));
  await page.locator('#qc-file').setInputFiles({name:'partial.wav',mimeType:'audio/wav',buffer:wave()});await page.locator('#upload-button').click();await page.waitForFunction(()=>pendingUploadId&&!document.querySelector('#file-remove').disabled);
  const part=await page.evaluate(()=>pendingUploadId);assert.ok(fs.existsSync(path.join(root,'uploads',owner,part+'.part')));await page.unroute('**/api/upload/chunk');
  await page.locator('#file-remove').click();await page.locator('#file-result').waitFor({state:'hidden'});assert.ok(!fs.existsSync(path.join(root,'uploads',owner,part+'.part')));
  results.push('Failed upload: Remove deletes incomplete server session and .part bytes');
  await page.goto(base+'/demo/');await page.locator('#demo-workspace').waitFor({state:'visible'});
  const staleA=await uploadSplit('stale-a.wav'),staleB=await uploadSplit('stale-b.wav');
  await page.locator('#refresh-uploads').click();
  await page.locator('#uploads-list .upload-file-row').filter({hasText:'stale-a.wav'}).getByRole('button',{name:'Analyze',exact:true}).click();
  let release,arrived;const waiting=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
  await page.route('**/api/upload/remove',async r=>{const response=await r.fetch();arrived();await gate;await r.fulfill({response})});
  await page.locator('#file-remove').click();await waiting;
  await page.locator('#uploads-list .upload-file-row').filter({hasText:'stale-b.wav'}).getByRole('button',{name:'Analyze',exact:true}).click();
  release();await page.waitForFunction(()=>!document.querySelector('#file-remove').disabled);
  await page.unroute('**/api/upload/remove');assert.equal(await page.evaluate(()=>uploadedFileId),staleB);assert.ok(!source(staleA));assert.ok(source(staleB));
  await page.locator('#file-remove').click();await page.locator('#file-result').waitFor({state:'hidden'});
  results.push('Stale delete response cannot clear a newly selected source');
  await page.goto(base+'/demo/qc/');await page.locator('#qc-workspace').waitFor({state:'visible'});
  for(const [width,height] of [[1440,900],[390,844],[320,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'qc-after-delete-'+width+'.png'),fullPage:true})}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors,realWorkers:true,isolatedStorage:true},null,2));console.log(JSON.stringify({results,errors},null,2));
 }finally{if(browser)await browser.close();if(web)await close(web);if(backend)await close(backend);fs.rmSync(root,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});
