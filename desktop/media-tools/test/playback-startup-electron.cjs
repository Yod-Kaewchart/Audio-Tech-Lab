'use strict';
const {app,BrowserWindow,dialog,ipcMain}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Playback}=require('../src/playback.cjs');
const mode=process.env.ATL_STARTUP_TEST==='early-close'?'early-close':'failure',root=path.resolve('test-output/playback-startup-'+mode+'-'+Date.now());fs.mkdirSync(root,{recursive:true});app.setPath('userData',path.join(root,'profile'));
const original=Playback.prototype.init;let messages=0;
dialog.showMessageBox=async()=>{messages++;return {response:0};};
Playback.prototype.init=async function(){if(mode==='failure')throw Error('Injected host initialization failure');process.nextTick(()=>BrowserWindow.getAllWindows().find(w=>w!==this.window).close());return original.call(this);};
app.on('will-quit',()=>{try{assert.equal(BrowserWindow.getAllWindows().length,0);assert.equal(ipcMain.listenerCount('atl:playback-host'),0);assert.equal(messages,mode==='failure'?1:0);fs.writeFileSync(path.join(root,'results.json'),JSON.stringify({passed:true,mode,windows:0,ipcListeners:0,messages},null,2));console.log('PLAYBACK STARTUP PASS '+mode+' '+root);}catch(e){console.error(e);process.exitCode=1;}});
require('../src/main.cjs');
