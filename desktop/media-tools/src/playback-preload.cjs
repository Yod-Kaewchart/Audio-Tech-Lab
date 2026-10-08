'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Private host bridge: no filesystem, dialogs, library mutations or public job IPC.
contextBridge.exposeInMainWorld('playbackHost',Object.freeze({
 receive:listener=>{const handler=(_event,message)=>listener(message);ipcRenderer.on('atl:playback-command',handler);return ()=>ipcRenderer.removeListener('atl:playback-command',handler);},
 publish:message=>ipcRenderer.send('atl:playback-host',message)
}));
