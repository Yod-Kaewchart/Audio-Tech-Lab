'use strict';
const path=require('node:path');
const {fail,opaque,shape}=require('./common.cjs');
const HOST='atl-media://app/playback-host.html';
function validateCommand(arg){
 const noValue=['play','toggle','pause','stop','next','previous'];
 if(!arg||typeof arg!=='object')fail('INVALID_REQUEST','คำสั่ง Player ไม่ถูกต้อง');
 if(arg.type==='play'&&Object.hasOwn(arg,'trackId')){shape(arg,['type','trackId']);if(!opaque(arg.trackId))fail('INVALID_REQUEST','รหัสเพลงไม่ถูกต้อง');}
 else if(noValue.includes(arg.type))shape(arg,['type']);
 else if(['seek','volume','mute','shuffle','repeat','artwork'].includes(arg.type)){
  shape(arg,['type','value']);const v=arg.value;
  const valid=arg.type==='seek'?Number.isFinite(v)&&v>=0:arg.type==='volume'?Number.isFinite(v)&&v>=0&&v<=1:['mute','shuffle'].includes(arg.type)?typeof v==='boolean':arg.type==='repeat'?['off','one','all'].includes(v):['logo','cover'].includes(v);
  if(!valid)fail('INVALID_REQUEST','ค่า Player ไม่ถูกต้อง');
 }else fail('INVALID_REQUEST','คำสั่ง Player ไม่ถูกต้อง');
 return arg;
}
// One private renderer owns the audio element for the entire app session.
// UI documents can be replaced without replacing this renderer or its media pipeline.
class Playback {
 constructor({BrowserWindow,ipcMain,onState}){
  this.ipc=ipcMain;this.pending=new Map();this.serial=0;this.closed=false;this.onState=onState;
  this.window=new BrowserWindow({show:false,skipTaskbar:true,webPreferences:{preload:path.join(__dirname,'playback-preload.cjs'),backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:false}});
  const wc=this.window.webContents;wc.setWindowOpenHandler(()=>({action:'deny'}));wc.on('will-attach-webview',e=>e.preventDefault());wc.on('will-navigate',(e,url)=>{if(url!==HOST)e.preventDefault();});
  this.window.on('close',event=>{if(!this.closed)event.preventDefault();});
  this.receive=(event,message)=>{
   if(this.closed||this.window.isDestroyed()||event.sender!==wc||event.senderFrame!==wc.mainFrame||event.senderFrame.url!==HOST)return;
   if(message?.kind==='state'){this.state=message.state;this.onState?.(this.state);}
   else if(message?.kind==='reply'){
    const request=this.pending.get(message.id);if(!request)return;this.pending.delete(message.id);clearTimeout(request.timer);
    if(message.error)request.reject(Object.assign(new Error(message.error.message),{code:'PLAYBACK_FAILED'}));else request.resolve(message.state);
   }
  };
  ipcMain.on('atl:playback-host',this.receive);
  wc.on('render-process-gone',()=>{
   this.failed=true;const message='ตัวเล่นเสียงหยุดทำงาน กรุณาปิดแล้วเปิดโปรแกรมใหม่';this.rejectPending(message);
   if(this.state){const now=Date.now();this.state={...this.state,sequence:this.state.sequence+1,status:'error',paused:true,intent:false,loading:false,spinning:false,error:message,discMs:this.state.discMs+(this.state.spinning?Math.max(0,now-this.state.sampledAt):0),sampledAt:now};this.onState?.(this.state);}
  });
 }
 async init(){await this.window.loadURL(HOST);await this.command({type:'state'});this.ready=true;return this;}
 command(command){
  if(this.failed)return command.type==='state'?Promise.resolve(this.state):Promise.reject(Object.assign(new Error('ตัวเล่นเสียงหยุดทำงาน กรุณาปิดแล้วเปิดโปรแกรมใหม่'),{code:'PLAYBACK_FAILED'}));
  if(this.closed||this.window.isDestroyed())return Promise.reject(Object.assign(new Error('ตัวเล่นเสียงไม่พร้อม'),{code:'PLAYBACK_FAILED'}));
  const id=++this.serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Object.assign(new Error('ตัวเล่นเสียงไม่ตอบกลับ'),{code:'PLAYBACK_FAILED'}));},10000);
   this.pending.set(id,{resolve,reject,timer});this.window.webContents.send('atl:playback-command',{id,command});
  });
 }
 rejectPending(message){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Object.assign(new Error(message),{code:'PLAYBACK_FAILED'}));}this.pending.clear();}
 async close(){
  if(this.closing)return this.closing;
  this.closing=(async()=>{try{if(this.ready&&!this.closed&&!this.failed&&!this.window.isDestroyed())await this.command({type:'shutdown'});}finally{this.closed=true;this.rejectPending('ปิดตัวเล่นแล้ว');this.ipc.removeListener('atl:playback-host',this.receive);if(!this.window.isDestroyed())this.window.destroy();}})();
  return this.closing;
 }
}
module.exports={Playback,HOST,validateCommand};
