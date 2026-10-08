'use strict';
// A private playback window can finish loading before the visible UI.
async function mainWindow(app){
 for(let i=0;i<1500;i++){
  for(const page of app.windows())if(/^atl-media:\/\/app\/(download|convert|player)\.html(?:#.*)?$/.test(page.url()))return page;
  await new Promise(resolve=>setTimeout(resolve,20));
 }throw Error('Media Tools UI document did not open');
}
// Poll resolved IPC results; a Promise itself must never count as a passing predicate.
async function waitFor(page,predicate,arg,options={}){
 const deadline=Date.now()+(options.timeout||30000);
 do{if(await page.evaluate(predicate,arg))return;await new Promise(resolve=>setTimeout(resolve,40));}while(Date.now()<deadline);
 throw Error('Timed out waiting for '+predicate.toString());
}
module.exports={mainWindow,waitFor};
