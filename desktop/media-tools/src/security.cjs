const {fail}=require('./common.cjs');
const PAGES=new Set(['atl-media://app/download.html','atl-media://app/convert.html']);
function approvedDocument(value){try{const u=new URL(value);u.hash='';return PAGES.has(u.href);}catch{return false;}}
function validateSender(event,window){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==event.sender.mainFrame||!approvedDocument(event.senderFrame.url))fail('INVALID_REQUEST','ไม่อนุญาตคำขอจากหน้าจอนี้');}
module.exports={PAGES,approvedDocument,validateSender};
