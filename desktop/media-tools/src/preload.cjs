const {contextBridge,ipcRenderer,webUtils}=require('electron');
const invoke=(method,arg)=>ipcRenderer.invoke('atl:'+method,arg);
contextBridge.exposeInMainWorld('localMedia',Object.freeze({
 getCapabilities:()=>invoke('getCapabilities'),
 playerList:()=>invoke('playerList'),playerPickFiles:()=>invoke('playerPickFiles'),playerPickFolder:()=>invoke('playerPickFolder'),
 playerDrop:files=>invoke('playerDrop',Array.from(files).map(file=>webUtils.getPathForFile(file)).filter(Boolean)),
 playerRemove:trackId=>invoke('playerRemove',trackId),playerReorder:order=>invoke('playerReorder',order),
 playerConfirmReset:()=>invoke('playerConfirmReset'),playerReset:()=>invoke('playerReset'),
 pasteSourceUrl:()=>invoke('pasteSourceUrl'),
 chooseInputFile:()=>invoke('chooseInputFile'),chooseOutputDirectory:()=>invoke('chooseOutputDirectory'),
 inspectUrl:request=>invoke('inspectUrl',request),cancelInspection:request=>invoke('cancelInspection',request),
 startDownload:request=>invoke('startDownload',request),startConvert:request=>invoke('startConvert',request),
 getCurrentJob:()=>invoke('getCurrentJob'),resetFinishedJob:()=>invoke('resetFinishedJob'),cancelJob:request=>invoke('cancelJob',request),openResult:request=>invoke('openResult',request),
 subscribeJob:listener=>{if(typeof listener!=='function')throw new TypeError('listener');const handler=(_event,snapshot)=>listener(snapshot);ipcRenderer.on('atl:job',handler);return ()=>ipcRenderer.removeListener('atl:job',handler);}
}));
