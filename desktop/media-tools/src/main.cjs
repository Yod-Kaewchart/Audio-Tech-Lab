'use strict';
const {app,BrowserWindow,protocol,session,ipcMain,dialog,shell,Menu,clipboard}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {Dependencies}=require('./dependencies.cjs');const {Engine}=require('./engine.cjs');const {reply,fail}=require('./common.cjs');const {validateSender,PAGES,approvedDocument}=require('./security.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'atl-media',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setName('Audio Tech Labs Media Tools');
// One main process/one global job, including attempts to launch another app window.
if(!app.requestSingleInstanceLock()){app.quit();}else{
 let win,engine,closing=false,picker=false;const ui=path.join(__dirname,'../ui');
 const noArg=value=>{if(value!==undefined)fail('INVALID_REQUEST','คำขอไม่ถูกต้อง');};
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(async()=>{
  const vendor=app.isPackaged?path.join(process.resourcesPath,'vendor'):path.join(__dirname,'../vendor');
  const deps=new Dependencies(vendor);try{await deps.load();}catch{}
  engine=await new Engine({deps,dataDir:path.join(app.getPath('userData'),'local-media')}).init();
  protocol.handle('atl-media',async request=>{
   try{const u=new URL(request.url);if(u.hostname!=='app'||u.search||u.hash||request.method!=='GET')return new Response('',{status:403});const name=decodeURIComponent(u.pathname).replace(/^\//,'');
    const allowed=new Set(['download.html','convert.html','media-tools.css','native.css','view.js','adapters.js','controller.js','assets/dm-sans.ttf','assets/noto-sans-thai.ttf']);if(!allowed.has(name))return new Response('',{status:404});
    const body=await fs.readFile(path.join(ui,name));const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf'}[path.extname(name)];
    return new Response(body,{headers:{'Content-Type':type,'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
   }catch{return new Response('',{status:404});}
  });
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('atl-media://app/')}));
  win=new BrowserWindow({width:1280,height:940,minWidth:360,minHeight:600,backgroundColor:'#141719',title:'Audio Tech Labs · Media Tools',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:!app.isPackaged}});
  win.removeMenu();win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(!approvedDocument(url))event.preventDefault();});win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.on('context-menu',(_event,params)=>{
   if(!approvedDocument(params.pageURL)||(!params.isEditable&&!params.selectionText))return;
   const edit=params.editFlags,items=params.isEditable?[
    {role:'undo',label:'เลิกทำ',enabled:edit.canUndo},{role:'redo',label:'ทำซ้ำ',enabled:edit.canRedo},{type:'separator'},
    {role:'cut',label:'ตัด',enabled:edit.canCut},{role:'copy',label:'คัดลอก',enabled:edit.canCopy},
    {role:'paste',label:'วาง',enabled:edit.canPaste},{type:'separator'},{role:'selectAll',label:'เลือกทั้งหมด',enabled:edit.canSelectAll}
   ]:[{role:'copy',label:'คัดลอก',enabled:edit.canCopy}];
   Menu.buildFromTemplate(items).popup({window:win,frame:params.frame||undefined});
  });
  ipcMain.handle('atl:pasteSourceUrl',(event,arg)=>reply(async()=>{
   validateSender(event,win);noArg(arg);engine.assertIdle();
   // Paste only into the focused, enabled URL field. Never return clipboard contents over IPC.
   if(!(await clipboard.readText()).trim())fail('INVALID_REQUEST','กรุณาคัดลอกลิงก์ก่อนกดวางลิงก์');
   validateSender(event,win);engine.assertIdle();
   const ready=await win.webContents.executeJavaScript("location.pathname==='/download.html' && document.activeElement?.id==='source-url' && !document.activeElement.matches(':disabled')");
   if(!ready)fail('INVALID_REQUEST','กรุณาเลือกช่องลิงก์ YouTube ก่อนวาง');
   win.webContents.paste();return {accepted:true};
  }));
  const choose=async(kind)=>{engine.assertIdle();if(picker)fail('BUSY','มีหน้าต่างเลือกไฟล์เปิดอยู่');picker=true;try{const result=await dialog.showOpenDialog(win,kind==='file'?{title:'เลือกไฟล์เสียง',properties:['openFile'],filters:[{name:'Audio',extensions:['wav','flac','mp3','m4a','aac','ogg','opus','aiff','aif','wma','webm']},{name:'All files',extensions:['*']}]}:{title:'เลือกโฟลเดอร์ปลายทาง',defaultPath:app.getPath('downloads'),properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths.length)return null;return kind==='file'?await engine.registerFile(result.filePaths[0]):await engine.registerFolder(result.filePaths[0]);}finally{picker=false;}};
  const handlers={getCapabilities:arg=>{noArg(arg);return engine.capabilities();},chooseInputFile:arg=>{noArg(arg);return choose('file');},chooseOutputDirectory:arg=>{noArg(arg);return choose('folder');},inspectUrl:arg=>engine.inspect(arg),cancelInspection:arg=>engine.cancelInspection(arg),startDownload:arg=>engine.start('download',arg),startConvert:arg=>engine.start('convert',arg),getCurrentJob:arg=>{noArg(arg);return engine.snapshot();},resetFinishedJob:arg=>{noArg(arg);return engine.resetFinishedJob();},cancelJob:arg=>engine.cancelJob(arg),openResult:async arg=>{const result=await engine.result(arg);const error=await shell.openPath(result.path);if(error)fail('ACCESS_DENIED','เปิดผลลัพธ์ไม่ได้ กรุณาตรวจแอปสำหรับเปิดไฟล์');return {opened:true};}};
  for(const [method,handler] of Object.entries(handlers))ipcMain.handle('atl:'+method,(event,arg)=>reply(async()=>{validateSender(event,win);return handler(arg);}));
  engine.on('job',snapshot=>{if(win&&!win.isDestroyed())win.webContents.send('atl:job',snapshot);});
  win.on('close',event=>{
   if(closing)return;const running=engine.busy()&&engine.job.status!=='cleanup-required';const inspecting=[...engine.inspections.values()].some(e=>!e.finished&&!e.control.cancelled);
   if(!running&&!inspecting)return;event.preventDefault();if(picker)return;picker=true;
   dialog.showMessageBox(win,{type:'question',title:'มีงานกำลังทำงาน',message:'ทำงานต่อ หรือยกเลิกและรอให้หยุดก่อนปิด?',buttons:['ทำงานต่อ','ยกเลิกและปิด'],defaultId:0,cancelId:0,noLink:true}).then(async answer=>{picker=false;if(answer.response!==1)return;for(const [requestId] of engine.inspections)await engine.cancelInspection({requestId});if(running){await engine.cancelJob({jobId:engine.job.jobId});await engine.work;}if(engine.job?.status==='cleanup-required'){await dialog.showMessageBox(win,{type:'error',message:engine.job.error.message,detail:'ยังยืนยัน cleanup ไม่ครบ โปรดตรวจตำแหน่งที่แสดงก่อนปิด'});return;}closing=true;win.close();}).catch(()=>{picker=false;});
  });
  await win.loadURL('atl-media://app/download.html');
 }).catch(async e=>{await dialog.showMessageBox({type:'error',message:'เปิด Media Tools ไม่สำเร็จ',detail:String(e.message)});app.quit();});
 app.on('window-all-closed',()=>app.quit());
}
