'use strict';
const {app,BrowserWindow,dialog}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const out=path.resolve(__dirname,'../test-output/filename-electron-'+Date.now());
const {Engine}=require('../src/engine.cjs');
const {startRequest}=require('../src/common.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let sent=[];
Engine.prototype.inspect=async()=>({sourceId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',displayName:'Synthetic UI source',metadata:null});
Engine.prototype.start=async function(mode,req){startRequest(req,mode);sent.push({mode,req});return null;};
async function wait(fn,label,ms=14000){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(100);}throw Error('Timed out: '+label);}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 app.setPath('userData',path.join(out,'profile'));
 dialog.showOpenDialog=async()=>({canceled:false,filePaths:[out]});
 require('../src/main.cjs');
 await app.whenReady();
 await wait(()=>BrowserWindow.getAllWindows().length>0,'window');
 const win=BrowserWindow.getAllWindows()[0];
 const evalJs=code=>win.webContents.executeJavaScript(code);
 await wait(()=>evalJs("!!document.querySelector('#output-name')").catch(()=>false),'Download UI');
 assert(await evalJs("!!(document.querySelector('#pick-folder').compareDocumentPosition(document.querySelector('#output-name')) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(document.querySelector('#output-name').compareDocumentPosition(document.querySelector('#start')) & Node.DOCUMENT_POSITION_FOLLOWING)"));
 const fill=async(id,val)=>evalJs("(()=>{const x=document.getElementById("+JSON.stringify(id)+");x.value="+JSON.stringify(val)+";x.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await evalJs("(()=>{const f=document.querySelector('input[name=format][value=FLAC]');f.checked=true;f.dispatchEvent(new Event('change',{bubbles:true}));})()");
 await fill('source-url','https://youtu.be/abcdefghijk');
 await evalJs("document.getElementById('check-link').click()");
 await wait(()=>evalJs("document.getElementById('link-error').textContent==='ตรวจสอบต้นทางแล้ว'"),'source inspected');
 await evalJs("document.getElementById('pick-folder').click()");
 await wait(()=>evalJs("document.getElementById('folder-path').textContent.includes('filename-electron-')"),'folder selected');
 await wait(()=>evalJs("!document.getElementById('start').disabled"),'ready to download: '+await evalJs("document.getElementById('start-help').textContent+' | '+document.getElementById('capability-status').textContent"),25000);
 for(const invalid of ['bad.flac','../path','CON','bad|name']){
  await fill('output-name',invalid);
  assert.equal(await evalJs("document.getElementById('start').disabled"),true,invalid);
  assert.equal(await evalJs("document.getElementById('output-name').getAttribute('aria-invalid')"),'true',invalid);
 }
 await fill('output-name','อัลบั้มทดสอบ Vol.2');
 assert.equal(await evalJs("document.getElementById('start').disabled"),false);
 await evalJs("document.getElementById('start').click()");
 await wait(()=>sent.length===1,'custom request');
 assert.equal(sent[0].req.outputName,'อัลบั้มทดสอบ Vol.2');
 assert.equal(sent[0].req.encoding.format,'flac');
 await fill('output-name','');
 await evalJs("document.getElementById('start').click()");
 await wait(()=>sent.length===2,'fallback request');
 assert.equal(sent[1].req.outputName,'');
 for(const width of [360,390,768,1280]){
  win.setSize(width,900);
  await sleep(200);
  assert.equal(await evalJs('document.documentElement.scrollWidth<=innerWidth'),true,'horizontal scroll '+width);
  if(width===1280){await evalJs("document.getElementById('output-name').scrollIntoView({block:'center'})");const b=await win.webContents.capturePage();await fs.writeFile(path.join(out,'filename-field.png'),b.toPNG());}
 }
 await win.loadURL('atl-media://app/convert.html');
 await wait(()=>evalJs("!!document.querySelector('#start')").catch(()=>false),'Convert');
 assert.equal(await evalJs("document.querySelector('#output-name')===null"),true);
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,checks:['field-order','native-bridge-custom-and-empty','invalid-live-validation','no-scroll-360-390-768-1280','convert-unchanged'],requests:sent},null,2));
 console.log('FILENAME ELECTRON PASS '+out);
 app.quit();
})().catch(async e=>{console.error(e);try{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:false,error:e.stack},null,2));}catch{}app.exit(1);});
