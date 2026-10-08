'use strict';
// Actual native-window sizes, packaged/offline fonts, and full-page visual evidence.
const {_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {mainWindow,waitFor}=require('./electron-ui.cjs'),{wave}=require('./fixtures.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const packaged=!!process.env.ATL_THEME_EXE,kind=process.env.ATL_THEME_KIND||(packaged?'portable':'development');
 const out=path.resolve('evidence/home-theme'),run=path.resolve('test-output/home-theme-'+kind+'-'+Date.now());await fs.mkdir(out,{recursive:true});await fs.mkdir(run,{recursive:true});
 const input=path.join(run,'เพลงภาษาไทย ทดสอบสระและวรรณยุกต์.wav');await wave(input,20);
 const reference=JSON.parse(await fs.readFile(path.join(out,'reference.json'),'utf8')).publicDesktop;
 const restrictedPath=path.join(process.env.SystemRoot,'System32');
 const app=await _electron.launch({executablePath:process.env.ATL_THEME_EXE||path.resolve('node_modules/electron/dist/electron.exe'),args:[...packaged?[]:[path.resolve('.')],'--user-data-dir='+path.join(run,'profile')],env:{...process.env,PATH:restrictedPath,Path:restrictedPath,NODE_PATH:'',NODE_OPTIONS:'',ELECTRON_RUN_AS_NODE:undefined}});
 const rows=[],errors=[],requests=[];let page;
 try{
  page=await mainWindow(app);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.waitForSelector('#page-title');await page.waitForLoadState('load');
  const runtime=await app.evaluate(async({app,session})=>{
   // Dead HTTP(S) proxy plus production CSP/self-only protocol: no internet for UI fonts.
   await session.defaultSession.setProxy({mode:'fixed_servers',proxyRules:'http=127.0.0.1:9;https=127.0.0.1:9',proxyBypassRules:'<-loopback>'});
   return {isPackaged:app.isPackaged,appPath:app.getAppPath(),path:process.env.PATH};
  });assert.equal(runtime.isPackaged,packaged);assert.equal(runtime.path,restrictedPath);
  for(const [size,width,height] of [['minimum',360,600],['normal',1280,940]])for(const mode of ['download','convert','player']){
   const window=await app.evaluate(async({BrowserWindow},{width,height,mode})=>{
    const w=BrowserWindow.getAllWindows().find(w=>/^atl-media:\/\/app\/(download|convert|player)\.html/.test(w.webContents.getURL()));
    w.setSize(width,height);await w.loadURL('atl-media://app/'+mode+'.html');
    return {bounds:w.getBounds(),contentBounds:w.getContentBounds(),minimum:w.getMinimumSize(),preferences:{devTools:w.webContents.getLastWebPreferences().devTools}};
   },{width,height,mode});
   await page.waitForSelector('#page-title');await page.evaluate(()=>document.fonts.ready);await waitFor(page,()=>document.fonts.status==='loaded');
   if(mode!=='player')await waitFor(page,()=>document.querySelector('#capability-status').textContent.includes('1.0.0'));
   if(mode==='player'){
    if(await page.locator('.playlist-row').count()===0){await page.locator('#file-input').setInputFiles(input);await waitFor(page,()=>document.querySelectorAll('.playlist-row').length===1&&document.querySelector('#import-status').hidden);}
    await page.locator('.playlist-row').dblclick();await waitFor(page,()=>document.querySelector('#playback-status').textContent==='กำลังเล่น');await page.locator('#play-pause').click();await waitFor(page,()=>document.querySelector('#playback-status').textContent==='พัก');
   }else{await page.locator('#output-name').fill('เพลงภาษาไทย กำลังฟังเสียงต้นฉบับ');}
   await page.mouse.move(0,0);await waitFor(page,color=>getComputedStyle(document.querySelector('.button-primary')).backgroundColor===color,reference.styles['.button-primary'].backgroundColor);
   const details=await page.evaluate(()=>{
    const style=selector=>{const e=document.querySelector(selector);if(!e)return null;const s=getComputedStyle(e);return {fontFamily:s.fontFamily,fontWeight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage};};
    const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('[hidden]')&&!e.classList.contains('visually-hidden');};
    const controls=Array.from(document.querySelectorAll('button,input:not([type=radio]):not([type=file]),select')).filter(visible);
    const overflow=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||e.tagName==='BUTTON'&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1);}).map(e=>e.id||e.className);
    // Thai glyph text ranges must fit visible containers; screenshot QA also checks marks.
    const clippedThai=[];for(const e of document.querySelectorAll('button,label,h2,h3,p,.playlist-title strong,.playlist-title small'))if(visible(e)&&/[\u0e01-\u0e5b]/.test(e.textContent)){
     const range=document.createRange();range.selectNodeContents(e);const box=e.getBoundingClientRect();
     if(Array.from(range.getClientRects()).some(r=>r.width>0&&(r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1)))clippedThai.push(e.id||e.className||e.tagName);
    }
    return {innerWidth,innerHeight,documentWidth:document.documentElement.scrollWidth,body:style('body'),header:style('.site-header'),navigation:style('.tool-nav'),panel:style('.panel'),note:style('.prototype-note'),title:style('h1'),heading:style('h2'),button:style('.button-primary'),input:style('input[type=text]'),dropdown:style('select'),playlist:style('.playlist-row[aria-current=true]'),format:style('.format-option span'),controlFonts:[...new Set(controls.map(e=>getComputedStyle(e).fontFamily))],overflow,clippedThai,fonts:Array.from(document.fonts,f=>({family:f.family,weight:f.weight,status:f.status}))};
   });
   for(const key of ['fontFamily','fontWeight','lineHeight','color','backgroundColor','backgroundImage'])assert.equal(details.body[key],reference.styles.body[key],mode+' body '+key);
   assert.equal(details.header.backgroundColor,reference.styles['.site-header'].backgroundColor);
   assert.equal(details.panel.backgroundColor,reference.styles['.service-card'].backgroundColor);
   assert.equal(details.note.backgroundColor,reference.styles['#web-demo'].backgroundColor);
   assert.equal(details.title.fontWeight,'700');assert.equal(details.heading.fontWeight,'600');
   assert.equal(details.button.backgroundColor,reference.styles['.button-primary'].backgroundColor);assert.equal(details.button.fontWeight,'700');
   assert.deepEqual(details.controlFonts,[reference.styles.body.fontFamily]);assert.equal(details.documentWidth<=details.innerWidth,true);assert.deepEqual(details.overflow,[]);assert.deepEqual(details.clippedThai,[]);
   if(details.input)assert.equal(details.input.backgroundColor,reference.styles['.site-header'].backgroundColor);
   if(details.dropdown)assert.equal(details.dropdown.backgroundColor,reference.styles['.site-header'].backgroundColor);
   if(details.playlist)assert.equal(details.playlist.backgroundColor,reference.styles['#web-demo'].backgroundColor);
   const metrics=await page.evaluate(async reference=>{
    for(const weight of [400,500,600,700]){await document.fonts.load(weight+' 16px "DM Sans"','Audio Tech Labs');await document.fonts.load(weight+' 16px "Noto Sans Thai"','กำลังฟัง');}
    const el=document.createElement('span');el.style.cssText='position:absolute;left:-10000px;white-space:pre;font-family:var(--font-ui);';document.body.append(el);
    const metrics=reference.map(row=>{el.style.fontWeight=row.weight;el.style.fontSize=row.size+'px';el.textContent=row.text;return {...row,width:el.getBoundingClientRect().width};});el.remove();return metrics;
   },reference.metrics);
   for(let i=0;i<metrics.length;i++)assert.equal(metrics[i].width,reference.metrics[i].width,'Public font metrics '+JSON.stringify(metrics[i]));
   details.metrics=metrics;
   const renderedFonts=await app.evaluate(async({BrowserWindow},mode)=>{
    const wc=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='atl-media://app/'+mode+'.html').webContents,d=wc.debugger;
    d.attach('1.3');try{await d.sendCommand('DOM.enable');await d.sendCommand('CSS.enable');const {root}=await d.sendCommand('DOM.getDocument'),result={};
     for(const selector of ['#page-title','h2','.button-primary',mode==='player'?'.playlist-title strong':'.intro-row p']){const {nodeId}=await d.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector});result[selector]=(await d.sendCommand('CSS.getPlatformFontsForNode',{nodeId})).fonts;}return result;
    }finally{d.detach();}
   },mode);
   const used=Object.values(renderedFonts).flat();assert.ok(used.some(f=>f.isCustomFont&&f.familyName.startsWith('DM Sans')));assert.ok(used.some(f=>f.isCustomFont&&f.familyName==='Noto Sans Thai'));assert.ok(used.every(f=>f.isCustomFont));
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,kind+'-'+mode+'-'+size+'-full.png'),fullPage:true});
   const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>/^atl-media:\/\/app\/(download|convert|player)\.html/.test(w.webContents.getURL())).webContents.capturePage()).toPNG().toString('base64'));
   await fs.writeFile(path.join(out,kind+'-'+mode+'-'+size+'.png'),Buffer.from(png,'base64'));
   rows.push({mode,size,window,details,renderedFonts});console.log('PASS '+kind+' '+mode+' '+size+' native '+window.bounds.width+'x'+window.bounds.height+' content '+details.innerWidth+'x'+details.innerHeight);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith('atl-media:')),[]);
  const fonts={},manifest=JSON.parse(await fs.readFile(path.join(out,'font-manifest.json'),'utf8'));for(const name of [...manifest.fonts.map(f=>f.file),'DM-Sans-OFL.txt','Noto-Sans-Thai-OFL.txt']){const source=await fs.readFile(path.resolve('ui/assets',name)),payload=await fs.readFile(path.join(runtime.appPath,'ui/assets',name));assert.equal(sha(source),sha(payload));const publicFont=manifest.fonts.find(f=>f.file===name);if(publicFont)assert.equal(sha(source),publicFont.sha256);fonts[name]={sourceSha256:sha(source),payloadSha256:sha(payload)};}
  await fs.writeFile(path.join(out,kind+'.json'),JSON.stringify({passed:true,at:new Date().toISOString(),executable:process.env.ATL_THEME_EXE||path.resolve('node_modules/electron/dist/electron.exe'),runtime,fonts,rows,errors,requests,limits:['Developer Windows, not a clean VM','HTTP(S) dead proxy + production CSP/self-only request policy; OS internet remains enabled','Native media import uses Playwright file input; no native picker claimed','Download live provider not exercised by visual test']},null,2));
 }catch(e){await fs.writeFile(path.join(out,kind+'-failure.json'),JSON.stringify({passed:false,error:e.stack,rows,errors},null,2));if(page)await page.screenshot({path:path.join(out,kind+'-failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
